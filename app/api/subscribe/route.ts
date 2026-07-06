import { NextResponse } from "next/server";
import { saveSubscriber } from "@/lib/store";
import { isEmail, toStr, LIMITS } from "@/lib/validate";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import type { Subscriber } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!rateLimit(`subscribe:${clientIp(request)}`, 6, 10 * 60_000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: hidden field, humans never fill it. Pretend success.
  if (typeof body.confirm_email === "string" && body.confirm_email.trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = toStr(body.email);
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const sub: Subscriber = {
    email: email.slice(0, LIMITS.email),
    source: toStr(body.source).slice(0, LIMITS.short) || "popup",
    subscribedAt: new Date().toISOString(),
  };

  await saveSubscriber(sub);
  return NextResponse.json({ ok: true });
}
