"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Users,
  ScrollText,
  BrainCircuit,
  Siren,
  Boxes,
  Timer,
  FlaskConical,
  DatabaseBackup,
  FileCog,
  ServerCog,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { postJson } from "@/lib/api";
import type { AdminRole } from "@/lib/types";
import { ADMIN_ROLE_LABELS, ADMIN_ROLES } from "@/lib/types";
import type {
  AiApproval,
  RetentionRule,
  SecurityIncident,
  SecurityOverview,
  SecuritySettings,
  SecurityTest,
  VendorRecord,
} from "@/lib/security-center/types";
import type { SecurityTestDef } from "@/lib/security-center/catalog";
import { statusPill, statusDot, labelClass } from "@/components/admin/security/shared";
import { STATUS_LEVEL_LABELS } from "@/lib/security-center/catalog";
import { IncidentsView } from "@/components/admin/security/IncidentsView";
import { VendorsView } from "@/components/admin/security/VendorsView";
import { ApprovalsView } from "@/components/admin/security/ApprovalsView";
import { RetentionView } from "@/components/admin/security/RetentionView";
import { TestsView } from "@/components/admin/security/TestsView";
import { AuditView } from "@/components/admin/security/AuditView";
import { UsersRolesView } from "@/components/admin/security/UsersRolesView";
import { PoliciesView } from "@/components/admin/security/PoliciesView";
import { MfaSetup } from "@/components/admin/security/MfaSetup";

export type SecurityCapabilities = {
  manageIncidents: boolean;
  manageVendors: boolean;
  manageRetention: boolean;
  approveAi: boolean;
  manageTests: boolean;
  manageSettings: boolean;
  viewAudit: boolean;
  manageMfa: boolean;
};

export type PublicAdmin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  mfaEnabled: boolean;
};

export type SecuritySnapshot = {
  role: AdminRole;
  capabilities: SecurityCapabilities;
  overview: SecurityOverview;
  incidents: SecurityIncident[];
  vendors: VendorRecord[];
  retentionRules: RetentionRule[];
  approvals: AiApproval[];
  tests: SecurityTest[];
  settings: SecuritySettings;
  admins: PublicAdmin[];
  testCatalog: SecurityTestDef[];
};

type Section =
  | "overview"
  | "users"
  | "audit"
  | "approvals"
  | "incidents"
  | "backups"
  | "vendors"
  | "retention"
  | "environment"
  | "tests"
  | "policies";

const SECTIONS: { id: Section; label: string; icon: typeof ShieldCheck }[] = [
  { id: "overview", label: "Security Overview", icon: ShieldCheck },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "audit", label: "Audit Logs", icon: ScrollText },
  { id: "approvals", label: "AI Approvals", icon: BrainCircuit },
  { id: "incidents", label: "Incidents", icon: Siren },
  { id: "vendors", label: "Vendors", icon: Boxes },
  { id: "retention", label: "Data Retention", icon: Timer },
  { id: "tests", label: "Security Tests", icon: FlaskConical },
  { id: "backups", label: "Backups", icon: DatabaseBackup },
  { id: "environment", label: "Environment", icon: ServerCog },
  { id: "policies", label: "Policies", icon: FileCog },
];

