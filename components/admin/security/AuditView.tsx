"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { formatDate, inputClass, labelClass } from "@/components/admin/security/shared";

type AuditRow = {
  id?: string;
  created_at?: string;
  actor_type?: string;
  actor_email?: string;
  actor_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
};

const ACTOR_TYPES = ["", "admin", "system", "cron", "anonymous"];
const PRESETS = [
  { label: "All", prefix: "" },
  { label: "Security", prefix: "security." },
  { label: "Authentication", prefix: "admin.login" },
  { label: "AI actions", prefix: "security.approval" },
  { label: "Scheduling", prefix: "scheduling." },
  { label: "DSAR", prefix: "dsar." },
];

export function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prefix, setPrefix] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [actorType, setActorType] = useState("");
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ section: "audit", limit: "200" });
      if (prefix) params.set("actionPrefix", prefix);
      if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim().toLowerCase());
      if (actorType) params.set("actorType", actorType);
      const res = await fetch(`/api/admin/security?${params.toString()}`, { cache: "no-store" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b.error ?? "Could not load audit log.");
        setRows([]);
        return;
      }
      setRows((b.events as AuditRow[]) ?? []);
    } catch {
      setError("Network error loading audit log.");
    } finally {
      setLoading(false);
    }
  }, [prefix, actorEmail, actorType]);

  useEffect(() => {
    load();
  }, [load]);

  const csvHref = (() => {
    const params = new URLSearchParams({ format: "csv", limit: "500" });
    if (prefix && !prefix.includes(".")) params.set("action", prefix);
    return `/api/admin/audit?${params.toString()}`;
  })();

  const aiOnly = (r: AuditRow) => (r.action ?? "").includes("approval") || (r.metadata?.actorType === "ai");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={labelClass}>Audit log</p>
          <p className="mt-1 max-w-2xl text-xs text-white/45">
            Who performed an action, what happened, when, and which record was
            affected. Secrets and passwords are never written to the log.
          </p>
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30"
        >
          <Download size={14} /> Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPrefix(p.prefix)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              prefix === p.prefix
                ? "border-crimson/45 bg-crimson/10 text-white"
                : "border-white/12 bg-white/[0.02] text-white/55 hover:border-white/25"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Filter by actor email"
            className={`${inputClass} max-w-[220px]`}
          />
          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
            className={`${inputClass} max-w-[150px]`}
          >
            {ACTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t ? t : "Any actor type"}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:border-white/30"
          >
            <Search size={14} /> Filter
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-crimson-light">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-white/50">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-sm text-white/50">
          No audit events match. Real events are recorded as admins act — sign in,
          change records, decide AI approvals — and appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i} className="border-b border-white/[0.06] last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="text-white/80">{r.actor_email ?? r.actor_id ?? "—"}</span>
                    <span className="ml-2 font-mono text-[0.56rem] uppercase tracking-label text-white/35">
                      {r.actor_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{r.action}</td>
                  <td className="px-4 py-3 text-white/55">
                    {r.entity_type ? `${r.entity_type}${r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${
                        aiOnly(r)
                          ? "border-crimson/40 bg-crimson/10 text-crimson-light"
                          : "border-white/12 bg-white/[0.03] text-white/45"
                      }`}
                    >
                      {aiOnly(r) ? "AI-related" : "Human/system"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetail(r)}
                      className="text-xs text-crimson-light hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/12 bg-base-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={labelClass}>Event detail</p>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                ["Time", formatDate(detail.created_at)],
                ["Actor", detail.actor_email ?? detail.actor_id ?? "—"],
                ["Actor type", detail.actor_type ?? "—"],
                ["Action", detail.action ?? "—"],
                ["Entity", detail.entity_type ?? "—"],
                ["Entity id", detail.entity_id ?? "—"],
                ["IP", detail.ip ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-white/[0.06] pb-2">
                  <dt className="text-white/40">{k}</dt>
                  <dd className="text-right text-white/80">{v}</dd>
                </div>
              ))}
            </dl>
            {detail.metadata && Object.keys(detail.metadata).length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-white/40">Metadata (no secrets)</p>
                <pre className="mt-2 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[0.7rem] text-white/70">
                  {JSON.stringify(detail.metadata, null, 2)}
                </pre>
              </div>
            )}
            <button
              onClick={() => setDetail(null)}
              className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
