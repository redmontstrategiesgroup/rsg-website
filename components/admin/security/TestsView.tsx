"use client";

import { useState } from "react";
import { FlaskConical, ListChecks } from "lucide-react";
import type { SecurityTest } from "@/lib/security-center/types";
import type { SecurityTestDef } from "@/lib/security-center/catalog";
import {
  formatDate,
  inputClass,
  labelClass,
  resultPill,
  riskPill,
  type RunFn,
} from "@/components/admin/security/shared";

const RESULTS = ["not_run", "pass", "partial", "fail"] as const;
const RESULT_LABELS: Record<string, string> = {
  not_run: "Not run",
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
};
const RETESTS = ["none", "required", "scheduled", "passed", "failed"] as const;
const SEVERITIES = ["", "info", "low", "medium", "high", "critical"] as const;

export function TestsView({
  tests,
  catalog,
  canManage,
  run,
  busy,
}: {
  tests: SecurityTest[];
  catalog: SecurityTestDef[];
  canManage: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<SecurityTest | null>(null);
  const aiTests = catalog.filter((c) => c.group === "ai");
  const platformTests = catalog.filter((c) => c.group === "platform");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className={labelClass}>Security & AI abuse testing</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            The internal checklist for AI-enabled projects — prompt injection,
            sensitive-info disclosure, permission bypass, data leakage, excessive
            agency, and more — plus platform tests like backup restoration and
            access control. Each records expected vs. actual behavior, severity,
            evidence, and retest status.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => run({ action: "seed_test_checklist" })}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30 disabled:opacity-50"
          >
            <ListChecks size={14} /> Load standard checklist
          </button>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="card p-6 text-sm text-white/55">
          <div className="flex items-start gap-3">
            <FlaskConical size={18} className="mt-0.5 shrink-0 text-white/40" />
            <div>
              <p>No tests recorded yet.</p>
              <p className="mt-1 text-xs text-white/40">
                {canManage
                  ? "Load the standard checklist to seed the AI and platform tests below, then record results."
                  : "Tests will appear here once the checklist is populated."}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ChecklistPreview title="AI abuse tests" items={aiTests} />
            <ChecklistPreview title="Platform tests" items={platformTests} />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Retest</th>
                <th className="px-4 py-3">Last run</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-white/[0.06] last:border-0 align-top">
                  <td className="px-4 py-3.5">
                    <p className="text-white/85">{t.name}</p>
                    <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/35">{t.category}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${resultPill(t.result)}`}>
                      {RESULT_LABELS[t.result]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {t.severity ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${riskPill(t.severity)}`}>
                        {t.severity}
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-white/55">{t.retestStatus}</td>
                  <td className="px-4 py-3.5 text-white/45">{formatDate(t.lastRunAt)}</td>
                  <td className="px-4 py-3.5 text-right">
                    {canManage && (
                      <button onClick={() => setEditing(t)} className="text-xs text-crimson-light hover:underline">
                        Record
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && canManage && (
        <TestForm
          test={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await run({ action: "upsert_test", ...payload });
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ChecklistPreview({ title, items }: { title: string; items: SecurityTestDef[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/45">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-white/55">
        {items.slice(0, 8).map((i) => (
          <li key={i.category} className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
            {i.label}
          </li>
        ))}
        {items.length > 8 && <li className="text-white/35">+{items.length - 8} more</li>}
      </ul>
    </div>
  );
}

function TestForm({
  test,
  busy,
  onSubmit,
  onCancel,
}: {
  test: SecurityTest;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [t, setT] = useState<SecurityTest>({ ...test });
  const set = (k: keyof SecurityTest, v: unknown) => setT((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/12 bg-base-900 p-6" onClick={(e) => e.stopPropagation()}>
        <p className={labelClass}>Record test result</p>
        <p className="mt-2 text-sm font-medium text-white">{t.name}</p>
        <p className="text-xs text-white/40">{t.category}</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-xs text-white/45">Expected behavior</p>
            <textarea value={t.expected} onChange={(e) => set("expected", e.target.value)} rows={2} className={inputClass} />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/45">Actual behavior</p>
            <textarea value={t.actual} onChange={(e) => set("actual", e.target.value)} rows={2} className={inputClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={t.result} onChange={(e) => set("result", e.target.value)} className={inputClass}>
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  Result: {RESULT_LABELS[r]}
                </option>
              ))}
            </select>
            <select value={t.severity ?? ""} onChange={(e) => set("severity", e.target.value || null)} className={inputClass}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s ? `Severity: ${s}` : "No severity"}
                </option>
              ))}
            </select>
            <select value={t.retestStatus} onChange={(e) => set("retestStatus", e.target.value)} className={inputClass}>
              {RETESTS.map((r) => (
                <option key={r} value={r}>
                  Retest: {r}
                </option>
              ))}
            </select>
          </div>
          <textarea value={t.evidence ?? ""} onChange={(e) => set("evidence", e.target.value)} placeholder="Evidence (reference, not secrets)" rows={2} className={inputClass} />
          <textarea value={t.remediation ?? ""} onChange={(e) => set("remediation", e.target.value)} placeholder="Remediation" rows={2} className={inputClass} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSubmit(t as unknown as Record<string, unknown>)}
            disabled={busy}
            className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
          >
            Save result
          </button>
          <button onClick={onCancel} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 hover:border-white/30">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
