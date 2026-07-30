"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Loader2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { postJson } from "@/lib/api";
import { trackEvent } from "@/lib/events";
import type { IndustryVertical, RsgSystem } from "@/lib/industries/types";

/**
 * Vertical-specific assessment. Questions adapt to the industry, answers
 * drive a system recommendation BEFORE the visitor is asked to book, and the
 * submission lands in the admin lead pipeline via /api/assessment.
 */
export function AssessmentForm({ vertical }: { vertical: IndustryVertical }) {
  const questions = vertical.assessment.questions;
  const half = Math.ceil(questions.length / 2);
  const pages = useMemo(() => [questions.slice(0, half), questions.slice(half)], [questions, half]);

  const [step, setStep] = useState(0); // 0,1 = question pages; 2 = contact; 3 = result
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: "", company: "", email: "", phone: "" });
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  const recommended = useMemo(
    () => recommendSystem(vertical, answers),
    [vertical, answers]
  );

  const setAnswer = (id: string, value: string) => {
    if (!started) {
      setStarted(true);
      trackEvent("assessment_start", { form: "industry_assessment", vertical: vertical.slug });
    }
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const pageComplete = (page: number) =>
    pages[page].every((q) => !q.required || (answers[q.id] ?? "").trim().length > 0);

  const contactValid =
    contact.name.trim().length > 1 &&
    /.+@.+\..+/.test(contact.email) &&
    contact.email.length <= 200;

  async function submit() {
    if (!contactValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await postJson("/api/assessment", {
        vertical: vertical.slug,
        answers,
        contact,
        recommendedSystemId: recommended.id,
        pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
        hp,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong — please try again or email us directly.");
        return;
      }
      trackEvent("assessment_complete", { form: "industry_assessment", vertical: vertical.slug });
      setStep(3);
    } catch {
      setError("Something went wrong — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="assessment" className="scroll-mt-24 border-y border-white/[0.08] bg-base-900">
      <div className="container-px section-y">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <Reveal y={12}>
              <p className="label flex items-center gap-2">
                <ClipboardList size={13} aria-hidden />
                {vertical.shortName} assessment
              </p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
                {vertical.assessment.title}
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.14}>
              <p className="mt-6 text-[0.95rem] leading-relaxed text-white/55">
                {vertical.assessment.intro}
              </p>
            </Reveal>
            <Reveal y={12} delay={0.2}>
              <ol className="mt-9 space-y-3">
                {["Your operation", "Your current systems", "Where to send the assessment", "Your recommended starting point"].map(
                  (label, i) => (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.6rem] ${
                          step === i
                            ? "border-crimson bg-crimson/15 text-crimson-light"
                            : step > i
                              ? "border-crimson/40 bg-crimson/10 text-crimson-light/70"
                              : "border-white/15 text-white/35"
                        }`}
                      >
                        {step > i ? <Check size={11} aria-hidden /> : i + 1}
                      </span>
                      <span className={step === i ? "text-white/80" : "text-white/40"}>{label}</span>
                    </li>
                  )
                )}
              </ol>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <Reveal y={14} delay={0.1}>
              <div className="rounded-xl border border-white/10 bg-base/60 p-7 sm:p-9">
                {step <= 1 && (
                  <fieldset>
                    <legend className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                      {step === 0 ? "Part 1 — your operation" : "Part 2 — your current systems"}
                    </legend>
                    <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                      {pages[step].map((q) => (
                        <div key={q.id} className={q.type === "text" ? "sm:col-span-2" : ""}>
                          <label
                            htmlFor={`aq-${vertical.slug}-${q.id}`}
                            className="block text-[0.82rem] leading-snug text-white/60"
                          >
                            {q.label}
                            {q.required && <span className="ml-1 text-crimson-light">*</span>}
                          </label>
                          {q.type === "select" ? (
                            <select
                              id={`aq-${vertical.slug}-${q.id}`}
                              value={answers[q.id] ?? ""}
                              onChange={(e) => setAnswer(q.id, e.target.value)}
                              className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 focus:border-crimson/60 focus:outline-none"
                            >
                              <option value="" disabled>
                                Select…
                              </option>
                              {(q.options ?? []).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`aq-${vertical.slug}-${q.id}`}
                              type={q.type === "number" ? "number" : "text"}
                              inputMode={q.type === "number" ? "numeric" : undefined}
                              value={answers[q.id] ?? ""}
                              placeholder={q.placeholder}
                              maxLength={300}
                              onChange={(e) => setAnswer(q.id, e.target.value)}
                              className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none"
                            />
                          )}
                          {q.helper && (
                            <p className="mt-1.5 text-[0.75rem] sm:text-[0.68rem] leading-relaxed text-white/35">{q.helper}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                )}

                {step === 2 && (
                  <fieldset>
                    <legend className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                      Part 3 — where to send the assessment
                    </legend>
                    <p className="mt-4 text-sm leading-relaxed text-white/50">
                      Based on your answers we&apos;ll show your recommended starting point immediately,
                      and follow up with a short written read on where your operation is losing the most.
                    </p>
                    <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                      <ContactField
                        label="Your name" required value={contact.name}
                        onChange={(v) => setContact((c) => ({ ...c, name: v }))}
                      />
                      <ContactField
                        label="Business name" value={contact.company}
                        onChange={(v) => setContact((c) => ({ ...c, company: v }))}
                      />
                      <ContactField
                        label="Email" type="email" required value={contact.email}
                        onChange={(v) => setContact((c) => ({ ...c, email: v }))}
                      />
                      <ContactField
                        label="Phone" type="tel" value={contact.phone}
                        onChange={(v) => setContact((c) => ({ ...c, phone: v }))}
                      />
                    </div>
                    {/* Honeypot — invisible to humans */}
                    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                      <label>
                        Leave this field empty
                        <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
                      </label>
                    </div>
                    {error && (
                      <p role="alert" className="mt-5 rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson-light">
                        {error}
                      </p>
                    )}
                  </fieldset>
                )}

                {step === 3 && (
                  <div>
                    <p className="flex items-center gap-2.5 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-crimson-light">
                      <Check size={13} aria-hidden />
                      Assessment received
                    </p>
                    <h3 className="display mt-5 text-xl text-white sm:text-2xl">
                      Your recommended starting point: {recommended.name}
                    </h3>
                    <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-white/55">
                      {recommended.outcome}
                    </p>
                    <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                      {recommended.capabilities.slice(0, 4).map((c) => (
                        <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                          <Check size={14} aria-hidden className="mt-1 shrink-0 text-crimson-light/70" />
                          {c}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-6 text-sm leading-relaxed text-white/45">
                      We&apos;ll review your answers and follow up within one business day. If you&apos;d
                      rather talk it through now, book a strategy call and we&apos;ll walk your workflow together.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-4">
                      <Link href="/book" className="btn-primary">
                        Book a strategy call
                        <ArrowRight size={15} className="ml-2" aria-hidden />
                      </Link>
                      <Link href={`/demos/${vertical.demoSlug}`} className="btn-ghost">
                        Explore the demo meanwhile
                      </Link>
                    </div>
                  </div>
                )}

                {step < 3 && (
                  <div className="mt-9 flex items-center justify-between border-t border-white/[0.08] pt-6">
                    <button
                      type="button"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                      className="inline-flex min-h-11 items-center gap-2 text-sm text-white/45 transition-colors hover:text-white disabled:invisible lg:min-h-0"
                    >
                      <ArrowLeft size={14} aria-hidden />
                      Back
                    </button>
                    {step < 2 ? (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={!pageComplete(step)}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Continue
                        <ArrowRight size={15} className="ml-2" aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={submit}
                        disabled={!contactValid || submitting}
                        className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={15} className="mr-2 animate-spin" aria-hidden />
                            Sending…
                          </>
                        ) : (
                          <>
                            Get my recommendation
                            <ArrowRight size={15} className="ml-2" aria-hidden />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = `assess-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[0.82rem] leading-snug text-white/60">
        {label}
        {required && <span className="ml-1 text-crimson-light">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 focus:border-crimson/60 focus:outline-none"
      />
    </div>
  );
}

/** Keyword-match the visitor's answers against the vertical's rules. */
export function recommendSystem(
  vertical: IndustryVertical,
  answers: Record<string, string>
): RsgSystem {
  const haystack = Object.values(answers).join(" ").toLowerCase();
  for (const rule of vertical.assessment.recommendations) {
    if (rule.keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      const system = vertical.systems.find((s) => s.id === rule.systemId);
      if (system) return system;
    }
  }
  return (
    vertical.systems.find((s) => s.id === vertical.assessment.fallbackSystemId) ??
    vertical.systems[0]
  );
}
