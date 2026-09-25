"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Boxes,
  FolderKanban,
  Receipt,
  FileText,
  CalendarCheck,
  MessageSquare,
  Sparkles,
  Zap,
  BarChart3,
  Clock,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type {
  ClientPublic,
  PortalSystem,
  SystemStatus,
  ActivityKind,
  PortalInvoice,
} from "@/lib/types";
// Type-only import: keeps the server-only store (node:fs) out of the bundle.
import type { PortalManagedData } from "@/lib/managed-services/portal-data";
import type { PortalBookingSummary } from "@/lib/scheduling/booking";
import { formatMetricValue } from "@/lib/format";
import { CountUp } from "@/components/CountUp";
import { PlanServices } from "@/components/portal/PlanServices";
import { PortalShell } from "@/components/portal/PortalShell";
import { ScrollRail } from "@/components/ui/ScrollRail";

type Tab = "overview" | "plan" | "systems" | "projects" | "billing";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "plan", label: "Plan & Services", icon: ShieldCheck },
  { id: "systems", label: "AI Systems", icon: Boxes },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "billing", label: "Billing", icon: Receipt },
];

const STATUS_STYLES: Record<SystemStatus, { dot: string; text: string; label: string }> = {
  live: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Live" },
  optimizing: { dot: "bg-amber-400", text: "text-amber-300", label: "Optimizing" },
  building: { dot: "bg-sky-400", text: "text-sky-300", label: "Building" },
  paused: { dot: "bg-white/40", text: "text-white/50", label: "Paused" },
};

const ACTIVITY_ICON: Record<ActivityKind, typeof Activity> = {
  booking: CalendarCheck,
  lead: Sparkles,
  system: Zap,
  report: BarChart3,
  message: MessageSquare,
};

