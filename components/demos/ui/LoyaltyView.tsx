"use client";

import { useState } from "react";
import { ArrowRight, Award, BellRing, Gift, Plus, Star } from "lucide-react";
import { renderTemplate, uid } from "../engine";
import type { LoyaltyMember, LoyaltyReward } from "../types";
import { EmptyState, PanelHeading, SampleDataTag } from "./primitives";
import { Modal } from "./Modal";
import { SelectInput, SmallButton, TextInput } from "./fields";
import { applyNow, type ViewProps } from "./shared";

/**
 * Loyalty & referral module. Rendered only for industries whose config
 * provides `loyalty` (e.g. retail). All actions mutate isolated demo state.
 */
export function LoyaltyView(props: ViewProps) {
  const { state, config, dispatch, track, openRequest } = props;
  const loyalty = config.loyalty;
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCost, setNewCost] = useState("500");
  const [preview, setPreview] = useState<LoyaltyReward | null>(null);
  const [redeeming, setRedeeming] = useState<LoyaltyMember | null>(null);
  const [redeemReward, setRedeemReward] = useState("");

  if (!loyalty) return <EmptyState text="This demo doesn't include a loyalty program." />;

  const tierLabel = (id: string) => loyalty.tiers.find((t) => t.id === id)?.label ?? id;
  const topTier = loyalty.tiers[loyalty.tiers.length - 1];
  const sessionRedeemed = state.loyaltyRewards.reduce((s, r) => s + r.redeemedThisMonth, 0);

  const addPoints = (m: LoyaltyMember) => {
    applyNow(dispatch, [
      { kind: "loyaltyPoints", memberId: m.id, delta: 100, reason: "Staff adjustment" },
      {
        kind: "loyaltyActivity",
        item: { id: uid("la"), member: m.name, action: "Earned 100 bonus points — staff adjustment", time: "Just now" },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: `100 points added: ${m.name}`, body: "Simulated — the member would be notified by text or email.", tone: "success" },
      },
    ]);
    track("added loyalty points");
  };

  const moveTier = (m: LoyaltyMember, tierId: string) => {
    if (tierId === m.tierId) return;
    applyNow(dispatch, [
      { kind: "loyaltyTier", memberId: m.id, tierId },
      {
        kind: "loyaltyActivity",
        item: { id: uid("la"), member: m.name, action: `Moved to ${tierLabel(tierId)} tier`, time: "Just now" },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: `${m.name} → ${tierLabel(tierId)}`, body: "Tier perks apply immediately. Simulated notification queued.", tone: "success" },
      },
    ]);
    track("moved a customer into a VIP tier");
  };

  const redeem = () => {
    if (!redeeming) return;
    const reward = state.loyaltyRewards.find((r) => r.id === redeemReward);
    if (!reward) return;
    if (redeeming.points < reward.cost) return;
    applyNow(dispatch, [
      { kind: "loyaltyRedeem", memberId: redeeming.id, rewardId: reward.id },
      {
        kind: "loyaltyActivity",
        item: { id: uid("la"), member: redeeming.name, action: `Redeemed "${reward.label}" (−${reward.cost} pts)`, time: "Just now" },
      },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "campaign", text: `${redeeming.name} redeemed a loyalty reward: ${reward.label}.`, time: "Just now" },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: `Reward redeemed: ${redeeming.name}`, body: `${reward.label} — confirmation sent. Simulated.`, tone: "success" },
      },
    ]);
    track("redeemed a loyalty reward");
    setRedeeming(null);
  };

  const createReward = () => {
    const cost = Number(newCost.replace(/\D/g, "")) || 0;
    if (!newLabel.trim() || cost <= 0) return;
    applyNow(dispatch, [
      {
        kind: "loyaltyReward",
        reward: { id: uid("rw"), label: newLabel.trim(), cost, redeemedThisMonth: 0 },
      },
      {
        kind: "notify",
        notification: { id: uid("n"), title: "Reward created", body: `"${newLabel.trim()}" is live for ${state.loyaltyMembers.length} members. Simulated.`, tone: "success" },
      },
    ]);
    track("created a loyalty reward");
    setNewLabel("");
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      {/* Program stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Active members", loyalty.baseline.members + " enrolled"],
            ["Points issued (90 days)", loyalty.baseline.issued.toLocaleString()],
            ["Points redeemed", `${loyalty.baseline.redeemed.toLocaleString()} + ${sessionRedeemed} this session`],
            ["Referrals this quarter", String(loyalty.baseline.referrals)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/40">{label}</p>
            <p className="mt-2 text-lg font-medium tabular-nums text-white sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Members */}
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-3">
          <PanelHeading
            title={`${loyalty.programName} · members`}
            right={<SampleDataTag className="hidden lg:inline-flex" />}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {["Member", "Tier", "Points", "Visits", "Actions"].map((h, i, arr) => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/35">
                      {i === arr.length - 1 ? <span className="sr-only">{h}</span> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {state.loyaltyMembers.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white/85">{m.name}</p>
                      <p className="mt-0.5 text-[0.62rem] text-white/35">
                        Joined {m.joined} · {m.lastActivity}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`tier-${m.id}`}>Change {m.name}&apos;s tier</label>
                      <select
                        id={`tier-${m.id}`}
                        value={m.tierId}
                        onChange={(e) => moveTier(m, e.target.value)}
                        className="rounded border border-white/10 bg-base-900 px-1.5 py-1 text-[0.66rem] text-white/70 focus:border-crimson/60 focus:outline-none focus:ring-1 focus:ring-crimson/40"
                      >
                        {loyalty.tiers.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-white/70">{m.points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-white/45">{m.visits}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <SmallButton onClick={() => addPoints(m)} ariaLabel={`Add 100 points to ${m.name}`}>
                          <Plus size={10} aria-hidden /> 100 pts
                        </SmallButton>
                        <SmallButton
                          onClick={() => {
                            setRedeeming(m);
                            setRedeemReward(state.loyaltyRewards[0]?.id ?? "");
                          }}
                          ariaLabel={`Redeem a reward for ${m.name}`}
                        >
                          <Gift size={10} aria-hidden /> Redeem
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tiers + rewards */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
            <PanelHeading title="Tiers" />
            <ul className="divide-y divide-white/[0.05]">
              {loyalty.tiers.map((t) => {
                const count = state.loyaltyMembers.filter((m) => m.tierId === t.id).length;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <Award size={14} className={t.id === topTier?.id ? "mt-0.5 text-crimson-light" : "mt-0.5 text-white/30"} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/85">
                        {t.label}
                        <span className="ml-2 text-[0.62rem] font-normal text-white/35">{t.threshold.toLocaleString()}+ pts</span>
                      </p>
                      <p className="mt-0.5 text-[0.64rem] leading-snug text-white/45">{t.perks}</p>
                    </div>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] tabular-nums text-white/50">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
            <PanelHeading
              title="Rewards"
              right={
                <SmallButton tone="primary" onClick={() => setCreating(true)}>
                  <Plus size={11} aria-hidden /> New reward
                </SmallButton>
              }
            />
            <ul className="divide-y divide-white/[0.05]">
              {state.loyaltyRewards.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Star size={12} className="shrink-0 text-white/30" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80">{r.label}</p>
                    <p className="text-[0.62rem] text-white/35">
                      {r.cost.toLocaleString()} pts · {r.redeemedThisMonth} redeemed this month
                    </p>
                  </div>
                  <SmallButton onClick={() => { setPreview(r); track("previewed a loyalty notification"); }} ariaLabel={`Preview notification for ${r.label}`}>
                    <BellRing size={10} aria-hidden /> Preview
                  </SmallButton>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Recent activity + CTA */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-3">
          <PanelHeading title="Recent loyalty activity" />
          {state.loyaltyActivity.length === 0 ? (
            <EmptyState text="No activity yet — add points or redeem a reward above." />
          ) : (
            <ul className="max-h-56 divide-y divide-white/[0.05] overflow-y-auto no-scrollbar">
              {state.loyaltyActivity.map((a) => (
                <li key={a.id} className="px-4 py-2.5">
                  <p className="text-xs text-white/70">
                    <span className="font-medium text-white/85">{a.member}</span> — {a.action}
                  </p>
                  <p className="mt-0.5 text-[0.62rem] text-white/30">{a.time}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-crimson/20 bg-crimson/[0.05] p-4 lg:col-span-2">
          <div>
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-crimson-light/90">Why it matters</p>
            <p className="mt-2 text-xs leading-relaxed text-white/65">{loyalty.description}</p>
          </div>
          <button
            type="button"
            onClick={() => openRequest({ feature: "Loyalty & referral program", source: "loyalty_view" })}
            className="mt-4 inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
          >
            Add a loyalty program to my business
            <ArrowRight size={11} aria-hidden />
          </button>
        </div>
      </div>

      {/* Create reward */}
      {creating && (
        <Modal title="Create a reward" subtitle="Demo only — becomes available to all members instantly." onClose={() => setCreating(false)}>
          <div className="space-y-3">
            <TextInput label="Reward" value={newLabel} onChange={setNewLabel} required placeholder="Free gift wrap on any order" />
            <TextInput label="Point cost" value={newCost} onChange={setNewCost} required helper="Points a member spends to redeem." />
            <div className="flex justify-end gap-2 pt-1">
              <SmallButton onClick={() => setCreating(false)}>Cancel</SmallButton>
              <SmallButton tone="primary" onClick={createReward} disabled={!newLabel.trim() || !(Number(newCost.replace(/\D/g, "")) > 0)}>
                <Plus size={11} aria-hidden /> Create reward
              </SmallButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Redeem */}
      {redeeming && (
        <Modal
          title={`Redeem a reward — ${redeeming.name}`}
          subtitle={`${redeeming.points.toLocaleString()} points available. Demo only — nothing is really issued.`}
          onClose={() => setRedeeming(null)}
        >
          <div className="space-y-3">
            <SelectInput
              label="Reward"
              value={redeemReward}
              onChange={setRedeemReward}
              options={state.loyaltyRewards.map((r) => ({
                value: r.id,
                label: `${r.label} · ${r.cost.toLocaleString()} pts${redeeming.points < r.cost ? " (not enough points)" : ""}`,
              }))}
            />
            <div className="flex justify-end gap-2 pt-1">
              <SmallButton onClick={() => setRedeeming(null)}>Cancel</SmallButton>
              <SmallButton
                tone="primary"
                onClick={redeem}
                disabled={(state.loyaltyRewards.find((r) => r.id === redeemReward)?.cost ?? Infinity) > redeeming.points}
              >
                <Gift size={11} aria-hidden /> Redeem (simulated)
              </SmallButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Notification preview */}
      {preview && (
        <Modal title="Reward notification preview" subtitle="What the member receives — simulated, never sent from the demo." onClose={() => setPreview(null)}>
          <div className="rounded-lg border border-white/[0.08] bg-base-900/60 p-3.5">
            <p className="text-[0.6rem] uppercase tracking-wider text-white/35">SMS preview</p>
            <p className="mt-2 text-xs leading-relaxed text-white/80">
              {renderTemplate(loyalty.notificationPreview, {
                first_name: state.loyaltyMembers[0]?.name.split(" ")[0] ?? "Alex",
                business_name: state.settings.businessName,
                reward: preview.label,
                points: String(preview.cost),
              })}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <SmallButton tone="primary" onClick={() => setPreview(null)}>Done</SmallButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
