"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { ClientPublic, Lead, Subscriber } from "@/lib/types";
import type { AnalyticsSummary } from "@/lib/analytics";
import { formatMetricValue } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { postJson, patchJson } from "@/lib/api";

type Tab = "clients" | "leads" | "analytics";

export function AdminConsole({
  adminEmail,
  initialClients,
  leads,
  subscribers = [],
  analytics,
}: {
  adminEmail: string;
  initialClients: ClientPublic[];
  leads: Lead[];
  subscribers?: Subscriber[];
  analytics?: AnalyticsSummary;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("clients");
  const [clients, setClients] = useState(initialClients);
  const [selectedId, setSelectedId] = useState(initialClients[0]?.id ?? "");
  const [loggingOut, setLoggingOut] = useState(false);

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
            <a href="/" aria-label="Redmont Strategies Group home">
              <Logo showWordmark={false} />
            </a>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
              <ShieldCheck size={13} />
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[0.58rem] uppercase tracking-label text-white/40 sm:block">
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
        <h1 className="display text-gradient text-[1.8rem] font-semibold sm:text-[2.2rem]">
          Client management
        </h1>
        <p className="mt-3 text-white/55">
          Edit client profiles, reset access, update reported metrics, and
          review inbound leads.
        </p>

        {/* Tabs */}
        <div className="mt-8 flex gap-2 border-b border-white/10">
          {[
            { id: "clients" as Tab, label: "Clients", icon: Users, count: clients.length },
            { id: "leads" as Tab, label: "Leads", icon: Inbox, count: leads.length },
            {
              id: "analytics" as Tab,
              label: "Analytics",
              icon: BarChart3,
              count: analytics?.totalViews ?? 0,
            },
          ].map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                  active ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon size={15} />
                {t.label}
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[0.54rem] text-white/50">
                  {t.count}
                </span>
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
          {tab === "clients" ? (
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              {/* Client list */}
              <aside className="space-y-2">
                {clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      c.id === selectedId
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

              {/* Editor */}
              {selected ? (
                <ClientEditor key={selected.id} client={selected} onSaved={onSaved} />
              ) : (
                <p className="text-white/50">No clients found.</p>
              )}
            </div>
          ) : tab === "leads" ? (
            <div className="space-y-10">
              <LeadsTable leads={leads} />
              <SubscribersPanel subscribers={subscribers} />
            </div>
          ) : (
            <AnalyticsPanel analytics={analytics} />
          )}
        </div>
      </main>
    </div>
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

function LeadsTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) {
    return (
      <div className="card p-10 text-center">
        <Inbox size={28} className="mx-auto text-white/30" />
        <p className="mt-4 text-white/55">No leads captured yet.</p>
        <p className="mt-1 text-sm text-white/35">
          Submissions from the contact form will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
              <th className="px-4 py-3 font-normal">Score</th>
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Business</th>
              <th className="px-4 py-3 font-normal">Email</th>
              <th className="px-4 py-3 font-normal">Industry</th>
              <th className="px-4 py-3 font-normal">Timeline</th>
              <th className="px-4 py-3 font-normal">Biggest problem</th>
              <th className="px-4 py-3 font-normal">Received</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => (
              <tr key={i} className="border-b border-white/[0.06] last:border-0 align-top">
                <td className="px-4 py-3.5">
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
                </td>
                <td className="px-4 py-3.5 text-white/85">{l.name}</td>
                <td className="px-4 py-3.5 text-white/60">{l.company || "—"}</td>
                <td className="px-4 py-3.5 text-white/60">{l.email}</td>
                <td className="px-4 py-3.5 text-white/60">{l.industry || "—"}</td>
                <td className="px-4 py-3.5 text-white/60">{l.timeline || "—"}</td>
                <td className="max-w-xs px-4 py-3.5 text-white/60">
                  <span className="line-clamp-2">{l.problem || "—"}</span>
                </td>
                <td className="px-4 py-3.5 font-mono text-[0.6rem] uppercase tracking-label text-white/40">
                  {new Date(l.submittedAt).toLocaleDateString("en-US", {
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
  );
}

const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20";
