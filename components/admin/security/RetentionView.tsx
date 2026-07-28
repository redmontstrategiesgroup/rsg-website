"use client";

import { useState } from "react";
import { Timer, Lock } from "lucide-react";
import type { RetentionRule } from "@/lib/security-center/types";
import { RETENTION_CATEGORIES } from "@/lib/security-center/catalog";
import { inputClass, labelClass, type RunFn } from "@/components/admin/security/shared";

const ACTIONS = ["manual_review", "anonymize", "archive", "delete"] as const;
const ACTION_LABELS: Record<string, string> = {
  manual_review: "Manual review",
  anonymize: "Anonymize",
  archive: "Archive",
  delete: "Delete",
};
const STATUSES = ["active", "draft", "suspended"] as const;

export function RetentionView({
  rules,
  canManage,
  run,
  busy,
}: {
  rules: RetentionRule[];
  canManage: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const byCategory = new Map(rules.map((r) => [r.dataCategory, r]));
  const [draft, setDraft] = useState<Record<string, Partial<RetentionRule>>>({});

  const draftFor = (key: string): Partial<RetentionRule> => {
    if (draft[key]) return draft[key];
    return (
      byCategory.get(key) ?? {
        dataCategory: key,
        retentionPeriod: "",
        actionAtExpiry: "manual_review",
        legalHold: false,
        status: "active",
      }
    );
  };
  const update = (key: string, patch: Partial<RetentionRule>) =>
    setDraft((d) => ({ ...d, [key]: { ...draftFor(key), ...patch } }));

  async function save(key: string) {
    const r = draftFor(key);
    const ok = await run({
      action: "upsert_retention",
      id: byCategory.get(key)?.id,
      dataCategory: key,
      label: RETENTION_CATEGORIES.find((c) => c.key === key)?.label ?? key,
      retentionPeriod: r.retentionPeriod ?? "",
      actionAtExpiry: r.actionAtExpiry ?? "manual_review",
      legalHold: r.legalHold ?? false,
      status: r.status ?? "active",
      notes: r.notes ?? "",
    });
    if (ok) setDraft((d) => ({ ...d, [key]: {} as Partial<RetentionRule> }));
  }

  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <p className={labelClass}>Data-retention manager</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Define how long each category of data is kept and what happens at
          expiry. Legal holds pause deletion. Nothing important is auto-deleted
          without a documented rule, permission checks, and a recoverable
          process.
        </p>
      </div>

      <div className="space-y-3">
        {RETENTION_CATEGORIES.map((cat) => {
          const r = draftFor(cat.key);
          const existing = byCategory.get(cat.key);
          const dirty = Boolean(draft[cat.key] && Object.keys(draft[cat.key]).length);
          return (
            <div key={cat.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Timer size={14} className="text-white/40" />
                    <p className="font-medium text-white">{cat.label}</p>
                    {existing?.legalHold && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.58rem] text-amber-300">
                        <Lock size={10} /> Legal hold
                      </span>
                    )}
                    {existing && (
                      <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[0.58rem] text-white/50">
                        {existing.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/40">{cat.hint}</p>
                </div>
              </div>

              {canManage ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_160px_auto] sm:items-center">
                  <input
                    value={r.retentionPeriod ?? ""}
                    onChange={(e) => update(cat.key, { retentionPeriod: e.target.value })}
                    placeholder="e.g. 24 months after last activity"
                    className={inputClass}
                  />
                  <select
                    value={r.actionAtExpiry ?? "manual_review"}
                    onChange={(e) => update(cat.key, { actionAtExpiry: e.target.value as RetentionRule["actionAtExpiry"] })}
                    className={inputClass}
                  >
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.status ?? "active"}
                    onChange={(e) => update(cat.key, { status: e.target.value as RetentionRule["status"] })}
                    className={inputClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-white/55">
                      <input
                        type="checkbox"
                        checked={r.legalHold ?? false}
                        onChange={(e) => update(cat.key, { legalHold: e.target.checked })}
                        className="h-4 w-4 accent-crimson"
                      />
                      Hold
                    </label>
                    <button
                      onClick={() => save(cat.key)}
                      disabled={busy || (!dirty && Boolean(existing))}
                      className="rounded-lg border border-white/15 px-3.5 py-2 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/60">
                  {existing?.retentionPeriod
                    ? `${existing.retentionPeriod} → ${ACTION_LABELS[existing.actionAtExpiry]}`
                    : "Not documented."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
