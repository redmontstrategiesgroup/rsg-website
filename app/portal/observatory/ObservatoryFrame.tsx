"use client";

/**
 * Slice 1 of the Observatory mount: the vanilla app (public/apps/observatory)
 * runs in a same-origin iframe (CSP carve-out in next.config.mjs). It executes
 * its deterministic simulation entirely client-side. Server-backed persistence
 * and the AI copilot are wired in the next slice via an in-frame adapter that
 * calls /api/portal/observatory/* (same-origin cookies + the rsg_csrf token).
 */
export function ObservatoryFrame() {
  return (
    <iframe
      src="/apps/observatory/index.html"
      title="NEXUS Observatory"
      style={{ width: "100%", height: "calc(100dvh - 3.5rem)", border: 0, display: "block" }}
    />
  );
}
