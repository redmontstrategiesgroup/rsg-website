"use client";

import { useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import type {
  ClientSubscription,
  ManagedServicePlan,
  SubscriptionStatus,
} from "@/lib/managed-services/types";
import { SUBSCRIPTION_STATUSES } from "@/lib/managed-services/types";
import { formatCents, formatMonthlyPrice } from "@/lib/managed-services/content";
import {
  EmptyState,
  Field,
  type MinimalClient,
  type RunFn,
  StatusPill,
  centsToDollarInput,
  clientLabel,
  dollarInputToCents,
  fmtDate,
  inputClass,
  isoToLocalInput,
  localInputToIso,
  numOrNullFromInput,
} from "./shared";

/** Normalized monthly value in cents (annual contracts ÷ 12). */
function normalizedMonthly(sub: ClientSubscription): number {
  if (sub.billingFrequency === "annual" && sub.annualPriceCents != null) {
    return Math.round(sub.annualPriceCents / 12);
  }
  return sub.monthlyPriceCents;
}

type SubDraft = {
  status: SubscriptionStatus;
  billingFrequency: "monthly" | "annual";
  monthlyPrice: string;
  annualPrice: string;
  setupFee: string;
  includedHours: string;
  additionalHourlyRate: string;
  accountManager: string;
  technicalOwner: string;
  slaNotes: string;
  adminNotes: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelReason: string;
};

function draftFromSub(sub: ClientSubscription): SubDraft {
  return {
    status: sub.status,
    billingFrequency: sub.billingFrequency,
    monthlyPrice: centsToDollarInput(sub.monthlyPriceCents),
    annualPrice: centsToDollarInput(sub.annualPriceCents),
    setupFee: centsToDollarInput(sub.setupFeeCents),
    includedHours: sub.includedHours == null ? "" : String(sub.includedHours),
    additionalHourlyRate: centsToDollarInput(sub.additionalHourlyRateCents),
    accountManager: sub.accountManager,
    technicalOwner: sub.technicalOwner,
    slaNotes: sub.slaNotes,
    adminNotes: sub.adminNotes,
    currentPeriodStart: isoToLocalInput(sub.currentPeriodStart),
    currentPeriodEnd: isoToLocalInput(sub.currentPeriodEnd),
    cancelReason: "",
  };
}

const EMPTY_ASSIGN = {
  clientId: "",
  planId: "",
  billingFrequency: "monthly" as "monthly" | "annual",
  monthlyPrice: "",
  includedHours: "",
  accountManager: "",
  technicalOwner: "",
  startNow: true,
};

export function SubscriptionsView({
  subscriptions,
  clients,
  plans,
  run,
  busy,
}: {
  subscriptions: ClientSubscription[];
  clients: MinimalClient[];
  plans: ManagedServicePlan[];
  run: RunFn;
  busy: boolean;
}) {
  const [assign, setAssign] = useState({ ...EMPTY_ASSIGN });
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SubDraft | null>(null);

  const selected = subscriptions.find((s) => s.id === selectedId) ?? null;

  function select(sub: ClientSubscription) {
    setSelectedId(sub.id);
    setDraft(draftFromSub(sub));
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assign.clientId || !assign.planId) return;
    const payload: Record<string, unknown> = {
      clientId: assign.clientId,
      planId: assign.planId,
      billingFrequency: assign.billingFrequency,
      accountManager: assign.accountManager,
      technicalOwner: assign.technicalOwner,
      startNow: assign.startNow,
    };
    const monthly = dollarInputToCents(assign.monthlyPrice);
    if (monthly != null) payload.monthlyPriceCents = monthly;
    if (assign.includedHours.trim()) {
      payload.includedHours = numOrNullFromInput(assign.includedHours);
    }
    const res = await run("assign_subscription", payload);
    if (res) setAssign({ ...EMPTY_ASSIGN });
  }

  async function saveDraft() {
    if (!selected || !draft) return;
    await run("update_subscription", {
      id: selected.id,
      patch: {
        status: draft.status,
        billingFrequency: draft.billingFrequency,
        monthlyPriceCents: dollarInputToCents(draft.monthlyPrice) ?? 0,
        annualPriceCents: dollarInputToCents(draft.annualPrice),
        setupFeeCents: dollarInputToCents(draft.setupFee) ?? 0,
        includedHours: numOrNullFromInput(draft.includedHours),
        additionalHourlyRateCents: dollarInputToCents(draft.additionalHourlyRate),
        accountManager: draft.accountManager,
        technicalOwner: draft.technicalOwner,
        slaNotes: draft.slaNotes,
        adminNotes: draft.adminNotes,
        currentPeriodStart: localInputToIso(draft.currentPeriodStart),
        currentPeriodEnd: localInputToIso(draft.currentPeriodEnd),
      },
    });
  }

  async function cancel(immediate: boolean) {
    if (!selected || !draft) return;
    const label = immediate
      ? "Cancel this subscription immediately? Stripe billing (when linked) is cancelled now."
      : "Schedule cancellation at the end of the current period?";
    if (!window.confirm(label)) return;
    await run("cancel_subscription", {
      id: selected.id,
      immediate,
      reason: draft.cancelReason || undefined,
    });
  }

  return (
    <div className="space-y-8">
      {/* Assign plan */}
      <form
        onSubmit={submitAssign}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
      >
        <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/45">
          Assign plan to client
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client *">
            <select
              className={inputClass}
              value={assign.clientId}
              onChange={(e) =>
                setAssign((a) => ({ ...a, clientId: e.target.value }))
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
          <Field label="Plan *">
            <select
              className={inputClass}
              value={assign.planId}
              onChange={(e) => setAssign((a) => ({ ...a, planId: e.target.value }))}
            >
              <option value="">Select plan…</option>
              {plans
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMonthlyPrice(p)}
                    {p.clientId ? " (custom)" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Billing frequency">
            <select
              className={inputClass}
              value={assign.billingFrequency}
              onChange={(e) =>
                setAssign((a) => ({
                  ...a,
                  billingFrequency: e.target.value as "monthly" | "annual",
                }))
              }
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Monthly price override ($, optional)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={assign.monthlyPrice}
              onChange={(e) =>
                setAssign((a) => ({ ...a, monthlyPrice: e.target.value }))
              }
            />
          </Field>
          <Field label="Included hours override (optional)">
            <input
              type="number"
              min={0}
              step="0.5"
              className={inputClass}
              value={assign.includedHours}
              onChange={(e) =>
                setAssign((a) => ({ ...a, includedHours: e.target.value }))
              }
            />
          </Field>
          <Field label="Account manager">
            <input
              className={inputClass}
              value={assign.accountManager}
              onChange={(e) =>
                setAssign((a) => ({ ...a, accountManager: e.target.value }))
              }
            />
          </Field>
          <Field label="Technical owner">
            <input
              className={inputClass}
              value={assign.technicalOwner}
              onChange={(e) =>
                setAssign((a) => ({ ...a, technicalOwner: e.target.value }))
              }
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={assign.startNow}
              onChange={(e) =>
                setAssign((a) => ({ ...a, startNow: e.target.checked }))
              }
            />
            Start now (activate + open first period)
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !assign.clientId || !assign.planId}
          className="btn-primary mt-4 gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Assign subscription
        </button>
      </form>

      {/* Subscriptions table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-normal">Client</th>
              <th className="px-4 py-3 font-normal">Plan</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Monthly value</th>
              <th className="px-4 py-3 font-normal">Renews</th>
              <th className="px-4 py-3 font-normal">Failed payments</th>
              <th className="px-4 py-3 font-normal">Account manager</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr
                key={s.id}
                onClick={() => select(s)}
                className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.02] ${
                  selectedId === s.id ? "bg-crimson/[0.06]" : ""
                }`}
              >
                <td className="px-4 py-3 text-white/85">
                  {clientLabel(clients, s.clientId)}
                </td>
                <td className="px-4 py-3 text-white/70">
                  {s.planName ?? s.planId.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={s.status} />
                  {s.cancelAtPeriodEnd && s.status !== "cancelled" ? (
                    <span className="ml-2 text-[0.6rem] text-amber-200/80">
                      ends at period end
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-white/70">
                  {formatCents(normalizedMonthly(s))}
                  {s.billingFrequency === "annual" ? (
                    <span className="ml-1 text-xs text-white/35">(annual)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {fmtDate(s.currentPeriodEnd)}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {s.failedPaymentCount > 0 ? (
                    <span className="text-red-300">{s.failedPaymentCount}</span>
                  ) : (
                    0
                  )}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {s.accountManager || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!subscriptions.length && (
          <div className="p-6">
            <EmptyState
              title="No subscriptions yet."
              hint="Assign a plan to a client above to create the first one."
            />
          </div>
        )}
      </div>

      {/* Detail editor */}
      {selected && draft ? (
        <div className="space-y-5 rounded-xl border border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/85">
                {clientLabel(clients, selected.clientId)} —{" "}
                {selected.planName ?? "plan"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Started {fmtDate(selected.startedAt)} · Commitment ends{" "}
                {fmtDate(selected.commitmentEndsAt)} · Payment method{" "}
                {selected.paymentMethodSummary || "—"}
              </p>
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Status">
              <select
                className={inputClass}
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, status: e.target.value as SubscriptionStatus } : d
                  )
                }
              >
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Billing frequency">
              <select
                className={inputClass}
                value={draft.billingFrequency}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          billingFrequency: e.target.value as "monthly" | "annual",
                        }
                      : d
                  )
                }
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </Field>
            <Field label="Monthly price ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.monthlyPrice}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, monthlyPrice: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Annual price ($, blank = derived)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.annualPrice}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, annualPrice: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Setup fee ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.setupFee}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, setupFee: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Included hours (blank = custom)">
              <input
                type="number"
                min={0}
                step="0.5"
                className={inputClass}
                value={draft.includedHours}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, includedHours: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Additional hourly rate ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.additionalHourlyRate}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, additionalHourlyRate: e.target.value } : d
                  )
                }
              />
            </Field>
            <Field label="Account manager">
              <input
                className={inputClass}
                value={draft.accountManager}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, accountManager: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Technical owner">
              <input
                className={inputClass}
                value={draft.technicalOwner}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, technicalOwner: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Period start">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.currentPeriodStart}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, currentPeriodStart: e.target.value } : d
                  )
                }
              />
            </Field>
            <Field label="Period end">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.currentPeriodEnd}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, currentPeriodEnd: e.target.value } : d
                  )
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SLA notes">
              <textarea
                rows={3}
                className={inputClass}
                value={draft.slaNotes}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, slaNotes: e.target.value } : d))
                }
              />
            </Field>
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
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="btn-primary gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save subscription
            </button>

            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-red-400/20 bg-red-400/[0.04] p-3">
              <Field label="Cancellation reason (optional)">
                <input
                  className={`${inputClass} min-w-[240px]`}
                  value={draft.cancelReason}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, cancelReason: e.target.value } : d))
                  }
                />
              </Field>
              <button
                type="button"
                disabled={busy}
                onClick={() => cancel(false)}
                className="rounded-lg border border-amber-400/40 px-3 py-2 text-xs text-amber-200 transition-colors hover:border-amber-400/70 disabled:opacity-60"
              >
                Cancel at period end
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => cancel(true)}
                className="rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300 transition-colors hover:border-red-400/70 disabled:opacity-60"
              >
                Cancel immediately
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
