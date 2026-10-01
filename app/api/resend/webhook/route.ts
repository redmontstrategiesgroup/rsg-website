import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { recordInboundEvent } from "@/lib/integration-log";
import { unsubscribeSubscriber } from "@/lib/store";
import { verifySvixSignature } from "@/lib/webhooks/inbound/verify";
import { resendAction } from "@/lib/webhooks/inbound/parse";

export const runtime = "nodejs";

/**
 * Resend delivery-event receiver (registered in Resend -> Webhooks for
 * email.bounced, email.complained, email.suppressed, email.failed,
 * email.delivery_delayed; signing secret = RESEND_WEBHOOK_SECRET).
 *
 * Security model:
 *  - Svix signature (svix-id / svix-timestamp / svix-signature) over the raw
 *    body, constant-time compare, 5-minute replay window.
 *  - The only side effect is suppressing an address, which is idempotent, so
 *    at-least-once delivery needs no separate claim.
 *  - 500 only when the suppression write fails, so Resend retries.
 *
 * CSRF is exempted for this exact path in proxy.ts.
 */
export async function POST(request: Request) {
  if (!(await rateLimit(`resend:webhook:${clientIp(request)}`, 300, 60_000))) {
    return rateLimitResponse();
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const ok = verifySvixSignature({
    secret,
    rawBody,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const action = resendAction(payload);
  await recordInboundEvent({
    provider: "resend",
    operation: `webhook.${String((payload as { type?: unknown }).type ?? "unknown").slice(0, 60)}`,
  });

  if (action.kind === "suppress") {
    const results = await Promise.all(action.emails.map((email) => unsubscribeSubscriber(email)));
    if (results.some((r) => !r)) {
      return NextResponse.json({ error: "Suppression failed." }, { status: 500 });
    }
    console.warn("[/api/resend/webhook] suppressed", { reason: action.reason, count: action.emails.length });
  } else if (action.kind === "log") {
    console.warn("[/api/resend/webhook] delivery problem", { reason: action.reason });
  }

  return NextResponse.json({ received: true });
}
