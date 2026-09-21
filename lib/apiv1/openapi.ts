// lib/apiv1/openapi.ts
/**
 * Builds the OpenAPI 3.1 document for `/api/v1` from what already exists:
 * the operation `withApi` stamps on every route handler (method, auth, scopes,
 * body/query/response zod schemas) and the webhook event catalog. Nothing here
 * is hand-maintained per endpoint — add a route with a real `meta.response`
 * and it documents itself; `tests/apiv1-openapi-coverage.test.ts` fails when
 * a route is missing from the document.
 */
import { z } from "zod";
import pkg from "@/package.json" with { type: "json" };
import { SITE_URL } from "@/lib/site";
import { EVENTS, EVENT_TYPES } from "@/lib/webhooks/events";
import { ADMIN_SCOPES, CLIENT_SCOPES } from "./scopes.ts";
import { V1_ROUTES } from "./openapi-routes.ts";
import { operationOf, type RegisteredOperation } from "./registry.ts";
import { SHARED_PARAMETERS, exampleFor, pathParameters, queryToParameters, zodToSchema, type JsonSchema, type OpenApiParameter } from "./json-schema.ts";

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

/** Display order for the reference page; tags not listed sort after these, alphabetically. */
export const TAG_ORDER = ["Account", "Projects", "Tickets", "Briefs", "Files", "Billing", "Webhooks", "Admin", "Public"];

export type OpenApiOperation = {
  operationId: string;
  summary: string;
  tags: string[];
  parameters: OpenApiParameter[];
  requestBody?: { required: true; content: Record<string, { schema: JsonSchema; example?: unknown }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: JsonSchema }> }>;
  security?: { bearerAuth: string[] }[];
  "x-audience": "client" | "admin" | "any" | "public";
  "x-scopes": string[];
  "x-idempotent": boolean;
  "x-rate-limit"?: { limit: number; window_seconds: number };
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  tags: { name: string }[];
  paths: Record<string, Partial<Record<Lowercase<Method>, OpenApiOperation>>>;
  webhooks: Record<string, { post: OpenApiOperation }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, JsonSchema>;
    parameters: Record<string, unknown>;
  };
};

export type RouteModule = { path: string; module: Record<string, unknown> };

const ERROR_SCHEMA: JsonSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "correlation_id"],
      properties: {
        code: {
          type: "string",
          enum: ["unauthenticated", "insufficient_scope", "not_found", "validation_failed", "rate_limited", "idempotency_required", "idempotency_mismatch", "conflict", "unavailable", "internal"],
        },
        message: { type: "string" },
        details: { description: "Field-level details for `validation_failed`; otherwise absent." },
        correlation_id: { type: "string", description: "Echoed in the `x-correlation-id` response header. Quote it when reporting a problem." },
      },
    },
  },
};

const WEBHOOK_HEADERS: OpenApiParameter[] = [
  { name: "x-rsg-signature", in: "header", required: true, description: "Hex HMAC-SHA256 of `${x-rsg-timestamp}.${raw body}` keyed by the endpoint secret.", schema: { type: "string" } },
  { name: "x-rsg-timestamp", in: "header", required: true, description: "Unix time in milliseconds when the delivery was signed; reject if more than 5 minutes from your clock.", schema: { type: "string" } },
  { name: "X-RSG-Event", in: "header", required: true, description: "The event type.", schema: { type: "string" } },
  { name: "X-RSG-Sequence", in: "header", required: true, description: "Per-endpoint monotonic sequence; use it to detect reordering.", schema: { type: "string" } },
  { name: "Idempotency-Key", in: "header", required: true, description: "Stable across retries of the same event — dedupe on it.", schema: { type: "string" } },
];

function audienceOf(op: RegisteredOperation): OpenApiOperation["x-audience"] {
  return op.auth === "none" ? "public" : op.auth;
}