export function SecurityCenterPanel({
  mfaEnabled,
  mfaSetupRequired,
}: {
  mfaEnabled: boolean;
  mfaSetupRequired: boolean;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<SecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/security", { cache: "no-store" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Failed to load security data.");
      }
      setData((await res.json()) as SecuritySnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Run a mutating action, then refresh the snapshot. */
  const run = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setBusy(true);
      setError("");
      try {
        const res = await postJson("/api/admin/security", payload);
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setError(b.error ?? "The action could not be completed.");
          return false;
        }
        await load();
        return true;
      } catch {
        setError("Network error — please try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 text-white/50">
        <Loader2 className="animate-spin" size={18} />
        Loading Security Center…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-6">
        <p className="text-white/70">{error || "Security data is unavailable."}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-sm text-white/70 hover:border-white/30"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const caps = data.capabilities;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-xl text-white">RSG Security Center</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            The RSG Secure Systems Standard, operationalized: identity, data,
            AI approvals, vendors, retention, incidents, and testing — backed by
            real system data.
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30 disabled:opacity-50"
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {data.overview.usingDemoData && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200/90">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Demo data is enabled in this environment. Some metrics may reflect
            seeded sample records rather than live production data.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-crimson/40 bg-crimson/[0.08] px-4 py-3 text-sm text-crimson-light">
          {error}
        </div>
      )}

      {mfaSetupRequired && (
        <MfaSetup enabled={mfaEnabled} onChanged={load} required />
      )}

      {/* Sub-nav */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-white/[0.04] text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div>
        {section === "overview" && <OverviewView overview={data.overview} />}
        {section === "environment" && (
          <EnvironmentView overview={data.overview} />
        )}
        {section === "backups" && <BackupsView overview={data.overview} />}
        {section === "users" && (
          <UsersRolesView
            admins={data.admins}
            settings={data.settings}
            canManageSettings={caps.manageSettings}
            selfMfaEnabled={mfaEnabled}
            canManageMfa={caps.manageMfa}
            run={run}
            busy={busy}
            onMfaChanged={load}
          />
        )}
        {section === "audit" &&
          (caps.viewAudit ? (
            <AuditView />
          ) : (
            <NoAccess note="Your role can view the Security Center but not the full audit log." />
          ))}
        {section === "approvals" && (
          <ApprovalsView
            approvals={data.approvals}
            canApprove={caps.approveAi}
            run={run}
            busy={busy}
          />
        )}
        {section === "incidents" && (
          <IncidentsView
            incidents={data.incidents}
            canManage={caps.manageIncidents}
            run={run}
            busy={busy}
          />
        )}
        {section === "vendors" && (
          <VendorsView
            vendors={data.vendors}
            canManage={caps.manageVendors}
            run={run}
            busy={busy}
          />
        )}
        {section === "retention" && (
          <RetentionView
            rules={data.retentionRules}
            canManage={caps.manageRetention}
            run={run}
            busy={busy}
          />
        )}
        {section === "tests" && (
          <TestsView
            tests={data.tests}
            catalog={data.testCatalog}
            canManage={caps.manageTests}
            run={run}
            busy={busy}
          />
        )}
        {section === "policies" && (
          <PoliciesView
            settings={data.settings}
            canManage={caps.manageSettings}
            run={run}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Overview ------------------------------- */

function OverviewView({ overview }: { overview: SecurityOverview }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.indicators.map((ind) => (
          <div
            key={ind.key}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className={labelClass}>{ind.label}</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${statusPill(
                  ind.status
                )}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(ind.status)}`} />
                {STATUS_LEVEL_LABELS[ind.status]}
              </span>
            </div>
            <p className="mt-3 text-lg font-medium text-white">{ind.value}</p>
            {ind.detail && (
              <p className="mt-1.5 text-xs leading-relaxed text-white/45">
                {ind.detail}
              </p>
            )}
          </div>
        ))}
      </div>

      {overview.counts.recentHighRiskAiActions.length > 0 && (
        <div className="card p-5">
          <p className={labelClass}>Recent high-risk AI actions</p>
          <ul className="mt-3 space-y-2">
            {overview.counts.recentHighRiskAiActions.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2 text-sm text-white/70 last:border-0"
              >
                <span className="truncate">{a.title}</span>
                <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-label text-white/40">
                  {a.riskLevel} · {a.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-white/35">
        Generated {new Date(overview.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ·
        every figure is measured from live system state or marked unavailable.
      </p>
    </div>
  );
}

function EnvironmentView({ overview }: { overview: SecurityOverview }) {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-white/55">
        Development, staging, and production are kept separate. These checks
        reflect how this running instance is configured.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {overview.environment.map((c) => (
          <div key={c.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className={labelClass}>{c.label}</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${statusPill(
                  c.status
                )}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                {STATUS_LEVEL_LABELS[c.status]}
              </span>
            </div>
            <p className="mt-2.5 text-sm font-medium text-white">{c.value}</p>
            {c.detail && (
              <p className="mt-1.5 text-xs leading-relaxed text-white/45">{c.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BackupsView({ overview }: { overview: SecurityOverview }) {
  const backup = overview.indicators.find((i) => i.key === "backups");
  const restore = overview.indicators.find((i) => i.key === "restore_test");
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-white/55">
        Backup status is read from real infrastructure when a Supabase
        management token is configured; otherwise it is clearly marked as
        unverified rather than shown as a false green light.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[backup, restore].filter(Boolean).map((ind) => (
          <div key={ind!.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-start justify-between gap-3">
              <p className={labelClass}>{ind!.label}</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${statusPill(
                  ind!.status
                )}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(ind!.status)}`} />
                {STATUS_LEVEL_LABELS[ind!.status]}
              </span>
            </div>
            <p className="mt-3 text-base font-medium text-white">{ind!.value}</p>
            {ind!.detail && (
              <p className="mt-1.5 text-xs leading-relaxed text-white/45">{ind!.detail}</p>
            )}
          </div>
        ))}
      </div>
      <div className="card p-5 text-sm text-white/60">
        <p className="text-white/80">What RSG documents for backups</p>
        <ul className="mt-3 space-y-1.5">
          {[
            "What is backed up (database, uploaded files, configuration).",
            "How often backups run and how long they are retained.",
            "How a restoration would be performed and who is responsible.",
            "Recovery testing — restore a backup into an isolated environment and verify integrity (logged in Security Tests).",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function NoAccess({ note }: { note: string }) {
  return (
    <div className="card p-6 text-sm text-white/55">{note}</div>
  );
}

export { ADMIN_ROLE_LABELS, ADMIN_ROLES };
