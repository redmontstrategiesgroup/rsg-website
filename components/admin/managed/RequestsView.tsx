"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type {
  ServiceRequest,
  ServiceRequestInclusion,
  ServiceRequestStatus,
} from "@/lib/managed-services/types";
import {
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPE_LABELS,
} from "@/lib/managed-services/types";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  centsToDollarInput,
  clientLabel,
  dollarInputToCents,
  fmtDateTime,
  inputClass,
  numOrNullFromInput,
} from "./shared";

const INCLUSIONS: ServiceRequestInclusion[] = [
  "included",
  "needs_approval",
  "extra_charge",
  "pending_assessment",
];

type RequestDraft = {
  status: ServiceRequestStatus;
  priority: "standard" | "priority" | "urgent";
  inclusion: ServiceRequestInclusion;
  estimatedHours: string;
  actualHours: string;
  extraCharge: string;
  adminNotes: string;
};

function draftFromRequest(r: ServiceRequest): RequestDraft {
  return {
    status: r.status,
    priority: r.priority,
    inclusion: r.inclusion,
    estimatedHours: r.estimatedHours == null ? "" : String(r.estimatedHours),
    actualHours: r.actualHours == null ? "" : String(r.actualHours),
    extraCharge: centsToDollarInput(r.extraChargeCents),
    adminNotes: r.adminNotes,
  };
}

function isOverdue(r: ServiceRequest): boolean {
  return Boolean(
    r.responseDueAt &&
      new Date(r.responseDueAt).getTime() < Date.now() &&
      r.status !== "completed" &&
      r.status !== "declined"
  );
}

export function RequestsView({
  requests,
  clients,
  run,
  busy,
}: {
  requests: ServiceRequest[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<RequestDraft | null>(null);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  function select(r: ServiceRequest) {
    setSelectedId(r.id);
    setDraft(draftFromRequest(r));
  }

  async function save() {
    if (!selected || !draft) return;
    await run("update_request", {
      id: selected.id,
      patch: {
        status: draft.status,
        priority: draft.priority,
        inclusion: draft.inclusion,
        estimatedHours: numOrNullFromInput(draft.estimatedHours),
        actualHours: numOrNullFromInput(draft.actualHours),
        extraChargeCents: dollarInputToCents(draft.extraCharge),
        adminNotes: draft.adminNotes,
      },
    });
  }

  if (!requests.length) {
    return (
      <EmptyState
        title="No service requests yet."
        hint="Client-portal requests land in this queue with SLA due times."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-normal">Client</th>
              <th className="px-4 py-3 font-normal">Type</th>
              <th className="px-4 py-3 font-normal">Title</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Priority</th>
              <th className="px-4 py-3 font-normal">Inclusion</th>
              <th className="px-4 py-3 font-normal">Response due</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr
                key={r.id}
                onClick={() => select(r)}
                className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.02] ${
                  selectedId === r.id ? "bg-crimson/[0.06]" : ""
                }`}
              >
                <td className="px-4 py-3 text-white/85">
                  {clientLabel(clients, r.clientId)}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {SERVICE_REQUEST_TYPE_LABELS[r.type] ?? r.type}
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-white/80">
                  {r.title}
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={r.status} />
                </td>
                <td className="px-4 py-3 text-white/60">{r.priority}</td>
                <td className="px-4 py-3 text-white/60">
                  {r.inclusion.replaceAll("_", " ")}
                </td>
                <td
                  className={`px-4 py-3 text-xs ${
                    isOverdue(r) ? "text-red-300" : "text-white/50"
                  }`}
                >
                  {fmtDateTime(r.responseDueAt)}
                  {isOverdue(r) ? " · overdue" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && draft ? (
        <div className="space-y-5 rounded-xl border border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/90">{selected.title}</p>
              <p className="mt-1 text-xs text-white/45">
                {clientLabel(clients, selected.clientId)} ·{" "}
                {SERVICE_REQUEST_TYPE_LABELS[selected.type]} · Submitted{" "}
                {fmtDateTime(selected.createdAt)}
              </p>
              {selected.details ? (
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-white/65">
                  {selected.details}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs text-white/45 hover:text-white"
              onClick={() => {
                setSelectedId("");
                setDraft(null);
              }}
            >
              Close
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Status">
              <select
                className={inputClass}
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, status: e.target.value as ServiceRequestStatus } : d
                  )
                }
              >
                {SERVICE_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                value={draft.priority}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          priority: e.target.value as RequestDraft["priority"],
                        }
                      : d
                  )
                }
              >
                <option value="standard">Standard</option>
                <option value="priority">Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Field label="Inclusion">
              <select
                className={inputClass}
                value={draft.inclusion}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          inclusion: e.target.value as ServiceRequestInclusion,
                        }
                      : d
                  )
                }
              >
                {INCLUSIONS.map((i) => (
                  <option key={i} value={i}>
                    {i.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estimated hours">
              <input
                type="number"
                min={0}
                max={500}
                step="0.25"
                className={inputClass}
                value={draft.estimatedHours}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, estimatedHours: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Actual hours">
              <input
                type="number"
                min={0}
                max={500}
                step="0.25"
                className={inputClass}
                value={draft.actualHours}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, actualHours: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Extra charge ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.extraCharge}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, extraCharge: e.target.value } : d))
                }
              />
            </Field>
          </div>

          <Field label="Admin notes">
            <textarea
              rows={3}
              className={inputClass}
              value={draft.adminNotes}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, adminNotes: e.target.value } : d))
              }
            />
          </Field>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save request
          </button>

          {selected.activity.length ? (
            <div>
              <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                Activity
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-white/45">
                {selected.activity.slice(0, 12).map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    {fmtDateTime(a.at)} — {a.text}
                    {a.by ? ` (${a.by})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-white/40">
          Select a request to triage status, scope, hours, and notes.
        </p>
      )}
    </div>
  );
}
