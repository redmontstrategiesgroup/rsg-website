"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Users,
  Inbox,
  Save,
  Check,
  Loader2,
  ShieldCheck,
  Building2,
  BarChart3,
  FileSearch,
  Copy,
  UserPlus,
  LayoutDashboard,
  RefreshCw,
  Phone,
  Mail,
  ExternalLink,
  Link2,
  Calendar,
  Cpu,
  ShieldAlert,
  Wrench,
  Route,
} from "lucide-react";
import type { AdminRole, ClientPublic, Lead, LeadStatus, Subscriber } from "@/lib/types";
import { LEAD_STATUSES } from "@/lib/types";
import type { AnalyticsSummary } from "@/lib/analytics";
import { formatMetricValue } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { postJson, patchJson } from "@/lib/api";
import { ConnectAdminPanel } from "@/components/admin/ConnectAdminPanel";
import { SchedulingAdminPanel } from "@/components/admin/SchedulingAdminPanel";
import { PrivateAiAdminPanel } from "@/components/admin/PrivateAiAdminPanel";
import { SecurityCenterPanel } from "@/components/admin/SecurityCenterPanel";
import { IndustriesAdminPanel } from "@/components/admin/IndustriesAdminPanel";
import { ManagedServicesAdminPanel } from "@/components/admin/ManagedServicesAdminPanel";
import { LifecycleAdminPanel } from "@/components/admin/LifecycleAdminPanel";

type Tab =
  | "clients"
  | "lifecycle"
  | "leads"
  | "analytics"
  | "brief"
  | "connect"
  | "industries"
  | "managed"
  | "scheduling"
  | "private-ai"
  | "security";

export type AdminCaps = {
  clients: boolean;
  leads: boolean;
  analytics: boolean;
  scheduling: boolean;
  connect: boolean;
  privateAi: boolean;
  brief: boolean;
  security: boolean;
};

