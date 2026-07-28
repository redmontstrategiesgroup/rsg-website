"use client";

import { useState } from "react";
import { Plus, Siren, Download } from "lucide-react";
import type { SecurityIncident, IncidentTimelineKind } from "@/lib/security-center/types";
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_TIMELINE_LABELS,
} from "@/lib/security-center/catalog";
import {
  formatDate,
  inputClass,
  labelClass,
  riskPill,
  type RunFn,
} from "@/components/admin/security/shared";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["open", "contained", "monitoring", "resolved", "closed"] as const;
const TIMELINE_KINDS: IncidentTimelineKind[] = [
  "containment",
  "credential_rotation",
  "isolation",
  "log_preservation",
  "notification",
  "restoration",
  "note",
  "resolution",
  "follow_up",
];

export function IncidentsView({
  incidents,
  canManage,
  run,
  busy,
}: {
  incidents: SecurityIncident[];
  canManage: boolean;
  run: RunFn;
  busy: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className={labelClass}>Incident response</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Detect, contain, rotate credentials, isolate systems, preserve logs,
            restore service, notify affected clients, and track corrective
            actions — each incident carries its own record and timeline.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setCreating((v) => !v);
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70 transition-colors hover:border-white/30"
          >
            <Plus size={14} /> New incident
          </button>
        )}
      </div>

      {creating && canManage && (
        <IncidentForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={async (payload) => {
            const ok = await run({ action: "create_incident", ...payload });
            if (ok) setCreating(false);
          }}
        />
      )}

      {incidents.length === 0 ? (
        <div className="card flex items-start gap-3 p-6 text-sm text-white/55">
          <Siren size={18} className="mt-0.5 shrink-0 text-white/40" />
          <p>No incidents recorded. When one occurs, open a record here to track containment, notification, and resolution.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3 text-white/85">{i.title}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${riskPill(i.severity)}`}>
                      {i.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60">{INCIDENT_STATUS_LABELS[i.status]}</td>
                  <td className="px-4 py-3 text-white/55">{i.owner || "—"}</td>
                  <td className="px-4 py-3 text-white/50">{formatDate(i.detectedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedId(i.id);
                        setCreating(false);
                      }}
                      className="text-xs text-crimson-light hover:underline"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <IncidentDetail
          incident={selected}
          canManage={canManage}
          busy={busy}
          run={run}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function IncidentForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [owner, setOwner] = useState("");
  const [systems, setSystems] = useState("");

  return (
    <div className="card space-y-3 p-5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Incident title"
        className={inputClass}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description — what was detected"
        rows={3}
        className={inputClass}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className={inputClass}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              Severity: {s}
            </option>
          ))}
        </select>
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Responsible owner" className={inputClass} />
        <input value={systems} onChange={(e) => setSystems(e.target.value)} placeholder="Systems affected (comma-separated)" className={inputClass} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            title.trim() &&
            onSubmit({
              title,
              description,
              severity,
              owner,
              systemsAffected: systems.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          disabled={busy || !title.trim()}
          className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
        >
          Create incident
        </button>
        <button onClick={onCancel} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 hover:border-white/30">
          Cancel
        </button>
      </div>
    </div>
  );
}

function IncidentDetail({
  incident,
  canManage,
  busy,
  run,
  onClose,
}: {
  incident: SecurityIncident;
  canManage: boolean;
  busy: boolean;
  run: RunFn;
  onClose: () => void;
}) {
  const [entryKind, setEntryKind] = useState<IncidentTimelineKind>("containment");
  const [entryText, setEntryText] = useState("");
  const [status, setStatus] = useState(incident.status);

  const report = () => {
    const lines = [
      `INCIDENT REPORT — ${incident.title}`,
      `Severity: ${incident.severity}`,
      `Status: ${INCIDENT_STATUS_LABELS[incident.status]}`,
      `Owner: ${incident.owner || "—"}`,
      `Detected: ${incident.detectedAt}`,
      `Systems affected: ${incident.systemsAffected.join(", ") || "—"}`,
      "",
      "Description:",
      incident.description || "—",
      "",
      "Timeline:",
      ...incident.timeline.map(
        (t) => `- [${t.at}] ${INCIDENT_TIMELINE_LABELS[t.kind]} (${t.actor}): ${t.text}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${incident.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/12 bg-base-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${riskPill(incident.severity)}`}>
                {incident.severity}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[0.6rem] text-white/60">
                {INCIDENT_STATUS_LABELS[incident.status]}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-medium text-white">{incident.title}</h3>
          </div>
          <button onClick={report} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/30">
            <Download size={12} /> Export report
          </button>
        </div>

        {incident.description && <p className="mt-3 text-sm text-white/65">{incident.description}</p>}
        <p className="mt-2 text-xs text-white/40">
          Owner: {incident.owner || "—"} · Detected {formatDate(incident.detectedAt)}
          {incident.systemsAffected.length > 0 && <> · Systems: {incident.systemsAffected.join(", ")}</>}
        </p>

        {/* Timeline */}
        <div className="mt-5">
          <p className={labelClass}>Timeline</p>
          <ol className="mt-3 space-y-3 border-l border-white/10 pl-4">
            {incident.timeline.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-crimson-light" />
                <p className="text-xs font-medium text-white/80">
                  {INCIDENT_TIMELINE_LABELS[t.kind]}
                  <span className="ml-2 font-normal text-white/35">{formatDate(t.at)} · {t.actor}</span>
                </p>
                <p className="mt-0.5 text-sm text-white/60">{t.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {canManage && (
          <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
            <p className={labelClass}>Record an action</p>
            <div className="flex flex-wrap gap-2">
              <select value={entryKind} onChange={(e) => setEntryKind(e.target.value as IncidentTimelineKind)} className={`${inputClass} max-w-[220px]`}>
                {TIMELINE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INCIDENT_TIMELINE_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                value={entryText}
                onChange={(e) => setEntryText(e.target.value)}
                placeholder="What was done"
                className={`${inputClass} min-w-[200px] flex-1`}
              />
              <button
                onClick={async () => {
                  if (!entryText.trim()) return;
                  const ok = await run({
                    action: "update_incident",
                    id: incident.id,
                    timelineEntry: { kind: entryKind, text: entryText },
                  });
                  if (ok) setEntryText("");
                }}
                disabled={busy || !entryText.trim()}
                className="btn-primary !px-4 !py-2.5 text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/45">Status:</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputClass} max-w-[200px]`}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {INCIDENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => run({ action: "update_incident", id: incident.id, status })}
                disabled={busy || status === incident.status}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"
              >
                Update status
              </button>
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30">
          Close
        </button>
      </div>
    </div>
  );
}
