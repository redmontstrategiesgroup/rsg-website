/**
 * Integration observability — one structured event per outbound provider call.
 *
 * Every triage answers one question first: is this the PROVIDER, this one
 * CONNECTION, or OUR CODE? The three have completely different responses, and
 * you cannot tell them apart from `console.error(err)`. This module records the
 * fields that separate them:
 *
 *   correlation_id  ties one operation across retries and background jobs
 *   provider / connection_id / tenant_id   the three axes a triage slices on
 *   operation, attempt, status_code, duration_ms
 *   error_class     OUR closed taxonomy, not the provider's string
 *   provider_request_id   what their support team asks for first
 *   outcome         success | retrying | failed | dead_lettered | skipped
 *
 * Two sinks, on purpose:
 *   integration_runs        append-only call log — what you cluster and slice
 *   integration_connections per-connection health — what you ALERT from
 *
 * Instrumentation must never break the call it instruments. Every persistence
 * failure here is swallowed (and reported to Sentry); the provider result is
 * returned or the provider error rethrown unchanged in shape.
 *
 * Server-only. Uses node:async_hooks — do not import from middleware or any
 * edge-runtime module.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { captureException } from "@/lib/observability";

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type Provider =
  | "resend"
  | "stripe"
  | "anthropic"
  | "supabase"
  | "twilio"
  // Not a third party — our own scheduled work. A cron that stopped firing
  // takes the email queue, reminders, and lifecycle jobs down with it and
  // reports nothing, so it needs the same staleness alerting as a provider.
  | "internal";

/**
 * OUR classification, not the provider's. Provider strings change without
 * notice and differ per endpoint, which makes them useless for grouping —
 * this closed set is what makes a dashboard readable and an alert meaningful.
 */
export type ErrorClass =
  | "rate_limited"
  | "auth_expired"
  | "auth_revoked"
  | "permission_denied"
  | "validation"
  | "not_found"
  | "provider_unavailable"
  | "timeout"
  | "our_bug";

export type Outcome =
  | "success"
  | "retrying"
  | "failed"
  | "dead_lettered"
  | "skipped";

/** Error classes that mean the credential is dead until a human re-authorizes. */
const REAUTH_CLASSES: ReadonlySet<ErrorClass> = new Set([
  "auth_expired",
  "auth_revoked",
]);

/** Error classes worth retrying — the failure is transient, not a bad request. */
const RETRYABLE_CLASSES: ReadonlySet<ErrorClass> = new Set([
  "rate_limited",
  "provider_unavailable",
  "timeout",
]);

export function isRetryable(cls: ErrorClass): boolean {
  return RETRYABLE_CLASSES.has(cls);
}

export function needsReauth(cls: ErrorClass): boolean {
  return REAUTH_CLASSES.has(cls);
}

// ---------------------------------------------------------------------------
// Correlation id
//
// Generated at the entry point and propagated through every hop. An id that
// stops at the queue boundary is the reason a triage takes an afternoon
// instead of ten minutes — see carryCorrelationId() in lib/email-jobs.ts for
// the enqueue side.
// ---------------------------------------------------------------------------

export const CORRELATION_HEADER = "x-correlation-id";

const correlationStore = new AsyncLocalStorage<string>();

/** Sanitize an inbound id — it arrives from a header and is echoed into logs. */
function cleanCorrelationId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 64);
  return /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}

/** Reuse an inbound/stored id when there is one; mint a fresh one otherwise. */
export function ensureCorrelationId(existing?: string | null): string {
  return cleanCorrelationId(existing) ?? correlationStore.getStore() ?? randomUUID();
}

/** The id for the operation in flight, if we are inside one. */
export function currentCorrelationId(): string | undefined {
  return correlationStore.getStore();
}

/**
 * Run `fn` with `id` as the ambient correlation id. Everything downstream —
 * nested provider calls, retries, awaited helpers — inherits it without having
 * to thread a parameter through every signature.
 */
export function withCorrelation<T>(id: string, fn: () => T): T {
  return correlationStore.run(id, fn);
}

/** Read the correlation id off an inbound request, minting one if absent. */
export function correlationFromRequest(request: Request): string {
  return ensureCorrelationId(request.headers.get(CORRELATION_HEADER));
}

