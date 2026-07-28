"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { patchJson } from "@/lib/api";
import type { PrivateAiOpportunity, PrivateAiPipelineStage } from "@/lib/private-ai/types";
import {
  PRIVATE_AI_PIPELINE_STAGES,
  PRIVATE_AI_STAGE_LABELS,
} from "@/lib/private-ai/types";
import { deploymentLabel } from "@/lib/private-ai/architecture";

export function PrivateAiAdminPanel() {
  const [rows, setRows] = useState<PrivateAiOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/privateai");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not load private AI opportunities.");
        return;
      }
      const list = (data.opportunities ?? []) as PrivateAiOpportunity[];
      setRows(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    } catch {
      setError("Network error loading private AI pipeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function savePatch(patch: Partial<PrivateAiOpportunity>) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const res = await patchJson("/api/admin/privateai", {
      id: selected.id,
      status: patch.status,
      owner: patch.owner,
      adminNotes: patch.adminNotes,
      technicalNotes: patch.technicalNotes,
      securityNotes: patch.securityNotes,
      budgetRange: patch.budgetRange,
      timeline: patch.timeline,
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed.");
      return;
    }
    const updated = data.opportunity as PrivateAiOpportunity;
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setMessage("Saved.");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/45">
        <Loader2 className="animate-spin" size={16} /> Loading private AI pipeline…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-xl">Private AI Pipeline</h2>
          <p className="mt-1 text-sm text-white/45">
            Configurations submitted from the Private AI System Designer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-white/50">{message}</p> : null}

      {!rows.length ? (
        <p className="text-sm text-white/40">No private AI inquiries yet.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full p-4 text-left ${
                  selectedId === row.id
                    ? "bg-crimson/[0.08]"
                    : "hover:bg-white/[0.025]"
                }`}
              >
                <p className="text-sm font-medium text-white/85">
                  {row.businessName || row.name}
                </p>
                <p className="mt-1 font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                  {PRIVATE_AI_STAGE_LABELS[row.status] ?? row.status}
                </p>
                <p className="mt-1 truncate text-xs text-white/40">
                  {deploymentLabel(row.deploymentPreference)} · {row.email}
                </p>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="space-y-5 rounded-xl border border-white/10 p-5">
              <div>
                <h3 className="display text-lg">{selected.businessName}</h3>
                <p className="mt-1 text-sm text-white/50">
                  {selected.name} · {selected.email} · {selected.phone}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                    Stage
                  </span>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-base-800 px-3 py-2.5"
                    value={selected.status}
                    onChange={(e) =>
                      void savePatch({
                        status: e.target.value as PrivateAiPipelineStage,
                      })
                    }
                  >
                    {PRIVATE_AI_PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {PRIVATE_AI_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                    Owner
                  </span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    defaultValue={selected.owner}
                    key={`owner-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) => void savePatch({ owner: e.target.value })}
                  />
                </label>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Item label="Industry" value={selected.industry} />
                <Item label="Employees" value={selected.employees} />
                <Item label="Locations" value={selected.locations} />
                <Item label="Timeline" value={selected.timeline} />
                <Item
                  label="Deployment"
                  value={deploymentLabel(selected.deploymentPreference)}
                />
                <Item label="System" value={selected.config.systemType} />
                <Item label="Business type" value={selected.config.businessType} />
                <Item label="Budget range" value={selected.budgetRange} />
                <Item
                  label="Data sources"
                  value={selected.config.dataSources.join(", ")}
                />
                <Item
                  label="Privacy controls"
                  value={selected.config.privacyControls.join(", ")}
                />
                <Item label="Current software" value={selected.currentSoftware} />
                <Item label="Privacy concerns" value={selected.privacyConcerns} />
                <Item
                  label="Compliance notes"
                  value={selected.complianceConsiderations}
                />
              </dl>

              <label className="block text-sm">
                <span className="mb-1.5 block font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                  Admin notes
                </span>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                  defaultValue={selected.adminNotes}
                  key={`notes-${selected.id}-${selected.updatedAt}`}
                  onBlur={(e) => void savePatch({ adminNotes: e.target.value })}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                    Technical notes
                  </span>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    defaultValue={selected.technicalNotes}
                    key={`tech-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) =>
                      void savePatch({ technicalNotes: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                    Security notes
                  </span>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                    defaultValue={selected.securityNotes}
                    key={`sec-${selected.id}-${selected.updatedAt}`}
                    onBlur={(e) =>
                      void savePatch({ securityNotes: e.target.value })
                    }
                  />
                </label>
              </div>

              <div>
                <p className="font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                  Architecture summary
                </p>
                <ul className="mt-2 space-y-1 text-sm text-white/55">
                  {selected.architecture.coreComponents.map((c) => (
                    <li key={c}>— {c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                  Activity
                </p>
                <ul className="mt-2 space-y-2 text-xs text-white/40">
                  {selected.activity.map((a, i) => (
                    <li key={`${a.at}-${i}`}>
                      {new Date(a.at).toLocaleString()} — {a.text}
                      {a.by ? ` (${a.by})` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-white/30">
                {saving ? "Saving…" : `Updated ${new Date(selected.updatedAt).toLocaleString()}`}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.52rem] uppercase tracking-label text-white/35">
        {label}
      </dt>
      <dd className="mt-1 text-white/70">{value || "—"}</dd>
    </div>
  );
}
