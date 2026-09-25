import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "./auth.ts";
import { SITE_URL } from "./site.ts";

/**
 * Signed, non-expiring unsubscribe links for the marketing list.
 *
 * The site promises "every email includes an unsubscribe link" (privacy
 * policy, EmailCapture). This is the mechanism behind that promise: a link
 * carries the address plus an HMAC over it, so nobody can unsubscribe
 * someone else by guessing, and the link keeps working for as long as the
 * message sits in an inbox. Any future sender must call
 * `unsubscribeHeaders()` for RFC 8058 one-click support and put
 * `unsubscribeUrl()` in the body, and must filter recipients through
 * `getSubscribers()` (which drops suppressed addresses by default).
 */

const PURPOSE = "unsubscribe:v1:";

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function sign(email: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(PURPOSE + normalize(email))
    .digest("base64url");
}

export function createUnsubscribeToken(email: string): string {
  return sign(email);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(sign(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Absolute URL for the link in an email body. */
export function unsubscribeUrl(email: string): string {
  const e = Buffer.from(normalize(email)).toString("base64url");
  return `${SITE_URL}/api/unsubscribe?e=${e}&t=${createUnsubscribeToken(email)}`;
}

/** Decode the `e` query parameter back to an address. */
export function decodeEmailParam(param: string | null): string | null {
  if (!param) return null;
  try {
    const email = Buffer.from(param, "base64url").toString("utf8");
    return email.includes("@") ? normalize(email) : null;
  } catch {
    return null;
  }
}

/**
 * Headers for a marketing send so mail clients show a native unsubscribe
 * control (RFC 2369 + RFC 8058 one-click). Spread into the provider call.
 */
export function unsubscribeHeaders(email: string): Record<string, string> {
  const url = unsubscribeUrl(email);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
