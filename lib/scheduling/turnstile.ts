/**
 * Cloudflare Turnstile verification, shared by the cookie booking-session
 * route and the public booking API. Moved out of
 * `app/api/booking/session/route.ts` verbatim so both callers share one
 * implementation.
 */

/**
 * True when Turnstile is fully configured for this deployment — both
 * `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set, and
 * callers are expected to pass a solved challenge. If only one of the two
 * is set, this reports the gate as INACTIVE rather than silently exempting
 * requests — that combination is a misconfiguration, not "dev mode".
 * This is the single source of truth for the dev exemption on any caller
 * that checks it first (see `verifyTurnstileStrict` below); local/dev with
 * neither var set is exempt.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

async function checkTurnstileToken(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    }
  );
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

/**
 * Verification for the public v1 booking API
 * (lib/apiv1/resources/public-booking.ts), which always checks
 * `isTurnstileConfigured()` before calling this. It never short-circuits
 * to "pass" on a missing site key, so the dev exemption lives in exactly
 * one place — `isTurnstileConfigured()` — rather than being decided again
 * here and potentially disagreeing with it.
 */
export function verifyTurnstileStrict(token: string | undefined, ip: string): Promise<boolean> {
  return checkTurnstileToken(token, ip);
}

/**
 * Verification used by the cookie booking-session route
 * (app/api/booking/session/route.ts). Preserved verbatim (including its
 * own dev-exemption short-circuit) so that route's externally visible
 * behaviour does not change: when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is
 * unset, verification is skipped entirely (returns true) regardless of
 * whether a secret is configured. New callers should prefer
 * `isTurnstileConfigured()` + `verifyTurnstileStrict()` instead of adding
 * more callers of this short-circuiting variant.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string
): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  return checkTurnstileToken(token, ip);
}
