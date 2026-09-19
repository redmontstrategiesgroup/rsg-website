/**
 * Cloudflare Turnstile verification, shared by the cookie booking-session
 * route and the public booking API. Moved out of
 * `app/api/booking/session/route.ts` verbatim so both callers share one
 * implementation.
 */

/** True when a Turnstile secret is configured — i.e. the deployment expects
 * callers to pass a solved challenge. Local/dev without a secret is exempt. */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: string | undefined,
  ip: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return true;
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
