import { getSupabase } from "@/lib/supabase";

/**
 * Exactly-once processing for inbound webhooks that are NOT naturally
 * idempotent (e.g. a Cal.com booking that creates a lead). Providers deliver
 * at least once, so the first claim of (provider, event_id) wins and every
 * retry after it is a no-op.
 *
 * "claimed"   first delivery: process it
 * "duplicate" already claimed: acknowledge and skip
 * "error"     storage failed: return 5xx so the provider retries later
 */
export async function claimInboundEvent(
  provider: string,
  eventId: string
): Promise<"claimed" | "duplicate" | "error"> {
  const sb = getSupabase();
  if (!sb) return "error";
  const { error } = await sb
    .from("inbound_webhook_events")
    .insert({ provider, event_id: eventId.slice(0, 300) });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  console.error("[inbound-webhook] claim failed", { provider, error: error.message });
  return "error";
}

/** Undo a claim when processing failed, so the provider's retry is not swallowed. */
export async function releaseInboundEvent(provider: string, eventId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("inbound_webhook_events")
    .delete()
    .eq("provider", provider)
    .eq("event_id", eventId.slice(0, 300));
}