export function Dashboard({
  client,
  managed,
  booking,
}: {
  client: ClientPublic;
  managed?: PortalManagedData | null;
  booking?: PortalBookingSummary | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const liveCount = useMemo(
    () => client.systems.filter((s) => s.status === "live").length,
    [client.systems]
  );

  // Session keepalive: while the portal is open, ping /api/auth/me so the
  // sliding session cookie keeps renewing. A 401 means the session was
  // revoked or expired: bounce to the login screen.
  useEffect(() => {
    const id = setInterval(
      () => {
        fetch("/api/auth/me")
          .then((res) => {
            if (res.status === 401) {
              router.push("/login");
              router.refresh();
            }
          })
          .catch(() => {});
      },
      10 * 60 * 1000
    );
    return () => clearInterval(id);
  }, [router]);

  return (
    <PortalShell company={client.company} userName={client.name} role="owner">
      <div>
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="label">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-crimson" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
            </span>
            Client Portal · {client.plan}
          </p>
          <h1 className="display text-gradient mt-5 text-[2rem] leading-[1.05] sm:text-[2.7rem]">
            Welcome back, {firstName(client.name)}
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            {[
              client.systems.length > 0 &&
                `${liveCount} AI system${liveCount === 1 ? "" : "s"} live`,
              client.since && `client since ${client.since}`,
              client.strategist && `managed by ${client.strategist}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </motion.div>

        {/* Tabs */}
        <ScrollRail
          role="tablist"
          aria-label="Portal sections"
          activeKey={tab}
          keyboardTabs
          className="mt-9 flex gap-2 border-b border-white/10 pb-px"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-3 text-sm transition-colors ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon size={15} />
                {t.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-crimson shadow-glow-sm"
                  />
                )}
              </button>
            );
          })}
        </ScrollRail>

        {/* Panels */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "overview" && <Overview client={client} booking={booking} />}
              {tab === "plan" && (
                <PlanServices client={client} data={managed ?? null} />
              )}
              {tab === "systems" && <Systems systems={client.systems} />}
              {tab === "projects" && <Projects client={client} />}
              {tab === "billing" && <Billing client={client} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PortalShell>
  );
}

/* ------------------------------- Overview ------------------------------ */

function Overview({
  client,
  booking,
}: {
  client: ClientPublic;
  booking?: PortalBookingSummary | null;
}) {
  const isEmpty =
    client.metrics.length === 0 &&
    client.systems.length === 0 &&
    client.activity.length === 0 &&
    !booking;

  if (isEmpty) {
    return (
      <EmptyState
        title="Nothing here yet."
        copy="Your metrics, systems, and activity will appear here once your account is active and RSG begins work."
      />
    );
  }

  return (
    <div className="space-y-8">
      {booking && <ConsultationCard booking={booking} />}

      {/* KPI grid */}
      {client.metrics.length > 0 && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {client.metrics.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="card group relative overflow-hidden p-5 hover:border-white/20"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-crimson/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              {m.label}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold text-white">
              <CountUp
                to={m.value}
                format={(v) => formatMetricValue(Math.round(v), m.format)}
              />
            </p>
            <div className="mt-2 flex items-center gap-2">
              {m.delta && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 font-mono text-[0.56rem] uppercase tracking-label text-emerald-300">
                  {m.delta}
                </span>
              )}
              {m.hint && <span className="text-[0.7rem] text-white/40">{m.hint}</span>}
            </div>
          </motion.div>
        ))}
      </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Systems snapshot */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              AI systems
            </h2>
            <span className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              {client.systems.length} deployed
            </span>
          </div>
          {client.systems.length > 0 ? (
            <div className="mt-5 space-y-3">
              {client.systems.map((s) => (
                <SystemRow key={s.name} system={s} compact />
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/40">
              No systems deployed yet. Systems RSG builds for you will appear
              here.
            </p>
          )}
        </div>

        {/* Activity feed */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Live activity
            </h2>
            {client.activity.length > 0 && (
              <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-label text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
                streaming
              </span>
            )}
          </div>
          {client.activity.length === 0 ? (
            <p className="mt-5 text-sm text-white/40">
              No activity yet. Updates will appear here once work is underway.
            </p>
          ) : (
          <ol className="mt-5 space-y-4">
            {client.activity.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.kind];
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  className="flex gap-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-white/80">{a.text}</p>
                    <p className="mt-0.5 font-mono text-[0.56rem] uppercase tracking-label text-white/35">
                      {a.time}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Consultation card -------------------------- */

const BOOKING_STATUS_STYLES: Record<
  PortalBookingSummary["status"],
  { text: string; label: string }
> = {
  confirmed: { text: "text-emerald-300", label: "Confirmed" },
  rescheduled: { text: "text-amber-300", label: "Rescheduled" },
  cancelled: { text: "text-white/40", label: "Cancelled" },
  completed: { text: "text-white/50", label: "Completed" },
  no_show: { text: "text-crimson-light", label: "No-show" },
};

function formatBookingTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ConsultationCard({ booking }: { booking: PortalBookingSummary }) {
  const st = BOOKING_STATUS_STYLES[booking.status] ?? BOOKING_STATUS_STYLES.confirmed;
  const upcoming =
    (booking.status === "confirmed" || booking.status === "rescheduled") &&
    new Date(booking.starts_at).getTime() > Date.now();
  const manageable = booking.status !== "cancelled" && booking.status !== "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-crimson/15 text-crimson-light">
          <CalendarCheck size={16} />
        </span>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            {upcoming ? "Upcoming consultation" : "Your consultation"}
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {formatBookingTime(booking.starts_at)}
            {booking.appointment_type_name ? ` · ${booking.appointment_type_name}` : ""}
          </p>
          {booking.team_member_name && (
            <p className="mt-0.5 text-[0.78rem] text-white/45">
              with {booking.team_member_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 self-stretch sm:self-auto">
        <span className={`font-mono text-[0.58rem] uppercase tracking-label ${st.text}`}>
          {st.label}
        </span>
        {manageable && (
          <Link
            href={`/booking/manage/${booking.manage_token}`}
            className="btn-ghost px-3.5 py-2 text-xs"
          >
            Manage
            <ChevronRight size={13} />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------- Systems ------------------------------- */

function Systems({ systems }: { systems: PortalSystem[] }) {
  if (systems.length === 0) {
    return (
      <EmptyState
        title="No systems yet."
        copy="The AI systems and automations RSG builds for your business will appear here once they are deployed."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {systems.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <SystemRow system={s} />
        </motion.div>
      ))}
    </div>
  );
}

function SystemRow({ system, compact }: { system: PortalSystem; compact?: boolean }) {
  const st = STATUS_STYLES[system.status];
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 ${
        compact ? "" : "h-full"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[0.95rem] font-semibold text-white">
              {system.name}
            </h3>
            <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-label text-white/40">
              {system.category}
            </span>
          </div>
          {!compact && (
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {system.description}
            </p>
          )}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.56rem] uppercase tracking-label ${st.text}`}>
          <span className={`h-1.5 w-1.5 animate-pulse-soft rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-label text-white/45">
          <Zap size={11} className="text-crimson-light" />
          {system.throughput}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-label text-white/45">
          <Clock size={11} className="text-crimson-light" />
          {system.uptime}% uptime
        </span>
      </div>
    </div>
  );
}

/* ------------------------------- Projects ------------------------------ */

const PHASE_ORDER = ["Discovery", "Build", "Launch", "Optimize", "Complete"];

function Projects({ client }: { client: ClientPublic }) {
  if (client.projects.length === 0 && client.deliverables.length === 0) {
    return (
      <EmptyState
        title="No projects yet."
        copy="Your active projects, roadmap, and deliverables will appear here once work begins."
      />
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {client.projects.length === 0 && (
          <div className="card p-6 text-sm text-white/40">
            No active projects yet.
          </div>
        )}
        {client.projects.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-[0.95rem] font-semibold text-white">
                  {p.name}
                </h3>
                <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-label text-white/40">
                  {p.owner} · due {p.due}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-crimson/15 px-3 py-1 font-mono text-[0.54rem] uppercase tracking-label text-crimson-light">
                {p.phase}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-[0.58rem] uppercase tracking-label text-white/40">
                <span>Progress</span>
                <span className="text-white/70">{p.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.progress}%` }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-crimson-dark to-crimson-light shadow-glow-sm"
                />
              </div>
            </div>

            {/* Phase pips */}
            <div className="mt-4 flex items-center gap-1.5">
              {PHASE_ORDER.map((ph) => {
                const reached =
                  PHASE_ORDER.indexOf(ph) <= PHASE_ORDER.indexOf(p.phase);
                return (
                  <span
                    key={ph}
                    className={`h-1 flex-1 rounded-full ${
                      reached ? "bg-crimson/70" : "bg-white/[0.08]"
                    }`}
                    title={ph}
                  />
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Deliverables */}
      <div className="card h-fit p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Deliverables
        </h2>
        {client.deliverables.length === 0 && (
          <p className="mt-5 text-sm text-white/40">
            No deliverables yet.
          </p>
        )}
        <ul className="mt-5 space-y-3">
          {client.deliverables.map((d) => (
            <li
              key={d.name}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 transition-colors hover:border-white/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                <FileText size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{d.name}</p>
                <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  {d.type} · {d.date}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
                  d.status === "Ready"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : d.status === "In review"
                    ? "bg-amber-400/10 text-amber-300"
                    : "bg-white/[0.06] text-white/50"
                }`}
              >
                {d.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------- Billing ------------------------------ */

function Billing({ client }: { client: ClientPublic }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="card h-fit p-6">
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
          Current plan
        </p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-white">
          {client.plan}
        </h2>
        <p className="mt-2 text-sm text-white/55">
          {client.since ? `Client since ${client.since}. ` : ""}
          Managed by {client.strategist}.
        </p>
        <Link href="/book" className="btn-ghost mt-6 w-full">
          Talk to your strategist
          <ChevronRight size={15} />
        </Link>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Invoices
        </h2>
        {client.invoices.length === 0 ? (
          <p className="mt-5 text-sm text-white/40">
            No invoices yet. Invoices will appear here once billing is
            configured for your account.
          </p>
        ) : (
        <div className="mt-5">
          {/* Phones: one card per invoice. The 5-column table below needs
              ~560px and its wrapper was overflow-hidden, so the last column
              was simply cut off on a 375px screen. */}
          <ul className="space-y-2 md:hidden">
            {client.invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-white/80">{inv.id}</p>
                  <p className="mt-0.5 text-xs text-white/50">{inv.date}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-white/85">${inv.amount.toLocaleString("en-US")}</p>
                  <InvoiceStatus status={inv.status} className="mt-1" />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  <th className="px-4 py-3 font-normal">Invoice</th>
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Amount</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {client.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3.5 font-mono text-white/80">{inv.id}</td>
                    <td className="px-4 py-3.5 text-white/60">{inv.date}</td>
                    <td className="px-4 py-3.5 text-white/80">
                      ${inv.amount.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3.5">
                      <InvoiceStatus status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ empty state ---------------------------- */

function EmptyState({
  title,
  copy,
  className,
}: {
  title: string;
  copy: string;
  className?: string;
}) {
  return (
    <div className={`card p-8 text-center sm:p-10 ${className ?? ""}`}>
      <p className="font-display text-base font-semibold text-white/85">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
        {copy}
      </p>
    </div>
  );
}

/* -------------------------------- helpers ------------------------------ */

/** First name, skipping an honorific like "Dr." / "Mr." */
function InvoiceStatus({
  status,
  className = "",
}: {
  status: PortalInvoice["status"];
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
        status === "Paid"
          ? "bg-emerald-400/10 text-emerald-300"
          : status === "Due"
            ? "bg-crimson/15 text-crimson-light"
            : "bg-white/[0.06] text-white/50"
      } ${className}`}
    >
      {status}
    </span>
  );
}

function firstName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const titles = new Set(["dr.", "dr", "mr.", "mr", "mrs.", "mrs", "ms.", "ms", "prof.", "prof"]);
  const first = titles.has(parts[0]?.toLowerCase()) ? parts[1] : parts[0];
  return first ?? name;
}
