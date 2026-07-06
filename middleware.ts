import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: CSRF protection and coarse bot filtering for every
 * state-changing API request, plus issuing the CSRF token cookie.
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

/** Obvious non-browser/scripted clients — blocked from mutating API calls. */
const BOT_UA =
  /\b(bot|crawl|spider|scrape|slurp|curl|wget|python-requests|python-urllib|aiohttp|scrapy|httpclient|libwww|okhttp|go-http-client|java\/|phantomjs|headlesschrome)\b/i;

function forbidden(reason: string) {
  return NextResponse.json({ error: reason }, { status: 403 });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
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

    return NextResponse.next();
  }

  // Non-mutating traffic: make sure the CSRF token cookie exists so client
  // scripts can echo it on their next POST.
  const response = NextResponse.next();
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
