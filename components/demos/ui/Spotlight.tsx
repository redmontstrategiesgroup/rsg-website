"use client";

import { createElement, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import type { FreshEntry, FreshKind } from "../types";

/** How long after an effect an entity stays spotlighted. Matches the CSS animation. */
export const SPOT_WINDOW_MS = 10_000;

export function isFresh(entry: FreshEntry | undefined, now: number = Date.now()): boolean {
  return !!entry && now - entry.at < SPOT_WINDOW_MS;
}

/**
 * Text marker so a spotlighted item isn't colour-only. Floats in the item's
 * top-right corner by default; pass `inline` where the caller places it in
 * flow because that corner is already taken.
 */
export function FreshPill({ inline = false }: { inline?: boolean } = {}) {
  return (
    <span className={`demo-spotlight__pill${inline ? " demo-spotlight__pill--inline" : ""}`}>
      Just now
    </span>
  );
}

type Props = Omit<HTMLAttributes<HTMLElement>, "id"> & {
  id: string;
  fresh: Record<string, FreshEntry>;
  /** Override the colour family; defaults to the entry's kind. */
  kind?: FreshKind;
  as?: "div" | "li" | "tr";
  /**
   * Where the "Just now" marker goes. `true` floats it in the item's
   * top-right corner, which only works while nothing else lives there;
   * `"inline"` appends it in flow, for a flex row whose trailing cell is a
   * status pill, amount, or date it would otherwise cover. `false` opts out
   * entirely — table rows can't hold a bare span, and a card may want the
   * pill somewhere specific, so those render <FreshPill /> themselves.
   */
  pill?: boolean | "inline";
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
    active && pill ? <FreshPill key="pill" inline={pill === "inline"} /> : null,
  );
}
