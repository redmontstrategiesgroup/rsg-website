"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import type {
  ManagedServicePlan,
  Proposal,
  ProposalKind,
} from "@/lib/managed-services/types";
import { formatCents, formatMonthlyPrice } from "@/lib/managed-services/content";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  centsToDollarInput,
  clientLabel,
  copyText,
  dollarInputToCents,
  fmtDate,
  inputClass,
  labelClass,
  slugifyKey,
} from "./shared";

const KINDS: { value: ProposalKind; label: string }[] = [
  { value: "implementation", label: "Implementation (one-time)" },
  { value: "monthly_service", label: "Monthly service" },
  { value: "implementation_plus_monthly", label: "Implementation + monthly" },
  { value: "project_completion", label: "Project completion" },
];

type ItemDraft = { title: string; detail: string };
type AddonDraft = { name: string; description: string; monthlyPrice: string };

type ProposalDraft = {
  id?: string;
  kind: ProposalKind;
  clientId: string;
  leadId: string;
  title: string;
  summary: string;
  preparedFor: string;
  implSummary: string;
  implItems: ItemDraft[];
  implCost: string;
  implDeposit: string;
  implTimeline: string;
  delivered: ItemDraft[];
  ownershipNotes: string;
  planId: string;
  alternativePlanIds: string[];
  billingFrequency: "monthly" | "annual";
  monthlyPrice: string;
  setupFee: string;
  includedSupport: string;
  serviceLevel: string;
  minimumCommitmentMonths: string;
  addons: AddonDraft[];
  contractTerms: string;
  validUntil: string;
};

const EMPTY_DRAFT: ProposalDraft = {
  kind: "implementation_plus_monthly",
  clientId: "",
  leadId: "",
  title: "",
  summary: "",
  preparedFor: "",
  implSummary: "",
  implItems: [],
  implCost: "",
  implDeposit: "",
  implTimeline: "",
  delivered: [],
  ownershipNotes: "",
  planId: "",
  alternativePlanIds: [],
  billingFrequency: "monthly",
  monthlyPrice: "",
  setupFee: "",
  includedSupport: "",
  serviceLevel: "",
  minimumCommitmentMonths: "",
  addons: [],
  contractTerms: "",
  validUntil: "",
};

function draftFromProposal(p: Proposal): ProposalDraft {
  return {
    id: p.id,
    kind: p.kind,
    clientId: p.clientId ?? "",
    leadId: p.leadId ?? "",
    title: p.title,
    summary: p.summary,
    preparedFor: p.preparedFor,
    implSummary: p.implementation.summary ?? "",
    implItems: (p.implementation.items ?? []).map((i) => ({ ...i })),
    implCost: centsToDollarInput(p.implementation.costCents ?? null),
    implDeposit: centsToDollarInput(p.implementation.depositCents ?? null),
    implTimeline: p.implementation.timeline ?? "",
    delivered: (p.implementation.delivered ?? []).map((i) => ({ ...i })),
    ownershipNotes: p.implementation.ownershipNotes ?? "",
    planId: p.planId ?? "",
    alternativePlanIds: [...p.alternativePlanIds],
    billingFrequency: p.billingFrequency,
    monthlyPrice: centsToDollarInput(p.monthlyPriceCents),
    setupFee: centsToDollarInput(p.setupFeeCents),
    includedSupport: p.includedSupport,
    serviceLevel: p.serviceLevel,
    minimumCommitmentMonths: String(p.minimumCommitmentMonths ?? 0),
    addons: p.addons.map((a) => ({
      name: a.name,
      description: a.description,
      monthlyPrice: centsToDollarInput(a.monthlyPriceCents),
    })),
    contractTerms: p.contractTerms,
    validUntil: p.validUntil ? p.validUntil.slice(0, 10) : "",
  };
}

