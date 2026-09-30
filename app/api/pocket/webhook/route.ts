import { after, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { pocketTimestamp, verifyPocketSignature } from "@/lib/pocket/signature";
import { webhookRecordingId } from "@/lib/pocket/parse";
import { syncOne } from "@/lib/pocket/recordings";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Pocket webhook receiver (register it in the Pocket app: Integrations ->
 * Webhooks, URL https://<site>/api/pocket/webhook, secret = POCKET_WEBHOOK_SECRET).
 *
 * Security model:
 *  - HMAC-SHA256 signature over "{timestamp}.{rawBody}" (X-HeyPocket-Signature),
 *    constant-time compare, stale timestamps rejected.
 *  - The payload is only used for the recording id: the recording itself is
 *    re-fetched from the Pocket API with our key, so nothing in the body is
 *    trusted as content.
 *  - Idempotent: sync upserts on pocket_id, so at-least-once delivery is safe.
 *  - Responds 200 immediately and syncs after the response (Pocket times out
 *    at 30s).
 *
 * CSRF is exempted for this exact path in proxy.ts.
 */

const SYNC_EVENTS = new Set([
  "recording.created",
  "transcription.completed",
  "transcript.edited",
  "summary.completed",
  "summary.regenerated",
  "summary.updated",
  "action_items.regenerated",
  "action_items.updated",
  "speakers.labeled",
]);

export async function POST(request: Request) {
  if (!(await rateLimit(`pocket:webhook:${clientIp(request)}`, 120, 60_000))) {
    return rateLimitResponse();
  }

  const secret = process.env.POCKET_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const ok = verifyPocketSignature({
    secret,
    rawBody,
    signature: request.headers.get("x-heypocket-signature"),
    timestamp: pocketTimestamp(request.headers, payload),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  const event = String((payload as { event?: unknown }).event ?? "");
  const recordingId = webhookRecordingId(payload);
  if (!SYNC_EVENTS.has(event) || !recordingId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  after(async () => {
    try {
      await syncOne(recordingId);
    } catch (err) {
      console.error("[/api/pocket/webhook] sync failed", event, recordingId, err);
    }
  });
  return NextResponse.json({ received: true });
}
