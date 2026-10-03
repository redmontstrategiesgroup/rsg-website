"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Close on outside pointerdown or Escape. Dropdowns in the demo OS had
 * neither, so on touch the only way to dismiss one was to find and re-tap
 * the exact trigger.
 */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ref]);
}

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Width classes for the panel. It is always capped to the viewport. */
  className?: string;
  /** Preferred horizontal anchor; flips if it would leave the viewport. */
  align?: "left" | "right";
  /** Distance below the trigger. Tailwind top-* class. */
  offsetClassName?: string;
  /** Accessible name of the panel. */
  label?: string;
};

/**
 * Anchored dropdown panel. Wrap trigger + <Popover> in a `relative` element.
 *
 * Flips to whichever side keeps it on screen: a `right-0 w-72` menu whose
 * trigger has wrapped to the left edge of a phone used to extend 200px past
 * the left of the viewport, where body overflow clipping hid it entirely.
 */
export function Popover({
  open,
  onClose,
  children,
  className = "w-72",
  align = "right",
  offsetClassName = "top-11",
  label,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<"left" | "right">(align);
  useDismissable(wrapRef, open, onClose);

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    setSide(align);
    // Measure after the preferred side has been applied.
    const id = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const pad = 8;
      if (r.left < pad && align === "right") setSide("left");
      else if (r.right > window.innerWidth - pad && align === "left") setSide("right");
    });
    return () => cancelAnimationFrame(id);
  }, [open, align]);

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      role={label ? "dialog" : undefined}
      aria-label={label}
      className={`absolute z-40 max-w-[calc(100vw-1.5rem)] rounded-lg border border-white/10 bg-base-800 shadow-lift ${offsetClassName} ${
        side === "right" ? "right-0" : "left-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
