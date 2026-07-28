/**
 * Bypass block (WCAG 2.4.1, Level A). The marketing header carries a logo plus
 * up to nine nav items, so without this a keyboard or switch user tabs through
 * the whole header on every page before reaching the content.
 *
 * Visually hidden until focused, then pinned top-left above everything — the
 * navbar sits at z-50, so this has to clear it to be visible when focused.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-white/20 focus:bg-base-900 focus:px-4 focus:py-2.5 focus:text-sm focus:text-white focus:outline-none focus:ring-2 focus:ring-crimson"
    >
      Skip to main content
    </a>
  );
}
