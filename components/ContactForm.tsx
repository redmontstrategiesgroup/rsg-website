"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { submitContactForm } from "@/app/actions/contact";
import { getTracking } from "@/lib/tracking";
import { trackEvent } from "@/lib/events";
import { Turnstile } from "./Turnstile";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const INDUSTRIES = [
  "Med spa / aesthetic clinic",
  "Gym / fitness studio",
  "Dental office",
  "Wellness clinic",
  "Home services / contracting",
  "Cleaning company",
  "Other local service business",
  "High-ticket services",
  "Other",
];

const CONTACT_METHODS = ["Call", "Text", "Email"];
const BEST_TIMES = ["Morning", "Afternoon", "Evening"];
const TIMELINES = ["Immediately", "This month", "Next 90 days", "Just exploring"];

type FormState = {
  name: string;
  company: string;
  website: string;
  email: string;
  phone: string;
  industry: string;
  problem: string;
  improve: string;
  preferredContact: string;
  bestTime: string;
  timeline: string;
};

const EMPTY: FormState = {
  name: "",
  company: "",
  website: "",
  email: "",
  phone: "",
  industry: "",
  problem: "",
  improve: "",
  preferredContact: "",
  bestTime: "",
  timeline: "",
};

const DRAFT_KEY = "rsg_contact_draft";

export function ContactForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bot checks: honeypot field + time-to-submit.
  const [trap, setTrap] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  // Remount key: Turnstile tokens are single-use, so re-render after attempts.
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const mountedAt = useRef(Date.now());
  const restored = useRef(false);
  const startedRef = useRef(false);

  // Preserve whatever the visitor has typed until they actually submit.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormState>;
        setForm((f) => ({ ...f, ...draft }));
      }
    } catch {
      /* corrupt or unavailable draft — start clean */
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      const hasContent = Object.values(form).some((v) => v.trim());
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [form]);

  const update =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      if (!startedRef.current) {
        startedRef.current = true;
        trackEvent("contact_form_start");
      }
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the verification above the submit button.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitContactForm({
        ...form,
        ...getTracking(),
        company_site: trap,
        elapsedMs: Date.now() - mountedAt.current,
        turnstileToken,
      });
      if (!result.ok) {
        setError(result.error);
        // Tokens are single-use — refresh the widget for the retry.
        setTurnstileToken("");
        setTurnstileNonce((n) => n + 1);
        setSubmitting(false);
        return;
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      trackEvent("contact_form_submit");
      setSubmitted(true);
      router.push("/thank-you");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-white/10 bg-base-900 p-7 sm:p-10">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-14"
          >
            <div className="h-px w-12 bg-crimson-light/80" />
            <h3 className="mt-8 font-display text-2xl font-medium text-white">
              Request received.
            </h3>
            <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-white/55">
              Thank you. We&rsquo;ll review your business and reach out to
              schedule your strategy call.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={onSubmit}
            className="relative"
          >
            {/* Honeypot — clipped in-place so it cannot widen the page */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden opacity-0"
            >
              <label>
                Company site
                <input
                  type="text"
                  name="company_site"
                  tabIndex={-1}
                  autoComplete="off"
                  value={trap}
                  onChange={(e) => setTrap(e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <input required value={form.name} onChange={update("name")} className={input} placeholder="Full name" autoComplete="name" />
              </Field>
              <Field label="Business name" required>
                <input required value={form.company} onChange={update("company")} className={input} placeholder="Business name" autoComplete="organization" />
              </Field>
              <Field label="Email" required>
                <input type="email" required value={form.email} onChange={update("email")} className={input} placeholder="Email address" autoComplete="email" />
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={update("phone")} className={input} placeholder="Phone number" autoComplete="tel" />
              </Field>
              <Field label="Website">
                <input value={form.website} onChange={update("website")} className={input} placeholder="Website" autoComplete="url" />
              </Field>
              <Field label="Industry">
                <select value={form.industry} onChange={update("industry")} className={select}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred contact method">
                <select value={form.preferredContact} onChange={update("preferredContact")} className={select}>
                  <option value="">No preference</option>
                  {CONTACT_METHODS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Best time to contact">
                <select value={form.bestTime} onChange={update("bestTime")} className={select}>
                  <option value="">No preference</option>
                  {BEST_TIMES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Timeline" className="sm:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIMELINES.map((t) => {
                    const active = form.timeline === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setForm((f) => ({ ...f, timeline: active ? "" : t }))
                        }
                        className={`border px-3 py-2.5 text-[0.8rem] transition-colors ${
                          active
                            ? "border-crimson/60 bg-crimson-soft text-white"
                            : "border-white/15 text-white/55 hover:border-white/35 hover:text-white/80"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Biggest problem right now" required className="sm:col-span-2">
                <textarea required value={form.problem} onChange={update("problem")} rows={3} className={`${input} resize-none`} placeholder="Where is the business losing time, leads, or money?" />
              </Field>
              <Field label="What do you want to improve?" className="sm:col-span-2">
                <textarea value={form.improve} onChange={update("improve")} rows={3} className={`${input} resize-none`} placeholder="Follow-up, website conversion, operations, AI implementation…" />
              </Field>
            </div>

            {TURNSTILE_SITE_KEY && (
              <div className="mt-5">
                <Turnstile
                  key={turnstileNonce}
                  siteKey={TURNSTILE_SITE_KEY}
                  onToken={setTurnstileToken}
                />
              </div>
            )}

            {error && (
              <p className="mt-4 border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary mt-7 w-full gap-2.5 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Book a Strategy Call"
              )}
            </button>
            <p className="mt-4 text-center text-xs text-white/35">
              Your details are only used to follow up about your business.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

const input =
  "w-full border border-white/15 bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-white/25 transition-colors focus:border-white/50 focus:outline-none";
const select = `${input} appearance-none pr-9`;

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/50">
        {label}
        {required && <span className="ml-1 text-crimson-light">*</span>}
      </span>
      {children}
    </label>
  );
}
