"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { trackEvent } from "@/lib/events";
import { postJson } from "@/lib/api";
import { loadSession } from "./storage";
import type { IndustryConfig } from "./types";
import { Modal } from "./ui/Modal";
import { CheckboxInput, Field, SelectInput, SmallButton, TextArea, TextInput } from "./ui/fields";

/** Default service list — industries can override via config.requestServices. */
export const SERVICE_OPTIONS = [
  "Custom private AI systems",
  "AI receptionist & missed-call recovery",
  "Automated follow-up sequences",
  "Lead pipeline & CRM",
  "Online scheduling & reminders",
  "Instant quotes & estimate follow-up",
  "Reactivation & marketing campaigns",
  "Reviews & reputation",
  "Reporting & analytics",
] as const;

/**
 * Explored-key pattern → pattern that picks the matching option from the
 * ACTIVE service list (which differs per industry).
 */
const FEATURE_HINTS: [RegExp, RegExp][] = [
  [/receptionist|missed.?call|store assistant/i, /receptionist|store assistant|missed.?call/i],
  [/follow.?up|workflow|automation|no.?show|win.?back|welcome|cart/i, /follow.?up|automation|retention/i],
  [/pipeline|record|intake/i, /pipeline|crm|customer/i],
  [/appointment|calendar|booked|reschedul/i, /scheduling|reminder/i],
  [/quote|estimate|treatment plan/i, /quote|estimate/i],
  [/campaign|reactivat|markdown/i, /campaign|marketing/i],
  [/review/i, /review/i],
  [/analytics/i, /analytics|reporting|dashboard/i],
  [/loyalty|reward|tier/i, /loyalty|referral/i],
  [/inventory|stock|purchase order/i, /inventory|dashboard/i],
];

const BUSINESS_SIZES = ["Just me", "2 – 5 people", "6 – 20 people", "21 – 50 people", "50+ people"];

const TIME_WINDOWS = ["Flexible", "Morning (8–12)", "Afternoon (12–4)", "Evening (4–7)"];

function servicesFromExplored(explored: string[], options: string[], initial?: string): string[] {
  const picked = new Set<string>();
  if (initial && options.includes(initial)) picked.add(initial);
  for (const key of explored) {
    for (const [exploredRe, optionRe] of FEATURE_HINTS) {
      if (!exploredRe.test(key)) continue;
      const match = options.find((o) => optionRe.test(o));
      if (match) picked.add(match);
    }
  }
  return [...picked];
}

/** Turn tracked keys like "explored receptionist" into readable phrases. */
function humanize(key: string): string {
  return key
    .replace(/^explored (\w+)$/, "the $1 section")
    .replace(/^simulated: /, "simulated ");
}

/**
 * "Request this system" consultation form — a short two-step flow. Step 1
 * covers what the visitor needs (services + industry-specific questions),
 * step 2 covers how to reach them. Pre-fills demo context (system viewed,
 * features explored) visibly and editably; submits a real inquiry to the RSG
 * team — the only demo surface that ever leaves the browser.
 */
