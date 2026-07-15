import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { recordConnectEvent } from "@/lib/connect";

export const runtime = "nodejs";

/**
 * Permanent QR landing redirect. Scan tracking is recorded, then visitors
 * land on /connect with source=qr so attribution and personalization apply.
 * Destination can change later without reprinting physical codes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaign = url.searchParams.get("campaign")?.slice(0, 80) ?? "";
  const dest = new URL("/connect", SITE_URL);
  dest.searchParams.set("source", "qr");
  if (campaign) dest.searchParams.set("campaign", campaign);
  dest.searchParams.set("utm_source", "qr");
  dest.searchParams.set("utm_medium", "offline");
  if (campaign) dest.searchParams.set("utm_campaign", campaign);

  const vid = url.searchParams.get("v")?.slice(0, 64);
  await recordConnectEvent({
    eventType: "qr_scan",
    source: "qr",
    campaign: campaign || undefined,
    path: "/r/connect",
    visitorId: vid || undefined,
    referrer: request.headers.get("referer")?.slice(0, 400) || undefined,
    device: "unknown",
  });

  return NextResponse.redirect(dest.toString(), 302);
}
