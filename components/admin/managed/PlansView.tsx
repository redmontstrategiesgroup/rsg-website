"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import { STANDARD_PLAN_KEYS } from "@/lib/managed-services/types";
import {
  COMPARISON_CATEGORIES,
  formatMonthlyPrice,
} from "@/lib/managed-services/content";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  arrayToLines,
  centsToDollarInput,
  clientLabel,
  dollarInputToCents,
  inputClass,
  labelClass,
  linesToArray,
  numOrNullFromInput,
  slugifyKey,
} from "./shared";

type AddonDraft = {
  key: string;
  name: string;
  description: string;
  monthlyPrice: string;
};

type ComparisonDraft = Record<string, { included: boolean; text: string }>;

type PlanDraft = {
  id: string;
  key: string;
  name: string;
  tagline: string;
  bestFit: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  annualDiscountPct: string;
  setupFee: string;
  customPricing: boolean;
  includedHours: string;
  additionalHourlyRate: string;
  supportLevel: string;
  responseTime: string;
  minimumCommitmentMonths: string;
  cancellationTerms: string;
  featuresText: string;
  scopeText: string;
  addons: AddonDraft[];
  comparison: ComparisonDraft;
  recommended: boolean;
  businessCritical: boolean;
  active: boolean;
  tierRank: string;
  sortOrder: string;
};

function draftFromPlan(plan: ManagedServicePlan): PlanDraft {
  const comparison: ComparisonDraft = {};
  for (const cat of COMPARISON_CATEGORIES) {
    const v = plan.comparison[cat.key];
    comparison[cat.key] =
      typeof v === "string"
        ? { included: true, text: v }
        : { included: v === true, text: "" };
  }
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    tagline: plan.tagline,
    bestFit: plan.bestFit,
    description: plan.description,
    monthlyPrice: centsToDollarInput(plan.monthlyPriceCents),
    annualPrice: centsToDollarInput(plan.annualPriceCents),
    annualDiscountPct: String(plan.annualDiscountPct ?? 0),
    setupFee: centsToDollarInput(plan.setupFeeCents),
    customPricing: plan.customPricing,
    includedHours: plan.includedHours == null ? "" : String(plan.includedHours),
    additionalHourlyRate: centsToDollarInput(plan.additionalHourlyRateCents),
    supportLevel: plan.supportLevel,
    responseTime: plan.responseTime,
    minimumCommitmentMonths: String(plan.minimumCommitmentMonths ?? 0),
    cancellationTerms: plan.cancellationTerms,
    featuresText: arrayToLines(plan.features),
    scopeText: arrayToLines(plan.detailedScope),
    addons: plan.addons.map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      monthlyPrice: centsToDollarInput(a.monthlyPriceCents),
    })),
    comparison,
    recommended: plan.recommended,
    businessCritical: plan.businessCritical,
    active: plan.active,
    tierRank: String(plan.tierRank ?? 0),
    sortOrder: String(plan.sortOrder ?? 0),
  };
}

