import { getSupabase } from "@/lib/supabase";
import { deliverBatch, enqueue } from "@/lib/webhooks/outbox";
import type { EventType } from "@/lib/webhooks/catalog";

/**
 * The one way to publish a domain event.
 *
 * Fans the event out to subscriber endpoints (kind 'client', signed RSG
 * payloads for n8n / Zapier / custom receivers) and Slack endpoints (kind
 * 'slack'), then starts delivery straight away instead of waiting for the
 * nightly cron, which remains the retry safety net.
 *
 * Never throws and never blocks on delivery: an event that cannot be sent
 * must not fail the booking, payment or form submission that produced it.
 */
export async function emitEvent(
  type: EventType,
  data: Record<string, unknown>,
  opts?: { eventId?: string }
): Promise<void> {
  if (!getSupabase()) return;
  try {
    await ensureSlackEndpoint();
    const [client, slack] = await Promise.all([
      enqueue({ eventType: type, eventId: opts?.eventId, payload: data, kind: "client" }),
      enqueue({ eventType: type, eventId: opts?.eventId, payload: data, kind: "slack" }),
    ]);
    if (client.queued + slack.queued > 0) await deliverSoon();
  } catch (err) {
    console.error("[emitEvent] failed", {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Deliver after the response is sent. `after` only exists inside a request;
 * from a cron or script the claim-based batch runs inline-async instead (the
 * cron sweep catches anything a killed function leaves behind).
 */
async function deliverSoon(): Promise<void> {
  const run = async () => {
    try {
      await deliverBatch(10);
    } catch (err) {
      console.error("[emitEvent] immediate delivery failed", err instanceof Error ? err.message : err);
    }
  };
  try {
    // Loaded lazily: this module is reachable from code the plain-Node test
    // runner imports, where "next/server" does not resolve.
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}

let slackSync: Promise<void> | null = null;
let slackSyncedUrl: string | null = null;

/**
 * SLACK_WEBHOOK_URL (a Slack incoming-webhook URL) is mirrored into
 * webhook_endpoints as a kind='slack' endpoint, so Slack gets the outbox's
 * retries, backoff and dead-lettering for free. Empty `events` means the
 * catalog's Slack defaults. Runs once per process per URL.
 */
async function ensureSlackEndpoint(): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url || !url.startsWith("https://hooks.slack.com/")) return;
  if (slackSyncedUrl === url && slackSync) return slackSync;
  slackSyncedUrl = url;
  slackSync = (async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("webhook_endpoints").upsert(
      {
        url,
        // The outbox requires a secret; Slack authenticates by URL, so this is
        // never sent anywhere.
        secret: "slack-incoming-webhook",
        kind: "slack",
        description: "Slack notifications (SLACK_WEBHOOK_URL)",
        events: [],
        enabled: true,
      },
      { onConflict: "url", ignoreDuplicates: true }
    );
    if (error) {
      slackSync = null;
      console.error("[emitEvent] Slack endpoint sync failed", error.message);
    }
  })();
  return slackSync;
}
