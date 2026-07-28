import { timingSafeEqual } from "node:crypto";

/**
 * Shared cron authorization.
 *
 * Extracted verbatim from app/api/cron/scheduling/route.ts so a second cron
 * entrypoint cannot drift from it — an auth check that exists in two copies
 * eventually exists in two versions, and the weaker one is the one that gets
 * found.
 *
 * Compares in constant time: a plain === leaks the shared secret a character at
 * a time through response timing.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
