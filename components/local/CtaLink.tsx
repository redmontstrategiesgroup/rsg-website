"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent, type EventName } from "@/lib/events";

/**
 * CTA link for local service/industry pages. Fires the shared
 * service_page_cta_click event plus the CTA-specific event so both
 * per-page and site-wide funnels can be reported on.
 */
export function CtaLink({
  href,
  page,
  cta,
  event,
  className,
  children,
}: {
  href: string;
  /** Page slug, for event attribution. */
  page: string;
  /** Short CTA id, e.g. "book_call" | "audit". */
  cta: string;
  /** CTA-specific event to fire alongside service_page_cta_click. */
  event: EventName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackEvent("service_page_cta_click", { page, cta });
        trackEvent(event, { location: `local_${cta}`, page });
      }}
    >
      {children}
    </Link>
  );
}
