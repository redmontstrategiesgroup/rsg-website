import { deliverBatch, enqueue } from "@/lib/webhooks/outbox";

/**
 * Scheduling webhooks — now a thin adapter over the shared outbox
 * (lib/webhooks/outbox.ts).
 *
 * This file used to contain its own enqueue-and-deliver loop, which had four
 * structural faults: no claim before sending (so two overlapping cron runs sent
 * every event twice), no backoff (so a brief outage burned the whole retry
 * budget in seconds), 4xx retried like 5xx, and `failed` as a terminal state
 * with no replay path. See the migration
 * `20260728000000_webhook_outbox_hardening.sql` for the full account.
 *
 * The signatures below are unchanged so the nine existing call sites in
 * booking.ts, qualify-flow.ts and reminders.ts keep working.
 */

/**
 * Queue an event for delivery to every subscribed endpoint.
 *
 * `eventId` should be a stable identity for the DOMAIN event — it is what lets
 * both this outbox and the receiver collapse duplicates. Pick something that
 * distinguishes genuine repeat occurrences: a booking can be rescheduled more
 * than once, so `booking.rescheduled:<id>` alone would silently swallow the
 * second reschedule. Include the new start time.
 *
 * Omitting it falls back to a per-delivery identity, which means duplicates
 * cannot be detected on either side.
 */
export async function enqueueWebhook(
  eventType: string,
  payload: Record<string, unknown>,
  opts?: { eventId?: string }
): Promise<void> {
  await enqueue({
    eventType,
    eventId: opts?.eventId,
    payload,
    kind: "client",
  });
}

/**
 * Attempt a batch of due deliveries.
 *
 * Returns the original `{ delivered, failed }` shape the cron route logs, plus
 * the newer counters. `failed` deliberately still counts retrying + dead: the
 * cron's audit metadata has always meant "did not get through this tick", and
 * quietly changing that number's meaning would make historical runs
 * incomparable.
 */
export async function deliverPendingWebhooks(limit = 20): Promise<{
  delivered: number;
  failed: number;
  retrying: number;
  dead: number;
  released: number;
}> {
  const result = await deliverBatch(limit);
  return {
    delivered: result.delivered,
    failed: result.retrying + result.dead,
    retrying: result.retrying,
    dead: result.dead,
    released: result.released,
  };
}

export { replayDeadLetters, outboxHealth } from "@/lib/webhooks/outbox";
