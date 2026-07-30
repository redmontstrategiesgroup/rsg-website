"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * Progressive disclosure for long enumerated lists — phones only.
 *
 * The vertical pages run to nearly fifty phone screens, most of it lists of
 * ten-plus cards. This shows the first few and puts the rest behind one tap,
 * so the page can be skimmed without a minute of scrolling.
 *
 * Two properties make this safe rather than merely shorter:
 *
 *  - **Nothing leaves the DOM.** The overflow is wrapped in a node that is
 *    `hidden` when collapsed and `display: contents` otherwise, so every item
 *    is still in the server-rendered HTML for crawlers, and `contents` keeps
 *    the children as direct grid/flex items of the real container — the
 *    wrapper never disturbs the layout.
 *  - **Desktop is untouched.** From `sm` up the wrapper is always `contents`
 *    and the button is `hidden`, so wide screens render exactly as before.
 */
export function MobileReveal({
  children,
  previewCount = 4,
  label,
  className,
}: {
  children: ReactNode;
  /** How many items stay visible on a phone before the fold. */
  previewCount?: number;
  /** Button text, e.g. "Show all 10 problems". */
  label: string;
  /** Classes for the list container (grid/flow classes live here). */
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);

  if (items.length <= previewCount) {
    return <div className={className}>{children}</div>;
  }

  const head = items.slice(0, previewCount);
  const tail = items.slice(previewCount);

  return (
    <>
      <div className={className}>
        {head}
        <div className={expanded ? "contents" : "hidden sm:contents"}>
          {tail}
        </div>
      </div>

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="btn-ghost mt-6 w-full sm:hidden"
        >
          {label}
        </button>
      )}
    </>
  );
}
