"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: an icon-only control has no visible text to name it. */
  "aria-label": string;
};

/**
 * Icon-only button with a guaranteed 44px touch target.
 *
 * Every close-X, bell, chevron and toast dismiss in the codebase used to
 * hand-roll `h-7 w-7` or `h-8 w-8` (28–32px), and one shipped with no size
 * at all (a bare 12px icon). The visual footprint is whatever `className`
 * paints; the hit area never drops below 44px on any device.
 */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { className = "", type = "button", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
