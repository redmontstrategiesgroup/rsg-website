"use client";

import { useCallback, useMemo, useState } from "react";
import type { FormQuestion, FormSection } from "@/lib/lifecycle/types";
import { isAnswered, visibleSections } from "@/lib/lifecycle/form-utils";
import { Field, ChoiceChips, inputClass } from "@/components/booking/ui";
import { Button, InfoTip } from "@/components/portal/ui";

/**
 * Shared multi-step form engine for the qualification flow, the business
 * systems assessment, and the preparation questionnaire. Handles conditional
 * sections/questions, per-section validation, autosave, progress, and an
 * optional review step. Presentation matches the booking funnel.
 */

export type FormFlowAnswers = Record<string, unknown>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateQuestion(q: FormQuestion, value: unknown): string | null {
  if (q.required && !isAnswered(value)) return "This one's required.";
  if (!isAnswered(value)) return null;
  const text = String(value);
  if (q.type === "email" && !EMAIL_RE.test(text)) return "That email doesn't look right.";
  if (q.type === "phone" && text.replace(/\D/g, "").length < 10) {
    return "Please enter a full phone number.";
  }
  if ((q.type === "text" || q.type === "textarea") && text.length > 4000) {
    return "That's a bit long — please shorten it.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: FormQuestion;
  value: unknown;
  error?: string;
  onChange: (next: unknown) => void;
}) {
  const label = (
    <>
      {question.label}
      {question.tooltip && <InfoTip text={question.tooltip} />}
    </>
  );

  switch (question.type) {
    case "chips":
      return (
        <div>
          <p className="mb-2 block text-sm text-white/60">
            {label}
            {!question.required && <span className="ml-1.5 text-white/35">(optional)</span>}
          </p>
          {question.help && <p className="mb-2 text-xs text-white/40">{question.help}</p>}
          <ChoiceChips
            label={question.label}
            options={(question.options ?? []).map((o) => o.label)}
            value={
              (question.options ?? []).find((o) => o.value === value)?.label ?? ""
            }
            onChange={(next) => {
              const opt = (question.options ?? []).find((o) => o.label === next);
              onChange(opt?.value ?? "");
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-crimson-light">{error}</p>
          )}
        </div>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const labels = selected
        .map((v) => (question.options ?? []).find((o) => o.value === v)?.label)
        .filter((l): l is string => Boolean(l));
      return (
        <div>
          <p className="mb-2 block text-sm text-white/60">
            {label}
            {!question.required && <span className="ml-1.5 text-white/35">(optional)</span>}
          </p>
          {question.help && <p className="mb-2 text-xs text-white/40">{question.help}</p>}
          <ChoiceChips
            label={question.label}
            multi
            options={(question.options ?? []).map((o) => o.label)}
            value={labels}
            onChange={(next) => {
              const arr = Array.isArray(next) ? next : [next];
              onChange(
                arr
                  .map((l) => (question.options ?? []).find((o) => o.label === l)?.value)
                  .filter(Boolean),
              );
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-crimson-light">{error}</p>
          )}
        </div>
      );
    }
    case "boolean":
      return (
        <div>
          <p className="mb-2 block text-sm text-white/60">{label}</p>
          {question.help && <p className="mb-2 text-xs text-white/40">{question.help}</p>}
          <ChoiceChips
            label={question.label}
            options={["Yes", "No"]}
            value={value === "true" ? "Yes" : value === "false" ? "No" : ""}
            onChange={(next) => onChange(next === "Yes" ? "true" : next === "No" ? "false" : "")}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-crimson-light">{error}</p>
          )}
        </div>
      );
    case "scale": {
      const [low, high] = question.scaleLabels ?? ["Not at all", "Completely"];
      const current = typeof value === "string" ? value : "";
      return (
        <div>
          <p className="mb-2 block text-sm text-white/60">{label}</p>
          {question.help && <p className="mb-2 text-xs text-white/40">{question.help}</p>}
          <div className="flex items-center gap-2" role="group" aria-label={question.label}>
            {["1", "2", "3", "4", "5"].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={current === n}
                onClick={() => onChange(current === n ? "" : n)}
                className={`min-h-[44px] flex-1 border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
                  current === n
                    ? "border-crimson/70 bg-crimson/10 text-white"
                    : "border-white/15 text-white/60 hover:border-white/35"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[0.65rem] text-white/35">
            <span>{low}</span>
            <span>{high}</span>
          </div>
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-crimson-light">{error}</p>
          )}
        </div>
      );
    }
    case "select":
      return (
        <Field
          label={question.label}
          error={error}
          hint={question.help}
          optional={!question.required}
        >
          {(props) => (
            <select
              {...props}
              className={inputClass(Boolean(error))}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">Choose one…</option>
              {(question.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      );
    case "textarea":
      return (
        <Field
          label={question.label}
          error={error}
          hint={question.help}
          optional={!question.required}
        >
          {(props) => (
            <textarea
              {...props}
              rows={3}
              className={inputClass(Boolean(error))}
              placeholder={question.placeholder}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </Field>
      );
    default:
      // text / email / phone / url / file-note
      return (
        <Field
          label={question.label}
          error={error}
          hint={question.help}
          optional={!question.required}
        >
          {(props) => (
            <input
              {...props}
              type={
                question.type === "email"
                  ? "email"
                  : question.type === "phone"
                    ? "tel"
                    : question.type === "url"
                      ? "url"
                      : "text"
              }
              className={inputClass(Boolean(error))}
              placeholder={question.placeholder}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </Field>
      );
  }
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

export function FormFlow({
  sections,
  initialAnswers = {},
  onSaveSection,
  onSubmit,
  submitLabel = "Submit",
  showReview = true,
  footer,
}: {
  sections: FormSection[];
  initialAnswers?: FormFlowAnswers;
  /** Called when a section advances (autosave). Failures surface inline. */
  onSaveSection?: (
    entries: { sectionKey: string; questionKey: string; answer: unknown }[],
    sectionKey: string,
  ) => Promise<void>;
  onSubmit: (answers: FormFlowAnswers) => Promise<void>;
  submitLabel?: string;
  showReview?: boolean;
  footer?: React.ReactNode;
}) {
  const [answers, setAnswers] = useState<FormFlowAnswers>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const active = useMemo(() => visibleSections(sections, answers), [sections, answers]);
  const clamped = Math.min(stepIndex, Math.max(0, active.length - 1));
  const section = active[clamped];
  const remainingMinutes = active
    .slice(clamped)
    .reduce((sum, s) => sum + (s.estimatedMinutes ?? 1), 0);

  const setAnswer = useCallback((key: string, next: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: next }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const validateSection = useCallback((): boolean => {
    if (!section) return true;
    const next: Record<string, string> = {};
    for (const q of section.questions) {
      const error = validateQuestion(q, answers[q.key]);
      if (error) next[q.key] = error;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [section, answers]);

  const persistSection = useCallback(async () => {
    if (!onSaveSection || !section) return;
    const entries = section.questions
      .filter((q) => isAnswered(answers[q.key]))
      .map((q) => ({ sectionKey: section.key, questionKey: q.key, answer: answers[q.key] }));
    await onSaveSection(entries, section.key);
  }, [onSaveSection, section, answers]);

  const advance = useCallback(async () => {
    if (!validateSection()) return;
    setFlowError(null);
    setBusy(true);
    try {
      await persistSection();
      if (clamped >= active.length - 1) {
        if (showReview) setReviewing(true);
        else await onSubmit(answers);
      } else {
        setStepIndex(clamped + 1);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      setFlowError(
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong saving your answers. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [validateSection, persistSection, clamped, active.length, showReview, onSubmit, answers]);

  const submit = useCallback(async () => {
    setFlowError(null);
    setBusy(true);
    try {
      await onSubmit(answers);
    } catch (error) {
      setFlowError(
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong submitting. Please try again.",
      );
      setBusy(false);
    }
  }, [onSubmit, answers]);

  if (!section) return null;

  // ---- Review screen ------------------------------------------------------
  if (reviewing) {
    return (
      <div className="animate-fade-up">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/50">
          Review your answers
        </p>
        <div className="mt-5 space-y-6">
          {active.map((s, i) => (
            <div key={s.key} className="border border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{s.label}</p>
                <button
                  type="button"
                  className="link-underline text-xs text-white/50 hover:text-white"
                  onClick={() => {
                    setReviewing(false);
                    setStepIndex(i);
                  }}
                >
                  Edit
                </button>
              </div>
              <dl className="mt-3 space-y-2">
                {s.questions
                  .filter((q) => isAnswered(answers[q.key]))
                  .map((q) => {
                    const value = answers[q.key];
                    const display = Array.isArray(value)
                      ? (value as string[])
                          .map(
                            (v) =>
                              (q.options ?? []).find((o) => o.value === v)?.label ?? v,
                          )
                          .join(", ")
                      : ((q.options ?? []).find((o) => o.value === value)?.label ??
                        String(value));
                    return (
                      <div key={q.key} className="flex flex-wrap items-baseline gap-x-3">
                        <dt className="text-xs text-white/40">{q.label}</dt>
                        <dd className="text-sm text-white/80">{display}</dd>
                      </div>
                    );
                  })}
              </dl>
            </div>
          ))}
        </div>
        {flowError && (
          <p role="alert" className="mt-4 text-sm text-crimson-light">{flowError}</p>
        )}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => setReviewing(false)} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} busy={busy}>
            {submitLabel}
          </Button>
        </div>
        {footer}
      </div>
    );
  }

  // ---- Section screen -----------------------------------------------------
  return (
    <div key={section.key} className="animate-fade-up">
      <div aria-label={`Step ${clamped + 1} of ${active.length}: ${section.label}`}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/50">
            Step {clamped + 1} of {active.length}
          </p>
          <p className="text-xs text-white/40">
            ~{Math.max(1, remainingMinutes)} min remaining
          </p>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {active.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 transition-colors ${i <= clamped ? "bg-crimson" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      <h2 className="display mt-8 text-xl sm:text-2xl">{section.label}</h2>
      {section.description && (
        <p className="mt-2 text-sm leading-relaxed text-white/50">{section.description}</p>
      )}

      <div className="mt-8 space-y-6">
        {section.questions.map((q) => (
          <QuestionField
            key={q.key}
            question={q}
            value={answers[q.key]}
            error={errors[q.key]}
            onChange={(next) => setAnswer(q.key, next)}
          />
        ))}
      </div>

      {flowError && (
        <p role="alert" className="mt-4 text-sm text-crimson-light">{flowError}</p>
      )}

      <div className="mt-10 flex items-center justify-between gap-4">
        {clamped > 0 ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setStepIndex(clamped - 1)}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={advance} busy={busy}>
          {clamped >= active.length - 1 && !showReview ? submitLabel : "Continue"}
        </Button>
      </div>
      {footer}
    </div>
  );
}