export function PlansView({
  plans,
  clients,
  run,
  busy,
}: {
  plans: ManagedServicePlan[];
  clients: MinimalClient[];
  run: RunFn;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [custom, setCustom] = useState({
    basePlanKey: STANDARD_PLAN_KEYS[0] as string,
    clientId: "",
    name: "",
    monthlyPrice: "",
    includedHours: "",
  });

  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function savePlan() {
    if (!draft || !draft.name.trim()) return;
    const comparison: Record<string, string | boolean> = {};
    for (const cat of COMPARISON_CATEGORIES) {
      const cell = draft.comparison[cat.key];
      comparison[cat.key] = cell?.text.trim()
        ? cell.text.trim().slice(0, 120)
        : Boolean(cell?.included);
    }
    await run("upsert_plan", {
      plan: {
        id: draft.id,
        name: draft.name.trim(),
        tagline: draft.tagline,
        bestFit: draft.bestFit,
        description: draft.description,
        monthlyPriceCents: dollarInputToCents(draft.monthlyPrice),
        annualPriceCents: dollarInputToCents(draft.annualPrice),
        annualDiscountPct: Number(draft.annualDiscountPct) || 0,
        setupFeeCents: dollarInputToCents(draft.setupFee) ?? 0,
        customPricing: draft.customPricing,
        includedHours: numOrNullFromInput(draft.includedHours),
        additionalHourlyRateCents: dollarInputToCents(draft.additionalHourlyRate),
        supportLevel: draft.supportLevel,
        responseTime: draft.responseTime,
        minimumCommitmentMonths: Number(draft.minimumCommitmentMonths) || 0,
        cancellationTerms: draft.cancellationTerms,
        features: linesToArray(draft.featuresText),
        detailedScope: linesToArray(draft.scopeText),
        addons: draft.addons
          .filter((a) => a.name.trim())
          .map((a) => ({
            key: a.key || slugifyKey(a.name),
            name: a.name.trim(),
            description: a.description,
            monthlyPriceCents: dollarInputToCents(a.monthlyPrice),
          })),
        comparison,
        recommended: draft.recommended,
        businessCritical: draft.businessCritical,
        active: draft.active,
        tierRank: Number(draft.tierRank) || 0,
        sortOrder: Number(draft.sortOrder) || 0,
      },
    });
  }

  async function createCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!custom.clientId || !custom.name.trim()) return;
    const res = await run("create_custom_plan", {
      basePlanKey: custom.basePlanKey,
      clientId: custom.clientId,
      name: custom.name.trim(),
      monthlyPriceCents: dollarInputToCents(custom.monthlyPrice),
      includedHours: numOrNullFromInput(custom.includedHours),
    });
    if (res) {
      setCustom({
        basePlanKey: STANDARD_PLAN_KEYS[0] as string,
        clientId: "",
        name: "",
        monthlyPrice: "",
        includedHours: "",
      });
    }
  }

  return (
    <div className="space-y-8">
      {/* Plans table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-normal">Plan</th>
              <th className="px-4 py-3 font-normal">Monthly</th>
              <th className="px-4 py-3 font-normal">Type</th>
              <th className="px-4 py-3 font-normal">Tier</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-white/5 last:border-0 ${
                  draft?.id === p.id ? "bg-crimson/[0.06]" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span className="text-white/90">{p.name}</span>
                  <span className="ml-2 font-mono text-[0.58rem] text-white/35">
                    {p.key}
                  </span>
                  {p.recommended ? (
                    <span className="ml-2 rounded-full border border-crimson/40 bg-crimson/10 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-crimson-light">
                      Recommended
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-white/70">
                  {formatMonthlyPrice(p)}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {p.basePlanKey ? (
                    <>
                      Custom · base {p.basePlanKey}
                      <span className="block text-xs text-white/40">
                        {clientLabel(clients, p.clientId)}
                      </span>
                    </>
                  ) : (
                    "Standard"
                  )}
                </td>
                <td className="px-4 py-3 text-white/60">{p.tierRank}</td>
                <td className="px-4 py-3">
                  <StatusPill value={p.active ? "active" : "inactive"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs text-crimson-light hover:underline"
                    onClick={() => setDraft(draftFromPlan(p))}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!plans.length && (
          <div className="p-6">
            <EmptyState title="No plans found." hint="Standard plans seed automatically once the store is reachable." />
          </div>
        )}
      </div>

      {/* New custom variation */}
      <form
        onSubmit={createCustom}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
      >
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          New custom variation
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Base plan">
            <select
              className={inputClass}
              value={custom.basePlanKey}
              onChange={(e) =>
                setCustom((c) => ({ ...c, basePlanKey: e.target.value }))
              }
            >
              {STANDARD_PLAN_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Client *">
            <select
              className={inputClass}
              value={custom.clientId}
              onChange={(e) =>
                setCustom((c) => ({ ...c, clientId: e.target.value }))
              }
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name *">
            <input
              className={inputClass}
              value={custom.name}
              onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
              placeholder="Optimize — Acme custom"
            />
          </Field>
          <Field label="Monthly price ($, blank = custom)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={custom.monthlyPrice}
              onChange={(e) =>
                setCustom((c) => ({ ...c, monthlyPrice: e.target.value }))
              }
            />
          </Field>
          <Field label="Included hours (blank = base)">
            <input
              type="number"
              min={0}
              step="0.5"
              className={inputClass}
              value={custom.includedHours}
              onChange={(e) =>
                setCustom((c) => ({ ...c, includedHours: e.target.value }))
              }
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={busy || !custom.clientId || !custom.name.trim()}
          className="btn-primary mt-4 gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create custom variation
        </button>
      </form>

      {/* Plan editor */}
      {draft ? (
        <div className="space-y-6 rounded-xl border border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
              Editing plan · <span className="text-crimson-light">{draft.key}</span>
            </p>
            <button
              type="button"
              className="text-xs text-white/45 hover:text-white"
              onClick={() => setDraft(null)}
            >
              Close editor
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name *">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Tagline" className="lg:col-span-2">
              <input
                className={inputClass}
                value={draft.tagline}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </Field>
            <Field label="Best fit" className="lg:col-span-3">
              <input
                className={inputClass}
                value={draft.bestFit}
                onChange={(e) => set("bestFit", e.target.value)}
              />
            </Field>
            <Field label="Description" className="lg:col-span-3">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className={labelClass}>Pricing</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Monthly price ($, blank = none)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={draft.monthlyPrice}
                  onChange={(e) => set("monthlyPrice", e.target.value)}
                />
              </Field>
              <Field label="Annual discount %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={draft.annualDiscountPct}
                  onChange={(e) => set("annualDiscountPct", e.target.value)}
                />
              </Field>
              <Field label="Explicit annual price ($, optional)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={draft.annualPrice}
                  onChange={(e) => set("annualPrice", e.target.value)}
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
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={draft.customPricing}
                  onChange={(e) => set("customPricing", e.target.checked)}
                />
                Custom pricing (quote)
              </label>
              <Field label="Included hours / mo (blank = custom)">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className={inputClass}
                  value={draft.includedHours}
                  onChange={(e) => set("includedHours", e.target.value)}
                />
              </Field>
              <Field label="Additional hourly rate ($)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={draft.additionalHourlyRate}
                  onChange={(e) => set("additionalHourlyRate", e.target.value)}
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support level">
              <input
                className={inputClass}
                value={draft.supportLevel}
                onChange={(e) => set("supportLevel", e.target.value)}
              />
            </Field>
            <Field label="Response time">
              <input
                className={inputClass}
                value={draft.responseTime}
                onChange={(e) => set("responseTime", e.target.value)}
              />
            </Field>
            <Field label="Cancellation terms" className="sm:col-span-2">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.cancellationTerms}
                onChange={(e) => set("cancellationTerms", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Features (one per line)">
              <textarea
                rows={8}
                className={`${inputClass} font-mono text-xs`}
                value={draft.featuresText}
                onChange={(e) => set("featuresText", e.target.value)}
              />
            </Field>
            <Field label="Detailed scope (one per line)">
              <textarea
                rows={8}
                className={`${inputClass} font-mono text-xs`}
                value={draft.scopeText}
                onChange={(e) => set("scopeText", e.target.value)}
              />
            </Field>
          </div>

          {/* Add-ons */}
          <div>
            <div className="flex items-center justify-between">
              <p className={labelClass}>Add-ons</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-crimson-light hover:underline"
                onClick={() =>
                  set("addons", [
                    ...draft.addons,
                    { key: "", name: "", description: "", monthlyPrice: "" },
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
                              j === i ? { ...x, description: e.target.value } : x
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
                              j === i ? { ...x, monthlyPrice: e.target.value } : x
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
              <p className="mt-2 text-xs text-white/35">No add-ons on this plan.</p>
            )}
          </div>

          {/* Comparison */}
          <div>
            <p className={labelClass}>
              Comparison table (check = included, or enter a text value)
            </p>
            <div className="mt-2 space-y-1.5">
              {COMPARISON_CATEGORIES.map((cat) => {
                const cell = draft.comparison[cat.key] ?? {
                  included: false,
                  text: "",
                };
                return (
                  <div
                    key={cat.key}
                    className="grid items-center gap-3 rounded-lg border border-white/5 px-3 py-2 sm:grid-cols-[220px_60px_1fr]"
                  >
                    <span className="text-sm text-white/70">{cat.label}</span>
                    <label className="flex items-center gap-1.5 text-xs text-white/45">
                      <input
                        type="checkbox"
                        checked={cell.included}
                        onChange={(e) =>
                          set("comparison", {
                            ...draft.comparison,
                            [cat.key]: { ...cell, included: e.target.checked },
                          })
                        }
                      />
                      Incl.
                    </label>
                    <input
                      className={inputClass}
                      placeholder="Free-text value (overrides checkbox)"
                      value={cell.text}
                      onChange={(e) =>
                        set("comparison", {
                          ...draft.comparison,
                          [cat.key]: { ...cell, text: e.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flags & ordering */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={draft.recommended}
                onChange={(e) => set("recommended", e.target.checked)}
              />
              Recommended
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={draft.businessCritical}
                onChange={(e) => set("businessCritical", e.target.checked)}
              />
              Business-critical
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              Active
            </label>
            <Field label="Tier rank">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.tierRank}
                onChange={(e) => set("tierRank", e.target.value)}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                className={inputClass}
                value={draft.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={savePlan}
            disabled={busy || !draft.name.trim()}
            className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save plan
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/40">
          Select a plan above to edit its pricing and configuration.
        </p>
      )}
    </div>
  );
}
