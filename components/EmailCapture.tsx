"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { postJson } from "@/lib/api";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";

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

  const dismiss = useCallback(() => {
    try {
      if (!done) localStorage.setItem(STORAGE_KEY, `dismissed:${Date.now()}`);
    } catch {
      /* storage unavailable: nothing to persist */
    }
    setOpen(false);
  }, [done]);

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

  if (!open) return null;

  return (
    <Dialog
      title="Subscribe to RSG notes"
      onClose={dismiss}
      size="sm"
      zIndexClassName="z-50"
      hideHeader
      panelClassName="relative bg-base-900 [&>div]:p-8 [&>div]:sm:p-10"
    >
      {done ? (
        <div>
          <div className="h-px w-12 bg-crimson-light/80" />
          <h2 className="display mt-7 text-2xl text-white">
            You&rsquo;re on the list.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Occasional notes on business systems and practical AI. Every
            email carries an unsubscribe link.
          </p>
          <button type="button" onClick={dismiss} className="btn-ghost mt-8 px-6 py-3 text-[0.82rem]">
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
            <span className="text-white/45">in your inbox.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/55">
            Short, occasional notes on business systems, follow-up, and
            practical AI implementation for service businesses. No fluff,
            unsubscribe anytime.
          </p>

          <form onSubmit={subscribe} className="relative mt-7">
            {/* Honeypot: clipped in-place so it cannot widen the page */}
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
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="go"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
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
            type="button"
            onClick={dismiss}
            className="-ml-2 mt-3 inline-flex min-h-11 items-center px-2 text-xs text-white/35 transition-colors hover:text-white/60 lg:min-h-0"
          >
            No thanks
          </button>
        </div>
      )}

      <IconButton
        onClick={dismiss}
        aria-label="Close"
        className="absolute right-1 top-1 text-white/40 hover:text-white"
      >
        <X size={16} />
      </IconButton>
    </Dialog>
  );
}
