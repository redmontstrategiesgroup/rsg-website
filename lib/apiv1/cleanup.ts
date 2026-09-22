import type { SupabaseClient } from "@supabase/supabase-js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const REQUESTS_TTL_MS = 30 * 24 * 60 * 60_000;

/**
 * Deletes expired `api_idempotency` (24h) and `api_requests` (30d) rows.
 * Run from the scheduling cron; never throws for a normal delete failure
 * beyond what the client itself raises — the cron step catches and reports.
 */
export async function cleanupApiTables(
  sb: SupabaseClient,
  now: number = Date.now(),
): Promise<{ idempotency: number; requests: number }> {
  const idempotencyCutoff = new Date(now - IDEMPOTENCY_TTL_MS).toISOString();
  const requestsCutoff = new Date(now - REQUESTS_TTL_MS).toISOString();

  const { count: idempotencyCount, error: idempotencyError } = await sb
    .from("api_idempotency")
    .delete({ count: "exact" })
    .lt("created_at", idempotencyCutoff);
  if (idempotencyError) throw new Error(`cleanupApiTables: ${idempotencyError.message}`);

  const { count: requestsCount, error: requestsError } = await sb
    .from("api_requests")
    .delete({ count: "exact" })
    .lt("created_at", requestsCutoff);
  if (requestsError) throw new Error(`cleanupApiTables: ${requestsError.message}`);

  return { idempotency: idempotencyCount ?? 0, requests: requestsCount ?? 0 };
}
