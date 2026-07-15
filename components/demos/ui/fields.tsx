"use client";

import { useId, type ReactNode } from "react";

/** Small labelled form primitives shared across the demo OS dialogs. */

const inputClass =
  "w-full rounded border border-white/12 bg-base-900 px-3 py-2 text-xs text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40";

export function Field({
  label,
  helper,
  required,
  children,
  htmlFor,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/45">
        {label}
        {required && <span className="ml-1 text-crimson-light" aria-hidden>*</span>}
      </label>
      {children}
      {helper && <p className="mt-1 text-[0.64rem] text-white/35">{helper}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  helper,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  helper?: string;
  type?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <Field label={label} helper={error ?? helper} required={required} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-red-400/60" : ""}`}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  required,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  helper?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <Field label={label} helper={error ?? helper} required={required} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} resize-y ${error ? "border-red-400/60" : ""}`}
      />
    </Field>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  required,
  helper,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  helper?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} helper={helper} required={required} htmlFor={id}>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxInput({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  helper?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-base-900 accent-[#b3243a]"
      />
      <label htmlFor={id} className="text-xs text-white/70">
        {label}
        {helper && <span className="block text-[0.64rem] text-white/35">{helper}</span>}
      </label>
    </div>
  );
}

export function SmallButton({
  onClick,
  children,
  tone = "ghost",
  disabled,
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const styles = {
    ghost:
      "border-white/15 text-white/65 hover:border-white/40 hover:text-white",
    primary: "border-crimson/60 bg-crimson/15 text-crimson-light hover:bg-crimson/25",
    danger: "border-red-500/40 text-red-300/90 hover:bg-red-500/10",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[0.68rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson disabled:cursor-not-allowed disabled:opacity-40 ${styles[tone]}`}
    >
      {children}
    </button>
  );
}
