import { requireSupabase } from "@/lib/scheduling/db";
import {
  CORRELATION_HEADER,
  currentCorrelationId,
  ensureCorrelationId,
  recordDeadLettered,
  withCorrelation,
  type ErrorClass,
} from "@/lib/integration-log";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, signPayload } from "./sign";

/**
 * Hardened outbound webhook outbox.
 *
 * One delivery pipeline for every outbound webhook: subscriber endpoints
 * (`kind = 'client'`) and the per-app registry sync (`kind = 'registry'`).
 * They differ only in payload and destination, so a second bespoke sender
 * would just be a second place for these bugs to come back.
 *
 * Guarantees, and the honest limits of each:
 *
 *   AT-LEAST-ONCE, NOT EXACTLY-ONCE. A row is claimed, sent, then marked
 *   delivered. If the process dies between the send and the mark, the event is
 *   sent again. That is unavoidable without a distributed transaction across a
 *   network we do not control, so every event carries a stable `event_id` and
 *   receivers MUST dedupe on it. We make duplicates rare and detectable; we do
 *   not make them impossible.
 *
 *   PER-ENDPOINT ORDERING IS BEST-EFFORT. Events are attempted in `sequence`
 *   order per endpoint, but a failed event backs off while later ones proceed,
 *   so arrival order can still differ from production order. The `sequence`
 *   number is what lets a receiver DETECT that rather than be misled by it.
 *   There is deliberately no head-of-line blocking: one broken event must not
 *   freeze an endpoint's entire stream.
 */

const DEFAULT_MAX_ATTEMPTS = 8;
const CLAIM_WORKER = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

export type EnqueueInput = {
  eventType: string;
  /**
   * Stable identity for the DOMAIN event, e.g. `booking.created:${bookingId}`.
   * Two enqueues with the same eventId for the same endpoint collapse into one
   * row, and the receiver dedupes on it. Omitting it means duplicates cannot be
   * detected on either side — only do that for events with genuinely no
   * identity.
   */
  eventId?: string;
  payload: Record<string, unknown>;
  /** Which destination class to fan out to. Defaults to subscriber endpoints. */
  kind?: "client" | "registry";
  /** Restrict to specific endpoints; defaults to all enabled ones that subscribe. */
  endpointIds?: string[];
};

type ClaimedRow = {
  id: string;
  endpoint_id: string;
  event_type: string;
  event_id: string | null;
  sequence: number | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  idempotency_key: string;
  correlation_id: string | null;
  url: string;
  secret: string;
  kind: string;
};

// ---------------------------------------------------------------------------
// Backoff
// ---------------------------------------------------------------------------

/**
 * Exponential backoff with FULL jitter, capped at an hour.
 *
 * Jitter is not decoration. Without it, every delivery that failed during the
 * same outage retries at the same instant on the next tick and re-creates the
 * spike that caused the outage — the classic thundering herd. Full jitter
 * (random over the whole window, not window ± a bit) spreads them properly.
 *
 * attempt 1 → up to 2s, 2 → 4s, 3 → 8s … 8 → capped at 1h.
 */
export function backoffMs(attempt: number, retryAfterSeconds?: number | null): number {
  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds)) {
    // A provider telling us exactly when to come back beats our guess. Still
    // capped: a hostile or broken Retry-After of 30 days must not park an event
    // past anyone's attention span.
    return Math.min(retryAfterSeconds * 1000, 60 * 60 * 1000);
  }
  const ceiling = Math.min(2 ** attempt * 1000, 60 * 60 * 1000);
  return Math.random() * ceiling;
}

/**
 * Is this HTTP status worth retrying?
 *
 * The old deliverer retried every non-2xx identically, so a 400 caused by a
 * malformed payload was re-sent five times and could never succeed — burning
 * the retry budget while telling us nothing. 4xx means "your request is wrong";
 * repeating it unchanged is not a strategy. 408 and 429 are the exceptions:
 * they are about timing, not correctness.
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 400 && status < 500) return false;
  return true; // 5xx and anything unexpected
}

function errorClassForStatus(status: number | null): ErrorClass {
  if (status === null) return "timeout";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "permission_denied";
  if (status === 404) return "not_found";
  if (status >= 400 && status < 500) return "validation";
  return "provider_unavailable";
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Queue an event for every endpoint that subscribes to it.
 *
 * Never throws: a webhook that cannot be queued must not fail the booking that
 * produced it. It is logged loudly instead — an event that vanishes silently at
 * enqueue is invisible to every downstream check, because nothing downstream
 * knows it should have existed.
 */
