import { NextResponse } from "next/server";
import { saveSubscriber } from "@/lib/store";
import { isEmail, toStr, LIMITS } from "@/lib/validate";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { DEFAULT_CONTACT_TO_EMAIL } from "@/lib/leads";
import type { Subscriber } from "@/lib/types";
import { Resend } from "resend";
import { callProvider } from "@/lib/integration-log";

export const runtime = "nodejs";

async function notifyOwner(sub: Subscriber): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const to = process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_CONTACT_TO_EMAIL;
  try {
    const resend = new Resend(apiKey);
    await callProvider(
      { provider: "resend", operation: "email.send.subscriber_notice" },
      async () => {
        const { data, error } = await resend.emails.send({
          from:
            process.env.CONTACT_FROM_EMAIL ?? "RSG Website <onboarding@resend.dev>",
          to,
          subject: `New email signup: ${sub.email}`,
          text: `A visitor subscribed via the website (${sub.source}) at ${sub.subscribedAt}.\n\nEmail: ${sub.email}`,
        });
        if (error) {
          throw Object.assign(new Error(error.message), {
            name: error.name,
            status: (error as { statusCode?: number }).statusCode,
          });
        }
        return data;
      }
    );
  } catch {
    // Non-fatal — the subscriber is already saved. Recorded by callProvider.
  }
}

export async function POST(request: Request) {
  if (!(await rateLimit(`subscribe:${clientIp(request)}`, 6, 10 * 60_000))) {
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

  const result = await saveSubscriber(sub);
  if (result === "failed") {
    return NextResponse.json(
      { error: "We couldn't save your email right now. Please try again." },
      { status: 503 }
    );
  }
  if (result === "created") {
    await notifyOwner(sub);
  }

  return NextResponse.json({ ok: true });
}
