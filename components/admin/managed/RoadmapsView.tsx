"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type {
  ClientRoadmap,
  RoadmapItemKind,
  RoadmapItemStatus,
  RoadmapStatus,
} from "@/lib/managed-services/types";
import { ROADMAP_ITEM_KINDS } from "@/lib/managed-services/types";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  clientLabel,
  fmtDate,
  fmtDateTime,
  inputClass,
  isoToLocalInput,
  labelClass,
  localInputToIso,
} from "./shared";

const ROADMAP_STATUSES: RoadmapStatus[] = [
  "draft",
  "proposed",
  "approved",
  "in_progress",
  "completed",
];

const ITEM_STATUSES: RoadmapItemStatus[] = [
  "proposed",
  "approved",
  "in_progress",
  "done",
  "deferred",
];

type ItemDraft = {
  id?: string;
  kind: RoadmapItemKind;
  title: string;
  detail: string;
  impact: string;
  timeline: string;
  status: RoadmapItemStatus;
};

type RoadmapDraft = {
  id?: string;
  clientId: string;
  title: string;
  periodLabel: string;
  status: RoadmapStatus;
  summary: string;
  items: ItemDraft[];
  estimatedImpact: string;
  proposedTimeline: string;
  reviewScheduledFor: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

const EMPTY_DRAFT: RoadmapDraft = {
  clientId: "",
  title: "",
  periodLabel: "",
  status: "draft",
  summary: "",
  items: [],
  estimatedImpact: "",
  proposedTimeline: "",
  reviewScheduledFor: "",
  approvedAt: null,
  approvedBy: null,
};

const EMPTY_ITEM: ItemDraft = {
  kind: "planned",
  title: "",
  detail: "",
  impact: "",
  timeline: "",
  status: "proposed",
};

function draftFromRoadmap(r: ClientRoadmap): RoadmapDraft {
  return {
    id: r.id,
    clientId: r.clientId,
    title: r.title,
    periodLabel: r.periodLabel,
    status: r.status,
    summary: r.summary,
    items: r.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      detail: i.detail,
      impact: i.impact,
      timeline: i.timeline,
      status: i.status,
    })),
    estimatedImpact: r.estimatedImpact,
    proposedTimeline: r.proposedTimeline,
    reviewScheduledFor: isoToLocalInput(r.reviewScheduledFor),
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
  };
}