export async function enqueue(input: EnqueueInput): Promise<{ queued: number }> {
  const kind = input.kind ?? "client";
  try {
    const sb = requireSupabase();
    let query = sb.from("webhook_endpoints").select("*").eq("enabled", true).eq("kind", kind);
    if (input.endpointIds?.length) query = query.in("id", input.endpointIds);

    const { data: endpoints } = await query;
    if (!endpoints?.length) return { queued: 0 };

    const correlationId = ensureCorrelationId(currentCorrelationId());
    let queued = 0;

    for (const ep of endpoints) {
      const subscribed = (ep.events as string[]) ?? [];
      if (
        subscribed.length &&
        !subscribed.includes(input.eventType) &&
        !subscribed.includes("*")
      ) {
        continue;
      }

      const eventId = input.eventId ?? null;

      // Per-endpoint monotonic ordering token, allocated atomically.
      const { data: sequence } = await sb.rpc("next_endpoint_sequence", {
        p_endpoint: ep.id,
      });

      const body = {
        id: eventId ?? `${input.eventType}:${ep.id}:${sequence}`,
        type: input.eventType,
        sequence,
        created_at: new Date().toISOString(),
        data: input.payload,
      };

      const { error } = await sb.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        event_type: input.eventType,
        event_id: eventId,
        sequence,
        payload: body,
        status: "pending",
        attempts: 0,
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        idempotency_key: body.id,
        correlation_id: correlationId,
        next_attempt_at: new Date().toISOString(),
      });

      if (error) {
        // 23505 = unique violation on (endpoint_id, event_id): this domain event
        // is already queued for this endpoint. That is the dedupe working, not a
        // failure — a double-fired enqueue is exactly what it is there for.
        if (error.code === "23505") continue;
        console.error("[outbox] enqueue failed", {
          eventType: input.eventType,
          endpointId: ep.id,
          correlationId,
          error: error.message,
        });
        continue;
      }
      queued += 1;
    }

    return { queued };
  } catch (err) {
    console.error("[outbox] enqueue threw", {
      eventType: input.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
    return { queued: 0 };
  }
}

// ---------------------------------------------------------------------------
// Deliver
// ---------------------------------------------------------------------------

export type DeliveryResult = {
  delivered: number;
  retrying: number;
  dead: number;
  released: number;
};

/**
 * Claim a batch and attempt each one.
 *
 * The claim is what makes concurrent runs safe — see claim_webhook_deliveries()
 * in the migration. Two cron ticks overlapping used to mean the same event was
 * POSTed twice.
 */
export async function deliverBatch(limit = 20): Promise<DeliveryResult> {
  const sb = requireSupabase();

  // Recover rows orphaned by a worker that died mid-flight before claiming new
  // ones, or they sit in 'sending' forever and are never retried by anyone.
  const { data: released } = await sb.rpc("release_stale_webhook_claims");

  const { data: rows, error } = await sb.rpc("claim_webhook_deliveries", {
    p_limit: limit,
    p_worker: CLAIM_WORKER,
  });

  if (error) {
    console.error("[outbox] claim failed", { error: error.message });
    return { delivered: 0, retrying: 0, dead: 0, released: Number(released ?? 0) };
  }

  const claimed = (rows ?? []) as ClaimedRow[];
  const result: DeliveryResult = {
    delivered: 0,
    retrying: 0,
    dead: 0,
    released: Number(released ?? 0),
  };

  for (const row of claimed) {
    // Restore the correlation id captured at enqueue, so the delivery attempt
    // is traceable back to the request that produced the event rather than
    // starting a fresh, unconnected trace inside the cron.
    const outcome = await withCorrelation(
      row.correlation_id ?? ensureCorrelationId(),
      () => attemptDelivery(row)
    );
    result[outcome] += 1;
  }

  return result;
}

async function attemptDelivery(row: ClaimedRow): Promise<"delivered" | "retrying" | "dead"> {
  const sb = requireSupabase();
  const attempt = row.attempts + 1;
  const rawBody = JSON.stringify(row.payload);
  const { signature, timestamp } = signPayload(row.secret, rawBody);

  let status: number | null = null;
  let errorMessage: string | null = null;
  let retryAfter: number | null = null;

  try {
    const res = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: String(timestamp),
        [CORRELATION_HEADER]: row.correlation_id ?? "",
        "X-RSG-Event": row.event_type,
        "X-RSG-Sequence": String(row.sequence ?? ""),
        // The receiver's dedupe key. Stable across every retry of this event —
        // that is the entire contract that makes at-least-once tolerable.
        "Idempotency-Key": row.idempotency_key,
      },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });

    status = res.status;
    if (res.ok) {
      await sb
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          attempts: attempt,
          response_status: status,
          delivered_at: new Date().toISOString(),
          claimed_at: null,
          claimed_by: null,
          last_error: null,
        })
        .eq("id", row.id);
      return "delivered";
    }

    const header = res.headers.get("Retry-After");
    if (header) {
      const parsed = Number(header);
      if (Number.isFinite(parsed)) retryAfter = parsed;
    }
    errorMessage = `HTTP ${status}`;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "delivery failed";
  }

  const permanent = status !== null && !isRetryableStatus(status);
  const exhausted = attempt >= row.max_attempts;
  const giveUp = permanent || exhausted;

  if (giveUp) {
    await sb
      .from("webhook_deliveries")
      .update({
        status: "dead",
        attempts: attempt,
        response_status: status,
        last_error: permanent
          ? `${errorMessage} (permanent — not retried)`
          : `${errorMessage} (attempts exhausted)`,
        dead_lettered_at: new Date().toISOString(),
        claimed_at: null,
        claimed_by: null,
      })
      .eq("id", row.id);

    // Surface it. A dead letter nobody is told about is a lost event with
    // extra steps.
    await recordDeadLettered({
      provider: "internal",
      operation: `webhook.${row.kind}.${row.event_type}`,
      connectionId: row.endpoint_id,
      correlationId: row.correlation_id ?? undefined,
      attempt,
      errorClass: errorClassForStatus(status),
      errorMessage: errorMessage ?? "unknown",
    });

    return "dead";
  }

  await sb
    .from("webhook_deliveries")
    .update({
      status: "pending",
      attempts: attempt,
      response_status: status,
      last_error: errorMessage,
      next_attempt_at: new Date(Date.now() + backoffMs(attempt, retryAfter)).toISOString(),
      claimed_at: null,
      claimed_by: null,
    })
    .eq("id", row.id);

  return "retrying";
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * Re-drive dead-lettered events.
 *
 * This is the step the old deliverer had no answer for: once a row hit `failed`
 * there was no path back, so fixing a broken endpoint still left every event it
 * missed permanently undelivered.
 *
 * Resets attempts to 0 — a replay is a deliberate human decision after the
 * cause was addressed, so it deserves a fresh budget rather than one attempt
 * against an already-exhausted counter.
 */
