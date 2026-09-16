import type { ZodError } from "zod";
import { ApiError, errorBody, toApiError } from "./errors.ts";
import { abandonIdempotent, beginIdempotent, completeIdempotent, keylessPrincipalId, requestHash, type IdemDb } from "./idempotency.ts";
import { parseBearer, type ApiKeyRow } from "./keys.ts";
import type { Principal } from "./principal.ts";
import { registerOperation } from "./registry.ts";
import type { ApiConfig, ApiHandler, HandlerResult, RouteHandler } from "./types.ts";
import { recordUsage, templatePath, type UsageDb } from "./usage.ts";

export type PipelineDeps = {
  enabled(): boolean;
  resolveKey(bearer: string | null): Promise<ApiKeyRow | null>;
  resolvePrincipal(key: ApiKeyRow): Promise<Principal | null>;
  rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
  clientIp(request: Request): string;
  idempotency: IdemDb | null; // null → idempotent routes fail with 503 unavailable
  usage: UsageDb | null; // null → skip logging
  now?: () => number;
};

const KEYED_LIMIT = { limit: 600, windowMs: 10 * 60_000 };
const KEYLESS_LIMIT = { limit: 60, windowMs: 10 * 60_000 };
const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Expose-Headers": "x-correlation-id, X-RateLimit-Limit, X-RateLimit-Remaining, Idempotent-Replayed",
    "Access-Control-Max-Age": "86400",
  };
}

export function optionsHandler(): RouteHandler {
  return async () => new Response(null, { status: 204, headers: corsHeaders() });
}

function json(status: number, body: unknown, correlationId: string, extra: Record<string, string> = {}): Response {
  // `extra` (including a handler's own HandlerResult.headers, e.g. Location) is spread FIRST so
  // the pipeline's own Content-Type/x-correlation-id/CORS headers always win and can't be
  // overridden by a handler or an error path.
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extra, "Content-Type": "application/json", "x-correlation-id": correlationId, ...corsHeaders() },
  });
}

function principalIdOf(p: Principal): string {
  return p.type === "client" ? p.portal.client.id : p.adminId;
}

function zodDetails(err: unknown): unknown {
  const z = err as ZodError;
  return typeof (z as { flatten?: unknown }).flatten === "function" ? z.flatten() : undefined;
}

