"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  LogOut,
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
  Download,
  ChevronRight,
} from "lucide-react";
import type {
  ClientPublic,
  PortalSystem,
  SystemStatus,
  ActivityKind,
} from "@/lib/types";
import { formatMetricValue } from "@/lib/format";
import { CountUp } from "@/components/CountUp";
import { Logo } from "@/components/Logo";
import { postJson } from "@/lib/api";

type Tab = "overview" | "systems" | "projects" | "billing";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
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

export function Dashboard({ client }: { client: ClientPublic }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loggingOut, setLoggingOut] = useState(false);

  const liveCount = useMemo(
    () => client.systems.filter((s) => s.status === "live").length,
    [client.systems]
  );

  // Session keepalive: while the portal is open, ping /api/auth/me so the
  // sliding session cookie keeps renewing and active users stay signed in.
  useEffect(() => {
    const id = setInterval(
      () => {
        fetch("/api/auth/me").catch(() => {});
      },
      10 * 60 * 1000
    );
    return () => clearInterval(id);
  }, []);

  async function logout() {
    setLoggingOut(true);
    await postJson("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-[0.35]" />
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-crimson/[0.08] blur-[130px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-base/70 backdrop-blur-xl">
        <div className="container-px flex h-20 items-center justify-between gap-4">
          <a href="/" aria-label="Redmont Strategies Group home">
            <Logo />
          </a>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{client.name}</p>
              <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
                {client.company}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-crimson/15 font-display text-sm font-semibold text-crimson-light">
              {initials(client.name)}
            </div>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">{loggingOut ? "…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container-px py-10 sm:py-12">
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
            {liveCount} AI system{liveCount === 1 ? "" : "s"} live · client since{" "}
            {client.since} · managed by {client.strategist}
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="no-scrollbar mt-9 flex gap-2 overflow-x-auto border-b border-white/10 pb-px">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
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
        </div>

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
              {tab === "overview" && <Overview client={client} />}
              {tab === "systems" && <Systems systems={client.systems} />}
              {tab === "projects" && <Projects client={client} />}
              {tab === "billing" && <Billing client={client} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------- Overview ------------------------------ */

function Overview({ client }: { client: ClientPublic }) {
  return (
    <div className="space-y-8">
      {/* KPI grid */}
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
          <div className="mt-5 space-y-3">
            {client.systems.map((s) => (
              <SystemRow key={s.name} system={s} compact />
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Live activity
            </h2>
            <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-label text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
              streaming
            </span>
          </div>
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
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Systems ------------------------------- */

function Systems({ systems }: { systems: PortalSystem[] }) {
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
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
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
          Client since {client.since}. Managed by {client.strategist}.
        </p>
        <a href="/contact" className="btn-ghost mt-6 w-full">
          Talk to your strategist
          <ChevronRight size={15} />
        </a>
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Invoices
        </h2>
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3 font-normal">Invoice</th>
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3" />
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
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
                        inv.status === "Paid"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : inv.status === "Due"
                          ? "bg-crimson/15 text-crimson-light"
                          : "bg-white/[0.06] text-white/50"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button className="inline-flex items-center gap-1 font-mono text-[0.56rem] uppercase tracking-label text-white/40 transition-colors hover:text-white">
                      <Download size={12} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-white/35">
          <ArrowUpRight size={13} />
          Demo billing data — no real charges are made.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- helpers ------------------------------ */

/** First name, skipping an honorific like "Dr." / "Mr." */
function firstName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const titles = new Set(["dr.", "dr", "mr.", "mr", "mrs.", "mrs", "ms.", "ms", "prof.", "prof"]);
  const first = titles.has(parts[0]?.toLowerCase()) ? parts[1] : parts[0];
  return first ?? name;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
