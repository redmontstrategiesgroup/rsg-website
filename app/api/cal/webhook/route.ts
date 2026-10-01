import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { recordInboundEvent } from "@/lib/integration-log";
import { processLead } from "@/lib/leads";
import { verifyCalSignature } from "@/lib/webhooks/inbound/verify";
import { calEvent } from "@/lib/webhooks/inbound/parse";
import { claimInboundEvent, releaseInboundEvent } from "@/lib/webhooks/inbound/claim";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cal.com booking receiver (register in Cal.com -> Settings -> Developer ->
 * Webhooks for Booking Created / Rescheduled / Cancelled, secret =
 * CAL_WEBHOOK_SECRET).
 *
 * Bookings made through the public Cal.com link never touch a site form, so
 * without this they never reach the leads table or the admin console.
 *
 * Security model:
 *  - HMAC-SHA256 hex signature over the raw body (x-cal-signature-256),
 *    constant-time compare.
 *  - Cal.com sends no timestamp, so replays are stopped by claiming
 *    (provider, booking uid + trigger) before any side effect. A failed lead
 *    write releases the claim and returns 500 so Cal.com retries.
 *
 * CSRF is exempted for this exact path in proxy.ts.
 */
export async function POST(request: Request) {
  if (!(await rateLimit(`cal:webhook:${clientIp(request)}`, 120, 60_000))) {
    return rateLimitResponse();
  }

  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const ok = verifyCalSignature({
    secret,
    rawBody,
    signature: request.headers.get("x-cal-signature-256"),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const event = calEvent(payload);
  if (event.kind === "ping" || event.kind === "ignore") {
    return NextResponse.json({ received: true, ignored: event.kind === "ignore" });
  }

  await recordInboundEvent({
    provider: "cal",
    operation: `webhook.${event.kind === "booking_created" ? "BOOKING_CREATED" : event.trigger}`,
  });

  const claim = await claimInboundEvent("cal", event.eventId);
  if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true });
  if (claim === "error") return NextResponse.json({ error: "Storage unavailable." }, { status: 500 });

  if (event.kind === "booking_changed") {
    console.info("[/api/cal/webhook] booking changed", { trigger: event.trigger });
    return NextResponse.json({ received: true });
  }

  try {
    const result = await processLead(event.lead);
    if (!result.storedInDatabase && !result.duplicate) {
      throw new Error("lead not stored");
    }
    return NextResponse.json({ received: true, leadId: result.leadId ?? null });
  } catch (err) {
    await releaseInboundEvent("cal", event.eventId);
    console.error("[/api/cal/webhook] lead capture failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Lead capture failed." }, { status: 500 });
  }
}
