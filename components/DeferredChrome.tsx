"use client";

import dynamic from "next/dynamic";

/**
 * Floating chrome that nobody needs on first paint.
 *
 * The chat panel opens on a tap and the email prompt waits 14 seconds, yet
 * both were in the initial bundle — and both pull in framer-motion, which is
 * the single largest dependency on the marketing site. Loading them on demand
 * keeps that weight off the critical path, which matters most on the 4G phone
 * connections this site is being tuned for.
 *
 * `ssr: false` is correct rather than merely convenient: neither renders
 * anything on the server (the chat starts closed, the prompt starts hidden),
 * so there is no markup to lose and no layout shift when they arrive.
 */
const ChatWidget = dynamic(
  () => import("./ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

const EmailCapture = dynamic(
  () => import("./EmailCapture").then((m) => m.EmailCapture),
  { ssr: false }
);

export function DeferredChrome() {
  return (
    <>
      <ChatWidget />
      <EmailCapture />
    </>
  );
}
