"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Cookie consent banner. On accept, sets a one-year consent cookie plus a
 * first-party visitor id (rsg_vid) for marketing attribution. On decline,
 * records the choice and sets nothing else.
 */

const CONSENT_COOKIE = "rsg_consent";
const VISITOR_COOKIE = "rsg_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function writeCookie(name: string, value: string, maxAge = ONE_YEAR) {
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readCookie(CONSENT_COOKIE)) return;
    // Small delay so the banner doesn't flash during the initial paint.
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  function accept() {
    writeCookie(CONSENT_COOKIE, "all");
    if (!readCookie(VISITOR_COOKIE)) {
      const vid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      writeCookie(VISITOR_COOKIE, vid);
    }
    setVisible(false);
    // Let the analytics tracker record the current page right away.
    window.dispatchEvent(new Event("rsg-consent-granted"));
  }

  function decline() {
    writeCookie(CONSENT_COOKIE, "essential");
    // Remove any previously set marketing cookie.
    writeCookie(VISITOR_COOKIE, "", 0);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    /*
      On phones this sits above the chat launcher and spans the width, rather
      than squeezing into the 216px left over beside it. From `sm` up it
      returns to the original compact card in the corner.
    */
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-20 z-40 border border-white/15 bg-base-900 p-5 shadow-lift sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(380px,calc(100%-6.5rem))] sm:p-6"
    >
      <p className="text-[0.72rem] sm:text-[0.62rem] font-medium uppercase tracking-[0.22em] text-white/40">
        Cookies
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        We use a small number of cookies to understand how visitors use this
        site and to improve it. See the{" "}
        <Link
          href="/privacy"
          className="text-white/85 underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white/60"
        >
          privacy policy
        </Link>
        .
      </p>
      {/* Both controls clear 44px so neither is a mis-tap risk. */}
      <div className="mt-5 flex items-center gap-3 sm:gap-5">
        <button
          onClick={accept}
          className="btn-primary flex-1 px-6 py-2.5 text-[0.8rem] sm:flex-none"
        >
          Accept
        </button>
        <button
          onClick={decline}
          className="inline-flex min-h-12 items-center justify-center px-4 text-sm text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