export function RequestSystemDialog({
  config,
  onClose,
  initialFeature,
  source = "demo_page",
}: {
  config: IndustryConfig;
  onClose: () => void;
  initialFeature?: string;
  source?: string;
}) {
  // Snapshot the visitor's demo session once, when the dialog opens.
  const session = useMemo(() => loadSession(config.slug), [config.slug]);
  const explored = useMemo(() => session?.explored ?? [], [session]);
  const scenariosRun = Object.keys(session?.scenarioRuns ?? {}).length;
  const customBusinessName =
    session && session.settings.businessName !== config.businessName
      ? session.settings.businessName
      : "";
  const serviceOptions = useMemo(
    () => config.requestServices ?? [...SERVICE_OPTIONS],
    [config.requestServices],
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [company, setCompany] = useState(customBusinessName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [businessSize, setBusinessSize] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState(TIME_WINDOWS[0]);
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<string[]>(() =>
    servicesFromExplored(explored, serviceOptions, initialFeature),
  );
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState(""); // honeypot — humans never see or fill this
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const dateId = useId();
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    trackEvent("demo_request_open", { demo: config.slug, source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Moving between steps unmounts the focused button — put keyboard and
  // screen-reader users back at the step heading so the change is announced.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  // Announce validation failures and move focus to the summary.
  useEffect(() => {
    if (Object.keys(errors).length > 0) errorSummaryRef.current?.focus();
  }, [errors]);

  const toggleService = (s: string) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const todayIso = new Date().toISOString().slice(0, 10);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Please enter your name";
    if (!company.trim()) errs.company = "Please enter your company name";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email";
    if (phone.replace(/\D/g, "").length < 10) errs.phone = "Enter a valid phone number";
    if (!consent) errs.consent = "Please confirm so we can reply to you";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const filledExtras = Object.fromEntries(
      Object.entries(extras).filter(([, v]) => v.trim().length > 0),
    );

    setStatus("submitting");
    setServerError("");
    try {
      const res = await postJson("/api/demorequest", {
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredContact,
        businessSize: businessSize || undefined,
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTime === TIME_WINDOWS[0] ? undefined : preferredTime,
        notes: notes.trim() || undefined,
        services,
        extras: Object.keys(filledExtras).length ? filledExtras : undefined,
        demoSlug: config.slug,
        featuresExplored: explored.slice(0, 30),
        scenariosRun,
        demoBusinessName: customBusinessName || undefined,
        problem: session?.settings.personalization.problem || undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        hp,
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setServerError(data?.error ?? "Something went wrong — please try again in a minute.");
        setStatus("error");
        return;
      }
      trackEvent("demo_request_submit", { demo: config.slug, source });
      setStatus("success");
    } catch {
      setServerError("Network error — please check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <Modal title="Request received" subtitle={config.systemName} onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 size={20} className="text-emerald-400" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-white/90">
              Thanks {name.split(" ")[0]} — your request is on its way to the RSG team.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/55">
              We&apos;ll reach out by {preferredContact} within one business day with next steps and
              a walkthrough tailored to {company}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/book" className="btn-primary px-5 py-2.5 text-xs">
              Prefer to pick a time now? Book a call
              <ArrowRight size={12} className="ml-1.5" aria-hidden />
            </Link>
            <button type="button" onClick={onClose} className="btn-ghost px-5 py-2.5 text-xs">
              Back to the demo
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Request this system for my business"
      subtitle={`${config.systemName} — configured for your ${config.industry.toLowerCase()} operation`}
      onClose={onClose}
      wide
    >
      {/* Progress */}
      <div className="mb-4">
        <p
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-white/40 outline-none"
        >
          Step {step} of 2 — {step === 1 ? "what you need" : "how to reach you"}
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {[1, 2].map((s) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-crimson" : "bg-white/10"}`} />
          ))}
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        {step === 1 && (
          <div className="space-y-4">
            {/* Demo context — visible and editable, never silently attached */}
            <div className="rounded-lg border border-crimson/20 bg-crimson/[0.05] px-3.5 py-3">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-crimson-light/90">
                Your demo session
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                {explored.length > 0 ? (
                  <>
                    You explored{" "}
                    {explored
                      .slice(0, 6)
                      .map((k) => humanize(k).toLowerCase())
                      .join(", ")}
                    {explored.length > 6 ? ` and ${explored.length - 6} more features` : ""}
                    {scenariosRun > 0 ? `, and ran ${scenariosRun} scenario${scenariosRun > 1 ? "s" : ""}` : ""}
                    . We&apos;ve preselected the matching services below — adjust them however you like.
                  </>
                ) : (
                  <>We&apos;ll include which demo you viewed ({config.systemName}) so the conversation starts in the right place.</>
                )}
              </p>
            </div>

            {/* Services */}
            <fieldset>
              <legend className="mb-2 block text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/45">
                What should your system include?
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {serviceOptions.map((s) => (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2 text-xs transition-colors ${
                      services.includes(s)
                        ? "border-crimson/50 bg-crimson/[0.08] text-white/90"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={services.includes(s)}
                      onChange={() => toggleService(s)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-base-900 accent-[#b3243a]"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Industry-specific qualification questions (all optional) */}
            {(config.requestExtras?.length ?? 0) > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {config.requestExtras?.map((q) => (
                  <SelectInput
                    key={q.id}
                    label={q.label}
                    value={extras[q.id] ?? ""}
                    onChange={(v) => setExtras((prev) => ({ ...prev, [q.id]: v }))}
                    options={q.options.map((o) => ({ value: o, label: o }))}
                    placeholder="Select…"
                    helper={q.helper}
                  />
                ))}
              </div>
            )}

            <TextArea
              label="What's your biggest challenge right now?"
              value={notes}
              onChange={setNotes}
              rows={3}
              helper="Optional — current tools, bottlenecks, goals…"
            />

            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <SmallButton onClick={onClose}>Cancel</SmallButton>
              <button type="button" onClick={() => setStep(2)} className="btn-primary px-5 py-2.5 text-xs">
                Continue
                <ArrowRight size={12} className="ml-1.5" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {Object.keys(errors).length > 0 && (
              <p
                ref={errorSummaryRef}
                tabIndex={-1}
                role="alert"
                className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300/90 outline-none"
              >
                Please fix the highlighted fields below, then send again.
              </p>
            )}
            {/* Contact details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Your name" value={name} onChange={setName} required error={errors.name} placeholder="Jordan Ellis" />
              <TextInput label="Company name" value={company} onChange={setCompany} required error={errors.company} placeholder="Your business" />
              <TextInput label="Email" value={email} onChange={setEmail} type="email" required error={errors.email} placeholder="you@company.com" />
              <TextInput label="Phone" value={phone} onChange={setPhone} type="tel" required error={errors.phone} placeholder="(508) 555-0100" />
              <SelectInput
                label="Preferred contact method"
                value={preferredContact}
                onChange={setPreferredContact}
                options={[
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone call" },
                  { value: "text", label: "Text message" },
                ]}
              />
              <SelectInput
                label="Team size"
                value={businessSize}
                onChange={setBusinessSize}
                options={BUSINESS_SIZES.map((b) => ({ value: b, label: b }))}
                placeholder="Optional"
              />
              <Field label="Preferred meeting date" helper="Optional — we'll confirm by email" htmlFor={dateId}>
                <input
                  id={dateId}
                  type="date"
                  value={preferredDate}
                  min={todayIso}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full rounded border border-white/12 bg-base-900 px-3 py-2 text-xs text-white/85 [color-scheme:dark] focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40"
                />
              </Field>
              <SelectInput
                label="Best time of day"
                value={preferredTime}
                onChange={setPreferredTime}
                options={TIME_WINDOWS.map((t) => ({ value: t, label: t }))}
              />
            </div>

            {/* Honeypot — hidden from real users, catches naive bots */}
            <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              <label>
                Leave this field empty
                <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
              </label>
            </div>

            <div>
              <CheckboxInput
                label="It's OK to contact me about this request."
                checked={consent}
                onChange={setConsent}
                helper="We only use your details to respond — no lists, no spam."
              />
              {errors.consent && <p className="mt-1 text-[0.64rem] text-red-300/90">{errors.consent}</p>}
            </div>

            {status === "error" && (
              <p role="alert" className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
                {serverError}
              </p>
            )}

            <div className="flex flex-col-reverse items-stretch gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.62rem] leading-relaxed text-white/35">
                This form is the only part of the demo that contacts a real person.
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <SmallButton onClick={() => setStep(1)}>
                  <ArrowLeft size={11} aria-hidden /> Back
                </SmallButton>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="btn-primary px-5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={12} className="mr-1.5" aria-hidden />
                  {status === "submitting" ? "Sending…" : "Send my request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
