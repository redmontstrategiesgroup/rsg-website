"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, type EventName } from "@/lib/events";

// Guards against React StrictMode's dev double-mount firing the event twice,
// while still allowing a genuine revisit to the page to count again.
const recentlyFired = new Map<string, number>();

/** Fires an analytics event once when the page mounts (e.g. thank-you view). */
export function TrackPageEvent({ event }: { event: EventName }) {
  const pathname = usePathname();

  useEffect(() => {
    const key = `${event}:${pathname}`;
    const last = recentlyFired.get(key) ?? 0;
    if (Date.now() - last < 2_000) return;
    recentlyFired.set(key, Date.now());
    trackEvent(event);
  }, [event, pathname]);

  return null;
}