export function AdminConsole({
  adminEmail,
  caps,
  mfaEnabled = false,
  mfaSetupRequired = false,
  initialClients,
  leads: initialLeads,
  subscribers = [],
  analytics,
}: {
  adminEmail: string;
  /** Server-resolved role. Enforcement is server-side; `caps` drives the UI. */
  role: AdminRole;
  caps: AdminCaps;
  mfaEnabled?: boolean;
  mfaSetupRequired?: boolean;
  initialClients: ClientPublic[];
  leads: Lead[];
  subscribers?: Subscriber[];
  analytics?: AnalyticsSummary;
}) {
  const router = useRouter();
  // Tabs available to this role, in display order. Real enforcement is
  // server-side on every API route; this keeps the UI honest to the role.
  const availableTabs: Tab[] = [
    caps.clients && ("clients" as Tab),
    (caps.leads || caps.clients) && ("lifecycle" as Tab),
    caps.leads && ("leads" as Tab),
    caps.analytics && ("analytics" as Tab),
    caps.scheduling && ("scheduling" as Tab),
    caps.connect && ("connect" as Tab),
    caps.connect && ("industries" as Tab),
    caps.clients && ("managed" as Tab),
    caps.privateAi && ("private-ai" as Tab),
    caps.security && ("security" as Tab),
    caps.brief && ("brief" as Tab),
  ].filter(Boolean) as Tab[];
  const [tab, setTab] = useState<Tab>(availableTabs[0] ?? "security");
  const [clients, setClients] = useState(initialClients);
  const [leads, setLeads] = useState(initialLeads);
  const [selectedId, setSelectedId] = useState(initialClients[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const newLeadCount = leads.filter((l) => (l.status ?? "new") === "new").length;

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  // Sliding-session keepalive while the console is open.
  useEffect(() => {
    const id = setInterval(
      () => {
        fetch("/api/admin/me").catch(() => {});
      },
      10 * 60 * 1000
    );
    return () => clearInterval(id);
  }, []);

  async function logout() {
    setLoggingOut(true);
    await postJson("/api/admin/logout");
    router.push("/admin/login");
    router.refresh();
  }

  function onSaved(updated: ClientPublic) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function onCreated(created: ClientPublic) {
    setClients((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-[0.3]" />
        <div className="absolute left-1/2 top-[-10%] h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-crimson/[0.06] blur-[130px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-base/70 backdrop-blur-xl">
        <div className="container-px flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Redmont Strategies Group home">
              <Logo showWordmark={false} />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
              <ShieldCheck size={13} />
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
            >
              <LayoutDashboard size={15} />
              Intelligence
            </Link>
            <span className="hidden font-mono text-[0.58rem] uppercase tracking-label text-white/40 md:block">
              {adminEmail}
            </span>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container-px py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-gradient text-[1.8rem] font-semibold sm:text-[2.2rem]">
              Admin console
            </h1>
            <p className="mt-3 text-white/55">
              Manage clients, review inbound leads, and open executive
              intelligence.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-crimson/30 bg-crimson/[0.08] px-4 py-2.5 text-sm text-crimson-light transition-colors hover:border-crimson/50 sm:hidden"
          >
            <LayoutDashboard size={15} />
            Intelligence dashboard
          </Link>
        </div>

        {mfaSetupRequired && tab !== "security" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-crimson/40 bg-crimson/[0.08] px-4 py-3 text-sm text-white/80">
            <ShieldAlert size={16} className="text-crimson-light" />
            <span>
              Multifactor authentication is required for your role. Some actions
              are blocked until you enroll.
            </span>
            <button
              onClick={() => setTab("security")}
              className="rounded-lg border border-crimson/40 px-3 py-1.5 text-xs font-medium text-crimson-light transition-colors hover:border-crimson/60"
            >
              Set up MFA
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10">
          {(
            [
              { id: "clients" as Tab, label: "Clients", icon: Users, count: clients.length, badge: 0 },
              {
                id: "lifecycle" as Tab,
                label: "Client OS",
                icon: Route,
                count: null,
                badge: 0,
              },
              {
                id: "leads" as Tab,
                label: "Leads",
                icon: Inbox,
                count: leads.length,
                badge: newLeadCount,
              },
              {
                id: "analytics" as Tab,
                label: "Analytics",
                icon: BarChart3,
                count: analytics?.totalViews ?? 0,
                badge: 0,
              },
              {
                id: "scheduling" as Tab,
                label: "Scheduling",
                icon: Calendar,
                count: null,
                badge: 0,
              },
              {
                id: "connect" as Tab,
                label: "Connect Page",
                icon: Link2,
                count: null,
                badge: 0,
              },
              {
                id: "industries" as Tab,
                label: "Industries",
                icon: Building2,
                count: null,
                badge: 0,
              },
              {
                id: "managed" as Tab,
                label: "Managed Services",
                icon: Wrench,
                count: null,
                badge: 0,
              },
              {
                id: "private-ai" as Tab,
                label: "Private AI",
                icon: Cpu,
                count: null,
                badge: 0,
              },
              {
                id: "security" as Tab,
                label: "Security",
                icon: ShieldCheck,
                count: null,
                badge: 0,
              },
              {
                id: "brief" as Tab,
                label: "Audit Brief",
                icon: FileSearch,
                count: null,
                badge: 0,
              },
            ] as { id: Tab; label: string; icon: typeof Users; count: number | null; badge: number }[]
          )
            .filter((t) => availableTabs.includes(t.id))
            .map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm transition-colors ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon size={15} />
                {t.label}
                {t.badge > 0 && (
                  <span className="rounded-full bg-crimson px-2 py-0.5 font-mono text-[0.54rem] text-white">
                    {t.badge} new
                  </span>
                )}
                {t.count != null && t.badge === 0 && (
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[0.54rem] text-white/50">
                    {t.count}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="admin-tab"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-crimson shadow-glow-sm"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {tab === "clients" && caps.clients ? (
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {/* Client list */}
              <aside className="space-y-2">
                <button
                  onClick={() => setCreating(true)}
                  className={`flex w-full items-center gap-3 rounded-xl border border-dashed p-3.5 text-left transition-colors ${
                    creating
                      ? "border-crimson/50 bg-crimson/[0.06] text-white"
                      : "border-white/15 text-white/60 hover:border-white/35 hover:text-white"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                    <UserPlus size={15} />
                  </span>
                  <span className="text-sm font-medium">New client</span>
                </button>

                {clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setCreating(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      c.id === selectedId && !creating
                        ? "border-crimson/40 bg-crimson/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                      <Building2 size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {c.company}
                      </span>
                      <span className="block truncate font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                        {c.plan}
                      </span>
                    </span>
                  </button>
                ))}
              </aside>

              {/* Editor / create form */}
              {creating ? (
                <CreateClientForm onCreated={onCreated} onCancel={() => setCreating(false)} />
              ) : selected ? (
                <ClientEditor key={selected.id} client={selected} onSaved={onSaved} />
              ) : (
                <p className="text-white/50">
                  No clients yet. Use “New client” to provision one.
                </p>
              )}
            </div>
          ) : tab === "leads" && caps.leads ? (
            <div className="space-y-10">
              <LeadsTable leads={leads} onLeadsChange={setLeads} />
              <SubscribersPanel subscribers={subscribers} />
            </div>
          ) : tab === "analytics" && caps.analytics ? (
            <AnalyticsPanel analytics={analytics} />
          ) : tab === "connect" && caps.connect ? (
            <ConnectAdminPanel />
          ) : tab === "industries" && caps.connect ? (
            <IndustriesAdminPanel />
          ) : tab === "lifecycle" && (caps.leads || caps.clients) ? (
            <LifecycleAdminPanel />
          ) : tab === "managed" && caps.clients ? (
            <ManagedServicesAdminPanel />
          ) : tab === "scheduling" && caps.scheduling ? (
            <SchedulingAdminPanel />
          ) : tab === "private-ai" && caps.privateAi ? (
            <PrivateAiAdminPanel />
          ) : tab === "security" && caps.security ? (
            <SecurityCenterPanel
              mfaEnabled={mfaEnabled}
              mfaSetupRequired={mfaSetupRequired}
            />
          ) : tab === "brief" && caps.brief ? (
            <BriefPanel />
          ) : (
            <p className="text-white/50">
              You don’t have access to this section.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------------------------- Create client ---------------------------- */

const PLAN_OPTIONS = [
  "Strategy Audit",
  "Growth Systems Build",
  "Full Business Operating System",
  "Growth Retainer",
];

function CreateClientForm({
  onCreated,
  onCancel,
}: {
  onCreated: (client: ClientPublic) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
    plan: PLAN_OPTIONS[0],
    since: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function generatePassword() {
    // This value becomes the client's actual portal password, so it must come
    // from a CSPRNG. Math.random() is seeded predictably and its internal state
    // is recoverable from a handful of outputs — fine for a jitter, not for a
    // credential. Alphabet excludes look-alike characters (0/O, 1/l/I) because
    // these get read aloud and retyped.
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    // Rejection-free modulo bias is irrelevant at this alphabet size relative
    // to 2^32, so index directly.
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const pw = `RSG-${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12)}`;
    setForm((f) => ({ ...f, password: pw }));
    setCopied(false);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await postJson("/api/admin/clients", form);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the client.");
        setSaving(false);
        return;
      }
      onCreated(data.client);
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <h2 className="display text-xl text-white">New client</h2>
        <p className="mt-1 text-sm text-white/50">
          Creates a portal account. Share the temporary password with the
          client; they sign in at /login.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Contact name *
          </span>
          <input required value={form.name} onChange={set("name")} className={inputClass} placeholder="Full name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Business name *
          </span>
          <input required value={form.company} onChange={set("company")} className={inputClass} placeholder="Business name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Email *
          </span>
          <input required type="email" value={form.email} onChange={set("email")} className={inputClass} placeholder="Email address" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Plan
          </span>
          <select value={form.plan} onChange={set("plan")} className={inputClass}>
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Temporary password *
          </span>
          <div className="flex gap-2">
            <input
              required
              value={form.password}
              onChange={set("password")}
              className={inputClass}
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={generatePassword}
              className="shrink-0 rounded-lg border border-white/15 px-3 text-xs text-white/70 transition-colors hover:border-white/35 hover:text-white"
            >
              Generate
            </button>
            {form.password && (
              <button
                type="button"
                onClick={copyPassword}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/70 transition-colors hover:border-white/35 hover:text-white"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Client since
          </span>
          <input value={form.since} onChange={set("since")} className={inputClass} placeholder="Jul 2026" />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          {saving ? "Creating…" : "Create client"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Analytics ------------------------------ */

function AnalyticsPanel({ analytics }: { analytics?: AnalyticsSummary }) {
  if (!analytics || analytics.totalViews === 0) {
    return (
      <div className="card p-10 text-center">
        <BarChart3 size={28} className="mx-auto text-white/30" />
        <p className="mt-4 text-white/55">No page views recorded yet.</p>
        <p className="mt-1 text-sm text-white/35">
          Views are counted for visitors who accept cookies on the marketing
          site.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: `Views · ${analytics.windowDays}d`, value: analytics.totalViews },
          { label: `Unique visitors · ${analytics.windowDays}d`, value: analytics.uniqueVisitors },
          {
            label: "Top page",
            value: analytics.topPages[0]?.path ?? "—",
            isText: true,
          },
        ].map((s) => (
          <div key={s.label} className="card p-6">
            <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/40">
              {s.label}
            </p>
            <p
              className={`mt-3 font-display text-white ${
                s.isText ? "truncate text-lg" : "text-3xl font-semibold"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-white/80">Top pages</h2>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3 font-normal">Path</th>
                <th className="px-4 py-3 font-normal">Views</th>
                <th className="px-4 py-3 font-normal">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topPages.map((p) => (
                <tr key={p.path} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3.5 text-white/85">{p.path}</td>
                  <td className="px-4 py-3.5 text-white/60">{p.views}</td>
                  <td className="px-4 py-3.5 text-white/60">{p.visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-white/80">Recent days</h2>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Views</th>
                <th className="px-4 py-3 font-normal">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {analytics.days.map((d) => (
                <tr key={d.date} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3.5 font-mono text-[0.65rem] text-white/70">
                    {d.date}
                  </td>
                  <td className="px-4 py-3.5 text-white/60">{d.views}</td>
                  <td className="px-4 py-3.5 text-white/60">{d.visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Audit Brief ----------------------------- */

function BriefPanel() {
  const [url, setUrl] = useState("");
  const [business, setBusiness] = useState("");
  const [notes, setNotes] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);
    setError(null);
    setOutput("");
    setCopied(false);
    try {
      const res = await postJson("/api/admin/brief", { url, business, notes });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) setOutput((o) => o + chunk);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setRunning(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div>
        <h2 className="text-sm font-medium text-white/80">
          Pre-call Business Systems Audit brief
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/45">
          Runs the RSG research agent against a lead&rsquo;s website and
          produces a brief: snapshot, lead-capture review, conversion risks,
          quick wins, and talking points for the strategy call. Takes a few
          minutes.
        </p>

        <form onSubmit={generate} className="mt-6 space-y-3">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://leads-website.com"
            className={inputClass}
            disabled={running}
          />
          <input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Business name (optional)"
            className={inputClass}
            disabled={running}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Context from the lead, e.g. their biggest problem (optional)"
            className={`${inputClass} resize-none`}
            disabled={running}
          />
          <button
            type="submit"
            disabled={running || !url.trim()}
            className="btn-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Researching…
              </>
            ) : (
              "Generate brief"
            )}
          </button>
          {error && (
            <p className="border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
              {error}
            </p>
          )}
        </form>
      </div>

      <div className="card relative min-h-[320px] p-6">
        {output ? (
          <>
            <button
              onClick={copy}
              className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/60 transition-colors hover:border-white/35 hover:text-white"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <div className="whitespace-pre-wrap pr-20 text-sm leading-relaxed text-white/75">
              {output}
            </div>
          </>
        ) : (
          <p className="text-sm text-white/35">
            {running
              ? "Starting the agent session…"
              : "The brief will appear here."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Subscribers ------------------------------ */

function SubscribersPanel({ subscribers }: { subscribers: Subscriber[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-white/80">
        Email subscribers
        <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[0.54rem] text-white/50">
          {subscribers.length}
        </span>
      </h2>
      {subscribers.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">
          No marketing signups yet. Emails captured by the site popup will
          appear here.
        </p>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Source</th>
                  <th className="px-4 py-3 font-normal">Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr
                    key={s.email}
                    className="border-b border-white/[0.06] last:border-0"
                  >
                    <td className="px-4 py-3.5 text-white/85">{s.email}</td>
                    <td className="px-4 py-3.5 text-white/60">{s.source}</td>
                    <td className="px-4 py-3.5 font-mono text-[0.6rem] uppercase tracking-label text-white/40">
                      {new Date(s.subscribedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Editor -------------------------------- */

const PROFILE_FIELDS: { key: keyof ClientPublic; label: string }[] = [
  { key: "name", label: "Contact name" },
  { key: "email", label: "Login email" },
  { key: "company", label: "Company" },
  { key: "plan", label: "Plan" },
  { key: "since", label: "Client since" },
  { key: "strategist", label: "Strategist" },
];

function ClientEditor({
  client,
  onSaved,
}: {
  client: ClientPublic;
  onSaved: (c: ClientPublic) => void;
}) {
  const [form, setForm] = useState({
    name: client.name,
    email: client.email,
    company: client.company,
    plan: client.plan,
    since: client.since,
    strategist: client.strategist,
  });
  const [metrics, setMetrics] = useState(
    client.metrics.map((m) => ({ ...m }))
  );
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await patchJson(`/api/admin/clients/${client.id}`, {
        ...form,
        password: password || undefined,
        metrics: metrics.map((m) => ({
          key: m.key,
          label: m.label,
          value: Number(m.value),
          delta: m.delta,
          hint: m.hint,
        })),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed.");
        setSaving(false);
        return;
      }
      const data = await res.json();
      onSaved(data.client);
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">Profile</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {PROFILE_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
                {f.label}
              </span>
              <input
                value={(form as Record<string, string>)[f.key] ?? ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, [f.key]: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Reported metrics
        </h2>
        <p className="mt-1 text-sm text-white/45">
          Values shown on the client&rsquo;s dashboard.
        </p>
        <div className="mt-5 space-y-3">
          {metrics.map((m, i) => (
            <div
              key={m.key}
              className="grid items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-[1.4fr_1fr_1fr]"
            >
              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/50">
                  Label
                </span>
                <input
                  value={m.label}
                  onChange={(e) =>
                    setMetrics((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/50">
                  Value ({m.format})
                </span>
                <input
                  type="number"
                  value={m.value}
                  onChange={(e) =>
                    setMetrics((arr) =>
                      arr.map((x, j) =>
                        j === i ? { ...x, value: Number(e.target.value) } : x
                      )
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/50">
                  Delta
                </span>
                <input
                  value={m.delta ?? ""}
                  onChange={(e) =>
                    setMetrics((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, delta: e.target.value } : x))
                    )
                  }
                  className={inputClass}
                />
              </label>
              <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/35 sm:col-span-3">
                Preview · {formatMetricValue(Number(m.value) || 0, m.format)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Access */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">Access</h2>
        <label className="mt-4 block max-w-sm">
          <span className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-label text-white/55">
            Reset password (leave blank to keep)
          </span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className={inputClass}
          />
        </label>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-base-800/90 p-4 backdrop-blur-xl">
        <div className="min-h-[1.25rem] text-sm">
          <AnimatePresence mode="wait">
            {error ? (
              <motion.span
                key="err"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-crimson-light"
              >
                {error}
              </motion.span>
            ) : saved ? (
              <motion.span
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-emerald-300"
              >
                <Check size={14} /> Saved to client record
              </motion.span>
            ) : (
              <span className="text-white/40">
                Editing {client.company}
              </span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Leads --------------------------------- */

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  meeting_scheduled: "Meeting scheduled",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
  archived: "Archived",
  intake_started: "Intake started",
  intake_abandoned: "Intake abandoned",
  submitted: "Submitted",
  qualified_not_booked: "Qualified — not booked",
  appointment_booked: "Appointment booked",
  manual_review: "Manual review",
  not_eligible: "Not currently eligible",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  no_show: "No-show",
  completed: "Completed",
  follow_up_required: "Follow-up required",
  converted: "Converted",
  closed: "Closed",
};

function LeadsTable({
  leads,
  onLeadsChange,
}: {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [sourceFilter, setSourceFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not refresh leads.");
        return;
      }
      onLeadsChange(data.leads ?? []);
    } catch {
      setError("Network error while refreshing leads.");
    } finally {
      setRefreshing(false);
    }
  }

  async function patchLead(id: string, patch: Partial<Lead>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await patchJson(`/api/admin/leads/${id}`, {
        status: patch.status,
        notes: patch.notes,
        owner: patch.owner,
        recommendedPlan: patch.recommendedPlan,
        archivedAt: patch.status === "archived" ? new Date().toISOString() : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update lead.");
        return;
      }
      onLeadsChange(
        leads.map((l) => (l.id === id ? { ...l, ...data.lead } : l))
      );
    } catch {
      setError("Network error while updating lead.");
    } finally {
      setSavingId(null);
    }
  }

  if (!leads.length) {
    return (
      <div className="card p-10 text-center">
        <Inbox size={28} className="mx-auto text-white/30" />
        <p className="mt-4 text-white/55">No leads captured yet.</p>
        <p className="mt-1 text-sm text-white/35">
          Contact form and chat submissions appear here once stored.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
    );
  }

  const extrasText = (l: Lead) => Object.values(l.demo?.extras ?? {}).join(" ").toLowerCase();
  const visible = leads.filter((l) => {
    if (sourceFilter && (l.source ?? "website_contact_form") !== sourceFilter) return false;
    switch (segmentFilter) {
      case "retail":
        return /retail|ecommerce/i.test(l.industry ?? "") || l.demo?.slug === "retail";
      case "demo":
        return Boolean(l.demo);
      case "high-retail":
        return (
          (/retail|ecommerce/i.test(l.industry ?? "") || l.demo?.slug === "retail") &&
          (l.score ?? 0) >= 60
        );
      case "multi-location":
        return /locations/.test(extrasText(l)) && !/1 location/.test(extrasText(l));
      case "ecommerce":
        return /online|both|ecommerce/.test(extrasText(l)) || /ecommerce/i.test(l.industry ?? "");
      case "full-system":
        return (l.demo?.featuresRequested ?? []).some((s) => /complete|full/i.test(s));
      default:
        return true;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          {leads.filter((l) => (l.status ?? "new") === "new").length} new ·{" "}
          {visible.length} shown · {leads.length} total
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="lead-source-filter">Filter by source</label>
          <select
            id="lead-source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white/70 focus:border-crimson/60 focus:outline-none [&>option]:bg-base-900"
          >
            <option value="">All sources</option>
            <option value="interactive_demo">Interactive Demo</option>
            <option value="website_contact_form">Contact form</option>
            <option value="website_chat">Chat</option>
            <option value="website_connect_page">Connect page</option>
            <option value="website_booking_funnel">Booking funnel</option>
          </select>
          <label className="sr-only" htmlFor="lead-segment-filter">Quick segment filter</label>
          <select
            id="lead-segment-filter"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white/70 focus:border-crimson/60 focus:outline-none [&>option]:bg-base-900"
          >
            <option value="">All leads</option>
            <option value="retail">Retail leads</option>
            <option value="demo">Demo leads</option>
            <option value="high-retail">High-value retail</option>
            <option value="multi-location">Multi-location retailers</option>
            <option value="ecommerce">Ecommerce retailers</option>
            <option value="full-system">Wants a full system</option>
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
            No leads match these filters.
          </p>
        )}
        {visible.map((l, i) => {
          const rowId = l.id ?? `local-${i}`;
          const open = expandedId === rowId;
          const status = (l.status ?? "new") as LeadStatus;
          return (
            <div
              key={rowId}
              className={`rounded-xl border transition-colors ${
                status === "new"
                  ? "border-crimson/35 bg-crimson/[0.04]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : rowId)}
                className="flex w-full flex-wrap items-start gap-3 p-4 text-left sm:items-center"
              >
                <span
                  className={`font-mono text-[0.7rem] ${
                    (l.score ?? 0) >= 60
                      ? "text-crimson-light"
                      : (l.score ?? 0) >= 30
                        ? "text-white/80"
                        : "text-white/40"
                  }`}
                >
                  {l.score ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {l.name}
                    {l.company ? (
                      <span className="text-white/45"> · {l.company}</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-white/50">
                    {l.email}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[0.54rem] uppercase tracking-label text-white/55">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <span className="font-mono text-[0.58rem] uppercase tracking-label text-white/35">
                  {new Date(l.submittedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-white/10 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                        Biggest problem
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                        {l.problem || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                        Wants to improve
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                        {l.improve || "—"}
                      </p>
                    </div>
                  </div>

                  {l.demo && (
                    <div className="rounded-lg border border-crimson/25 bg-crimson/[0.05] p-3.5">
                      <p className="font-mono text-[0.54rem] uppercase tracking-label text-crimson-light">
                        Interactive demo request — {l.demo.system}
                      </p>
                      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="font-mono text-[0.52rem] uppercase tracking-label text-white/40">
                            Features explored in demo
                          </p>
                          {l.demo.featuresExplored.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {l.demo.featuresExplored.map((f) => (
                                <span key={f} className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/65">
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-sm text-white/45">—</p>
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-[0.52rem] uppercase tracking-label text-white/40">
                            Services requested
                          </p>
                          {l.demo.featuresRequested.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {l.demo.featuresRequested.map((f) => (
                                <span key={f} className="rounded border border-crimson/30 bg-crimson/10 px-2 py-0.5 text-xs text-white/80">
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-sm text-white/45">—</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/55">
                        <span>Demo page: /demos/{l.demo.slug}</span>
                        <span>Business size: {l.demo.businessSize || "—"}</span>
                        <span>
                          Preferred meeting:{" "}
                          {[l.demo.preferredDate, l.demo.preferredTime].filter(Boolean).join(" · ") || "—"}
                        </span>
                        {typeof l.demo.scenariosRun === "number" && l.demo.scenariosRun > 0 && (
                          <span>Scenarios run: {l.demo.scenariosRun}</span>
                        )}
                        {l.demo.demoBusinessName && <span>Typed business name: {l.demo.demoBusinessName}</span>}
                        {Object.entries(l.demo.extras ?? {}).map(([k, v]) => (
                          <span key={k} className="capitalize">
                            {k.replace(/[-_]/g, " ")}: <span className="normal-case">{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-white/55">
                    <span>Industry: {l.industry || "—"}</span>
                    <span>Timeline: {l.timeline || "—"}</span>
                    <span>Preferred: {l.preferredContact || "—"}</span>
                    <span>Source: {l.source === "website_chat" ? "Chat" : l.source === "website_connect_page" ? "Connect page" : l.source === "interactive_demo" ? "Interactive Demo" : "Contact form"}</span>
                    {l.website ? (
                      <a
                        href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-crimson-light hover:underline"
                      >
                        Website <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`mailto:${encodeURIComponent(l.email)}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
                    >
                      <Mail size={14} /> Email lead
                    </a>
                    {l.phone ? (
                      <a
                        href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
                      >
                        <Phone size={14} /> Call
                      </a>
                    ) : null}
                    <Link
                      href="/book"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white"
                    >
                      Schedule follow-up
                    </Link>
                  </div>

                  {l.id ? (() => {
                    const leadId = l.id;
                    return (
                    <>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                      <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                        Recommended plan
                      </p>
                      {l.servicePlanAnswers &&
                        Object.keys(l.servicePlanAnswers).length > 0 && (
                          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                            {Object.entries(l.servicePlanAnswers)
                              .map(
                                ([k, v]) =>
                                  `${k.replace(/[_-]/g, " ")}: ${String(v).replace(/[_-]/g, " ")}`
                              )
                              .join(" · ")}
                          </p>
                        )}
                      <select
                        value={l.recommendedPlan ?? ""}
                        disabled={savingId === leadId}
                        onChange={(e) =>
                          patchLead(leadId, { recommendedPlan: e.target.value })
                        }
                        className={`${inputClass} mt-2 max-w-[260px]`}
                      >
                        <option value="">None</option>
                        <option value="maintain">Maintain</option>
                        <option value="optimize">Optimize</option>
                        <option value="scale">Scale</option>
                        <option value="managed_infrastructure">
                          Managed Infrastructure
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto]">
                      <label className="block">
                        <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                          Status
                        </span>
                        <select
                          value={status}
                          disabled={savingId === leadId}
                          onChange={(e) =>
                            patchLead(leadId, {
                              status: e.target.value as LeadStatus,
                            })
                          }
                          className={inputClass}
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                          Notes
                        </span>
                        <textarea
                          rows={2}
                          value={notesDraft[leadId] ?? l.notes ?? ""}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [leadId]: e.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Follow-up notes…"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={savingId === leadId}
                          onClick={() =>
                            patchLead(leadId, {
                              notes: notesDraft[leadId] ?? l.notes ?? "",
                            })
                          }
                          className="btn-primary disabled:opacity-70"
                        >
                          {savingId === leadId ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                    </>
                    );
                  })() : (
                    <p className="text-sm text-white/40">
                      This lead is file-store only. Run the Supabase leads
                      migration for status updates and durable storage.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20";