export function RoadmapsView({
  roadmaps,
  clients,
  run,
  busy,
}: {
  roadmaps: ClientRoadmap[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<RoadmapDraft | null>(null);

  const set = <K extends keyof RoadmapDraft>(k: K, v: RoadmapDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)),
          }
        : d
    );

  async function save() {
    if (!draft || !draft.clientId || !draft.title.trim()) return;
    const res = await run("upsert_roadmap", {
      id: draft.id,
      clientId: draft.clientId,
      title: draft.title.trim(),
      periodLabel: draft.periodLabel,
      status: draft.status,
      summary: draft.summary,
      items: draft.items
        .filter((i) => i.title.trim())
        .map((i) => ({
          id: i.id,
          kind: i.kind,
          title: i.title.trim(),
          detail: i.detail,
          impact: i.impact,
          timeline: i.timeline,
          status: i.status,
        })),
      estimatedImpact: draft.estimatedImpact,
      proposedTimeline: draft.proposedTimeline,
      reviewScheduledFor: localInputToIso(draft.reviewScheduledFor),
    });
    if (res && !draft.id) {
      const saved = res.roadmap as ClientRoadmap | undefined;
      if (saved?.id) setDraft((d) => (d ? { ...d, id: saved.id } : d));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Technology roadmaps
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus size={13} /> New roadmap
        </button>
      </div>

      {roadmaps.length ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-normal">Client</th>
                <th className="px-4 py-3 font-normal">Title</th>
                <th className="px-4 py-3 font-normal">Period</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Items</th>
                <th className="px-4 py-3 font-normal">Approved</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {roadmaps.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-white/5 last:border-0 ${
                    draft?.id === r.id ? "bg-crimson/[0.06]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-white/80">
                    {clientLabel(clients, r.clientId)}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-white/85">
                    {r.title}
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.periodLabel || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.items.length}</td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {r.approvedAt ? `${fmtDate(r.approvedAt)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-crimson-light hover:underline"
                      onClick={() => setDraft(draftFromRoadmap(r))}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No roadmaps yet."
          hint="Draft a quarterly roadmap and propose it for client approval."
        />
      )}

      {draft ? (
        <div className="space-y-6 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
              {draft.id ? "Edit roadmap" : "New roadmap"}
            </p>
            <button
              type="button"
              className="text-xs text-white/45 hover:text-white"
              onClick={() => setDraft(null)}
            >
              Close editor
            </button>
          </div>

          {draft.approvedAt ? (
            <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-2 text-xs text-emerald-200">
              Approved {fmtDateTime(draft.approvedAt)}
              {draft.approvedBy ? ` by ${draft.approvedBy}` : ""}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Client *">
              <select
                className={inputClass}
                value={draft.clientId}
                onChange={(e) => set("clientId", e.target.value)}
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
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Q3 2026 technology roadmap"
              />
            </Field>
            <Field label="Period label">
              <input
                className={inputClass}
                value={draft.periodLabel}
                onChange={(e) => set("periodLabel", e.target.value)}
                placeholder="Q3 2026"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as RoadmapStatus)}
              >
                {ROADMAP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Summary">
            <textarea
              rows={3}
              className={inputClass}
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Estimated impact">
              <input
                className={inputClass}
                value={draft.estimatedImpact}
                onChange={(e) => set("estimatedImpact", e.target.value)}
              />
            </Field>
            <Field label="Proposed timeline">
              <input
                className={inputClass}
                value={draft.proposedTimeline}
                onChange={(e) => set("proposedTimeline", e.target.value)}
              />
            </Field>
            <Field label="Review scheduled for">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.reviewScheduledFor}
                onChange={(e) => set("reviewScheduledFor", e.target.value)}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className={labelClass}>Roadmap items</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-crimson-light hover:underline"
                onClick={() => set("items", [...draft.items, { ...EMPTY_ITEM }])}
              >
                <Plus size={12} /> Add item
              </button>
            </div>
            {draft.items.length ? (
              <div className="mt-2 space-y-3">
                {draft.items.map((item, i) => (
                  <div
                    key={item.id ?? `new-${i}`}
                    className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3.5"
                  >
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr_150px_auto]">
                      <Field label="Kind">
                        <select
                          className={inputClass}
                          value={item.kind}
                          onChange={(e) =>
                            setItem(i, { kind: e.target.value as RoadmapItemKind })
                          }
                        >
                          {ROADMAP_ITEM_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {k.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Title *">
                        <input
                          className={inputClass}
                          value={item.title}
                          onChange={(e) => setItem(i, { title: e.target.value })}
                        />
                      </Field>
                      <Field label="Status">
                        <select
                          className={inputClass}
                          value={item.status}
                          onChange={(e) =>
                            setItem(i, {
                              status: e.target.value as RoadmapItemStatus,
                            })
                          }
                        >
                          {ITEM_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        type="button"
                        aria-label="Remove item"
                        className="self-end pb-2.5 text-white/40 hover:text-red-300"
                        onClick={() =>
                          set(
                            "items",
                            draft.items.filter((_, j) => j !== i)
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Detail">
                        <input
                          className={inputClass}
                          value={item.detail}
                          onChange={(e) => setItem(i, { detail: e.target.value })}
                        />
                      </Field>
                      <Field label="Impact">
                        <input
                          className={inputClass}
                          value={item.impact}
                          onChange={(e) => setItem(i, { impact: e.target.value })}
                        />
                      </Field>
                      <Field label="Timeline">
                        <input
                          className={inputClass}
                          value={item.timeline}
                          onChange={(e) => setItem(i, { timeline: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/35">
                No items yet — add current systems, problems, and planned work.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy || !draft.clientId || !draft.title.trim()}
            className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save roadmap
          </button>
        </div>
      ) : null}
    </div>
  );
}
