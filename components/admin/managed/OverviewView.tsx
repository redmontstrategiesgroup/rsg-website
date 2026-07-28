"use client";

import type {
  RecurringRevenueSummary,
  SubscriptionEvent,
} from "@/lib/managed-services/types";
import { formatCents } from "@/lib/managed-services/content";
import { EmptyState, Stat, fmtDateTime } from "./shared";

export function OverviewView({
  revenue,
  openRequests,
  events,
}: {
  revenue: RecurringRevenueSummary;
  openRequests: number;
  events: SubscriptionEvent[];
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR (normalized)" value={formatCents(revenue.mrrCents)} />
        <Stat label="ARR" value={formatCents(revenue.arrCents)} />
        <Stat label="Active subscriptions" value={revenue.activeSubscriptions} />
        <Stat label="Past due" value={revenue.pastDue} />
        <Stat label="Pending cancellation" value={revenue.pendingCancellation} />
        <Stat
          label="Failed payments · 30d"
          value={revenue.failedPaymentsLast30Days}
        />
        <Stat label="Cancelled · 90d" value={revenue.cancelledLast90Days} />
        <Stat label="Open requests" value={openRequests} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-5">
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
            MRR by plan
          </p>
          {revenue.byPlan.length ? (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3 font-normal">Plan</th>
                  <th className="py-2 pr-3 font-normal">Subscriptions</th>
                  <th className="py-2 font-normal">MRR</th>
                </tr>
              </thead>
              <tbody>
                {revenue.byPlan.map((p) => (
                  <tr key={p.planId} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-3 text-white/85">
                      {p.planName}
                      <span className="ml-2 font-mono text-[0.58rem] text-white/35">
                        {p.planKey}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-white/60">{p.count}</td>
                    <td className="py-2.5 text-white/85">
                      {formatCents(p.mrrCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-white/40">
              No revenue-generating subscriptions yet.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 p-5">
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
            Recent events
          </p>
          {events.length ? (
            <ul className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border-b border-white/5 pb-2.5 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-crimson-light">
                      {e.type}
                    </span>
                    <span className="text-xs text-white/35">
                      {fmtDateTime(e.createdAt)}
                    </span>
                  </div>
                  {e.description ? (
                    <p className="mt-1 text-white/70">{e.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-white/35">{e.actor}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No subscription events yet."
                hint="Assignments, updates, cancellations, and reports appear here."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
