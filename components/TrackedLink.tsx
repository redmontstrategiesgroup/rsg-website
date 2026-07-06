"use client";

import Link from "next/link";
import { trackEvent, type EventName } from "@/lib/events";

/**
 * Link that fires an analytics event on click. External URLs (booking
 * calendars etc.) open in a new tab; internal paths use Next navigation.
 */
export function TrackedLink({
  href,
  event,
  eventProps,
  className,
  children,
}: {
  href: string;
  event: EventName;
  eventProps?: Record<string, string>;
  className?: string;
  children: React.ReactNode;
}) {
  const onClick = () => trackEvent(event, eventProps);

  if (/^https?:\/\//.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
