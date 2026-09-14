"use client";

import { createElement, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import type { FreshEntry, FreshKind } from "../types";

/** How long after an effect an entity stays spotlighted. Matches the CSS animation. */
export const SPOT_WINDOW_MS = 10_000;

export function isFresh(entry: FreshEntry | undefined, now: number = Date.now()): boolean {
  return !!entry && now - entry.at < SPOT_WINDOW_MS;
}

/** Text marker so a spotlighted item isn't colour-only. */
export function FreshPill() {
  return <span className="demo-spotlight__pill">Just now</span>;
}

type Props = Omit<HTMLAttributes<HTMLElement>, "id"> & {
  id: string;
  fresh: Record<string, FreshEntry>;
  /** Override the colour family; defaults to the entry's kind. */
  kind?: FreshKind;
  as?: "div" | "li" | "tr";
  /** Table rows can't hold a span; pass false and render <FreshPill /> in a cell instead. */
  pill?: boolean;
  children: ReactNode;
};

/**
 * Wraps a list item and, while the entity is fresh (touched by a tour step,
 * scenario, sim, or receptionist outcome in the last 10 s), rings it in the
 * kind colour, appends a "Just now" pill, and scrolls it into view once.
 */
export function Spotlight({ id, fresh, kind, as = "div", pill = true, className = "", children, ...rest }: Props) {
  const entry = fresh[id];
  const active = isFresh(entry);
  const family = kind ?? entry?.kind ?? "record";
  const ref = useRef<HTMLElement>(null);
  const scrolledAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !entry || scrolledAt.current === entry.at) return;
    scrolledAt.current = entry.at;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, entry]);

  return createElement(
    as,
    {
      ref,
      className: `${className} ${active ? `demo-spotlight demo-spotlight--${family}` : ""}`.trim(),
      "data-spot-id": id,
      "data-fresh": active ? "true" : undefined,
      ...rest,
    },
    children,
    active && pill ? <FreshPill key="pill" /> : null,
  );
}
