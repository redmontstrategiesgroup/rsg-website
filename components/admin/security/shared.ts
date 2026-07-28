/** Shared styling + label helpers for the Security Center panel. */

import type { SecurityStatusLevel } from "@/lib/security-center/types";

/** Runs a mutating Security Center action and refreshes; resolves to success. */
export type RunFn = (payload: Record<string, unknown>) => Promise<boolean>;

export const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20";

export const labelClass =
  "font-mono text-[0.56rem] uppercase tracking-label text-white/55";

/** Tailwind classes for a status pill by security status level. */
export function statusPill(level: SecurityStatusLevel): string {
  switch (level) {
    case "secure":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "review_recommended":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "action_required":
      return "border-orange-400/40 bg-orange-400/10 text-orange-300";
    case "critical":
      return "border-crimson/50 bg-crimson/15 text-crimson-light";
  }
}

export function statusDot(level: SecurityStatusLevel): string {
  switch (level) {
    case "secure":
      return "bg-emerald-400";
    case "review_recommended":
      return "bg-amber-400";
    case "action_required":
      return "bg-orange-400";
    case "critical":
      return "bg-crimson-light";
  }
}

/** Severity/risk → pill classes (low → critical). */
export function riskPill(level: string): string {
  switch (level) {
    case "low":
    case "info":
      return "border-white/15 bg-white/[0.04] text-white/60";
    case "medium":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "high":
      return "border-orange-400/40 bg-orange-400/10 text-orange-300";
    case "critical":
      return "border-crimson/50 bg-crimson/15 text-crimson-light";
    default:
      return "border-white/15 bg-white/[0.04] text-white/60";
  }
}

/** Result pill for security tests. */
export function resultPill(result: string): string {
  switch (result) {
    case "pass":
    case "passed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "fail":
    case "failed":
      return "border-crimson/50 bg-crimson/15 text-crimson-light";
    case "partial":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/15 bg-white/[0.04] text-white/50";
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
