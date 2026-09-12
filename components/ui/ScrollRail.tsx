"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./IconButton";

type Tag = "div" | "ul" | "ol" | "nav";

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children: ReactNode;
  /** Element to render. Lists stay lists so screen readers keep their counts. */
  as?: Tag;
  /**
   * Where children snap: `start` for tab strips and card rails, `center` for
   * a single-item carousel.
   */
  snap?: "start" | "center" | "none";
  /**
   * Padding inside the scroller, matched by `scroll-padding` so a snapped
   * item never lands under the edge fade. Tailwind spacing scale.
   */
  inset?: 0 | 4 | 6;
  /**
   * Keep the active descendant in view. Matches `[aria-selected="true"]`,
   * `[aria-current]`, or `[data-active="true"]`; re-runs when `activeKey`
   * changes so a parent can drive it from state.
   */
  activeKey?: string | number | null;
  /** Show prev/next buttons on devices that have a hover pointer. */
  arrows?: boolean;
  /**
   * Arrow-key navigation between `[role="tab"]` descendants: Left/Right move
   * focus and select, Home/End jump. Put `role="tablist"` on the rail.
   */
  keyboardTabs?: boolean;
  /** Hide the native scrollbar (the edge fade still shows continuation). */
  hideScrollbar?: boolean;
};

const INSET: Record<NonNullable<Props["inset"]>, string> = {
  0: "",
  4: "px-4 scroll-px-4",
  6: "px-6 scroll-px-6",
};

const SNAP: Record<NonNullable<Props["snap"]>, string> = {
  start: "snap-x snap-mandatory [&>*]:snap-start",
  center: "snap-x snap-mandatory [&>*]:snap-center",
  none: "",
};

const FADE = 28; // px of edge fade

/**
 * Horizontal scroll container with the three things every hand-rolled rail
 * in the codebase was missing: scroll-snap, a visible cue that content
 * continues (edge fade + optional arrows), and scrolling the active item
 * into view so a tab strip never opens with the selected tab off-screen.
 *
 * Renders `overscroll-x-contain` so a swipe that reaches the end does not
 * bubble into a horizontal page gesture (back-navigation on iOS).
 */
export function ScrollRail({
  children,
  as = "div",
  snap = "start",
  inset = 0,
  activeKey,
  arrows = false,
  keyboardTabs = false,
  hideScrollbar = false,
  className = "",
  onKeyDown,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  /* Edge-fade state: which sides still have content beyond them. */
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 2;
    const right = max - el.scrollLeft > 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [measure]);

  /* Active item into view, horizontally only (never scrolls the page). */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(
      '[aria-selected="true"],[aria-current],[data-active="true"]'
    );
    if (!active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    const clamped = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
    if (Math.abs(el.scrollLeft - clamped) > 4) {
      el.scrollTo({ left: clamped, behavior: "auto" });
    }
  }, [activeKey]);

  const page = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  const handleKey = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      onKeyDown?.(e);
      if (!keyboardTabs || e.defaultPrevented) return;
      const el = ref.current;
      if (!el) return;
      const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
        (t) => !t.hasAttribute("disabled")
      );
      if (tabs.length === 0) return;
      const idx = tabs.findIndex((t) => t === document.activeElement);
      let next = -1;
      if (e.key === "ArrowRight") next = idx < 0 ? 0 : (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = idx < 0 ? tabs.length - 1 : (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    },
    [keyboardTabs, onKeyDown]
  );

  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${edges.left ? "transparent" : "black"} 0, black ${FADE}px, black calc(100% - ${FADE}px), ${
          edges.right ? "transparent" : "black"
        } 100%)`
      : undefined;

  const rail = createElement(
    as,
    {
      ref,
      className: `min-w-0 max-w-full overflow-x-auto overscroll-x-contain ${SNAP[snap]} ${INSET[inset]} ${
        hideScrollbar ? "no-scrollbar" : ""
      } ${className}`,
      style: mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined,
      onKeyDown: handleKey,
      ...rest,
    },
    children
  );

  if (!arrows) return rail;

  return (
    <div className="relative">
      {rail}
      {edges.left && (
        <IconButton
          aria-label="Scroll left"
          onClick={() => page(-1)}
          className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-base-900/90 text-white/70 backdrop-blur hover:text-white [@media(hover:hover)]:inline-flex"
        >
          <ChevronLeft size={18} />
        </IconButton>
      )}
      {edges.right && (
        <IconButton
          aria-label="Scroll right"
          onClick={() => page(1)}
          className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-base-900/90 text-white/70 backdrop-blur hover:text-white [@media(hover:hover)]:inline-flex"
        >
          <ChevronRight size={18} />
        </IconButton>
      )}
    </div>
  );
}
