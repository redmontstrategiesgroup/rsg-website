"use client";

import { useId, type ReactNode } from "react";

/** Shared presentational pieces for the simplified booking funnel. */

export function inputClass(error?: boolean) {
  return `w-full border bg-white/[0.03] px-4 py-3.5 text-base text-white outline-none transition focus:border-crimson/60 focus-visible:ring-1 focus-visible:ring-crimson/50 ${
    error ? "border-crimson/70" : "border-white/15"
  }`;
}

/** "Step X of 3" progress indicator with a segmented bar. */
export function ProgressSteps({
  current,
  labels,
}: {
  current: number; // 1-based
  labels: string[];
}) {
  return (
    <div aria-label={`Step ${current} of ${labels.length}: ${labels[current - 1]}`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/50">
          Step {current} of {labels.length}
        </p>
        <p className="text-sm text-white/70">{labels[current - 1]}</p>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {labels.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 transition-colors ${
              i < current ? "bg-crimson" : "bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Large touch-friendly selectable card. */
export function OptionCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[64px] border px-5 py-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
        selected
          ? "border-crimson/70 bg-crimson/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/30"
      }`}
    >
      <span className="block text-[0.95rem] font-medium text-white">
        {title}
      </span>
      {description && (
        <span className="mt-1 block text-xs leading-relaxed text-white/45">
          {description}
        </span>
      )}
    </button>
  );
}

/** Labeled form field with inline validation message. */
export function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-white/60">
        {label}
        {optional && <span className="ml-1.5 text-white/35">(optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="mb-2 text-xs text-white/40">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-crimson-light">
          {error}
        </p>
      )}
    </div>
  );
}

/** Single- or multi-select chip row for short optional questions. */
export function ChoiceChips({
  options,
  value,
  onChange,
  multi,
  label,
}: {
  options: string[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
  label: string;
}) {
  const selectedSet = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selectedSet.has(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (multi) {
                const next = new Set(selectedSet);
                if (active) next.delete(o);
                else next.add(o);
                onChange([...next]);
              } else {
                onChange(active ? "" : o);
              }
            }}
            className={`min-h-[40px] border px-3.5 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
              active
                ? "border-crimson/70 bg-crimson/10 text-white"
                : "border-white/15 text-white/70 hover:border-white/35"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Collapsible optional section (native disclosure — keyboard friendly). */
export function Expandable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="group border border-white/10 bg-white/[0.02]">
      <summary className="cursor-pointer select-none list-none px-5 py-4 text-sm font-medium text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {label}
      </summary>
      <div className="space-y-5 border-t border-white/10 px-5 py-5">
        {children}
      </div>
    </details>
  );
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function allTimezones(): string[] {
  try {
    const supported = Intl.supportedValuesOf?.("timeZone");
    if (supported?.length) return supported;
  } catch {
    /* older browsers */
  }
  return COMMON_TIMEZONES;
}

export function timezoneLabel(tz: string): string {
  try {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return `${tz.replace(/_/g, " ")}${offset ? ` (${offset})` : ""}`;
  } catch {
    return tz;
  }
}

export function TimezoneSelect({
  value,
  onChange,
  id,
  describedBy,
}: {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  describedBy?: string;
}) {
  const zones = allTimezones();
  const common = COMMON_TIMEZONES.filter((z) => zones.includes(z));
  const rest = zones.filter((z) => !common.includes(z));
  // Ensure the detected zone is always present even on fallback lists.
  const hasValue = common.includes(value) || rest.includes(value);

  return (
    <select
      id={id}
      aria-describedby={describedBy}
      className={inputClass()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!hasValue && <option value={value}>{timezoneLabel(value)}</option>}
      <optgroup label="United States">
        {common.map((z) => (
          <option key={z} value={z}>
            {timezoneLabel(z)}
          </option>
        ))}
      </optgroup>
      <optgroup label="All time zones">
        {rest.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
