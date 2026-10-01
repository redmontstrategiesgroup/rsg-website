import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature checks for inbound provider webhooks. Pure (no I/O) so they are
 * unit-tested directly; the routes only pass headers and the raw body in.
 */

/** Deliveries older (or newer) than this are treated as replays. */
export const SVIX_TOLERANCE_MS = 5 * 60_000;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Resend signs with Svix: svix-signature is a space-separated list of
 * "v1,<base64 HMAC-SHA256>" over "{svix-id}.{svix-timestamp}.{rawBody}", keyed
 * with the base64 part of the "whsec_…" secret. Several signatures appear
 * during a secret rotation; any one matching is enough.
 */
export function verifySvixSignature(input: {
  secret: string;
  rawBody: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}): boolean {
  const { secret, rawBody, id, timestamp, signature } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const sentAt = Number(timestamp) * 1000;
  if (Math.abs((input.now ?? Date.now()) - sentAt) > SVIX_TOLERANCE_MS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .some((part) => safeEqual(part.slice(3), expected));
}

/**
 * Cal.com: x-cal-signature-256 = hex HMAC-SHA256(secret, rawBody). Cal.com
 * sends no timestamp header, so replay protection is the event claim in the
 * route (booking uid + trigger), not a time window.
 */
export function verifyCalSignature(input: {
  secret: string;
  rawBody: string;
  signature: string | null;
}): boolean {
  const { secret, rawBody, signature } = input;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(signature.trim().toLowerCase(), expected);
}
