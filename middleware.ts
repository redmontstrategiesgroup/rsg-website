import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: CSRF protection and coarse bot filtering for every
 * state-changing API request, plus issuing the CSRF token cookie.
 * Also gates /admin and /dashboard page routes (cookie presence + signature).
 *
 * CSRF defense is layered:
 *  1. Session cookies are SameSite=Lax (set in lib/auth.ts).
 *  2. Fetch metadata / Origin must be same-origin for mutating requests.
 *  3. Double-submit token: the `rsg_csrf` cookie (readable by our JS) must
 *     be echoed back in the `x-csrf-token` header. Cross-site attackers can
 *     neither read the cookie nor set the header.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_COOKIE = "rsg_csrf";
const CSRF_HEADER = "x-csrf-token";
const ADMIN_COOKIE = "rsg_admin";

/**
 * Correlation id — minted here, at the entry point, and propagated forward on
 * the request headers so route handlers and every provider call they make log
 * under the same id. Echoed on the response so a browser error report and the
 * server-side trail can be joined.
 *
 * Middleware runs on the edge runtime, so this file must NOT import
 * lib/integration-log (node:async_hooks). The header is the contract between
 * them; the constant is duplicated deliberately.
 */
const CORRELATION_HEADER = "x-correlation-id";

/** Sanitize before echoing an attacker-controllable header into our logs. */
function inboundCorrelationId(request: NextRequest): string | null {
  const raw = request.headers.get(CORRELATION_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 64);
  return /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}

/** Obvious non-browser/scripted clients — blocked from mutating API calls. */
const BOT_UA =
  /\b(bot|crawl|spider|scrape|slurp|curl|wget|python-requests|python-urllib|aiohttp|scrapy|httpclient|libwww|okhttp|go-http-client|java\/|phantomjs|headlesschrome)\b/i;

function forbidden(reason: string) {
  return NextResponse.json({ error: reason }, { status: 403 });
}

function decodeAdminPayload(
  token: string | undefined
): { role?: string; exp?: number } | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [body] = token.split(".");
    const pad = "=".repeat((4 - ((body!.length % 4) || 4)) % 4);
    const b64 = body!.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return JSON.parse(atob(b64)) as { role?: string; exp?: number };
  } catch {
    return null;
  }
}

/** Base64url (no padding) of an ArrayBuffer — matches Node's digest("base64url"). */
function bufToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string compare (avoids leaking the signature via timing). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Full admin-cookie validation on the edge: verify the HMAC-SHA256 signature
 * (same secret + base64url shape as lib/auth's `sign`), then the role and
 * expiry. This is what stops a forged/unsigned cookie from passing the page
 * gate. The API handlers and page loaders verify independently too (defense in
 * depth) — but the gate should not accept a cookie the rest of the app rejects.
 *
 * Requires AUTH_SECRET at the edge. When it is unset (local dev, where lib/auth
 * uses a per-process random secret the edge runtime can't see), fall back to a
 * structural check so dev isn't locked out — production ALWAYS sets AUTH_SECRET
 * (lib/auth throws without it), so production always gets the real check.
 */
async function hasValidAdminCookie(token: string | undefined): Promise<boolean> {
  const payload = decodeAdminPayload(token);
  if (!payload) return false;
  if (payload.role !== "admin") return false;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    // Dev fallback: no shared secret at the edge. Structural check only; the
    // page loader (requireLiveAdminSession) still verifies the signature.
    return true;
  }

  const [body, signature] = token!.split(".");
  if (!body || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );
    return timingSafeEqualStr(bufToBase64url(sig), signature);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const correlationId = inboundCorrelationId(request) ?? crypto.randomUUID();
  const response = await handle(request, correlationId);
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

async function handle(request: NextRequest, correlationId: string) {
  const { pathname } = request.nextUrl;

  /** Pass the request through with the correlation id visible to the handler. */
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(CORRELATION_HEADER, correlationId);
    return NextResponse.next({ request: { headers } });
  };

  // Second-layer gate for admin UI (API handlers still call getAdminSession).
  const isAdminUi =
    (pathname.startsWith("/admin") && pathname !== "/admin/login") ||
    pathname.startsWith("/dashboard");
  if (isAdminUi) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!(await hasValidAdminCookie(token))) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    // External brief delivery is not a browser-cookie flow. It has its own
    // bearer-secret authentication, idempotency requirement, validation, and
    // rate limit in the route handler, so CSRF and browser user-agent checks do
    // not apply to this exact endpoint.
    if (pathname === "/api/briefs/ingest") {
      return forward();
    }
    // Cron jobs authenticate via shared secret, not browser CSRF cookies.
    if (pathname === "/api/cron/scheduling") {
      return forward();
    }
    // Stripe webhooks are server-to-server and authenticate via signature
    // verification (constructEvent) plus a unique-event replay guard in the
    // route handler. Browser CSRF and user-agent checks do not apply.
    if (pathname === "/api/stripe/webhook") {
      return forward();
    }
    // Health checks are GET-only; nothing to exempt here for mutating.

    // 1. Reject obvious scripted clients.
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua)) {
      return forbidden("Request blocked.");
    }

    // 2. Fetch-metadata check (sent by all modern browsers).
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return forbidden("Cross-site request blocked.");
    }

    // 3. Origin check, when the browser provides it.
    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      try {
        if (new URL(origin).host !== host) {
          return forbidden("Cross-site request blocked.");
        }
      } catch {
        return forbidden("Cross-site request blocked.");
      }
    }

    // 4. Double-submit token.
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = request.headers.get(CSRF_HEADER);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return forbidden("Missing or invalid CSRF token. Refresh and try again.");
    }

    return forward();
  }

  // Non-mutating traffic: make sure the CSRF token cookie exists so client
  // scripts can echo it on their next POST.
  const response = forward();
  if (!request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, crypto.randomUUID().replace(/-/g, ""), {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      // Deliberately NOT httpOnly — client JS must read it to echo it back.
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  // Everything except Next static assets and files with extensions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
