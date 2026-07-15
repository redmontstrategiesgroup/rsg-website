"use client";

import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Archive,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { intakeEffects, uid } from "../engine";
import type { Lead } from "../types";
import { EmptyState, PanelHeading, SampleDataTag, StatusPill, TempBadge } from "./primitives";
import { Modal } from "./Modal";
import { CheckboxInput, SelectInput, SmallButton, TextArea, TextInput } from "./fields";
import { applyNow, type ViewProps } from "./shared";

/* ------------------------------------------------------------------ */
/* Intake form (creates real demo records + triggers the workflow)     */
/* ------------------------------------------------------------------ */

export function IntakeFormModal({
  state,
  config,
  dispatch,
  track,
  onClose,
  title,
}: ViewProps & { onClose: () => void; title?: string }) {
  const fields = state.settings.intakeFields;
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.id] ?? "").trim();
      if (f.required && !v) errs[f.id] = "Required";
      if (f.type === "email" && v && !/^\S+@\S+\.\S+$/.test(v)) errs[f.id] = "Enter a valid email";
      if (f.type === "phone" && v && v.replace(/\D/g, "").length < 7) errs[f.id] = "Enter a valid phone number";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const name = values["name"]?.trim() || "New inquiry";
    const service =
      values["service"]?.trim() ||
      fields.find((f) => f.id !== "name" && f.type === "select" && values[f.id])
        ?.options?.find((o) => o === values[fields.find((x) => x.type === "select")?.id ?? ""]) ||
      config.terminology.record;
    const lead: Lead = {
      id: uid("lead"),
      name,
      service: values["service"]?.trim() || service,
      source: "Intake form (demo)",
      stageId: state.stages[0]?.id ?? "inquiry",
      lastActivity: "Just now",
      temp: "warm",
      phone: values["phone"],
      email: values["email"],
      assignee: state.settings.staff[0]?.name,
      note: values["notes"] || values["details"] || undefined,
      fields: Object.fromEntries(
        fields
          .filter((f) => !["name", "phone", "email", "service", "notes", "details"].includes(f.id) && values[f.id])
          .map((f) => [f.label, values[f.id]]),
      ),
      createdAt: "Just now",
    };
    // Small delay for a believable submit, then apply real state changes.
    setTimeout(() => {
      applyNow(dispatch, intakeEffects(lead, state, config));
      track("submitted the intake form");
      setSubmitting(false);
      onClose();
    }, 500);
  };

  return (
    <Modal
      title={title ?? `New ${config.terminology.record}`}
      subtitle="This is your live intake form — submitting creates a demo record and triggers the intake workflow."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        {fields.map((f) => {
          const v = values[f.id] ?? "";
          switch (f.type) {
            case "textarea":
              return (
                <TextArea key={f.id} label={f.label} value={v} onChange={(x) => set(f.id, x)} required={f.required} helper={f.helper} error={errors[f.id] || undefined} />
              );
            case "select":
              return (
                <SelectInput key={f.id} label={f.label} value={v} onChange={(x) => set(f.id, x)} required={f.required} helper={errors[f.id] || f.helper} placeholder="Select…" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
              );
            case "checkbox":
              return (
                <CheckboxInput key={f.id} label={f.label} checked={v === "yes"} onChange={(x) => set(f.id, x ? "yes" : "")} helper={f.helper} />
              );
            default:
              return (
                <TextInput key={f.id} label={f.label} value={v} onChange={(x) => set(f.id, x)} required={f.required} helper={f.helper} error={errors[f.id] || undefined} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} />
              );
          }
        })}
        <div className="flex justify-end gap-2 pt-1">
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-xs disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit (simulated)"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Record drawer (view + edit)                                         */
/* ------------------------------------------------------------------ */

