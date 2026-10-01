"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  KNOWN_PARAM,
  isKnownVisitorPath,
  markKnownVisitor,
} from "@/lib/known-visitor";

/**
 * Marks the visitor as known when they land from one of our emails: either a
 * private-link page (booking manage, proposal, portal...) or any page carrying
 * ?known=1. The param is then stripped so it isn't shared or bookmarked.
 * Reads window.location rather than useSearchParams so the root layout keeps
 * static rendering without a Suspense boundary.
 */
export function KnownVisitorMarker() {
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromEmail = url.searchParams.has(KNOWN_PARAM);
    if (fromEmail || isKnownVisitorPath(url.pathname)) markKnownVisitor();
    if (fromEmail) {
      url.searchParams.delete(KNOWN_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [pathname]);

  return null;
}
