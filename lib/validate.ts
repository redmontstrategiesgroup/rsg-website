/**
 * Small, dependency-free server-side validation helpers.
 * Used by the API route handlers to validate & sanitize untrusted input.
 */

export const LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  phone: 40,
  website: 200,
  short: 80,
  message: 4000,
  passwordMin: 6,
  passwordMax: 200,
  metricValueMax: 1_000_000_000_000, // 1e12 sanity cap
} as const;

/** Coerce to a trimmed string (non-strings become ""). */
export function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** RFC-ish email check with a length ceiling. */
export function isEmail(v: string): boolean {
  return v.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export type FieldErrors = Record<string, string>;

/** Accumulates per-field validation errors. */
export class Validator {
  readonly errors: FieldErrors = {};

  requiredString(field: string, value: unknown, max: number): string {
    const s = toStr(value);
    if (!s) this.errors[field] = "This field is required.";
    else if (s.length > max) this.errors[field] = `Must be ${max} characters or fewer.`;
    return s.slice(0, max);
  }

  /** Optional string — trimmed and capped, never errors. */
  optionalString(value: unknown, max: number): string {
    return toStr(value).slice(0, max);
  }

  email(field: string, value: unknown): string {
    const s = toStr(value);
    if (!s) this.errors[field] = "Email is required.";
    else if (!isEmail(s)) this.errors[field] = "Enter a valid email address.";
    return s;
  }

  /** A finite number within [0, cap]. Records an error otherwise. */
  finiteNumber(field: string, value: unknown, cap = LIMITS.metricValueMax): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) {
      this.errors[field] = "Must be a number.";
      return 0;
    }
    if (n < 0) {
      this.errors[field] = "Must be zero or greater.";
      return 0;
    }
    return Math.min(n, cap);
  }

  get valid(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}