function LeadDrawer({
  lead,
  state,
  config,
  dispatch,
  track,
  onClose,
}: ViewProps & { lead: Lead; onClose: () => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Lead>({ ...lead });
  const convo = state.conversations.find(
    (c) => c.contact.toLowerCase() === lead.name.toLowerCase(),
  );
  const tasks = state.tasks.filter((t) =>
    t.title.toLowerCase().includes(lead.name.split(" ")[0].toLowerCase()),
  );
  const appts = state.calendar.filter((e) =>
    e.title.toLowerCase().includes(lead.name.split(" ")[0].toLowerCase()),
  );

  const save = () => {
    applyNow(dispatch, [
      { kind: "updateLead", leadId: lead.id, patch: draft },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "pipeline", text: `${draft.name}'s record was updated by staff.`, time: "Just now" },
      },
    ]);
    track("edited records");
    setEdit(false);
    onClose();
  };

  return (
    <Modal title={lead.name} subtitle={`${lead.service} · ${lead.source}`} onClose={onClose} wide>
      {!edit ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {(
              [
                ["Stage", state.stages.find((s) => s.id === lead.stageId)?.label ?? "—"],
                ["Value", lead.value ? `$${lead.value.toLocaleString()}` : "—"],
                ["Priority", lead.temp ?? "—"],
                ["Assigned to", lead.assignee ?? "Unassigned"],
                ["Phone", lead.phone ?? "—"],
                ["Email", lead.email ?? "—"],
                ["Last activity", lead.lastActivity],
                ["Created", lead.createdAt ?? "Earlier"],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <p className="text-[0.6rem] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 text-xs text-white/80">{v}</p>
              </div>
            ))}
            {Object.entries(lead.fields ?? {}).map(([k, v]) => (
              <div key={k}>
                <p className="text-[0.6rem] uppercase tracking-wider text-white/35">{k}</p>
                <p className="mt-0.5 text-xs text-white/80">{v}</p>
              </div>
            ))}
          </div>
          {lead.note && (
            <div className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <p className="text-[0.6rem] uppercase tracking-wider text-white/35">Staff note</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">{lead.note}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-white/[0.08]">
              <p className="border-b border-white/[0.08] px-3 py-2 text-[0.6rem] uppercase tracking-wider text-white/40">
                Conversation
              </p>
              <div className="max-h-32 overflow-y-auto p-3 no-scrollbar">
                {convo ? (
                  convo.messages.slice(-3).map((m) => (
                    <p key={m.id} className="mb-1.5 text-[0.66rem] leading-snug text-white/60">
                      <span className="text-white/35">{m.from === "contact" ? lead.name.split(" ")[0] : m.from === "system" ? "Auto" : "Staff"}:</span>{" "}
                      {m.text.slice(0, 90)}
                      {m.text.length > 90 ? "…" : ""}
                    </p>
                  ))
                ) : (
                  <p className="text-[0.66rem] text-white/30">No messages yet.</p>
                )}
              </div>
            </div>
            <div className="rounded border border-white/[0.08]">
              <p className="border-b border-white/[0.08] px-3 py-2 text-[0.6rem] uppercase tracking-wider text-white/40">
                {config.terminology.appointments}
              </p>
              <div className="max-h-32 overflow-y-auto p-3 no-scrollbar">
                {appts.length ? (
                  appts.map((e) => (
                    <p key={e.id} className="mb-1.5 text-[0.66rem] text-white/60">
                      {e.day} {e.time} — {e.status ?? "scheduled"}
                    </p>
                  ))
                ) : (
                  <p className="text-[0.66rem] text-white/30">None scheduled.</p>
                )}
              </div>
            </div>
            <div className="rounded border border-white/[0.08]">
              <p className="border-b border-white/[0.08] px-3 py-2 text-[0.6rem] uppercase tracking-wider text-white/40">
                Tasks
              </p>
              <div className="max-h-32 overflow-y-auto p-3 no-scrollbar">
                {tasks.length ? (
                  tasks.map((t) => (
                    <p key={t.id} className={`mb-1.5 text-[0.66rem] ${t.done ? "text-white/30 line-through" : "text-white/60"}`}>
                      {t.title.slice(0, 70)}
                    </p>
                  ))
                ) : (
                  <p className="text-[0.66rem] text-white/30">No related tasks.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
            <SmallButton onClick={() => setEdit(true)}>
              <Pencil size={11} aria-hidden /> Edit record
            </SmallButton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required />
            <TextInput label="Interest / service" value={draft.service} onChange={(v) => setDraft({ ...draft, service: v })} />
            <SelectInput
              label="Stage"
              value={draft.stageId}
              onChange={(v) => setDraft({ ...draft, stageId: v })}
              options={state.stages.map((s) => ({ value: s.id, label: s.label }))}
            />
            <SelectInput
              label="Assigned to"
              value={draft.assignee ?? ""}
              onChange={(v) => setDraft({ ...draft, assignee: v || undefined })}
              options={state.settings.staff.map((s) => ({ value: s.name, label: s.name }))}
              placeholder="Unassigned"
            />
            <TextInput
              label="Estimated value ($)"
              value={draft.value !== undefined ? String(draft.value) : ""}
              onChange={(v) => setDraft({ ...draft, value: v ? Number(v.replace(/\D/g, "")) || 0 : undefined })}
            />
            <SelectInput
              label="Priority"
              value={draft.temp ?? ""}
              onChange={(v) => setDraft({ ...draft, temp: (v || undefined) as Lead["temp"] })}
              options={[
                { value: "hot", label: "Hot" },
                { value: "warm", label: "Warm" },
                { value: "cold", label: "Cold" },
              ]}
              placeholder="None"
            />
            <TextInput label="Phone" value={draft.phone ?? ""} onChange={(v) => setDraft({ ...draft, phone: v })} type="tel" />
            <TextInput label="Email" value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v })} type="email" />
          </div>
          <TextArea label="Staff note" value={draft.note ?? ""} onChange={(v) => setDraft({ ...draft, note: v })} />
          <div className="flex justify-end gap-2 pt-1">
            <SmallButton onClick={() => setEdit(false)}>Cancel</SmallButton>
            <SmallButton tone="primary" onClick={save} disabled={!draft.name.trim()}>
              Save changes
            </SmallButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Records table (search + filters + add + drawer)                     */
/* ------------------------------------------------------------------ */

export function LeadsView(props: ViewProps) {
  const { state, config, track } = props;
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const sources = [...new Set(state.leads.map((l) => l.source))];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.leads.filter(
      (l) =>
        (!q || l.name.toLowerCase().includes(q) || l.service.toLowerCase().includes(q) || (l.note ?? "").toLowerCase().includes(q)) &&
        (!stageFilter || l.stageId === stageFilter) &&
        (!sourceFilter || l.source === sourceFilter),
    );
  }, [state.leads, query, stageFilter, sourceFilter]);

  const stageLabel = (id: string) => state.stages.find((s) => s.id === id)?.label ?? id;
  const selectedLead = state.leads.find((l) => l.id === selected);

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
      <PanelHeading
        title={`${config.leadsLabel} · ${filtered.length} of ${state.leads.length}`}
        right={
          <div className="flex items-center gap-3">
            <SampleDataTag className="hidden lg:inline-flex" />
            <SmallButton tone="primary" onClick={() => setAdding(true)}>
              <Plus size={11} aria-hidden /> New {config.terminology.record}
            </SmallButton>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              track("searched records");
            }}
            placeholder={`Search ${config.terminology.records.toLowerCase()}…`}
            aria-label={`Search ${config.terminology.records}`}
            className="w-full rounded border border-white/10 bg-base-900 py-1.5 pl-8 pr-3 text-xs text-white/80 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
          className="rounded border border-white/10 bg-base-900 px-2 py-1.5 text-[0.68rem] text-white/70 focus:border-crimson/60 focus:outline-none"
        >
          <option value="">All stages</option>
          {state.stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter by source"
          className="rounded border border-white/10 bg-base-900 px-2 py-1.5 text-[0.68rem] text-white/70 focus:border-crimson/60 focus:outline-none"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={`No ${config.terminology.records.toLowerCase()} match — adjust the search or filters.`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Name", "Interest", "Source", "Stage", "Value", "Assigned", ""].map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-2.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/35">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/85">{lead.name}</span>
                      {lead.temp && <TempBadge temp={lead.temp} />}
                    </div>
                    {lead.note && <p className="mt-0.5 max-w-[16rem] truncate text-[0.62rem] text-white/35">{lead.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">{lead.service}</td>
                  <td className="px-4 py-3 text-xs text-white/45">{lead.source}</td>
                  <td className="px-4 py-3"><StatusPill tone="gray">{stageLabel(lead.stageId)}</StatusPill></td>
                  <td className="px-4 py-3 text-xs tabular-nums text-white/60">
                    {lead.value ? `$${lead.value.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/45">{lead.assignee ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <SmallButton onClick={() => setSelected(lead.id)} ariaLabel={`Open ${lead.name}'s record`}>
                      Open
                    </SmallButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <IntakeFormModal {...props} onClose={() => setAdding(false)} />}
      {selectedLead && (
        <LeadDrawer {...props} lead={selectedLead} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage editor                                                        */
/* ------------------------------------------------------------------ */

function StageEditor({ state, config, dispatch, track, onClose }: ViewProps & { onClose: () => void }) {
  const [newLabel, setNewLabel] = useState("");
  return (
    <Modal
      title="Customize pipeline stages"
      subtitle="Rename, reorder, add, or archive stages — records in archived stages move to the first stage."
      onClose={onClose}
    >
      <ul className="space-y-2">
        {state.stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded border border-white/[0.08] px-2.5 py-2">
            <input
              value={s.label}
              onChange={(e) => {
                dispatch({ type: "stage-rename", stageId: s.id, label: e.target.value });
                track("customized pipeline stages");
              }}
              aria-label={`Rename stage ${s.label}`}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-white/80 focus:border-crimson/50 focus:bg-base-900 focus:outline-none"
            />
            <span className="text-[0.6rem] tabular-nums text-white/30">
              {state.leads.filter((l) => l.stageId === s.id).length}
            </span>
            <SmallButton onClick={() => dispatch({ type: "stage-move", stageId: s.id, dir: -1 })} disabled={i === 0} ariaLabel={`Move ${s.label} earlier`}>
              <ArrowUp size={11} aria-hidden />
            </SmallButton>
            <SmallButton onClick={() => dispatch({ type: "stage-move", stageId: s.id, dir: 1 })} disabled={i === state.stages.length - 1} ariaLabel={`Move ${s.label} later`}>
              <ArrowDown size={11} aria-hidden />
            </SmallButton>
            <SmallButton
              tone="danger"
              onClick={() => {
                dispatch({ type: "stage-archive", stageId: s.id });
                track("customized pipeline stages");
              }}
              disabled={state.stages.length <= 2}
              ariaLabel={`Archive stage ${s.label}`}
            >
              <Archive size={11} aria-hidden />
            </SmallButton>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New stage name…"
          aria-label="New stage name"
          className="min-w-0 flex-1 rounded border border-white/12 bg-base-900 px-3 py-2 text-xs text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none"
        />
        <SmallButton
          tone="primary"
          onClick={() => {
            if (!newLabel.trim()) return;
            dispatch({ type: "stage-add", label: newLabel });
            track("customized pipeline stages");
            setNewLabel("");
          }}
          disabled={!newLabel.trim()}
        >
          <Plus size={11} aria-hidden /> Add stage
        </SmallButton>
      </div>
      <div className="mt-4 flex justify-between border-t border-white/[0.06] pt-3">
        <SmallButton
          onClick={() => {
            dispatch({ type: "stages-restore", stages: config.stages });
            track("customized pipeline stages");
          }}
        >
          <RotateCcw size={11} aria-hidden /> Restore defaults
        </SmallButton>
        <SmallButton tone="primary" onClick={onClose}>Done</SmallButton>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline board (drag-and-drop + accessible move menu)               */
/* ------------------------------------------------------------------ */

export function PipelineView(props: ViewProps) {
  const { state, config: _config, dispatch, track } = props;
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);

  const move = (lead: Lead, stageId: string) => {
    if (lead.stageId === stageId) return;
    const label = state.stages.find((s) => s.id === stageId)?.label ?? stageId;
    applyNow(dispatch, [
      { kind: "stage", leadId: lead.id, stageId },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "pipeline", text: `${lead.name} moved to ${label}.`, time: "Just now" },
      },
    ]);
    track("moved pipeline records");
  };

  const onDrop = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    const lead = state.leads.find((l) => l.id === id);
    if (lead) move(lead, stageId);
    setDragId(null);
    setDropStage(null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Drag cards between stages, or use each card&apos;s menu — every move updates the live analytics.
        </p>
        <div className="flex items-center gap-3">
          <SampleDataTag className="hidden lg:inline-flex" />
          <SmallButton onClick={() => setEditing(true)}>
            <Pencil size={11} aria-hidden /> Edit stages
          </SmallButton>
        </div>
      </div>
      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="flex gap-3" style={{ minWidth: `${state.stages.length * 15}rem` }}>
          {state.stages.map((stage, si) => {
            const leads = state.leads.filter((l) => l.stageId === stage.id);
            const total = leads.reduce((sum, l) => sum + (l.value ?? 0), 0);
            const isLast = si === state.stages.length - 1;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropStage(stage.id);
                }}
                onDragLeave={() => setDropStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => onDrop(e, stage.id)}
                className={`flex w-60 shrink-0 flex-col rounded-lg border bg-white/[0.015] transition-colors ${
                  dropStage === stage.id && dragId ? "border-crimson/60 bg-crimson/[0.04]" : "border-white/[0.07]"
                }`}
              >
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.64rem] font-medium uppercase tracking-[0.14em] text-white/55">
                      {stage.label}
                    </span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] tabular-nums text-white/50">
                      {leads.length}
                    </span>
                  </div>
                  {total > 0 && (
                    <p className="mt-0.5 text-[0.62rem] tabular-nums text-white/35">${total.toLocaleString()}</p>
                  )}
                </div>
                <div className="flex min-h-[7rem] flex-col gap-2 p-2">
                  {leads.length === 0 ? (
                    <p className="px-2 py-4 text-center text-[0.62rem] text-white/20">
                      {dragId ? "Drop here" : "Empty"}
                    </p>
                  ) : (
                    leads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(lead.id);
                          e.dataTransfer.setData("text/plain", lead.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropStage(null);
                        }}
                        className={`group cursor-grab rounded-md border bg-base-800 p-3 transition-colors active:cursor-grabbing ${
                          dragId === lead.id ? "border-crimson/60 opacity-60" : "border-white/[0.08] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <GripVertical size={11} className="shrink-0 text-white/20" aria-hidden />
                            <p className="text-xs font-medium text-white/85">{lead.name}</p>
                          </div>
                          {lead.temp && <TempBadge temp={lead.temp} />}
                        </div>
                        <p className="mt-1 text-[0.66rem] text-white/50">{lead.service}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-[0.62rem] tabular-nums text-white/40">
                            {lead.value ? `$${lead.value.toLocaleString()}` : lead.source}
                          </span>
                          <div className="flex items-center gap-1">
                            <label className="sr-only" htmlFor={`move-${lead.id}`}>
                              Move {lead.name} to stage
                            </label>
                            <select
                              id={`move-${lead.id}`}
                              value={lead.stageId}
                              onChange={(e) => move(lead, e.target.value)}
                              className="max-w-[6.5rem] rounded border border-white/10 bg-base-900 px-1 py-0.5 text-[0.6rem] text-white/55 focus:border-crimson/60 focus:outline-none"
                            >
                              {state.stages.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                            {!isLast && (
                              <button
                                type="button"
                                onClick={() => move(lead, state.stages[si + 1].id)}
                                className="inline-flex items-center rounded border border-white/10 px-1.5 py-0.5 text-[0.6rem] text-white/50 transition-colors hover:border-crimson/50 hover:text-crimson-light focus:outline-none focus-visible:ring-1 focus-visible:ring-crimson"
                                aria-label={`Advance ${lead.name} to ${state.stages[si + 1].label}`}
                              >
                                <ArrowRight size={10} aria-hidden />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && <StageEditor {...props} onClose={() => setEditing(false)} />}
    </div>
  );
}