function ItemsRepeater({
  label,
  items,
  onChange,
}: {
  label: string;
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={labelClass}>{label}</p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-crimson-light hover:underline"
          onClick={() => onChange([...items, { title: "", detail: "" }])}
        >
          <Plus size={12} /> Add row
        </button>
      </div>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="grid items-end gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1.6fr_auto]"
            >
              <Field label="Title">
                <input
                  className={inputClass}
                  value={item.title}
                  onChange={(e) =>
                    onChange(
                      items.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x
                      )
                    )
                  }
                />
              </Field>
              <Field label="Detail">
                <input
                  className={inputClass}
                  value={item.detail}
                  onChange={(e) =>
                    onChange(
                      items.map((x, j) =>
                        j === i ? { ...x, detail: e.target.value } : x
                      )
                    )
                  }
                />
              </Field>
              <button
                type="button"
                aria-label="Remove row"
                className="mb-2 text-white/40 hover:text-red-300"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/35">No rows yet.</p>
      )}
    </div>
  );
}

export function ProposalsView({
  proposals,
  plans,
  clients,
  run,
  busy,
}: {
  proposals: Proposal[];
  plans: ManagedServicePlan[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof ProposalDraft>(k: K, v: ProposalDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const showImplementation =
    draft?.kind === "implementation" ||
    draft?.kind === "implementation_plus_monthly";
  const showDelivered = draft?.kind === "project_completion";
  const showRecurring =
    draft?.kind === "monthly_service" ||
    draft?.kind === "implementation_plus_monthly" ||
    draft?.kind === "project_completion";

  function buildPayload(status?: "draft" | "sent"): Record<string, unknown> {
    if (!draft) return {};
    const implementation: Record<string, unknown> = {};
    if (showImplementation) {
      if (draft.implSummary) implementation.summary = draft.implSummary;
      implementation.items = draft.implItems
        .filter((i) => i.title.trim())
        .map((i) => ({ title: i.title.trim(), detail: i.detail }));
      const cost = dollarInputToCents(draft.implCost);
      if (cost != null) implementation.costCents = cost;
      const deposit = dollarInputToCents(draft.implDeposit);
      if (deposit != null) implementation.depositCents = deposit;
      if (draft.implTimeline) implementation.timeline = draft.implTimeline;
    }
    if (showDelivered) {
      implementation.delivered = draft.delivered
        .filter((i) => i.title.trim())
        .map((i) => ({ title: i.title.trim(), detail: i.detail }));
      if (draft.ownershipNotes) implementation.ownershipNotes = draft.ownershipNotes;
    }

    const payload: Record<string, unknown> = {
      id: draft.id,
      clientId: draft.clientId || null,
      leadId: draft.leadId.trim() || null,
      title: draft.title.trim(),
      kind: draft.kind,
      summary: draft.summary,
      preparedFor: draft.preparedFor,
      implementation,
      planId: showRecurring && draft.planId ? draft.planId : null,
      alternativePlanIds: showRecurring ? draft.alternativePlanIds : [],
      billingFrequency: draft.billingFrequency,
      monthlyPriceCents: dollarInputToCents(draft.monthlyPrice),
      setupFeeCents: dollarInputToCents(draft.setupFee) ?? 0,
      includedSupport: draft.includedSupport,
      serviceLevel: draft.serviceLevel,
      minimumCommitmentMonths: Number(draft.minimumCommitmentMonths) || 0,
      addons: draft.addons
        .filter((a) => a.name.trim())
        .map((a) => ({
          key: slugifyKey(a.name),
          name: a.name.trim(),
          description: a.description,
          monthlyPriceCents: dollarInputToCents(a.monthlyPrice),
        })),
      contractTerms: draft.contractTerms,
      validUntil: draft.validUntil
        ? new Date(`${draft.validUntil}T23:59:59`).toISOString()
        : null,
    };
    if (status) payload.status = status;
    return payload;
  }

  async function save(status?: "draft" | "sent") {
    if (!draft || !draft.title.trim()) return;
    const res = await run("upsert_proposal", buildPayload(status));
    if (res) {
      const saved = res.proposal as Proposal | undefined;
      if (saved?.id) setDraft((d) => (d ? { ...d, id: saved.id } : d));
      if (typeof res.shareUrl === "string") setShareUrl(res.shareUrl);
      setCopied(false);
    }
  }

  async function sendProposal(p?: Proposal) {
    const id = p?.id ?? draft?.id;
    if (!id) {
      // Unsaved draft — save & send in one call.
      await save("sent");
      return;
    }
    const res = await run("mark_sent", { id });
    if (res && typeof res.shareUrl === "string") {
      setShareUrl(res.shareUrl);
      setCopied(false);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Proposals
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white"
          onClick={() => {
            setDraft({ ...EMPTY_DRAFT });
            setShareUrl("");
          }}
        >
          <Plus size={13} /> New proposal
        </button>
      </div>

      {proposals.length ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-normal">Title</th>
                <th className="px-4 py-3 font-normal">Client / lead</th>
                <th className="px-4 py-3 font-normal">Kind</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Monthly</th>
                <th className="px-4 py-3 font-normal">Sent / viewed / accepted</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-white/5 last:border-0 ${
                    draft?.id === p.id ? "bg-crimson/[0.06]" : ""
                  }`}
                >
                  <td className="max-w-[240px] truncate px-4 py-3 text-white/85">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {p.clientId
                      ? clientLabel(clients, p.clientId)
                      : p.leadId
                        ? `Lead ${p.leadId.slice(0, 8)}…`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/55">
                    {p.kind.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={p.status} />
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {p.monthlyPriceCents != null
                      ? `${formatCents(p.monthlyPriceCents)}/mo`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmtDate(p.sentAt)} · {fmtDate(p.viewedAt)} ·{" "}
                    {fmtDate(p.acceptedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-xs text-crimson-light hover:underline"
                        onClick={() => {
                          setDraft(draftFromProposal(p));
                          setShareUrl("");
                        }}
                      >
                        Edit
                      </button>
                      {p.status === "draft" ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs text-white/60 hover:text-white disabled:opacity-60"
                          onClick={() => sendProposal(p)}
                        >
                          Send
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No proposals yet."
          hint="Build an implementation or managed-service proposal and share the tokenized link."
        />
      )}

      {shareUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm">
          <span className="text-emerald-200">Share link:</span>
          <code className="max-w-full overflow-x-auto text-xs text-white/80">
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={copyShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-6 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
              {draft.id ? "Edit proposal" : "New proposal"}
            </p>
            <button
              type="button"
              className="text-xs text-white/45 hover:text-white"
              onClick={() => setDraft(null)}
            >
              Close builder
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Kind">
              <select
                className={inputClass}
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value as ProposalKind)}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Client (optional)">
              <select
                className={inputClass}
                value={draft.clientId}
                onChange={(e) => set("clientId", e.target.value)}
              >
                <option value="">No client account</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lead id (optional, when no client)">
              <input
                className={inputClass}
                value={draft.leadId}
                onChange={(e) => set("leadId", e.target.value)}
                placeholder="lead uuid"
              />
            </Field>
            <Field label="Prepared for">
              <input
                className={inputClass}
                value={draft.preparedFor}
                onChange={(e) => set("preparedFor", e.target.value)}
                placeholder="Jane Doe, Acme Plumbing"
              />
            </Field>
            <Field label="Title *" className="sm:col-span-2">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label="Valid until">
              <input
                type="date"
                className={inputClass}
                value={draft.validUntil}
                onChange={(e) => set("validUntil", e.target.value)}
              />
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

          {showImplementation ? (
            <div className="space-y-4 rounded-lg border border-white/10 p-4">
              <p className="font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
                Implementation scope
              </p>
              <Field label="Implementation summary">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={draft.implSummary}
                  onChange={(e) => set("implSummary", e.target.value)}
                />
              </Field>
              <ItemsRepeater
                label="Scope items"
                items={draft.implItems}
                onChange={(items) => set("implItems", items)}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="One-time cost ($)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={draft.implCost}
                    onChange={(e) => set("implCost", e.target.value)}
                  />
                </Field>
                <Field label="Deposit ($)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={draft.implDeposit}
                    onChange={(e) => set("implDeposit", e.target.value)}
                  />
                </Field>
                <Field label="Timeline">
                  <input
                    className={inputClass}
                    value={draft.implTimeline}
                    onChange={(e) => set("implTimeline", e.target.value)}
                    placeholder="4–6 weeks"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {showDelivered ? (
            <div className="space-y-4 rounded-lg border border-white/10 p-4">
              <p className="font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
                Delivery summary
              </p>
              <ItemsRepeater
                label="What was delivered"
                items={draft.delivered}
                onChange={(items) => set("delivered", items)}
              />
              <Field label="Ownership & responsibility notes">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={draft.ownershipNotes}
                  onChange={(e) => set("ownershipNotes", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {showRecurring ? (
            <div className="space-y-4 rounded-lg border border-white/10 p-4">
              <p className="font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
                Recurring service
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Plan">
                  <select
                    className={inputClass}
                    value={draft.planId}
                    onChange={(e) => set("planId", e.target.value)}
                  >
                    <option value="">Select plan…</option>
                    {plans
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatMonthlyPrice(p)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Billing frequency">
                  <select
                    className={inputClass}
                    value={draft.billingFrequency}
                    onChange={(e) =>
                      set(
                        "billingFrequency",
                        e.target.value as "monthly" | "annual"
                      )
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </Field>
                <Field label="Monthly price override ($)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={draft.monthlyPrice}
                    onChange={(e) => set("monthlyPrice", e.target.value)}
                  />
                </Field>
                <Field label="Setup fee ($)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={draft.setupFee}
                    onChange={(e) => set("setupFee", e.target.value)}
                  />
                </Field>
                <Field label="Included support">
                  <input
                    className={inputClass}
                    value={draft.includedSupport}
                    onChange={(e) => set("includedSupport", e.target.value)}
                  />
                </Field>
                <Field label="Service level">
                  <input
                    className={inputClass}
                    value={draft.serviceLevel}
                    onChange={(e) => set("serviceLevel", e.target.value)}
                  />
                </Field>
                <Field label="Minimum commitment (months)">
                  <input
                    type="number"
                    min={0}
                    max={36}
                    className={inputClass}
                    value={draft.minimumCommitmentMonths}
                    onChange={(e) => set("minimumCommitmentMonths", e.target.value)}
                  />
                </Field>
              </div>

              <div>
                <p className={labelClass}>Alternative plans (max 3)</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {plans
                    .filter((p) => p.active && p.id !== draft.planId)
                    .map((p) => {
                      const checked = draft.alternativePlanIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              !checked && draft.alternativePlanIds.length >= 3
                            }
                            onChange={(e) =>
                              set(
                                "alternativePlanIds",
                                e.target.checked
                                  ? [...draft.alternativePlanIds, p.id]
                                  : draft.alternativePlanIds.filter(
                                      (id) => id !== p.id
                                    )
                              )
                            }
                          />
                          {p.name}
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Add-ons repeater */}
              <div>
                <div className="flex items-center justify-between">
                  <p className={labelClass}>Add-ons</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-crimson-light hover:underline"
                    onClick={() =>
                      set("addons", [
                        ...draft.addons,
                        { name: "", description: "", monthlyPrice: "" },
                      ])
                    }
                  >
                    <Plus size={12} /> Add add-on
                  </button>
                </div>
                {draft.addons.length ? (
                  <div className="mt-2 space-y-2">
                    {draft.addons.map((a, i) => (
                      <div
                        key={i}
                        className="grid items-end gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1.4fr_140px_auto]"
                      >
                        <Field label="Name">
                          <input
                            className={inputClass}
                            value={a.name}
                            onChange={(e) =>
                              set(
                                "addons",
                                draft.addons.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x
                                )
                              )
                            }
                          />
                        </Field>
                        <Field label="Description">
                          <input
                            className={inputClass}
                            value={a.description}
                            onChange={(e) =>
                              set(
                                "addons",
                                draft.addons.map((x, j) =>
                                  j === i
                                    ? { ...x, description: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </Field>
                        <Field label="Monthly ($)">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={inputClass}
                            value={a.monthlyPrice}
                            onChange={(e) =>
                              set(
                                "addons",
                                draft.addons.map((x, j) =>
                                  j === i
                                    ? { ...x, monthlyPrice: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          aria-label="Remove add-on"
                          className="mb-2 text-white/40 hover:text-red-300"
                          onClick={() =>
                            set(
                              "addons",
                              draft.addons.filter((_, j) => j !== i)
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/35">No add-ons.</p>
                )}
              </div>

              <Field label="Contract terms">
                <textarea
                  rows={4}
                  className={inputClass}
                  value={draft.contractTerms}
                  onChange={(e) => set("contractTerms", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => save()}
              disabled={busy || !draft.title.trim()}
              className="btn-ghost gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save proposal
            </button>
            <button
              type="button"
              onClick={() => sendProposal()}
              disabled={busy || !draft.title.trim()}
              className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {draft.id ? "Mark as sent" : "Save & send"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
