"use client";

import { ArrowRight, Ban, CheckCircle2, Route, ShieldCheck, UserCheck } from "lucide-react";
import type { BoundaryEvent, BoundaryOutcome, BoundaryRule } from "../types";
import { EmptyState, PanelHeading, SampleDataTag, StatusPill } from "./primitives";
import type { ViewProps } from "./shared";
import { trackEvent } from "@/lib/events";
import { Spotlight } from "./Spotlight";

export function boundaryStats(events: BoundaryEvent[]) {
  const stats = { declined: 0, routed: 0, verified: 0, disclosed: 0 };
  for (const e of events) stats[e.outcome] += 1;
  return stats;
}

const OUTCOME_META: Record<BoundaryOutcome, { label: string; tone: "red" | "amber" | "green" | "gray" }> = {
  declined: { label: "Declined", tone: "red" },
  routed: { label: "Routed to a person", tone: "amber" },
  verified: { label: "Identity verified", tone: "green" },
  disclosed: { label: "Disclosed up front", tone: "gray" },
};

function KindPill({ rule, staffName }: { rule: BoundaryRule; staffName?: string }) {
  if (rule.kind === "route") return <StatusPill tone="amber">Routes to {staffName ?? "staff"}</StatusPill>;
  if (rule.kind === "never") return <StatusPill tone="red">Never</StatusPill>;
  return <StatusPill tone="green">Always</StatusPill>;
}

export function BoundariesView({ state, config, track, openRequest }: ViewProps) {
  const boundaries = config.boundaries;
  const events = state.boundaryEvents;
  const stats = boundaryStats(events);
  const staffName = (id?: string) => state.settings.staff.find((s) => s.id === id)?.name;
  const countFor = (ruleId: string) => events.filter((e) => e.ruleId === ruleId).length;

  if (!boundaries) return <EmptyState text="No guardrails are configured for this demo." />;

  const cards = [
    { label: "Declined", value: stats.declined, Icon: Ban },
    { label: "Routed to a person", value: stats.routed, Icon: Route },
    { label: "Identity checks", value: stats.verified, Icon: UserCheck },
    { label: "Fees & terms disclosed", value: stats.disclosed, Icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-white/55">{boundaries.intro}</p>
        <SampleDataTag />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/40">
              <Icon size={11} className="text-rose-300/80" aria-hidden /> {label}
            </p>
            <p className="mt-2 text-xl font-medium tabular-nums text-white sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {boundaries.rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/85">{rule.label}</p>
                <div className="flex items-center gap-2">
                  <KindPill rule={rule} staffName={staffName(rule.routesTo)} />
                  <span className="text-[0.62rem] tabular-nums text-white/35">{countFor(rule.id)} this month</span>
                </div>
              </div>
              <p className="mt-1.5 text-[0.7rem] leading-relaxed text-white/50">{rule.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-2">
          <PanelHeading title="What stays human" />
          <ul className="space-y-2 px-4 py-3">
            {config.breakdown.teamControls.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-white/60">
                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-400/70" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={`Guardrail log · ${events.length}`} />
        {events.length === 0 ? (
          <EmptyState text="Nothing yet. Take a call as the AI receptionist and ask it something it shouldn't answer." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {events.map((e) => {
              const rule = boundaries.rules.find((r) => r.id === e.ruleId);
              const meta = OUTCOME_META[e.outcome];
              return (
                <Spotlight
                  as="li"
                  pill="inline"
                  id={e.id}
                  fresh={state.fresh}
                  kind="boundary"
                  key={e.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80">{e.summary}</p>
                    <p className="mt-0.5 text-[0.62rem] text-white/35">
                      {rule?.label ?? e.ruleId} · {e.source} · {e.at}
                    </p>
                  </div>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                </Spotlight>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            trackEvent("demo_cta_click", { demo: config.slug, cta: "boundaries" });
            track("reviewed guardrails");
            openRequest({ source: "boundaries_view", feature: "Guardrails & compliance boundaries" });
          }}
          className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        >
          Add these guardrails to my system <ArrowRight size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}
