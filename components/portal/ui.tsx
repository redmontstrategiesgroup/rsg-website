"use client";

import { type ReactNode } from "react";

/**
 * Shared presentational primitives for the client portal and the public
 * lifecycle pages (proposal / agreement / pay / assessment / prepare).
 * Visual language: dark corporate luxury — near-black surfaces, hairline
 * white borders, deep ruby accents, mono eyebrows. Matches components/booking/ui.tsx.
 */

// ---------------------------------------------------------------------------
// Status → tone (single source of truth so every pill reads consistently)
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "progress";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-white/55",
  info: "bg-sky-400/10 text-sky-300",
  success: "bg-emerald-400/10 text-emerald-300",
  warning: "bg-amber-400/10 text-amber-300",
  danger: "bg-crimson/15 text-crimson-light",
  progress: "bg-crimson/10 text-crimson-light",
};

const STATUS_TONES: Record<string, Tone> = {
  // shared / generic
  draft: "neutral",
  open: "info",
  pending: "warning",
  in_progress: "progress",
  in_review: "progress",
  completed: "success",
  closed: "neutral",
  cancelled: "neutral",
  expired: "neutral",
  // milestones / projects
  not_started: "neutral",
  upcoming: "info",
  waiting_on_client: "warning",
  under_review: "progress",
  changes_requested: "warning",
  approved: "success",
  delayed: "warning",
  blocked: "danger",
  on_track: "success",
  at_risk: "warning",
  onboarding: "info",
  active: "success",
  paused: "neutral",
  client_review: "progress",
  launched: "success",
  support: "info",
  archived: "neutral",
  // proposals / contracts
  sent: "info",
  viewed: "progress",
  revision_requested: "warning",
  withdrawn: "neutral",
  partially_signed: "progress",
  signed: "success",
  countersigned: "success",
  declined: "danger",
  voided: "neutral",
  // invoices / payments
  processing: "progress",
  paid: "success",
  uncollectible: "danger",
  refunded: "neutral",
  succeeded: "success",
  failed: "danger",
  partially_refunded: "warning",
  // tickets / requests
  submitted: "info",
  acknowledged: "progress",
  escalated: "danger",
  resolved: "success",
  needs_change_order: "warning",
  // renewals / expansion
  notice_sent: "info",
  in_discussion: "progress",
  renewed: "success",
  lapsed: "danger",
  identified: "neutral",
  recommended: "info",
  discussing: "progress",
  planned: "info",
  proposed: "progress",
  not_needed: "neutral",
  // misc
  won: "success",
  lost: "neutral",
  published: "success",
};

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function StatusPill({
  status,
  label,
  tone,
}: {
  status: string;
  label?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
        TONE_CLASSES[tone ?? statusTone(status)]
      }`}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout blocks
// ---------------------------------------------------------------------------

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="display mt-2 text-2xl sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  eyebrow,
  actions,
  children,
  padded = true,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions || eyebrow) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && (
              <h2 className="font-display text-base font-medium text-white">{title}</h2>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "px-5 py-5 sm:px-6" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/40">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-xl font-medium ${
          tone === "danger"
            ? "text-crimson-light"
            : tone === "warning"
              ? "text-amber-300"
              : tone === "success"
                ? "text-emerald-300"
                : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-white/45">{sub}</p>}
    </div>
  );
}

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-white/40">{label}</span>
      <span className="text-right text-sm text-white/80">{children}</span>
    </div>
  );
}

export function ProgressBar({
  value,
  ariaLabel,
}: {
  value: number; // 0-100
  ariaLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div
        className="h-full rounded-full bg-crimson transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// States: empty / loading / error / banner
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-4 text-white/25">{icon}</div>}
      <p className="font-display text-sm font-medium text-white/70">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/40">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 px-5 py-5">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  );
}

export function Banner({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
}) {
  const border =
    tone === "danger"
      ? "border-crimson/40"
      : tone === "warning"
        ? "border-amber-400/30"
        : tone === "success"
          ? "border-emerald-400/30"
          : "border-white/15";
  return (
    <div className={`border ${border} bg-white/[0.02] px-4 py-3.5`} role={tone === "danger" ? "alert" : undefined}>
      {title && <p className="text-sm font-medium text-white">{title}</p>}
      {children && (
        <div className={`text-xs leading-relaxed text-white/55 ${title ? "mt-1" : ""}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline (project roadmap, activity feeds)
// ---------------------------------------------------------------------------

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="relative space-y-0">{children}</ol>;
}

export function TimelineItem({
  status,
  last,
  title,
  meta,
  children,
}: {
  /** Drives the node color. */
  status: "complete" | "current" | "upcoming" | "warning";
  last?: boolean;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const node =
    status === "complete"
      ? "border-emerald-400/60 bg-emerald-400/20"
      : status === "current"
        ? "border-crimson bg-crimson/30 shadow-glow-sm"
        : status === "warning"
          ? "border-amber-400/60 bg-amber-400/20"
          : "border-white/20 bg-white/[0.04]";
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-5 h-full w-px bg-white/10"
        />
      )}
      <span
        aria-hidden="true"
        className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border ${node}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className={`text-sm font-medium ${
              status === "upcoming" ? "text-white/45" : "text-white"
            }`}
          >
            {title}
          </p>
          {meta && <div className="flex items-center gap-2">{meta}</div>}
        </div>
        {children && <div className="mt-1.5 text-xs leading-relaxed text-white/50">{children}</div>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Small interactive bits
// ---------------------------------------------------------------------------

export function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] font-mono text-[0.6rem] text-white/70">
      {initials || "•"}
    </span>
  );
}

export function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10" role="tablist">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.id)}
            className={`relative whitespace-nowrap px-4 py-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
              isActive ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-2 rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.55rem] text-white/60">
                {t.count}
              </span>
            )}
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-px bg-crimson" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible confirm/detail dialog (no portal dep; fixed overlay). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-base/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full overflow-y-auto border border-white/10 bg-base-900 shadow-lift sm:rounded-xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <h3 className="font-display text-base font-medium text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/40 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60"
          >
            ✕
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Primary/secondary buttons sized for portal density (smaller than .btn-primary). */
export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  busy,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-crimson text-white hover:bg-crimson-light disabled:hover:bg-crimson"
      : variant === "danger"
        ? "border border-crimson/50 text-crimson-light hover:border-crimson"
        : "border border-white/20 text-white/80 hover:border-white/50 hover:text-white";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex min-h-[38px] items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white"
        />
      )}
      {children}
    </button>
  );
}

/** Info tooltip for plain-language explanations of technical terms. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What does this mean? ${text}`}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 font-mono text-[0.55rem] text-white/50 transition hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 border border-white/15 bg-base-800 px-3 py-2 text-left text-[0.7rem] font-normal normal-case leading-relaxed tracking-normal text-white/75 opacity-0 shadow-lift transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
