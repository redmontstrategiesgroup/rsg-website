"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type {
  MaintenanceCategory,
  MaintenanceLog,
} from "@/lib/managed-services/types";
import { MAINTENANCE_CATEGORIES } from "@/lib/managed-services/types";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  clientLabel,
  fmtDateTime,
  inputClass,
  localInputToIso,
} from "./shared";

const EMPTY_FORM = {
  clientId: "",
  title: "",
  category: "maintenance" as MaintenanceCategory,
  description: "",
  hoursSpent: "",
  performedBy: "",
  performedAt: "",
  visibleToClient: true,
};

export function MaintenanceView({
  logs,
  clients,
  run,
  busy,
}: {
  logs: MaintenanceLog[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.title.trim()) return;
    const payload: Record<string, unknown> = {
      clientId: form.clientId,
      title: form.title.trim(),
      category: form.category,
      description: form.description,
      hoursSpent: Number(form.hoursSpent) || 0,
      visibleToClient: form.visibleToClient,
    };
    if (form.performedBy.trim()) payload.performedBy = form.performedBy.trim();
    const performedAt = localInputToIso(form.performedAt);
    if (performedAt) payload.performedAt = performedAt;
    const res = await run("log_maintenance", payload);
    if (res) setForm({ ...EMPTY_FORM });
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={submit}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
      >
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Log maintenance work
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client *">
            <select
              className={inputClass}
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title *">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Dependency updates applied"
            />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as MaintenanceCategory,
                }))
              }
            >
              {MAINTENANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hours spent">
            <input
              type="number"
              min={0}
              max={500}
              step="0.25"
              className={inputClass}
              value={form.hoursSpent}
              onChange={(e) => setForm((f) => ({ ...f, hoursSpent: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label="Performed by (defaults to you)">
            <input
              className={inputClass}
              value={form.performedBy}
              onChange={(e) =>
                setForm((f) => ({ ...f, performedBy: e.target.value }))
              }
            />
          </Field>
          <Field label="Performed at (defaults to now)">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.performedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, performedAt: e.target.value }))
              }
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              rows={2}
              className={inputClass}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form.visibleToClient}
              onChange={(e) =>
                setForm((f) => ({ ...f, visibleToClient: e.target.checked }))
              }
            />
            Visible to client
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !form.clientId || !form.title.trim()}
          className="btn-primary mt-4 gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Log entry
        </button>
      </form>

      <div>
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Recent logs
        </p>
        {logs.length ? (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Client</th>
                  <th className="px-4 py-3 font-normal">Title</th>
                  <th className="px-4 py-3 font-normal">Category</th>
                  <th className="px-4 py-3 font-normal">Hours</th>
                  <th className="px-4 py-3 font-normal">By</th>
                  <th className="px-4 py-3 font-normal">Client-visible</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-xs text-white/50">
                      {fmtDateTime(l.performedAt)}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {clientLabel(clients, l.clientId)}
                    </td>
                    <td className="px-4 py-3 text-white/85">
                      {l.title}
                      {l.description ? (
                        <span className="block max-w-[320px] truncate text-xs text-white/40">
                          {l.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-white/60">{l.category}</td>
                    <td className="px-4 py-3 text-white/60">{l.hoursSpent}</td>
                    <td className="px-4 py-3 text-white/60">{l.performedBy || "—"}</td>
                    <td className="px-4 py-3 text-white/60">
                      {l.visibleToClient ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="No maintenance logged yet."
              hint="Entries here feed client portals and hours tracking."
            />
          </div>
        )}
      </div>
    </div>
  );
}
