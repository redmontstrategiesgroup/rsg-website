"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { postJson } from "@/lib/api";

/**
 * One-time email capture for the marketing list. Appears once per visitor
 * (after a delay or meaningful scroll), never on the booking funnel, and stays
 * gone once subscribed or dismissed (30-day snooze on dismiss).
 */

const STORAGE_KEY = "rsg_email_capture";
const DISMISS_DAYS = 30;
const DELAY_MS = 14_000;
const SCROLL_TRIGGER = 0.35;

function isSuppressed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    if (raw === "subscribed") return true;
    if (raw.startsWith("dismissed:")) {
      const ts = Number(raw.slice("dismissed:".length));
      return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    }
    return false;
  } catch {
    return true;
  }
}

/** Wait for the cookie banner to be answered before interrupting. */
function consentDecided(): boolean {
  return document.cookie.includes("rsg_consent=");
}

export function EmailCapture() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firedRef = useRef(false);

  const suppressedRoute =
    pathname === "/book" || pathname.startsWith("/book/");

  useEffect(() => {
    if (suppressedRoute || isSuppressed()) return;

    const tryOpen = () => {
      if (firedRef.current) return;
      if (!consentDecided()) return; // don't stack on the cookie banner
      firedRef.current = true;
      setOpen(true);
    };

    const deadline = Date.now() + DELAY_MS;
    const timer = setTimeout(tryOpen, DELAY_MS);
    // Re-check every 1.5s: opens early on deep scroll, and covers the case
    // where the cookie banner was still unanswered when the timer fired.
    const retry = setInterval(() => {
      if (firedRef.current) {
        clearInterval(retry);
        return;
      }
      const el = document.documentElement;
      const scrolled =
        el.scrollHeight > el.clientHeight &&
        window.scrollY / (el.scrollHeight - el.clientHeight) > SCROLL_TRIGGER;
      if (scrolled || Date.now() >= deadline) tryOpen();
    }, 1_500);

    return () => {
      clearTimeout(timer);
      clearInterval(retry);
    };
  }, [suppressedRoute]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss() {
    try {
      if (!done) localStorage.setItem(STORAGE_KEY, `dismissed:${Date.now()}`);
    } catch {
      /* storage unavailable — nothing to persist */
    }
    setOpen(false);
  }

  async function subscribe(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/subscribe", {
        email,
        source: "popup",
        confirm_email: trap,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      try {
        localStorage.setItem(STORAGE_KEY, "subscribed");
      } catch {
        /* storage unavailable */
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Subscribe to RSG notes"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md border border-white/15 bg-base-900 p-8 shadow-lift sm:p-10"
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center text-white/40 transition-colors hover:text-white"
            >
              <X size={16} />
            </button>

            {done ? (
              <div>
                <div className="h-px w-12 bg-crimson-light/80" />
                <h2 className="display mt-7 text-2xl text-white">
                  You&rsquo;re on the list.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/55">
                  One short email a month. If it stops being useful,
                  unsubscribe in one click.
                </p>
                <button onClick={dismiss} className="btn-ghost mt-8 px-6 py-3 text-[0.82rem]">
                  Back to the site
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-white/40">
                  From RSG
                </p>
                <h2 className="display mt-5 text-[1.7rem] leading-[1.1] text-white">
                  Sharper systems,
                  <br />
                  <span className="text-white/45">once a month.</span>
                </h2>
                <p className="mt-5 text-sm leading-relaxed text-white/55">
                  One short email on business systems, follow-up, and
                  practical AI implementation for service businesses. No fluff,
                  unsubscribe anytime.
                </p>

                <form onSubmit={subscribe} className="relative mt-7">
                  {/* Honeypot — clipped in-place so it cannot widen the page */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden opacity-0"
                  >
                    <label>
                      Confirm email
                      <input
                        type="text"
                        name="confirm_email"
                        tabIndex={-1}
                        autoComplete="off"
                        value={trap}
                        onChange={(e) => setTrap(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      ref={inputRef}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      maxLength={254}
                      className="w-full border border-white/15 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/25 transition-colors focus:border-white/50 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-primary shrink-0 px-6 py-3 text-[0.82rem] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : "Subscribe"}
                    </button>
                  </div>
                  {error && (
                    <p className="mt-3 text-sm text-crimson-light">{error}</p>
                  )}
                </form>

                <button
                  onClick={dismiss}
                  className="mt-5 text-xs text-white/35 transition-colors hover:text-white/60"
                >
                  No thanks
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
