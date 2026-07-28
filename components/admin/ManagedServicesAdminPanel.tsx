"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { postJson } from "@/lib/api";
import type {
  ClientRoadmap,
  ClientSubscription,
  MaintenanceLog,
  ManagedServicePlan,
  Proposal,
  RecurringRevenueSummary,
  ServiceReport,
  ServiceRequest,
  SubscriptionEvent,
} from "@/lib/managed-services/types";
import {
  type MinimalClient,
  type RunResult,
} from "@/components/admin/managed/shared";
import { OverviewView } from "@/components/admin/managed/OverviewView";
import { PlansView } from "@/components/admin/managed/PlansView";
import { SubscriptionsView } from "@/components/admin/managed/SubscriptionsView";
import { RequestsView } from "@/components/admin/managed/RequestsView";
import { MaintenanceView } from "@/components/admin/managed/MaintenanceView";
import { ReportsView } from "@/components/admin/managed/ReportsView";
import { RoadmapsView } from "@/components/admin/managed/RoadmapsView";
import { ProposalsView } from "@/components/admin/managed/ProposalsView";

type SubTab =
  | "overview"
  | "plans"
  | "subscriptions"
  | "requests"
  | "maintenance"
  | "reports"
  | "roadmaps"
  | "proposals";

const SUBS: { id: SubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "plans", label: "Plans" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "requests", label: "Requests" },
  { id: "maintenance", label: "Maintenance" },
  { id: "reports", label: "Reports" },
  { id: "roadmaps", label: "Roadmaps" },
  { id: "proposals", label: "Proposals" },
];

/** Actions that route to the proposals endpoint. */
const PROPOSAL_ACTIONS = new Set([
  "upsert_proposal",
  "mark_sent",
  "create_completion_proposal",
]);

type SectionData = {
  // overview
  revenue?: RecurringRevenueSummary;
  openRequests?: number;
  events?: SubscriptionEvent[];
  // shared
  clients?: MinimalClient[];
  plans?: ManagedServicePlan[];
  // sections
  subscriptions?: ClientSubscription[];
  requests?: ServiceRequest[];
  logs?: MaintenanceLog[];
  reports?: ServiceReport[];
  roadmaps?: ClientRoadmap[];
  proposals?: Proposal[];
  error?: string;
};

export function ManagedServicesAdminPanel() {
  const [sub, setSub] = useState<SubTab>("overview");
  const [data, setData] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url =
        sub === "proposals"
          ? "/api/admin/proposals"
          : `/api/admin/managedservices?section=${sub}`;
      const res = await fetch(url);
      const j = (await res.json().catch(() => ({}))) as SectionData;
      if (!res.ok) {
        setError(j.error ?? "Failed to load managed-services data.");
        setData(null);
        return;
      }
      setData(j);
    } catch {
      setError("Network error loading managed services.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sub]);

  useEffect(() => {
    setMessage("");
    void load();
  }, [load]);

  const run = useCallback(
    async (
      action: string,
      payload: Record<string, unknown> = {}
    ): Promise<RunResult> => {
      setBusy(true);
      setMessage("");
      setError("");
      try {
        const endpoint = PROPOSAL_ACTIONS.has(action)
          ? "/api/admin/proposals"
          : "/api/admin/managedservices";
        const res = await postJson(endpoint, { action, ...payload });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || j.ok === false) {
          setError(
            typeof j.error === "string" ? j.error : "Action failed — nothing saved."
          );
          return null;
        }
        setMessage("Saved.");
        await load();
        return j;
      } catch {
        setError("Network error — action not saved.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl text-white">Managed Services</h2>
          <p className="mt-1 text-sm text-white/45">
            Plans, subscriptions, service delivery, reporting, and proposals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 transition-colors hover:text-white"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`shrink-0 px-3 py-2 text-xs transition-colors ${
              sub === s.id
                ? "border-b border-crimson text-white"
                : "text-white/45 hover:text-white/75"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {message ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-2 text-sm text-emerald-200"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-crimson/30 bg-crimson-soft px-4 py-2 text-sm text-crimson-light"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-sm text-white/40">
          Managed-services data could not be loaded. Check that the Supabase
          migration is applied, then refresh.
        </p>
      ) : (
        <>
          {sub === "overview" && data.revenue ? (
            <OverviewView
              revenue={data.revenue}
              openRequests={data.openRequests ?? 0}
              events={data.events ?? []}
            />
          ) : null}

          {sub === "plans" ? (
            <PlansView
              plans={data.plans ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "subscriptions" ? (
            <SubscriptionsView
              subscriptions={data.subscriptions ?? []}
              clients={data.clients ?? []}
              plans={data.plans ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "requests" ? (
            <RequestsView
              requests={data.requests ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "maintenance" ? (
            <MaintenanceView
              logs={data.logs ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "reports" ? (
            <ReportsView
              reports={data.reports ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "roadmaps" ? (
            <RoadmapsView
              roadmaps={data.roadmaps ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}

          {sub === "proposals" ? (
            <ProposalsView
              proposals={data.proposals ?? []}
              plans={data.plans ?? []}
              clients={data.clients ?? []}
              run={run}
              busy={busy}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