/**
 * The id to log under, resolved in priority order:
 *
 *   1. explicitly passed by the caller (a resumed queue job)
 *   2. the ambient AsyncLocalStorage store (inside withCorrelation)
 *   3. the INBOUND REQUEST HEADER that middleware set
 *   4. a fresh uuid
 *
 * Step 3 is what stops the trail dying at the route boundary. Middleware mints
 * the id and forwards it on the request headers, but that only reaches a
 * provider call if the route wrapped itself in withCorrelation — and 59 route
 * handlers will not all remember to. Reading the header here makes propagation
 * automatic: a browser error report quoting x-correlation-id joins to the
 * provider call without any per-route code.
 *
 * next/headers throws outside a request scope (cron scripts, tests), which is
 * exactly when there is no header to find, so the throw is the answer.
 */
async function resolveCorrelationId(explicit?: string | null): Promise<string> {
  const known = cleanCorrelationId(explicit) ?? correlationStore.getStore();
  if (known) return known;
  try {
    const { headers } = await import("next/headers");
    const inbound = cleanCorrelationId((await headers()).get(CORRELATION_HEADER));
    if (inbound) return inbound;
  } catch {
    /* not in a request scope — fall through to a fresh id */
  }
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Redaction
//
// Structural, at the logger — not by remembering at each call site. A
// credential in a log is a credential that must be rotated, and the log
// aggregator has a longer retention than the incident.
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/g, // Stripe keys
  /\bwhsec_[A-Za-z0-9]+/g, // Stripe webhook signing secret
  /\bre_[A-Za-z0-9_-]{10,}/g, // Resend API keys
  /\bsk-ant-[A-Za-z0-9_-]{10,}/g, // Anthropic keys
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWTs (Supabase)
  /\b[Bb]earer\s+[A-Za-z0-9._-]+/g, // Authorization headers
  /\bSG\.[A-Za-z0-9_-]{10,}/g, // SendGrid
  /\bAC[0-9a-f]{32}\b/g, // Twilio account SIDs
];

/** Email addresses are business data, but a log aggregator is the wrong home. */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Strip credentials and direct identifiers out of a message before it is
 * persisted. Applied to every error string; call sites do not opt in.
 */
