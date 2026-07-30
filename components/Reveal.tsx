import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** Retained for API compatibility; reveals never replay. */
  once?: boolean;
};

/**
 * Scroll-into-view reveal, driven entirely by CSS.
 *
 * Critically, this renders **visible** markup: the server HTML carries no
 * opacity:0, so text paints on first frame and LCP is never gated on JS.
 * The animation is opt-in and desktop-only — the inline script in the root
 * layout sets `data-reveal="on"` on <html> before first paint when the
 * viewport is wide and motion is welcome, and only then does the CSS in
 * globals.css hide these nodes for RevealObserver to bring back in.
 *
 * On phones there is no observer, no framer-motion, and no hidden content —
 * a plain <div> that costs nothing. This is a server component; it adds zero
 * JavaScript to the 222 places it is used.
 */
export function Reveal({ children, delay = 0, y, className }: RevealProps) {
  const style: CSSProperties = {};
  if (delay) style.transitionDelay = `${delay}s`;
  if (y != null) (style as Record<string, string>)["--reveal-y"] = `${y}px`;

  return (
    <div
      data-reveal=""
      className={className}
      style={Object.keys(style).length ? style : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Layout wrapper kept for API compatibility. Stagger is expressed by the
 * `delay` prop on each child <Reveal>, so this is now a plain container.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  /** Accepted and ignored — children carry their own delays. */
  stagger?: number;
}) {
  return <div className={className}>{children}</div>;
}
