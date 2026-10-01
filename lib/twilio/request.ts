import { siteUrl } from "@/lib/lifecycle/core";
import { clientIp, rateLimit } from "@/lib/security";
import { recordInboundEvent } from "@/lib/integration-log";
import { verifyTwilioSignature } from "./webhook";

/**
 * Authenticate a Twilio webhook. Returns the form params, or a Response to
 * send back as-is (503 unconfigured, 429 rate-limited, 401 bad signature).
 *
 * The signed URL is rebuilt from the public site URL plus the request's own
 * path and query: the URL Twilio was configured with. request.url can carry
 * an internal host behind Vercel's proxy, which would fail every check.
 */
export async function readTwilioRequest(
  request: Request,
  operation: string
): Promise<{ params: Record<string, string> } | Response> {
  if (!(await rateLimit(`twilio:${operation}:${clientIp(request)}`, 120, 60_000))) {
    return new Response("Too many requests.", { status: 429 });
  }
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return new Response("Twilio not configured.", { status: 503 });

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const { pathname, search } = new URL(request.url);
  const ok = verifyTwilioSignature({
    authToken,
    url: `${siteUrl()}${pathname}${search}`,
    params,
    signature: request.headers.get("x-twilio-signature"),
  });
  if (!ok) return new Response("Invalid signature.", { status: 401 });

  await recordInboundEvent({ provider: "twilio", operation: `webhook.${operation}` });
  return { params };
}

export function twiml(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

export function publicUrl(path: string, query?: Record<string, string>): string {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `${siteUrl()}${path}${qs}`;
}

export function voicemailGreeting(): string {
  return (
    process.env.TWILIO_VOICEMAIL_GREETING?.trim() ||
    "Thanks for calling Redmont Strategies Group. We can't take your call right now. Please leave your name, number and a short message after the tone, and we'll call you back."
  );
}
