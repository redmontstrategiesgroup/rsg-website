"use client";

import { useEffect } from "react";

/**
 * Drives the desktop reveal animation for every `[data-reveal]` node.
 *
 * One IntersectionObserver for the whole document replaces the 222
 * framer-motion components this used to take. It only ever runs when the
 * inline script in the root layout decided, before first paint, that this is
 * a wide viewport whose user welcomes motion — on phones this effect returns
 * immediately and nothing is observed.
 *
 * A MutationObserver picks up nodes added by client navigation.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.reveal !== "on") return;

    // Tells the layout's failsafe timer that the animation is in hand, so it
    // won't strip the flag and force everything visible.
    root.dataset.revealReady = "";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealIn = "";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -80px 0px" }
    );

    const observe = (scope: ParentNode) => {
      scope
        .querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal-in])")
        .forEach((el) => io.observe(el));
    };

    observe(document);

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node as HTMLElement;
          if (el.matches("[data-reveal]:not([data-reveal-in])")) io.observe(el);
          observe(el);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      delete root.dataset.revealReady;
    };
  }, []);

  return null;
}
