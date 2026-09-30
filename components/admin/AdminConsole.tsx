"use client";

import { useEffect, useRef, useState } from "react";
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
  Mic,
  ChevronDown,
} from "lucide-react";
import type { AdminRole, ClientPublic, Lead, LeadStatus, Subscriber } from "@/lib/types";
import { ADMIN_ROLE_LABELS, LEAD_STATUSES } from "@/lib/types";
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
import { PocketAdminPanel } from "@/components/admin/PocketAdminPanel";
import { LeadAiPanel } from "@/components/admin/LeadAiPanel";
import { ScrollRail } from "@/components/ui/ScrollRail";

type Tab =
  | "clients"
  | "lifecycle"
  | "leads"
  | "pocket"
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
  pocket: boolean;
  brief: boolean;
  security: boolean;
};

type NavItem = {
  id: Tab;
  label: string;
  description: string;
  icon: typeof Users;
  allowed: (caps: AdminCaps) => boolean;
};

/**
 * Sections, grouped the way the work is done. Order within the list is also
 * the default-landing order: the first section a role can see opens first.
 * Real enforcement is server-side on every API route; `allowed` only keeps
 * the UI honest to the role.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Pipeline",
    items: [
      {
        id: "clients",
        label: "Clients",
        description: "Provision portal accounts and edit the metrics each client sees.",
        icon: Users,
        allowed: (c) => c.clients,
      },
      {
        id: "lifecycle",
        label: "Client OS",
        description: "Track every account from first touch through delivery.",
        icon: Route,
        allowed: (c) => c.leads || c.clients,
      },
      {
        id: "leads",
        label: "Leads",
        description: "Review inbound leads, update their status, and follow up.",
        icon: Inbox,
        allowed: (c) => c.leads,
      },
      {
        id: "pocket",
        label: "Pocket",
        description: "Recordings from the Pocket recorder, transcribed, summarized, and matched to leads.",
        icon: Mic,
        allowed: (c) => c.pocket,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        id: "analytics",
        label: "Analytics",
        description: "Page views and visitors from consenting site traffic.",
        icon: BarChart3,
        allowed: (c) => c.analytics,
      },
      {
        id: "brief",
        label: "Audit Brief",
        description: "Generate a pre-call research brief from a lead's website.",
        icon: FileSearch,
        allowed: (c) => c.brief,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "scheduling",
        label: "Scheduling",
        description: "Native consultation booking, qualification, and calendar controls.",
        icon: Calendar,
        allowed: (c) => c.scheduling,
      },
      {
        id: "managed",
        label: "Managed Services",
        description: "Plans, subscriptions, service delivery, reporting, and proposals.",
        icon: Wrench,
        allowed: (c) => c.clients,
      },
      {
        id: "private-ai",
        label: "Private AI",
        description: "Configurations submitted from the Private AI System Designer.",
        icon: Cpu,
        allowed: (c) => c.privateAi,
      },
    ],
  },
  {
    label: "Website",
    items: [
      {
        id: "connect",
        label: "Connect Page",
        description: "Manage the RSG link hub used on social, cards, and QR codes.",
        icon: Link2,
        allowed: (c) => c.connect,
      },
      {
        id: "industries",
        label: "Industries",
        description: "Manage the industry pages shown on the marketing site.",
        icon: Building2,
        allowed: (c) => c.connect,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        id: "security",
        label: "Security",
        description: "Identity, data, AI approvals, vendors, retention, incidents, and testing, backed by real system data.",
        icon: ShieldCheck,
        allowed: (c) => c.security,
      },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isTab(value: string): value is Tab {
  return ALL_ITEMS.some((i) => i.id === value);
}

export function AdminConsole({
  adminEmail,
  role,
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
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.allowed(caps)),
  })).filter((g) => g.items.length > 0);
  const availableTabs = groups.flatMap((g) => g.items.map((i) => i.id));
  const [tab, setTabState] = useState<Tab>(availableTabs[0] ?? "security");
  const [clients, setClients] = useState(initialClients);
  const [leads, setLeads] = useState(initialLeads);
  const [selectedId, setSelectedId] = useState(initialClients[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const newLeadCount = leads.filter((l) => (l.status ?? "new") === "new").length;

  const selected = clients.find((c) => c.id === selectedId) ?? null;
  const current = ALL_ITEMS.find((i) => i.id === tab);
  const currentGroup = groups.find((g) => g.items.some((i) => i.id === tab));

  const counts: Partial<Record<Tab, { count?: number; badge?: number }>> = {
    clients: { count: clients.length },
    leads: { count: leads.length, badge: newLeadCount },
    analytics: { count: analytics?.totalViews ?? 0 },
  };

  // Deep-link: /admin#leads opens the Leads section, and reloads keep place.
  useEffect(() => {
    const syncFromHash = () => {
      const fromHash = window.location.hash.slice(1);
      if (isTab(fromHash) && availableTabs.includes(fromHash)) setTabState(fromHash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
    // availableTabs is derived from server-fixed caps, so subscribe once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * User-initiated section change. Moves focus to the new section's heading
   * so keyboard and screen-reader users land on the content they asked for
   * instead of staying in the nav with no sign that anything changed.
   */
  function setTab(next: Tab) {
    setTabState(next);
    window.history.replaceState(null, "", `#${next}`);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    if (window.scrollY > 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
  }

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

  function navBadge(id: Tab, active: boolean) {
    const c = counts[id];
    if (!c) return null;
    if (c.badge && c.badge > 0) {
      return (
        <span className="ml-auto rounded-full bg-crimson px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-white">
          {c.badge}
          <span className="sr-only"> new</span>
        </span>
      );
    }
    if (c.count == null) return null;
    return (
      <span
        className={`ml-auto rounded-full px-2 py-0.5 text-[0.6875rem] tabular-nums ${
          active ? "bg-white/15 text-white" : "bg-white/6 text-white/60"
        }`}
      >
        {c.count}
        <span className="sr-only"> total</span>
      </span>
    );
  }

  return (
    <div className="min-h-dvh bg-base">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-crimson focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.25]" />
        <div className="absolute left-1/2 top-[-10%] h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-crimson/6 blur-[130px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-base/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-app items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Redmont Strategies Group home"
              className="inline-flex min-h-11 min-w-11 items-center rounded-lg focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light"
            >
              <Logo showWordmark={false} />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-crimson/30 bg-crimson/8 px-3 py-1 text-xs font-medium text-crimson-light">
              <ShieldCheck size={13} aria-hidden="true" />
              Admin console
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className={`${quietButton} hidden sm:inline-flex`}
            >
              <LayoutDashboard size={15} aria-hidden="true" />
              Intelligence
            </Link>
            <div className="hidden text-right leading-tight md:block">
              <p className="max-w-[16rem] truncate text-sm text-white/85">{adminEmail}</p>
              <p className="text-xs text-white/60">{ADMIN_ROLE_LABELS[role] ?? role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              aria-label="Sign out"
              className={`${quietButton} disabled:opacity-50`}
            >
              {loggingOut ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut size={15} aria-hidden="true" />
              )}
              <span className="hidden sm:inline" aria-hidden="true">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-app px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:px-8">
        {/* Sidebar (desktop) */}
        <nav aria-label="Admin sections" className="hidden lg:block">
          <div className="sticky top-16 max-h-[calc(100dvh-4rem)] space-y-6 overflow-y-auto py-8 pr-1">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/55">
                  {g.label}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {g.items.map((item) => {
                    const active = tab === item.id;
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setTab(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light ${
                            active
                              ? "bg-white/[0.07] font-medium text-white"
                              : "text-white/70 hover:bg-white/4 hover:text-white"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="admin-nav-indicator"
                              aria-hidden="true"
                              className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-crimson-light"
                            />
                          )}
                          <Icon
                            size={16}
                            aria-hidden="true"
                            className={active ? "text-crimson-light" : "text-white/55 group-hover:text-white/80"}
                          />
                          <span className="truncate">{item.label}</span>
                          {navBadge(item.id, active)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main id="admin-main" className="min-w-0 py-6 lg:py-8">
          {/* Section rail (mobile / tablet) */}
          <ScrollRail
            as="nav"
            aria-label="Admin sections"
            activeKey={tab}
            snap="start"
            hideScrollbar
            className="-mx-4 mb-6 flex gap-2 px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden"
          >
            {groups.flatMap((g) => g.items).map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light ${
                    active
                      ? "border-crimson/50 bg-crimson/12 font-medium text-white"
                      : "border-white/12 bg-white/3 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                  {navBadge(item.id, active)}
                </button>
              );
            })}
          </ScrollRail>

          {/* Section heading */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div className="min-w-0">
              {currentGroup && (
                <p className="text-xs font-semibold uppercase tracking-wider text-crimson-light">
                  {currentGroup.label}
                </p>
              )}
              <h1
                id="admin-section-title"
                ref={headingRef}
                tabIndex={-1}
                className="display mt-1.5 text-[1.6rem] font-semibold text-white focus:outline-hidden sm:text-[1.9rem]"
              >
                {current?.label ?? "Admin console"}
              </h1>
              {current?.description && (
                <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-white/70">
                  {current.description}
                </p>
              )}
            </div>
            <Link href="/dashboard" className={`${quietButton} sm:hidden`}>
              <LayoutDashboard size={15} aria-hidden="true" />
              Intelligence dashboard
            </Link>
          </div>

          {mfaSetupRequired && tab !== "security" && (
            <div
              role="status"
              className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-crimson/40 bg-crimson/8 px-4 py-3 text-sm text-white/85"
            >
              <ShieldAlert size={16} className="shrink-0 text-crimson-light" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                Multifactor authentication is required for your role. Some actions
                are blocked until you enroll.
              </span>
              <button
                type="button"
                onClick={() => setTab("security")}
                className="min-h-11 rounded-lg border border-crimson/50 px-3.5 text-sm font-medium text-crimson-light transition-colors hover:border-crimson-light hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light"
              >
                Set up MFA
              </button>
            </div>
          )}

          <section aria-labelledby="admin-section-title" className="mt-8">
            {tab === "clients" && caps.clients ? (
              <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                {/* Client list */}
                <aside aria-label="Clients" className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    aria-pressed={creating}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed p-3.5 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light ${
                      creating
                        ? "border-crimson/50 bg-crimson/6 text-white"
                        : "border-white/20 text-white/75 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/3 text-crimson-light">
                      <UserPlus size={15} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium">New client</span>
                  </button>

                  <ul className="space-y-2">
                    {clients.map((c) => {
                      const active = c.id === selectedId && !creating;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(c.id);
                              setCreating(false);
                            }}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light ${
                              active
                                ? "border-crimson/40 bg-crimson/6"
                                : "border-white/10 bg-white/2 hover:border-white/25 hover:bg-white/4"
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/4 text-sm font-semibold text-crimson-light"
                            >
                              {c.company.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <span className="min-w-0">
                              <span className="block wrap-break-word text-sm font-medium text-white">
                                {c.company}
                              </span>
                              <span className="block truncate text-xs text-white/60">
                                {c.plan}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>

                {/* Editor / create form */}
                {creating ? (
                  <CreateClientForm onCreated={onCreated} onCancel={() => setCreating(false)} />
                ) : selected ? (
                  <ClientEditor key={selected.id} client={selected} onSaved={onSaved} />
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No clients yet"
                    body="Use “New client” to provision a portal account."
                  />
                )}
              </div>
            ) : tab === "leads" && caps.leads ? (
              <div className="space-y-10">
                <LeadsTable leads={leads} onLeadsChange={setLeads} />
                <SubscribersPanel subscribers={subscribers} />
              </div>
            ) : tab === "pocket" && caps.pocket ? (
              <PocketAdminPanel leads={leads} />
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
              <EmptyState
                icon={ShieldAlert}
                title="No access"
                body="Your role doesn’t include this section."
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

const quietButton =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/3 px-3.5 text-sm text-white/80 transition-colors hover:border-white/35 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light";

function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof Users;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/4 text-white/60">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-4 font-medium text-white/90">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-sm text-white/65">{body}</p>}
      {children}
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
    // is recoverable from a handful of outputs, fine for a jitter, not for a
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
        <p className="mt-1 text-sm text-white/65">
          Creates a portal account. Share the temporary password with the
          client; they sign in at /login.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
            Contact name *
          </span>
          <input required value={form.name} onChange={set("name")} className={inputClass} placeholder="Full name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
            Business name *
          </span>
          <input required value={form.company} onChange={set("company")} className={inputClass} placeholder="Business name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
            Email *
          </span>
          <input required type="email" value={form.email} onChange={set("email")} className={inputClass} placeholder="Email address" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
            Plan
          </span>
          <select value={form.plan} onChange={set("plan")} className={inputClass}>
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
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
          <span className="mb-1.5 block text-xs font-medium text-white/75">
            Client since
          </span>
          <input value={form.since} onChange={set("since")} className={inputClass} placeholder="Jul 2026" />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
          {saving ? "Creating…" : "Create client"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg px-3 text-sm text-white/70 transition-colors hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light"
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
      <EmptyState
        icon={BarChart3}
        title="No page views recorded yet"
        body="Views are counted for visitors who accept cookies on the marketing site."
      />
    );
  }

  const maxPageViews = Math.max(1, ...analytics.topPages.map((p) => p.views));
  const maxDayViews = Math.max(1, ...analytics.days.map((d) => d.views));

  return (
    <div className="space-y-8">
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: `Views · last ${analytics.windowDays} days`, value: analytics.totalViews.toLocaleString() },
          {
            label: `Unique visitors · last ${analytics.windowDays} days`,
            value: analytics.uniqueVisitors.toLocaleString(),
          },
          {
            label: "Top page",
            value: analytics.topPages[0]?.path ?? "-",
            isText: true,
          },
        ].map((s) => (
          <div key={s.label} className="card p-6">
            <dt className="text-sm text-white/65">{s.label}</dt>
            <dd
              className={`mt-2 font-display text-white ${
                s.isText ? "truncate text-lg" : "text-3xl font-semibold tabular-nums"
              }`}
              title={s.isText ? String(s.value) : undefined}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 xl:grid-cols-2">
        <div>
          <h2 className="text-base font-semibold text-white">Top pages</h2>
          <div className="card mt-4 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-md text-left text-sm">
              <caption className="sr-only">Most viewed pages</caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-xs uppercase tracking-wider text-white/60">
                  <th scope="col" className="px-4 py-3 font-medium">Path</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Views</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topPages.map((p) => (
                  <tr key={p.path} className="border-b border-white/6 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block truncate text-white/90">{p.path}</span>
                      <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-white/6">
                        <span
                          className="block h-full rounded-full bg-crimson-light/70"
                          style={{ width: `${(p.views / maxPageViews) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/80">{p.views}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/70">{p.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white">Recent days</h2>
          <div className="card mt-4 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-md text-left text-sm">
              <caption className="sr-only">Daily views and visitors</caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-xs uppercase tracking-wider text-white/60">
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="w-2/5 px-4 py-3 font-medium">
                    <span className="sr-only">Relative volume</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Views</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {analytics.days.map((d) => (
                  <tr key={d.date} className="border-b border-white/6 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/80">{d.date}</td>
                    <td className="px-4 py-3" aria-hidden="true">
                      <span className="block h-2 rounded-full bg-white/6">
                        <span
                          className="block h-full rounded-full bg-crimson-light/70"
                          style={{ width: `${(d.views / maxDayViews) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/80">{d.views}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/70">{d.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      setError("Network error: try again.");
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
        <h2 className="text-base font-semibold text-white">
          Pre-call Business Systems Audit brief
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Runs the RSG research agent against a lead&rsquo;s website and
          produces a brief: snapshot, lead-capture review, conversion risks,
          quick wins, and talking points for the strategy call. Takes a few
          minutes.
        </p>

        <form onSubmit={generate} className="mt-6 space-y-4">
          <label className="block">
            <span className={fieldLabel}>Lead website *</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://leads-website.com"
            className={inputClass}
            disabled={running}
          />
          </label>
          <label className="block">
            <span className={fieldLabel}>Business name</span>
          <input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Optional"
            className={inputClass}
            disabled={running}
          />
          </label>
          <label className="block">
            <span className={fieldLabel}>Context from the lead</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional, e.g. their biggest problem"
            className={`${inputClass} resize-none`}
            disabled={running}
          />
          </label>
          <button
            type="submit"
            disabled={running || !url.trim()}
            className="btn-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Researching…
              </>
            ) : (
              "Generate brief"
            )}
          </button>
          {error && (
            <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
              {error}
            </p>
          )}
        </form>
      </div>

      <div
        className="card relative min-h-[320px] p-6"
        aria-live="polite"
        aria-busy={running}
        aria-label="Generated brief"
        role="region"
      >
        {output ? (
          <>
            <button
              type="button"
              onClick={copy}
              className="absolute right-4 top-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs text-white/75 transition-colors hover:border-white/35 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light"
            >
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? "Copied" : "Copy brief"}
            </button>
            <div className="whitespace-pre-wrap pr-24 text-sm leading-relaxed text-white/85">
              {output}
            </div>
          </>
        ) : (
          <p className="text-sm text-white/60">
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
      <h2 className="text-base font-semibold text-white">
        Email subscribers
        <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-xs font-normal tabular-nums text-white/70">
          {subscribers.length}
        </span>
      </h2>
      {subscribers.length === 0 ? (
        <p className="mt-3 text-sm text-white/65">
          No marketing signups yet. Emails captured by the site popup will
          appear here.
        </p>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Email subscribers</caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-xs uppercase tracking-wider text-white/60">
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Source</th>
                  <th scope="col" className="px-4 py-3 font-medium">Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr
                    key={s.email}
                    className="border-b border-white/6 last:border-0"
                  >
                    <td className={`px-4 py-3.5 ${s.unsubscribedAt ? "text-white/60 line-through decoration-white/30" : "text-white/85"}`}>
                      {s.email}
                      {s.unsubscribedAt && (
                        <span className="ml-2 inline-block rounded-full bg-white/8 px-2 py-0.5 text-xs text-white/70 no-underline">
                          Unsubscribed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-white/70">{s.source}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-white/70">
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
              <span className="mb-1.5 block text-xs font-medium text-white/75">
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
        <p className="mt-1 text-sm text-white/65">
          Values shown on the client&rsquo;s dashboard.
        </p>
        <div className="mt-5 space-y-3">
          {metrics.map((m, i) => (
            <div
              key={m.key}
              className="grid items-end gap-3 rounded-xl border border-white/10 bg-white/2 p-4 sm:grid-cols-[1.4fr_1fr_1fr]"
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/75">
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
                <span className="mb-1.5 block text-xs font-medium text-white/75">
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
                <span className="mb-1.5 block text-xs font-medium text-white/75">
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
              <p className="text-xs text-white/60 sm:col-span-3">
                Preview: <span className="font-medium text-white/85">{formatMetricValue(Number(m.value) || 0, m.format)}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Access */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">Access</h2>
        <label className="mt-4 block max-w-sm">
          <span className="mb-1.5 block text-xs font-medium text-white/75">
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
        <div className="min-h-5 text-sm" role="status" aria-live="polite">
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
                <Check size={14} aria-hidden="true" /> Saved to client record
              </motion.span>
            ) : (
              <span className="text-white/65">
                Editing {client.company}
              </span>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
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
  qualified_not_booked: "Qualified, not booked",
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

/** Pill colours by pipeline stage. Text always carries the status too, so
 * colour is reinforcement, never the only signal. */
function statusTone(status: LeadStatus): string {
  switch (status) {
    case "new":
    case "submitted":
    case "manual_review":
    case "follow_up_required":
      return "border-crimson/40 bg-crimson/[0.14] text-crimson-light";
    case "qualified":
    case "qualified_not_booked":
    case "contacted":
    case "intake_started":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "meeting_scheduled":
    case "appointment_booked":
    case "rescheduled":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "won":
    case "converted":
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

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
      <EmptyState
        icon={Inbox}
        title="No leads captured yet"
        body="Contact form and chat submissions appear here once stored."
      >
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className={`${quietButton} mt-6 disabled:opacity-50`}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </EmptyState>
    );
  }

  const extrasText = (l: Lead) => Object.values(l.demo?.extras ?? {}).join(" ").toLowerCase();
  // Leads captured before the Sep 2026 retail → real estate switch carry
  // industry strings like "Retail & Ecommerce". They no longer match any
  // segment and show only under "All leads" — intended, and lossless.
  const isRealEstate = (l: Lead) =>
    /real ?estate|realty|brokerage|realtor/i.test(l.industry ?? "") ||
    l.demo?.slug === "realestate";
  const visible = leads.filter((l) => {
    if (sourceFilter && (l.source ?? "website_contact_form") !== sourceFilter) return false;
    switch (segmentFilter) {
      case "real-estate":
        return isRealEstate(l);
      case "demo":
        return Boolean(l.demo);
      case "high-real-estate":
        return isRealEstate(l) && (l.score ?? 0) >= 60;
      case "multi-agent":
        return /agents/.test(extrasText(l)) && !/just me/.test(extrasText(l));
      case "high-volume":
        return /150|400\+/.test(extrasText(l));
      case "full-system":
        return (l.demo?.featuresRequested ?? []).some((s) => /complete|full/i.test(s));
      default:
        return true;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/70" role="status">
          <span className="font-semibold text-white">
            {leads.filter((l) => (l.status ?? "new") === "new").length} new
          </span>{" "}
          · {visible.length} shown · {leads.length} total
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="lead-source-filter">Filter by source</label>
          <select
            id="lead-source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="min-h-11 rounded-lg border border-white/15 bg-base-900 px-3 text-sm text-white/85 focus:border-crimson-light focus:outline-hidden focus:ring-2 focus:ring-crimson/30"
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
            className="min-h-11 rounded-lg border border-white/15 bg-base-900 px-3 text-sm text-white/85 focus:border-crimson-light focus:outline-hidden focus:ring-2 focus:ring-crimson/30"
          >
            <option value="">All leads</option>
            <option value="real-estate">Real estate leads</option>
            <option value="demo">Demo leads</option>
            <option value="high-real-estate">High-value real estate</option>
            <option value="multi-agent">Multi-agent teams</option>
            <option value="high-volume">High-volume brokerages</option>
            <option value="full-system">Wants a full system</option>
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`${quietButton} disabled:opacity-50`}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh"}
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
          <p className="rounded-xl border border-white/10 bg-white/2 p-6 text-center text-sm text-white/65">
            No leads match these filters.
          </p>
        )}
        {visible.map((l, i) => {
          const rowId = l.id ?? `local-${i}`;
          const open = expandedId === rowId;
          const status = (l.status ?? "new") as LeadStatus;
          const panelId = `lead-panel-${rowId}`;
          const score = l.score;
          const adjustedFrom =
            l.aiScore != null && l.ruleScore != null && score != null && l.ruleScore !== score
              ? l.ruleScore
              : null;
          const delta = adjustedFrom != null && score != null ? score - adjustedFrom : 0;
          return (
            <div
              key={rowId}
              className={`rounded-xl border transition-colors ${
                status === "new"
                  ? "border-crimson/35 bg-crimson/4"
                  : "border-white/10 bg-white/2"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : rowId)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full flex-wrap items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-white/2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-crimson-light"
              >
                <span
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums ${
                    (score ?? 0) >= 60
                      ? "border-crimson/40 bg-crimson/12 text-crimson-light"
                      : (score ?? 0) >= 30
                        ? "border-white/15 bg-white/5 text-white/90"
                        : "border-white/10 text-white/60"
                  }`}
                  title={
                    adjustedFrom != null
                      ? `Lead score: rule ${adjustedFrom}, Claude ${delta >= 0 ? "+" : ""}${delta}`
                      : "Lead score"
                  }
                >
                  <span className="sr-only">Score </span>
                  {score ?? "–"}
                  {adjustedFrom != null ? (
                    <span className="sr-only"> (adjusted by Claude from {adjustedFrom})</span>
                  ) : null}
                  {adjustedFrom != null ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black bg-crimson-light"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block wrap-break-word text-sm font-medium text-white">
                    {l.name}
                    {l.company ? (
                      <span className="font-normal text-white/65"> · {l.company}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block break-all text-sm text-white/65 sm:wrap-break-word">
                    {l.email}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 text-white/60 transition-transform sm:order-last ${open ? "rotate-180" : ""}`}
                />
                <span className="flex w-full items-center gap-3 pl-13 sm:w-auto sm:pl-0">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(status)}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-white/60">
                    {new Date(l.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
              </button>

              {open && (
                <div id={panelId} className="space-y-4 border-t border-white/10 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-white/60">
                        Biggest problem
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                        {l.problem || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/60">
                        Wants to improve
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                        {l.improve || "-"}
                      </p>
                    </div>
                  </div>

                  {l.demo && (
                    <div className="rounded-lg border border-crimson/25 bg-crimson/5 p-3.5">
                      <p className="text-xs font-semibold text-crimson-light">
                        Interactive demo request: {l.demo.system}
                      </p>
                      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-white/60">
                            Features explored in demo
                          </p>
                          {l.demo.featuresExplored.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {l.demo.featuresExplored.map((f) => (
                                <span key={f} className="rounded-sm border border-white/10 bg-white/4 px-2 py-0.5 text-xs text-white/65">
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-sm text-white/65">-</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white/60">
                            Services requested
                          </p>
                          {l.demo.featuresRequested.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {l.demo.featuresRequested.map((f) => (
                                <span key={f} className="rounded-sm border border-crimson/30 bg-crimson/10 px-2 py-0.5 text-xs text-white/80">
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-sm text-white/65">-</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/55">
                        <span>Demo page: /demos/{l.demo.slug}</span>
                        <span>Business size: {l.demo.businessSize || "-"}</span>
                        <span>
                          Preferred meeting:{" "}
                          {[l.demo.preferredDate, l.demo.preferredTime].filter(Boolean).join(" · ") || "-"}
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
                    <span>Industry: {l.industry || "-"}</span>
                    <span>Timeline: {l.timeline || "-"}</span>
                    <span>Preferred: {l.preferredContact || "-"}</span>
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

                  {(l.firstTouch || l.journey?.length) && (
                    <div className="rounded-lg border border-white/10 bg-white/2 p-3.5">
                      {l.firstTouch && (
                        <>
                          <p className="text-xs font-medium text-white/60">
                            First visit
                          </p>
                          <p className="mt-1.5 text-sm text-white/65">
                            {[
                              new Date(l.firstTouch.at).toLocaleDateString(),
                              l.firstTouch.utmSource &&
                                `${l.firstTouch.utmSource}${l.firstTouch.utmMedium ? ` / ${l.firstTouch.utmMedium}` : ""}`,
                              l.firstTouch.utmCampaign && `campaign: ${l.firstTouch.utmCampaign}`,
                              l.firstTouch.referrer ? `from ${l.firstTouch.referrer}` : !l.firstTouch.utmSource && "direct",
                              l.firstTouch.landingPage && `landed on ${l.firstTouch.landingPage}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </>
                      )}
                      {l.journey?.length ? (
                        <>
                          <p className={`text-xs font-medium text-white/60 ${l.firstTouch ? "mt-3" : ""}`}>
                            Pages viewed before contacting ({l.journey.length})
                          </p>
                          <ol className="mt-1.5 space-y-0.5 text-xs text-white/55">
                            {l.journey.map((v, i) => (
                              <li key={`${v.at}-${i}`} className="flex gap-3">
                                <span className="shrink-0 tabular-nums text-white/60">
                                  {new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                                <span className="min-w-0 truncate">{v.path}</span>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : null}
                    </div>
                  )}

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
                    <LeadAiPanel
                      leadId={leadId}
                      leadEmail={l.email}
                      ruleScore={l.ruleScore ?? l.score ?? 0}
                      applied
                      onAnalyzed={(latest) => {
                        if (latest?.status !== "ok" || latest.adjustment == null) return;
                        const rule = l.ruleScore ?? l.score ?? 0;
                        const next = Math.min(100, Math.max(0, rule + latest.adjustment));
                        onLeadsChange(
                          leads.map((x) =>
                            x.id === leadId
                              ? { ...x, score: next, aiScore: latest.aiFitScore ?? x.aiScore, aiInsightId: latest.id }
                              : x,
                          ),
                        );
                      }}
                      onSent={() =>
                        onLeadsChange(
                          leads.map((x) =>
                            x.id === leadId && (x.status ?? "new") === "new"
                              ? { ...x, status: "contacted" }
                              : x,
                          ),
                        )
                      }
                    />
                    <div className="rounded-lg border border-white/10 bg-white/2 p-3.5">
                      <p className="text-xs font-medium text-white/60">
                        Recommended plan
                      </p>
                      {l.servicePlanAnswers &&
                        Object.keys(l.servicePlanAnswers).length > 0 && (
                          <p className="mt-1.5 text-xs leading-relaxed text-white/65">
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
                        <span className="mb-1.5 block text-xs font-medium text-white/75">
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
                        <span className="mb-1.5 block text-xs font-medium text-white/75">
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
                          className="btn-primary gap-2 disabled:opacity-70"
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
                    <p className="text-sm text-white/60">
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

const fieldLabel = "mb-1.5 block text-xs font-medium text-white/75";

const inputClass =
  "w-full rounded-lg border border-white/35 bg-white/3 px-3.5 py-2.5 text-sm text-white placeholder:text-white/45 transition-colors focus:border-crimson focus:outline-hidden focus:ring-2 focus:ring-crimson/20";
