import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pocket webhook signatures: X-HeyPocket-Signature = HMAC-SHA256(secret,
 * "{timestamp}.{rawBody}"). The docs don't pin the digest encoding or where the
 * timestamp travels, so this accepts hex or base64 (optionally "sha256="
 * prefixed) and takes the timestamp from the header when sent, else from the
 * payload. Constant-time compare; stale timestamps are rejected.
 */

/** Deliveries older than this are treated as replays. */
export const MAX_SIGNATURE_AGE_MS = 10 * 60_000;

function toMillis(ts: string): number | null {
  if (/^\d+$/.test(ts)) {
    const n = Number(ts);
    return n < 1e12 ? n * 1000 : n; // seconds or milliseconds
  }
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyPocketSignature(input: {
  secret: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  now?: number;
}): boolean {
  const { secret, rawBody } = input;
  if (!secret || !input.signature || !input.timestamp) return false;

  const when = toMillis(input.timestamp);
  if (when == null || Math.abs((input.now ?? Date.now()) - when) > MAX_SIGNATURE_AGE_MS) {
    return false;
  }

  const provided = input.signature.trim().replace(/^sha256=/i, "");
  const mac = createHmac("sha256", secret).update(`${input.timestamp}.${rawBody}`).digest();
  return safeEqual(provided.toLowerCase(), mac.toString("hex")) || safeEqual(provided, mac.toString("base64"));
}

/** Timestamp from the delivery headers, else the payload's `timestamp`. */
export function pocketTimestamp(headers: Headers, payload: unknown): string | null {
  const h =
    headers.get("x-heypocket-timestamp") ??
    headers.get("x-pocket-timestamp") ??
    headers.get("x-webhook-timestamp");
  if (h) return h.trim();
  const p = typeof payload === "object" && payload !== null ? (payload as { timestamp?: unknown }).timestamp : null;
  if (typeof p === "string") return p;
  if (typeof p === "number") return String(p);
  return null;
}