export async function replayDeadLetters(filter: {
  endpointId?: string;
  eventType?: string;
  since?: Date;
  limit?: number;
}): Promise<{ replayed: number }> {
  const sb = requireSupabase();

  let query = sb.from("webhook_deliveries").select("id").eq("status", "dead");
  if (filter.endpointId) query = query.eq("endpoint_id", filter.endpointId);
  if (filter.eventType) query = query.eq("event_type", filter.eventType);
  if (filter.since) query = query.gte("dead_lettered_at", filter.since.toISOString());

  const { data: rows } = await query
    .order("dead_lettered_at", { ascending: true })
    .limit(filter.limit ?? 100);

  if (!rows?.length) return { replayed: 0 };

  const { error } = await sb
    .from("webhook_deliveries")
    .update({
      status: "pending",
      attempts: 0,
      last_error: null,
      dead_lettered_at: null,
      next_attempt_at: new Date().toISOString(),
    })
    .in("id", rows.map((r) => r.id));

  if (error) {
    console.error("[outbox] replay failed", { error: error.message });
    return { replayed: 0 };
  }

  return { replayed: rows.length };
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * Outbox health, for the health endpoint and alerting.
 *
 * `oldestPendingAgeSeconds` is the number that matters. A growing queue with
 * everything nominally "pending" is what a stopped cron looks like, and counts
 * alone will not show it — the count looks fine right up until it does not.
 */
export async function outboxHealth(): Promise<{
  pending: number;
  sending: number;
  dead: number;
  oldestPendingAgeSeconds: number | null;
}> {
  const sb = requireSupabase();

  const counts = await Promise.all(
    (["pending", "sending", "dead"] as const).map(async (status) => {
      const { count } = await sb
        .from("webhook_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return [status, count ?? 0] as const;
    })
  );

  const { data: oldest } = await sb
    .from("webhook_deliveries")
    .select("created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  const map = Object.fromEntries(counts) as Record<"pending" | "sending" | "dead", number>;
  const oldestAt = oldest?.[0]?.created_at ? new Date(oldest[0].created_at).getTime() : null;

  return {
    pending: map.pending,
    sending: map.sending,
    dead: map.dead,
    oldestPendingAgeSeconds: oldestAt ? Math.round((Date.now() - oldestAt) / 1000) : null,
  };
}
