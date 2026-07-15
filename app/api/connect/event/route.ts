import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { recordConnectEvent, type ConnectEventType } from "@/lib/connect";

export const runtime = "nodejs";

const EventSchema = z.object({
  eventType: z.enum([
    "page_view",
    "link_click",
    "cta_click",
    "campaign_click",
    "form_start",
    "form_complete",
    "qr_scan",
  ]),
  linkId: z.string().max(80).optional(),
  sessionId: z.string().max(80).optional(),
  visitorId: z.string().max(80).optional(),
  source: z.string().max(80).optional(),
  medium: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  referrer: z.string().max(400).optional(),
  device: z.string().max(40).optional(),
  path: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  if (!(await rateLimit(`connect-event:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  await recordConnectEvent({
    eventType: parsed.data.eventType as ConnectEventType,
    linkId: parsed.data.linkId,
    sessionId: parsed.data.sessionId,
    visitorId: parsed.data.visitorId,
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign: parsed.data.campaign,
    referrer: parsed.data.referrer,
    device: parsed.data.device,
    path: parsed.data.path ?? "/connect",
  });

  return NextResponse.json({ ok: true });
}
