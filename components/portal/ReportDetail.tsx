"use client";

import type { MonthlyReport, ScorecardEntry } from "@/lib/lifecycle/types";
import { Button, SectionCard, StatusPill } from "@/components/portal/ui";

function Delta({ entry }: { entry: ScorecardEntry }) {
  if (entry.previous == null) {
    return <span className="text-[0.65rem] text-white/30">first month tracked</span>;
  }
  const delta = entry.value - entry.previous;
  if (delta === 0) return <span className="text-[0.65rem] text-white/40">no change</span>;
  const up = delta > 0;
  return (
    <span className={`text-[0.65rem] ${up ? "text-emerald-300" : "text-amber-300"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 1 })}{" "}
      vs last month
    </span>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  measured: "Measured",
  estimated: "Estimated",
  manual: "Manually entered",
};

function List({ title, items, tone }: { title: string; items: string[]; tone?: "risk" }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title={title}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-white/70">
            <span
              className={`mt-[8px] h-1 w-1 shrink-0 rounded-full ${
                tone === "risk" ? "bg-amber-300" : "bg-crimson-light"
              }`}
            />
            {item}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function ReportDetail({
  report,
  periodLabelText,
}: {
  report: MonthlyReport;
  periodLabelText: string;
}) {
  return (
    <div className="min-w-0 space-y-5 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="display text-xl">{report.title || `${periodLabelText} Performance Report`}</h2>
        <Button variant="ghost" onClick={() => window.print()}>
          Download PDF
        </Button>
      </div>

      <SectionCard title="Executive summary" eyebrow={periodLabelText}>
        <div className="space-y-3 text-sm leading-relaxed text-white/70">
          {report.executive_summary.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </SectionCard>

      <List title="Key wins" items={report.key_wins} />

      {report.scorecard.length > 0 && (
        <SectionCard title="Performance scorecard" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                  <th className="px-5 py-3 font-medium">Metric</th>
                  <th className="px-4 py-3 font-medium">This month</th>
                  <th className="px-4 py-3 font-medium">Trend</th>
                  <th className="px-4 py-3 font-medium">Goal</th>
                  <th className="px-5 py-3 font-medium">Data source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {report.scorecard.map((entry) => (
                  <tr key={entry.key}>
                    <td className="px-5 py-3 text-white/75">{entry.label}</td>
                    <td className="px-4 py-3 text-white">
                      {entry.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                      {entry.unit && <span className="text-white/40"> {entry.unit}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Delta entry={entry} />
                    </td>
                    <td className="px-4 py-3 text-white/55">
                      {entry.goal != null
                        ? entry.goal.toLocaleString("en-US", { maximumFractionDigits: 1 })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`font-mono text-[0.55rem] uppercase tracking-label ${
                          entry.source === "measured" ? "text-emerald-300/70" : "text-amber-300/70"
                        }`}
                      >
                        {SOURCE_LABELS[entry.source] ?? entry.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/10 px-5 py-3 text-[0.65rem] leading-relaxed text-white/35">
            Measured numbers come directly from your systems. Estimated and
            manually entered figures are labeled so you always know what
            you&rsquo;re looking at — we never present modeled numbers as
            measurements.
          </p>
        </SectionCard>
      )}

      {report.goal_progress.length > 0 && (
        <SectionCard title="Progress against your goals">
          <div className="space-y-3">
            {report.goal_progress.map((g, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-white/75">{g.goal}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">{g.progress}</span>
                  <StatusPill
                    status={g.on_track ? "on_track" : "at_risk"}
                    label={g.on_track ? "On track" : "Needs attention"}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <List title="Issues & risks" items={report.risks} tone="risk" />
      <List title="Recommendations" items={report.recommendations} />
      <List title="Next month's priorities" items={report.next_priorities} />

      {report.expansion_notes && (
        <SectionCard title="Looking further ahead">
          <p className="text-sm leading-relaxed text-white/70">{report.expansion_notes}</p>
        </SectionCard>
      )}
    </div>
  );
}
