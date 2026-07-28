"use client";

import { useState } from "react";
import { Check, X, ArrowUpRight, Play, Plus, ShieldQuestion } from "lucide-react";
import type { AiApproval } from "@/lib/security-center/types";
import { APPROVAL_STATUS_LABELS } from "@/lib/security-center/catalog";
import {
  formatDate,
  inputClass,
  labelClass,
  riskPill,
  type RunFn,
} from "@/components/admin/security/shared";

/** High-risk AI action examples that always require deliberate approval. */
const HIGH_RISK_EXAMPLES = [
  "Sending contracts",
  "Issuing refunds",
  "Changing pricing",
  "Deleting records",
  "Approving estimates",
  "Modifying permissions",
  "Sharing confidential documents",
  "Making financial commitments",
  "Publishing public content",
  "Sending sensitive customer communications",
];

export function ApprovalsView({
  approvals,
  canApprove,
  run,
  busy,
}: {
  approvals: AiApproval[];
  canApprove: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const open = approvals.filter(
    (a) => a.status === "awaiting_approval" || a.status === "escalated"
  );
  const decided = approvals.filter(
    (a) => !(a.status === "awaiting_approval" || a.status === "escalated")
  );

  async function decide(a: AiApproval, decision: "approved" | "rejected" | "escalated") {
    await run({ action: "decide_approval", id: a.id, decision, note: note[a.id] ?? "" });
  }

  async function execute(a: AiApproval) {
    if (
      !window.confirm(
        `Execute this approved action: "${a.title}"? This is irreversible.`
      )
    ) {
      return;
    }
    await run({ action: "execute_approval", id: a.id, confirm: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className={labelClass}>AI approval queue</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            High-risk AI actions do not execute automatically. Each waits here
            for a human to approve, reject, edit, or escalate. Approval states:
            Drafted → Awaiting approval → Approved / Rejected / Escalated →
            Executed / Failed.
          </p>
        </div>
        {canApprove && (
          <button
            onClick={() => run({ action: "create_demo_approval" })}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30 disabled:opacity-50"
          >
            <Plus size={14} /> Queue sample request
          </button>
        )}
      </div>

      {open.length === 0 ? (
        <div className="card flex items-start gap-3 p-6 text-sm text-white/55">
          <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-white/40" />
          <div>
            <p className="text-white/70">No AI actions are waiting for approval.</p>
            <p className="mt-1 text-xs text-white/40">
              When an AI feature drafts a high-risk action — {HIGH_RISK_EXAMPLES.slice(0, 4).join(", ")}, and more —
              it lands here for a human decision before anything happens.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((a) => (
            <article key={a.id} className="rounded-xl border border-crimson/25 bg-crimson/[0.04] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium ${riskPill(a.riskLevel)}`}>
                      {a.riskLevel} risk
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[0.6rem] text-white/60">
                      {APPROVAL_STATUS_LABELS[a.status]}
                    </span>
                    <span className="font-mono text-[0.56rem] uppercase tracking-label text-white/35">
                      {a.actionType}
                    </span>
                  </div>
                  <h4 className="mt-2 text-base font-medium text-white">{a.title}</h4>
                </div>
                <p className="shrink-0 text-xs text-white/40">
                  Requested {formatDate(a.requestedAt)}
                  {a.expiresAt && <> · expires {formatDate(a.expiresAt)}</>}
                </p>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className={labelClass}>Reason</p>
                  <p className="mt-1 text-sm text-white/65">{a.reason}</p>
                  <p className={`${labelClass} mt-3`}>Requesting system</p>
                  <p className="mt-1 text-sm text-white/65">{a.requestedBy}</p>
                </div>
                <div>
                  <p className={labelClass}>Data used</p>
                  <ul className="mt-1 space-y-1 text-sm text-white/60">
                    {a.dataSources.map((d) => (
                      <li key={d} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  <p className={`${labelClass} mt-3`}>Records affected</p>
                  <p className="mt-1 text-sm text-white/60">
                    {a.recordsAffected.join(", ") || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className={labelClass}>AI-generated content</p>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/75">
                  {a.content}
                </pre>
              </div>

              {canApprove ? (
                <div className="mt-4 space-y-2">
                  <input
                    value={note[a.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [a.id]: e.target.value }))}
                    placeholder="Decision note (optional)"
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => decide(a, "approved")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => decide(a, "rejected")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-2 text-sm text-crimson-light transition-colors hover:bg-crimson/20 disabled:opacity-50"
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={() => decide(a, "escalated")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/30 disabled:opacity-50"
                    >
                      <ArrowUpRight size={14} /> Escalate
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-white/40">
                  Your role can view approvals but not decide them.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Decided / history */}
      {decided.length > 0 && (
        <div>
          <p className={labelClass}>Recent decisions</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decided by</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {decided.slice(0, 30).map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3 text-white/80">{a.title}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${riskPill(a.riskLevel)}`}>
                        {a.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">{APPROVAL_STATUS_LABELS[a.status]}</td>
                    <td className="px-4 py-3 text-white/55">{a.decidedBy ?? "—"}</td>
                    <td className="px-4 py-3 text-white/50">{formatDate(a.decidedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {canApprove && a.status === "approved" && (
                        <button
                          onClick={() => execute(a)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/30 disabled:opacity-50"
                        >
                          <Play size={12} /> Mark executed
                        </button>
                      )}
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