export function redact(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[redacted]");
  out = out.replace(EMAIL_PATTERN, (match) => {
    const at = match.indexOf("@");
    return `${match.slice(0, 1)}***@${match.slice(at + 1)}`;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

type ErrorShape = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  type?: unknown;
  name?: unknown;
  message?: unknown;
  requestID?: unknown;
  requestId?: unknown;
  request_id?: unknown;
  _request_id?: unknown;
};

function asShape(err: unknown): ErrorShape {
  return (err && typeof err === "object" ? err : {}) as ErrorShape;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** HTTP status from whichever field this SDK happens to use. */
export function statusCodeOf(err: unknown): number | null {
  const shape = asShape(err);
  return numeric(shape.status) ?? numeric(shape.statusCode);
}

/**
 * Provider request id, from every spelling in use across our SDKs. Reads from
 * either a successful response or a thrown error:
 *
 *   requestID     Anthropic errors (APIError)
 *   _request_id   Anthropic SUCCESSFUL responses — non-enumerable, so it does
 *                 not survive a spread or JSON round-trip; it has to be read
 *                 directly off the object, which is why this runs on the raw
 *                 provider result rather than a copy of it
 *   requestId     Stripe errors (StripeError)
 *   request_id    plain REST responses
 */
export function providerRequestIdOf(value: unknown): string | null {
  const shape = asShape(value);
  for (const candidate of [
    shape.requestID,
    shape._request_id,
    shape.requestId,
    shape.request_id,
  ]) {
    if (typeof candidate === "string" && candidate) return candidate.slice(0, 128);
  }
  return null;
}

/**
 * Map any provider error into the closed set. Status code first (it is the most
 * portable signal), then SDK-specific codes, then message text as a last resort.
 */
export function classifyError(err: unknown): ErrorClass {
  const shape = asShape(err);
  const status = statusCodeOf(err);
  const name = typeof shape.name === "string" ? shape.name : "";
  const code = typeof shape.code === "string" ? shape.code : "";
  const type = typeof shape.type === "string" ? shape.type : "";
  const message = typeof shape.message === "string" ? shape.message.toLowerCase() : "";

  // Network-level failures never carry a status.
  if (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "timeout";
  }
  if (
    name === "APIConnectionError" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    type === "StripeConnectionError"
  ) {
    return "provider_unavailable";
  }

  if (status !== null) {
    if (status === 401) {
      // 401 with an explicit revocation signal is terminal; a plain 401 is an
      // expired or rotated credential. Both need a human, but the customer-
      // facing wording differs, so keep them distinct.
      return code === "revoked" || message.includes("revoked")
        ? "auth_revoked"
        : "auth_expired";
    }
    if (status === 403) return "permission_denied";
    if (status === 404) return "not_found";
    if (status === 408) return "timeout";
    if (status === 429) return "rate_limited";
    if (status === 422 || status === 400) return "validation";
    if (status >= 500) return "provider_unavailable";
    if (status >= 400) return "validation";
  }

  // Stripe surfaces its class in `type` rather than a status on some paths.
  if (type === "StripeAuthenticationError") return "auth_expired";
  if (type === "StripePermissionError") return "permission_denied";
  if (type === "StripeRateLimitError") return "rate_limited";
  if (type === "StripeInvalidRequestError" || type === "StripeCardError") {
    return "validation";
  }
  if (type === "StripeAPIError") return "provider_unavailable";

  // Nothing matched — most likely our own bug, and worth surfacing as one
  // rather than quietly filing it under "provider problem".
  return "our_bug";
}

// ---------------------------------------------------------------------------
// The error we rethrow
// ---------------------------------------------------------------------------

export class IntegrationError extends Error {
  readonly provider: Provider;
  readonly operation: string;
  readonly errorClass: ErrorClass;
  readonly statusCode: number | null;
  readonly providerRequestId: string | null;
  readonly retryable: boolean;

  constructor(input: {
    provider: Provider;
    operation: string;
    errorClass: ErrorClass;
    statusCode: number | null;
    providerRequestId: string | null;
    message: string;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "IntegrationError";
    this.provider = input.provider;
    this.operation = input.operation;
    this.errorClass = input.errorClass;
    this.statusCode = input.statusCode;
    this.providerRequestId = input.providerRequestId;
    this.retryable = isRetryable(input.errorClass);
  }

  /**
   * What a user or admin should see. Never show the provider's raw error to a
   * user — classify it, log the original.
   */
  get userMessage(): string {
    switch (this.errorClass) {
      case "auth_expired":
      case "auth_revoked":
        return `The ${this.provider} connection needs to be re-authorized.`;
      case "rate_limited":
        return `${this.provider} is rate limiting us — this will retry shortly.`;
      case "provider_unavailable":
      case "timeout":
        return `${this.provider} is not responding right now. This will retry automatically.`;
      case "permission_denied":
        return `Our ${this.provider} connection is missing a required permission.`;
      case "validation":
        return `${this.provider} rejected the request as invalid.`;
      case "not_found":
        return `The requested ${this.provider} record no longer exists.`;
      case "our_bug":
        return "Something went wrong on our side. The team has been notified.";
    }
  }
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export type RunRecord = {
  correlationId: string;
  provider: Provider;
  connectionId: string;
  tenantId: string | null;
  operation: string;
  attempt: number;
  statusCode: number | null;
  durationMs: number;
  errorClass: ErrorClass | null;
  errorMessage: string | null;
  providerRequestId: string | null;
  outcome: Outcome;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * tenant_id is a foreign key to clients(id). A caller passing anything that is
 * not a client uuid — a slug, an app name, a stale id from Stripe metadata —
 * would fail the INSERT and lose the ENTIRE log row, silently, exactly when it
 * is most needed. Drop the attribution instead and keep the record.
 */
function tenantColumn(tenantId: string | null): string | null {
  return tenantId && UUID_RE.test(tenantId) ? tenantId : null;
}

/**
 * Emit the structured line to stdout regardless of whether the database write
 * lands. Vercel retains these, so a Supabase outage does not blind the triage —
 * which matters precisely because a Supabase outage is when you need it most.
 */
function emitStructuredLog(record: RunRecord): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "integration.call",
    correlation_id: record.correlationId,
    provider: record.provider,
    connection_id: record.connectionId,
    tenant_id: record.tenantId,
    operation: record.operation,
    attempt: record.attempt,
    status_code: record.statusCode,
    duration_ms: record.durationMs,
    error_class: record.errorClass,
    provider_request_id: record.providerRequestId,
    outcome: record.outcome,
    ...(record.errorMessage ? { error_message: record.errorMessage } : {}),
  });
  if (record.outcome === "success" || record.outcome === "skipped") {
    console.info(line);
  } else {
    console.error(line);
  }
}

/**
 * Persist one call + fold it into per-connection health.
 *
 * Note the self-reference problem: a failing Supabase call is logged TO
 * Supabase, so it is the one provider whose failures cannot be self-recorded.
 * Those reach Sentry through captureException below, and the stdout line above.
 */
async function persist(record: RunRecord): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const nowIso = new Date().toISOString();
  const succeeded = record.outcome === "success";

  try {
    const { error } = await sb.from("integration_runs").insert({
      correlation_id: record.correlationId,
      provider: record.provider,
      connection_id: record.connectionId,
      tenant_id: tenantColumn(record.tenantId),
      operation: record.operation,
      attempt: record.attempt,
      status_code: record.statusCode,
      duration_ms: record.durationMs,
      error_class: record.errorClass,
      error_message: record.errorMessage,
      provider_request_id: record.providerRequestId,
      outcome: record.outcome,
    });
    if (error) throw error;
  } catch (err) {
    captureException(err, {
      note: "integration_runs insert failed — call log lost for this attempt",
      provider: record.provider,
      operation: record.operation,
    });
  }

  // A `skipped` call (feature unconfigured, nothing to send) says nothing about
  // the connection's health, so it must not reset a failure streak or refresh
  // last_success_at — that would mask a genuinely broken connection.
  if (record.outcome === "skipped" || record.outcome === "retrying") return;

  try {
    // A success always resets the counter to zero, so it needs no read — one
    // round trip instead of two. Only a failure has to read the prior count to
    // increment it. Successes dominate, so this halves the write cost of
    // instrumentation on the common path.
    //
    // The failure read-modify-write races if two failures land concurrently.
    // Low concurrency (one row per connection) and a lost update costs one
    // increment of a counter, not correctness of the underlying call log.
    let consecutiveFailures = 0;
    if (!succeeded) {
      const { data: existing } = await sb
        .from("integration_connections")
        .select("consecutive_failures")
        .eq("provider", record.provider)
        .eq("connection_id", record.connectionId)
        .maybeSingle();
      consecutiveFailures =
        ((existing?.consecutive_failures as number | undefined) ?? 0) + 1;
    }

    const status = succeeded
      ? "healthy"
      : record.errorClass && needsReauth(record.errorClass)
        ? "needs_reauth"
        : consecutiveFailures >= 3
          ? "down"
          : "degraded";

    const { error } = await sb.from("integration_connections").upsert(
      {
        provider: record.provider,
        connection_id: record.connectionId,
        tenant_id: tenantColumn(record.tenantId),
        last_attempt_at: nowIso,
        ...(succeeded
          ? { last_success_at: nowIso }
          : { last_failure_at: nowIso }),
        consecutive_failures: consecutiveFailures,
        last_error_class: succeeded ? null : record.errorClass,
        last_error_message: succeeded ? null : record.errorMessage,
        status,
        updated_at: nowIso,
      },
      { onConflict: "provider,connection_id" }
    );
    if (error) throw error;
  } catch (err) {
    captureException(err, {
      note: "integration_connections upsert failed — health state is stale",
      provider: record.provider,
    });
  }
}

/**
 * Hand the write to the platform's post-response hook so instrumentation never
 * sits in the user's latency path. Outside a request scope (cron, scripts,
 * tests) `after` throws, and we await instead — correct either way.
 */
async function flush(record: RunRecord): Promise<void> {
  emitStructuredLog(record);
  // Start the write exactly once. Calling persist() inside the try would run it
  // again in the catch — every call logged twice outside a request scope.
  const pending = persist(record);
  try {
    const { after } = await import("next/server");
    after(pending);
  } catch {
    await pending;
  }
}

// ---------------------------------------------------------------------------
// The wrapper
// ---------------------------------------------------------------------------

export type CallSpec = {
  provider: Provider;
  /** Dotted and specific: `email.send`, not "sending email". */
  operation: string;
  /** Distinct credential/account. Defaults to the single shared connection. */
  connectionId?: string;
  /** Client id when the call is on a tenant's behalf. */
  tenantId?: string | null;
  /** 1-based. Same correlation id across attempts groups them together. */
  attempt?: number;
  /** Overrides the ambient id — pass when resuming a queued job. */
  correlationId?: string;
  /**
   * Set when the caller will retry this attempt itself. Records `retrying`
   * instead of `failed`, so a first failure in a retry chain does not read as
   * an outage on the dashboard.
   */
  willRetry?: boolean;
  /** Provider-specific override when the generic mapping is wrong. */
  classify?: (err: unknown) => ErrorClass | null;
};

/**
 * Run one provider call, timed, classified, and recorded.
 *
 * Returns the provider's result untouched on success. On failure, records the
 * attempt and throws an IntegrationError whose `.userMessage` is safe to show
 * and whose `.cause` is the original error.
 */
export async function callProvider<T>(
  spec: CallSpec,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = await resolveCorrelationId(spec.correlationId);
  const connectionId = spec.connectionId ?? "default";
  const attempt = spec.attempt ?? 1;
  const startedAt = Date.now();

  const base = {
    correlationId,
    provider: spec.provider,
    connectionId,
    tenantId: spec.tenantId ?? null,
    operation: spec.operation,
    attempt,
  };

  try {
    const result = await withCorrelation(correlationId, fn);
    await flush({
      ...base,
      statusCode: statusCodeOf(result) ?? 200,
      durationMs: Date.now() - startedAt,
      errorClass: null,
      errorMessage: null,
      providerRequestId: providerRequestIdOf(result),
      outcome: "success",
    });
    return result;
  } catch (err) {
    const errorClass = spec.classify?.(err) ?? classifyError(err);
    const statusCode = statusCodeOf(err);
    const providerRequestId = providerRequestIdOf(err);
    const rawMessage = err instanceof Error ? err.message : String(err);
    const errorMessage = redact(rawMessage).slice(0, 500);

    await flush({
      ...base,
      statusCode,
      durationMs: Date.now() - startedAt,
      errorClass,
      errorMessage,
      providerRequestId,
      outcome: spec.willRetry ? "retrying" : "failed",
    });

    // `our_bug` is the class that should wake someone up — the others are
    // expected operational states with defined responses.
    if (errorClass === "our_bug") {
      captureException(err, {
        correlation_id: correlationId,
        provider: spec.provider,
        operation: spec.operation,
      });
    }

    throw new IntegrationError({
      provider: spec.provider,
      operation: spec.operation,
      errorClass,
      statusCode,
      providerRequestId,
      message: errorMessage,
      cause: err,
    });
  }
}

/**
 * Record a call we deliberately did not make (provider unconfigured, nothing
 * to send). Kept out of the health rollup — see persist() — but present in the
 * call log so "why did nothing happen" has an answer.
 */
export async function recordSkipped(
  spec: Pick<CallSpec, "provider" | "operation" | "connectionId" | "tenantId">,
  reason: string
): Promise<void> {
  await flush({
    correlationId: await resolveCorrelationId(),
    provider: spec.provider,
    connectionId: spec.connectionId ?? "default",
    tenantId: spec.tenantId ?? null,
    operation: spec.operation,
    attempt: 1,
    statusCode: null,
    durationMs: 0,
    errorClass: null,
    errorMessage: redact(reason).slice(0, 500),
    providerRequestId: null,
    outcome: "skipped",
  });
}

/**
 * Mark a job as permanently given up on. Distinct from `failed` because a dead
 * letter needs a human, and "any sustained non-zero DLQ arrivals" is its own
 * alert.
 */
export async function recordDeadLettered(input: {
  provider: Provider;
  operation: string;
  connectionId?: string;
  tenantId?: string | null;
  correlationId?: string;
  attempt: number;
  errorClass: ErrorClass;
  errorMessage: string;
}): Promise<void> {
  await flush({
    correlationId: await resolveCorrelationId(input.correlationId),
    provider: input.provider,
    connectionId: input.connectionId ?? "default",
    tenantId: input.tenantId ?? null,
    operation: input.operation,
    attempt: input.attempt,
    statusCode: null,
    durationMs: 0,
    errorClass: input.errorClass,
    errorMessage: redact(input.errorMessage).slice(0, 500),
    providerRequestId: null,
    outcome: "dead_lettered",
  });
}

/**
 * Touch a connection on an INBOUND event (a webhook we received). Catches the
 * failure mode nothing else does: a webhook that silently stopped arriving
 * produces no errors and no logs, only a `last_success_at` that stops moving.
 */
export async function recordInboundEvent(input: {
  provider: Provider;
  operation: string;
  connectionId?: string;
  tenantId?: string | null;
  correlationId?: string;
}): Promise<void> {
  await flush({
    correlationId: await resolveCorrelationId(input.correlationId),
    provider: input.provider,
    connectionId: input.connectionId ?? "webhook",
    tenantId: input.tenantId ?? null,
    operation: input.operation,
    attempt: 1,
    statusCode: 200,
    durationMs: 0,
    errorClass: null,
    errorMessage: null,
    providerRequestId: null,
    outcome: "success",
  });
}

/**
 * Declare how often a connection is EXPECTED to be exercised, so staleness
 * alerting has a baseline. Without this a connection is "on demand" and is
 * never reported stale — a connection nobody called is not a broken one.
 */
export async function setExpectedInterval(
  provider: Provider,
  connectionId: string,
  seconds: number | null
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("integration_connections").upsert(
      {
        provider,
        connection_id: connectionId,
        expected_interval_seconds: seconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,connection_id" }
    );
  } catch (err) {
    captureException(err, { note: "setExpectedInterval failed", provider });
  }
}
