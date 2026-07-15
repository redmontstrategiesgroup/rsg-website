"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Inertial smooth scrolling for the marketing site (Lenis).
 * Desktop only — on touch / narrow viewports Lenis fights native scroll
 * and can make position:fixed chrome (nav, chat) feel unpinned.
 * Also skipped for prefers-reduced-motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 1023px)");

    let lenis: Lenis | null = null;
    let frame = 0;

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lenis?.destroy();
      lenis = null;
    }

    function start() {
      stop();
      if (reduceMotion.matches || coarsePointer.matches || narrow.matches) {
        return;
      }

      lenis = new Lenis({
        duration: 1.1,
        // Smooth-scroll in-page anchor links too, stopping short of the navbar.
        anchors: { offset: -88 },
      });

      frame = requestAnimationFrame(function raf(time) {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      });
    }

    start();

    const onChange = () => start();
    reduceMotion.addEventListener("change", onChange);
    coarsePointer.addEventListener("change", onChange);
    narrow.addEventListener("change", onChange);

    return () => {
      reduceMotion.removeEventListener("change", onChange);
      coarsePointer.removeEventListener("change", onChange);
      narrow.removeEventListener("change", onChange);
      stop();
    };
  }, []);

  return null;
}