export function withApi<B = undefined, Q = undefined>(
  method: string,
  config: ApiConfig<B, Q>,
  handler: ApiHandler<B, Q>,
  deps: PipelineDeps,
): RouteHandler {
  if (config.auth === "none" && config.scopes?.length) {
    throw new Error(`withApi(${config.meta.operationId}): scopes on an unauthenticated route`);
  }
  registerOperation({ ...config.meta, method, auth: config.auth, scopes: config.scopes ?? [], idempotent: Boolean(config.idempotent) });

  return async (request, ctx) => {
    const now = deps.now ?? Date.now;
    const start = now();
    const correlationId = request.headers.get("x-correlation-id")?.slice(0, 64) || crypto.randomUUID();
    const url = new URL(request.url);
    const ip = deps.clientIp(request); // computed once, up front: used both for the keyless
    // rate-limit bucket below and as the fallback bucket for a bogus/expired bearer (see auth).
    let principal: Principal | null = null;
    let params: Record<string, string> = {};
    let idem: { principalId: string; key: string } | null = null;

    const finish = (res: Response) => {
      if (deps.usage) {
        recordUsage(deps.usage, {
          key_id: principal?.keyId ?? null,
          principal_type: principal?.type ?? null,
          principal_id: principal ? principalIdOf(principal) : null,
          method: request.method,
          path: templatePath(url.pathname, params),
          status: res.status,
          duration_ms: Math.max(0, now() - start),
          ip: deps.clientIp(request),
          correlation_id: correlationId,
        });
      }
      return res;
    };
    const fail = (err: ApiError, extra?: Record<string, string>) => finish(json(err.status, errorBody(err, correlationId), correlationId, extra));

    try {
      if (!deps.enabled()) throw new ApiError(503, "unavailable", "The API is not enabled.");

      // Auth
      const bearer = parseBearer(request.headers.get("authorization"));
      if (bearer) {
        const key = await deps.resolveKey(bearer);
        principal = key ? await deps.resolvePrincipal(key) : null;
        if (!principal) {
          // A bogus/expired bearer still costs a DB lookup (resolveKey/resolvePrincipal above).
          // Charge it against the keyless IP bucket BEFORE rejecting, so a flood of invalid keys
          // can't bypass rate limiting by never producing a principal. A successful auth below
          // is charged only once, against its own api:key:<id> bucket in the rate-limit step.
          if (!(await deps.rateLimit(`api:ip:${ip}`, KEYLESS_LIMIT.limit, KEYLESS_LIMIT.windowMs))) {
            return fail(new ApiError(429, "rate_limited", "Rate limit exceeded."), { "Retry-After": "60" });
          }
          throw new ApiError(401, "unauthenticated", "Invalid API key.");
        }
      } else if (config.auth !== "none") {
        throw new ApiError(401, "unauthenticated", "Missing API key.");
      }
      if (config.auth !== "none" && principal!.type !== config.auth) {
        throw new ApiError(403, "insufficient_scope", "This key cannot access this resource.");
      }
      const required = config.scopes ?? [];
      if (required.length && !required.every((s) => principal!.scopes.includes(s))) {
        throw new ApiError(403, "insufficient_scope", "This key lacks a required scope.", { required });
      }

      // Rate limit
      const rl = config.rateLimit ?? (principal ? KEYED_LIMIT : KEYLESS_LIMIT);
      const rlKey = principal ? `api:key:${principal.keyId}` : `api:ip:${ip}`;
      // Spec deviation (§2.4): X-RateLimit-Limit/Remaining are intentionally NOT emitted in
      // Phase 1 because lib/security.rateLimit() returns only a boolean, not remaining counts.
      if (!(await deps.rateLimit(rlKey, rl.limit, rl.windowMs))) {
        return fail(new ApiError(429, "rate_limited", "Rate limit exceeded."), { "Retry-After": "60" });
      }

      // Query
      const rawQuery: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { if (!Object.hasOwn(rawQuery, k)) rawQuery[k] = v; });
      let query: Q = {} as Q;
      if (config.query) {
        const r = config.query.safeParse(rawQuery);
        if (!r.success) throw new ApiError(422, "validation_failed", "Invalid query.", zodDetails(r.error));
        query = r.data;
      }

      // Body
      let rawBody = "";
      let body: B = undefined as B;
      if (MUTATING.has(request.method)) {
        rawBody = await request.text();
        if (config.body) {
          let parsed: unknown;
          try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { throw new ApiError(422, "validation_failed", "Invalid JSON.", { body: ["invalid JSON"] }); }
          const r = config.body.safeParse(parsed);
          if (!r.success) throw new ApiError(422, "validation_failed", "Invalid request.", zodDetails(r.error));
          body = r.data;
        }
      }

      params = await ctx.params;

      // Idempotency
      if (config.idempotent) {
        const k = request.headers.get("idempotency-key")?.trim() ?? "";
        if (k.length < 8 || k.length > 200) throw new ApiError(400, "idempotency_required", "A valid Idempotency-Key header (8–200 chars) is required.");
        if (!deps.idempotency) throw new ApiError(503, "unavailable", "Idempotency storage is not configured.");
        const principalId = principal ? principalIdOf(principal) : keylessPrincipalId(ip);
        const begun = await beginIdempotent(deps.idempotency, { principalId, key: k, requestHash: requestHash(request.method, url.pathname, rawBody) });
        if (begun.kind === "replay") return finish(json(begun.status, begun.body, correlationId, { "Idempotent-Replayed": "true" }));
        if (begun.kind === "mismatch") throw new ApiError(422, "idempotency_mismatch", "Idempotency-Key was already used with a different request.");
        if (begun.kind === "in_flight") throw new ApiError(409, "conflict", "A request with this Idempotency-Key is still in progress.");
        idem = { principalId, key: k };
      }

      // Handler + envelope + idempotency completion all share one try: any throw here — from the
      // handler itself, or from building/finishing the response — must abandon a "new" idempotent
      // row so a retry re-executes instead of getting stuck in_flight forever.
      try {
        const result: HandlerResult = await handler({ principal, body, query, params, request, correlationId });
        const status = result.status ?? 200;
        const payload = { data: result.data, ...(result.meta ? { meta: result.meta } : {}) };
        if (idem && deps.idempotency) await completeIdempotent(deps.idempotency, { ...idem, status, body: payload });
        return finish(json(status, payload, correlationId, result.headers));
      } catch (err) {
        if (idem && deps.idempotency) await abandonIdempotent(deps.idempotency, idem).catch(() => {});
        throw err;
      }
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.code === "internal") console.error("[apiv1]", correlationId, err);
      return fail(apiErr);
    }
  };
}
