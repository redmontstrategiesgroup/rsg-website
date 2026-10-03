import { NextResponse } from "next/server";
import { unsubscribeSubscriber } from "@/lib/store";
import { decodeEmailParam, verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Marketing-list unsubscribe. Reached from the link in every email
 * (`GET`, a person clicking) and from mail clients' native unsubscribe
 * control (`POST`, RFC 8058 one-click, no user interaction). Both verify the
 * signed token from lib/unsubscribe before touching the list.
 *
 * Errors never reveal whether an address is on the list.
 */
async function handle(request: Request): Promise<{ ok: boolean; status: number }> {
  if (!(await rateLimit(`unsubscribe:${clientIp(request)}`, 30, 10 * 60_000))) {
    return { ok: false, status: 429 };
  }
  const url = new URL(request.url);
  const email = decodeEmailParam(url.searchParams.get("e"));
  const token = url.searchParams.get("t") ?? "";
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return { ok: false, status: 400 };
  }
  const written = await unsubscribeSubscriber(email);
  return { ok: written, status: written ? 200 : 500 };
}

export async function GET(request: Request) {
  const result = await handle(request);
  if (result.status === 429) return rateLimitResponse();
  const dest = new URL("/unsubscribed", request.url);
  if (!result.ok) dest.searchParams.set("state", result.status === 400 ? "invalid" : "error");
  return NextResponse.redirect(dest, 303);
}

export async function POST(request: Request) {
  const result = await handle(request);
  if (result.status === 429) return rateLimitResponse();
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
