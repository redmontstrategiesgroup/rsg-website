import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signing — one scheme for every outbound webhook we send.
 *
 * REPLACES `signWebhookPayload` in lib/scheduling/notifications.ts, which was a
 * bare `HMAC(secret, body)` with no timestamp. That signature stays valid
 * forever, so anyone who captured one request could replay it indefinitely and
 * the receiver had no way to tell. Binding a timestamp into the signed material
 * and rejecting old ones is what closes that.
 *
 * The signed material is `${timestamp}.${rawBody}`. The timestamp MUST be inside
 * the signature — a timestamp that only travels in a header can be rewritten by
 * the attacker replaying the body.
 *
 * This is byte-for-byte the scheme the receivers expect:
 *   shared/supabase/functions/registry-sync/index.ts (the per-app projects)
 *
 * Changing it is a breaking change on both sides at once.
 */

export const SIGNATURE_HEADER = "x-rsg-signature";
export const TIMESTAMP_HEADER = "x-rsg-timestamp";

/** How far out of date an inbound signature may be. */
export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

/** The exact bytes covered by the signature. */
export function signingMaterial(timestamp: number | string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function signPayload(
  secret: string,
  rawBody: string,
  timestamp: number = Date.now()
): { signature: string; timestamp: number } {
  const signature = createHmac("sha256", secret)
    .update(signingMaterial(timestamp, rawBody))
    .digest("hex");
  return { signature, timestamp };
}

/**
 * Verify an inbound signature.
 *
 * Use this for anything we RECEIVE that is signed with our scheme. Returns a
 * reason rather than a bare boolean so a rejection can be logged specifically —
 * "stale timestamp" and "bad signature" are very different incidents, and
 * collapsing them makes a clock-skew outage look like an attack.
 */
export function verifySignature(input: {
  secret: string;
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  toleranceMs?: number;
  now?: number;
}): { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" } {
  const { secret, rawBody, signature, timestamp } = input;
  const tolerance = input.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  const now = input.now ?? Date.now();

  if (!signature || !timestamp) return { ok: false, reason: "missing" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing" };
  if (Math.abs(now - ts) > tolerance) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", secret)
    .update(signingMaterial(timestamp, rawBody))
    .digest("hex");

  // Compare in constant time. A plain === leaks, through timing, how many
  // leading characters matched — which is enough to forge a signature given
  // enough attempts. Length is checked first because timingSafeEqual throws on
  // a length mismatch, and length is not secret.
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "mismatch" };

  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "mismatch" };
}
