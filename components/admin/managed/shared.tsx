"use client";

/**
 * Shared primitives for the Managed Services admin panel sub-views.
 * Client-safe only: types from lib/managed-services/types.ts and display
 * helpers — never import the server-only store here.
 */

import { Inbox } from "lucide-react";

export type MinimalClient = {
  id: string;
  name: string;
  company: string;
  email: string;
};

/** Result shape of the panel's shared action runner. */
export type RunResult = Record<string, unknown> | null;
export type RunFn = (
  action: string,
  payload?: Record<string, unknown>
) => Promise<RunResult>;

export const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none [&>option]:bg-base-900";

export const labelClass =
  "mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/45";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl text-white">{value}</p>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <Inbox size={26} className="mx-auto text-white/25" />
      <p className="mt-4 text-sm text-white/55">{title}</p>
      {hint ? <p className="mt-1 text-xs text-white/35">{hint}</p> : null}
    </div>
  );
}

const PILL_STYLES: Record<string, string> = {
  active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  published: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  accepted: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  completed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  done: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  past_due: "border-red-400/40 bg-red-400/10 text-red-200",
  cancelled: "border-red-400/40 bg-red-400/10 text-red-200",
  declined: "border-red-400/40 bg-red-400/10 text-red-200",
  expired: "border-red-400/40 bg-red-400/10 text-red-200",
  pending_cancellation: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  awaiting_payment: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  paused: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  waiting_on_client: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  sent: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  viewed: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  proposed: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  in_progress: "border-sky-400/40 bg-sky-400/10 text-sky-200",
};

export function StatusPill({ value }: { value: string }) {
  const style =
    PILL_STYLES[value] ?? "border-white/15 bg-white/[0.04] text-white/60";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[0.54rem] uppercase tracking-wider ${style}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Value conversion helpers (form <-> API)
// ---------------------------------------------------------------------------

/** Cents -> "395.00"-style dollars for a number input. Empty for null. */
export function centsToDollarInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** Dollar-input string -> integer cents. "" -> null. */
export function dollarInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Number-input string -> number | null ("" -> null). */
export function numOrNullFromInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** datetime-local input value -> ISO string (null when empty/invalid). */
export function localInputToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO string -> datetime-local input value (local time, minute precision). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function arrayToLines(arr: string[] | undefined): string {
  return (arr ?? []).join("\n");
}

export function slugifyKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function clientLabel(
  clients: MinimalClient[],
  clientId: string | null | undefined
): string {
  if (!clientId) return "—";
  const c = clients.find((x) => x.id === clientId);
  if (!c) return `${clientId.slice(0, 8)}…`;
  return c.company ? `${c.name} · ${c.company}` : c.name;
}

/** Copy to clipboard with a legacy fallback. Returns true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