function buildOperation(path: string, op: RegisteredOperation): OpenApiOperation {
  const parameters: OpenApiParameter[] = [...pathParameters(path), ...queryToParameters(op.query)];
  if (op.idempotent) {
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      description: "Unique per logical request (a UUID works). Replays within 24h return the original response.",
      schema: { type: "string", maxLength: 200 },
    });
  }
  const contentType = op.contentType ?? "application/json";
  const body = zodToSchema(op.response, "output");
  // Statuses come from the registration, never from guessing by name: the route
  // author declares what the handler returns and the page documents exactly that.
  const responses: OpenApiOperation["responses"] = {
    [String(op.status ?? 200)]: { description: "Success", content: { [contentType]: { schema: body } } },
  };
  for (const [status, description] of Object.entries(op.extraResponses ?? {})) {
    responses[status] = { description, content: { [contentType]: { schema: body } } };
  }
  responses["4XX"] = { description: "Client error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  responses["5XX"] = { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  const out: OpenApiOperation = {
    operationId: op.operationId,
    summary: op.summary,
    tags: [op.tag],
    parameters,
    responses,
    "x-audience": audienceOf(op),
    "x-scopes": op.scopes,
    "x-idempotent": op.idempotent,
  };
  if (op.body) {
    const example = exampleFor(op.body);
    out.requestBody = { required: true, content: { "application/json": { schema: zodToSchema(op.body, "input"), ...(example !== undefined ? { example } : {}) } } };
  }
  if (op.auth !== "none") out.security = [{ bearerAuth: [] }];
  if (op.rateLimit) out["x-rate-limit"] = { limit: op.rateLimit.limit, window_seconds: Math.round(op.rateLimit.windowMs / 1000) };
  return out;
}

function buildWebhooks(): OpenApiDocument["webhooks"] {
  const out: OpenApiDocument["webhooks"] = {};
  for (const type of EVENT_TYPES) {
    const ev = EVENTS[type];
    const body = z.object({
      id: z.string().describe("Stable event id; identical on every retry"),
      type: z.literal(type),
      sequence: z.number().int().describe("Per-endpoint monotonic counter"),
      created_at: z.string().describe("ISO 8601 timestamp"),
      data: ev.dataSchema,
    });
    out[type] = {
      post: {
        operationId: `webhook_${type.replace(/\./g, "_")}`,
        summary: ev.description,
        tags: ["Webhooks"],
        parameters: WEBHOOK_HEADERS,
        requestBody: { required: true, content: { "application/json": { schema: zodToSchema(body, "output") } } },
        responses: { "2XX": { description: "Acknowledged. 5xx, 408, 429 and timeouts are retried with backoff; other 3xx/4xx are dead-lettered (redirects are never followed)." } },
        "x-audience": ev.audience === "both" ? "any" : ev.audience,
        "x-scopes": [],
        "x-idempotent": true,
      },
    };
  }
  return out;
}

function sortTags(tags: Iterable<string>): { name: string }[] {
  const rank = (t: string) => {
    const i = TAG_ORDER.findIndex((o) => t === o || t.startsWith(`${o} `));
    return i === -1 ? TAG_ORDER.length : i;
  };
  return [...new Set(tags)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((name) => ({ name }));
}

/** Pure core: given loaded route modules, produce the document. */
export function openApiForRoutes(routes: RouteModule[], opts: { version: string; serverUrl: string }): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  const tags = new Set<string>();
  for (const r of [...routes].sort((a, b) => a.path.localeCompare(b.path))) {
    for (const method of METHODS) {
      const op = operationOf(r.module[method]);
      if (!op) continue;
      const item = (paths[r.path] ??= {});
      item[method.toLowerCase() as Lowercase<Method>] = buildOperation(r.path, op);
      tags.add(op.tag);
    }
  }
  const tick = (s: string) => "`" + s + "`";
  const scopeList = `Client keys: ${CLIENT_SCOPES.map(tick).join(", ")}. Admin keys: ${ADMIN_SCOPES.map(tick).join(", ")}.`;
  return {
    openapi: "3.1.0",
    info: {
      title: "Redmont Strategies Group API",
      version: opts.version,
      description: `Versioned JSON API for clients, partners and integrations. Authenticate with \`Authorization: Bearer rsg_live_…\`. Every response is \`{ data }\` (lists add \`meta.next_cursor\`) or \`{ error }\`.\n\n${scopeList}`,
    },
    servers: [{ url: opts.serverUrl }],
    tags: sortTags(tags),
    paths,
    webhooks: buildWebhooks(),
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "rsg_live_…", description: "API key issued in the portal (client keys) or admin (admin keys)." },
      },
      schemas: { Error: ERROR_SCHEMA },
      parameters: SHARED_PARAMETERS,
    },
  };
}

let cached: Promise<OpenApiDocument> | null = null;

/** The document for the real routes; built once per process. */
export function buildOpenApi(): Promise<OpenApiDocument> {
  if (!cached) {
    const building = Promise.all(V1_ROUTES.map(async (r) => ({ path: r.path, module: await r.load() }))).then((routes) =>
      openApiForRoutes(routes, { version: pkg.version, serverUrl: SITE_URL }),
    );
    cached = building;
    // A failed build (a route module that throws on import) must not be pinned for the
    // life of the process — drop it so the next request rebuilds.
    building.catch(() => {
      if (cached === building) cached = null;
    });
  }
  return cached;
}
