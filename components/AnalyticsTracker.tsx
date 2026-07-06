"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { postJson } from "@/lib/api";
import { captureUtm } from "@/lib/tracking";

function consentedAll(): boolean {
  return document.cookie.includes("rsg_consent=all");
}

/**
 * Consent-gated first-party page-view tracking. Fires once per route change
 * when the visitor has accepted cookies, and once immediately when consent
 * is granted mid-visit (CookieConsent dispatches `rsg-consent-granted`).
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    // Remember campaign attribution regardless of cookie consent — it's
    // session-scoped and only ever submitted with the contact form.
    captureUtm();

    const track = () => {
      if (!consentedAll() || lastTracked.current === pathname) return;
      lastTracked.current = pathname;
      postJson("/api/analytics", {
        path: pathname,
        referrer: document.referrer,
      }).catch(() => {
        /* analytics must never break the page */
      });
    };

    track();
    window.addEventListener("rsg-consent-granted", track);
    return () => window.removeEventListener("rsg-consent-granted", track);
  }, [pathname]);

  return null;
}
