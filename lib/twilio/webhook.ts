import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook primitives. Pure (no I/O) so they are unit-tested directly.
 */

/**
 * X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + each POST param as
 * key+value, keys sorted)). `url` must be exactly the URL configured in
 * Twilio, query string included; behind Vercel the request URL can differ
 * from it, so callers pass the public URL, never request.url.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

export function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!input.authToken || !input.signature) return false;
  const expected = Buffer.from(twilioSignature(input.authToken, input.url, input.params));
  const given = Buffer.from(input.signature.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** E.164 only; anything else is refused as a forwarding target. */
export function isE164(value: string | undefined): value is string {
  return typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value.trim());
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const XML = '<?xml version="1.0" encoding="UTF-8"?>';

export function twimlEmpty(): string {
  return `${XML}<Response/>`;
}

export function twimlMessage(text: string): string {
  return `${XML}<Response><Message>${escapeXml(text.slice(0, 1500))}</Message></Response>`;
}

export function twimlHangup(): string {
  return `${XML}<Response><Hangup/></Response>`;
}

/** Ring the owner's phone; Twilio calls `actionUrl` with the outcome. */
export function twimlForward(input: { to: string; actionUrl: string; timeoutSeconds?: number }): string {
  const timeout = Math.min(Math.max(input.timeoutSeconds ?? 20, 5), 60);
  return (
    `${XML}<Response>` +
    `<Dial timeout="${timeout}" action="${escapeXml(input.actionUrl)}" method="POST">` +
    `<Number>${escapeXml(input.to)}</Number>` +
    `</Dial></Response>`
  );
}

/** Greeting, then record up to two minutes; the recording is reported to `callbackUrl`. */
export function twimlVoicemail(input: { greeting: string; callbackUrl: string; maxLengthSeconds?: number }): string {
  const maxLength = Math.min(Math.max(input.maxLengthSeconds ?? 120, 10), 600);
  return (
    `${XML}<Response>` +
    `<Say>${escapeXml(input.greeting.slice(0, 500))}</Say>` +
    `<Record maxLength="${maxLength}" playBeep="true" timeout="5" ` +
    `recordingStatusCallback="${escapeXml(input.callbackUrl)}" recordingStatusCallbackMethod="POST"/>` +
    `<Hangup/></Response>`
  );
}

/** A forwarded call counts as answered only when Twilio says so. */
export function dialWasAnswered(dialStatus: string | undefined): boolean {
  return dialStatus === "completed" || dialStatus === "answered";
}

/** Twilio Advanced Opt-Out sends OptOutType on STOP / START / HELP replies. */
export function optOutType(params: Record<string, string>): "STOP" | "START" | "HELP" | null {
  const t = (params.OptOutType ?? "").toUpperCase();
  return t === "STOP" || t === "START" || t === "HELP" ? t : null;
}
