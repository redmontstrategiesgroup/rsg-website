"use client";

import { ArrowRight, LifeBuoy } from "lucide-react";
import { deriveAnalytics, formatMetric } from "../engine";
import type { RecoveryTrigger } from "../types";
import { BarChart } from "./charts";
import { EmptyState, PanelHeading, SampleDataTag } from "./primitives";
import type { ViewProps } from "./shared";
import { trackEvent } from "@/lib/events";

export const TRIGGER_LABEL: Record<RecoveryTrigger, string> = {
  "quote-followup": "Quote follow-up",
  "missed-call": "Missed call",
  "no-show": "No-show recovery",
  reactivation: "Reactivation",
  deadline: "Deadline watch",
  "after-hours": "After hours",
  referral: "Referral",
};

export function RecoveredView({ state, config, track, openRequest }: ViewProps) {
  const recovered = config.recovered;
  const derived = deriveAnalytics(state);
  const ledger = state.recoveries;
  const automationName = (id?: string) => state.automations.find((a) => a.id === id)?.name;

  if (!recovered) return <EmptyState text="No recovery ledger is configured for this demo." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-white/55">{recovered.intro}</p>
        <SampleDataTag />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-5 lg:col-span-2">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-emerald-300/80">
            <LifeBuoy size={11} aria-hidden /> Recovered this month
          </p>
          <p className="mt-2 text-3xl font-medium tabular-nums text-white">
            ${derived.recoveredTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-[0.66rem] text-white/45">
            {ledger.length} {ledger.length === 1 ? "contact" : "contacts"} that had gone quiet
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 lg:col-span-3">
          <p className="mb-4 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">By trigger</p>
          {derived.recoveredByTrigger.length === 0 ? (
            <EmptyState text="Run a scenario to see where the recovered dollars come from." />
          ) : (
            <BarChart points={derived.recoveredByTrigger} unit="$" accentLast={false} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={`Ledger · ${ledger.length}`} />
        {ledger.length === 0 ? (
          <EmptyState text="Nothing recovered yet this session." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {ledger.map((r) => (
              <li key={r.id} data-spot-id={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/85">
                    {r.contact}
                    <span className="ml-2 text-[0.62rem] text-white/35">{TRIGGER_LABEL[r.trigger]}</span>
                  </p>
                  <p className="mt-0.5 text-[0.7rem] leading-relaxed text-white/55">{r.summary}</p>
                  <p className="mt-0.5 text-[0.62rem] text-white/35">
                    {r.silentFor}
                    {automationName(r.automationId) ? ` · ${automationName(r.automationId)}` : ""}
                    {` · ${r.at}`}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-emerald-300/90">
                  {formatMetric(r.amount, "currency")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[0.62rem] leading-relaxed text-white/35">
          How it is counted: {recovered.attributionRule}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            trackEvent("demo_cta_click", { demo: config.slug, cta: "recovered" });
            track("reviewed recovered revenue");
            openRequest({ source: "recovered_view", feature: "Automated follow-up sequences" });
          }}
          className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        >
          See what this would recover for my business <ArrowRight size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}
