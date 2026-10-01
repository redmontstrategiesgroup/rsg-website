"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { postJson } from "@/lib/api";
import { Banner, Button, Modal } from "@/components/portal/ui";
import { inputClass } from "@/components/booking/ui";
import { formatCents, type Proposal, type ProposalSection } from "@/lib/lifecycle/types";
import { sectionsWithCurrency } from "@/lib/call-proposal/sections";
import type { CallBriefRecord } from "@/lib/call-proposal/types";
import { BriefFacts } from "@/components/admin/CallProposalPanel";

const EDITABLE = ["draft", "sent", "viewed", "revision_requested"];
const PRICE_KEYS = new Set(["investment", "payment_schedule"]);
type Item = NonNullable<ProposalSection["items"]>[number];

function dollarsToCents(v: string): number | null {
  if (!v.trim()) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function ProposalEditor({
  id,
  onClose,
  onSaved,
}: {
  id: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [brief, setBrief] = useState<CallBriefRecord | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setProposal(null);
      setError(null);
      try {
        const res = await fetch(`/api/admin/lifecycle?section=proposal_detail&id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load.");
        if (cancelled) return;
        const p = json.proposal as Proposal;
        setProposal(p);
        setBrief((json.callBrief as CallBriefRecord | null) ?? null);
        setTitle(p.title);
        setSections(p.sections);
        setTotal(p.total_cents ? String(p.total_cents / 100) : "");
        setDeposit(p.deposit_cents ? String(p.deposit_cents / 100) : "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const editable = proposal ? EDITABLE.includes(proposal.status) : false;
  const totalCents = dollarsToCents(total);
  const depositCents = dollarsToCents(deposit);
  const priceChanged =
    proposal != null &&
    totalCents != null &&
    depositCents != null &&
    (totalCents !== proposal.total_cents || depositCents !== proposal.deposit_cents);
  const currency = sectionsWithCurrency(sections);

  const patch = (i: number, next: Partial<ProposalSection>) =>
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...next } : s)));
  const setItems = (i: number, items: Item[]) => patch(i, { items });
  const items = (i: number) => sections[i].items ?? [];

  async function save() {
    if (!id) return;
    if (totalCents == null || depositCents == null) {
      setError("Enter the total and deposit as dollar amounts.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await postJson("/api/admin/lifecycle", {
        action: "update_proposal",
        id,
        title,
        sections,
        ...(priceChanged ? { totalCents, depositCents } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setProposal(json.proposal);
      setSections(json.proposal.sections);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      title="Edit proposal"
      wide
      footer={
        editable ? (
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : undefined
      }
    >
      {!proposal && !error && <p className="py-6 text-center text-sm text-white/60">Loading…</p>}
      {error && (
        <Banner tone="danger" title="Couldn't save">
          {error}
        </Banner>
      )}
      {proposal && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            {!editable && (
              <Banner tone="info" title={`This proposal is ${proposal.status}`}>
                It can no longer be edited.
              </Banner>
            )}
            {proposal.total_cents === 0 && editable && (
              <Banner tone="warning" title="No price yet">
                Set the total and deposit before sending.
              </Banner>
            )}
            {currency.length > 0 && (
              <Banner tone="warning" title="Amounts in the text">
                Check for prices written into: {currency.join(", ")}.
              </Banner>
            )}

            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-white/60">Title</span>
              <input className={inputClass(false)} value={title} disabled={!editable}
                onChange={(e) => setTitle(e.target.value)} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-white/60">Total ($)</span>
                <input className={inputClass(totalCents == null)} inputMode="decimal" value={total}
                  disabled={!editable} onChange={(e) => setTotal(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-white/60">Deposit ($)</span>
                <input className={inputClass(depositCents == null)} inputMode="decimal" value={deposit}
                  disabled={!editable} onChange={(e) => setDeposit(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-white/55">
              Currently {formatCents(proposal.total_cents)} with a {formatCents(proposal.deposit_cents)} deposit.
              Changing the price rebuilds the payment schedule and rewrites the Investment and Payment
              Schedule text.
            </p>

            {sections.map((s, i) => (
              <fieldset key={`${s.key}-${i}`} className="space-y-2 rounded-lg border border-white/10 p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <input className={`${inputClass(false)} flex-1`} value={s.title} disabled={!editable}
                    aria-label={`Section ${i + 1} title`}
                    onChange={(e) => patch(i, { title: e.target.value })} />
                  <label className="inline-flex items-center gap-1.5 text-xs text-white/65">
                    <input type="checkbox" checked={Boolean(s.hidden)} disabled={!editable}
                      onChange={(e) => patch(i, { hidden: e.target.checked })} />
                    Hidden
                  </label>
                </div>
                {PRICE_KEYS.has(s.key) && (
                  <p className="text-xs text-white/50">Regenerated from the price when it changes.</p>
                )}
                <textarea className={inputClass(false)} rows={Math.min(12, Math.max(3, s.body.split("\n").length + 1))}
                  value={s.body} disabled={!editable} aria-label={`${s.title} text`}
                  onChange={(e) => patch(i, { body: e.target.value })} />
                {items(i).map((it, k) => (
                  <div key={k} className="grid gap-2 rounded border border-white/10 p-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                    <input className={inputClass(false)} placeholder="Title" value={it.title} disabled={!editable}
                      onChange={(e) => setItems(i, items(i).map((x, j) => (j === k ? { ...x, title: e.target.value } : x)))} />
                    <input className={inputClass(false)} placeholder="Detail" value={it.detail ?? ""} disabled={!editable}
                      onChange={(e) => setItems(i, items(i).map((x, j) => (j === k ? { ...x, detail: e.target.value } : x)))} />
                    <input className={inputClass(false)} placeholder="Meta" value={it.meta ?? ""} disabled={!editable}
                      onChange={(e) => setItems(i, items(i).map((x, j) => (j === k ? { ...x, meta: e.target.value } : x)))} />
                    {editable && (
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Move up" disabled={k === 0}
                          className="p-1.5 text-white/60 hover:text-white disabled:opacity-30"
                          onClick={() => { const next = [...items(i)]; [next[k - 1], next[k]] = [next[k], next[k - 1]]; setItems(i, next); }}>
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" aria-label="Move down" disabled={k === items(i).length - 1}
                          className="p-1.5 text-white/60 hover:text-white disabled:opacity-30"
                          onClick={() => { const next = [...items(i)]; [next[k + 1], next[k]] = [next[k], next[k + 1]]; setItems(i, next); }}>
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" aria-label="Remove item"
                          className="p-1.5 text-white/60 hover:text-crimson-light"
                          onClick={() => setItems(i, items(i).filter((_, j) => j !== k))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {editable && (
                  <button type="button" className="inline-flex items-center gap-1.5 text-xs text-white/65 hover:text-white"
                    onClick={() => setItems(i, [...items(i), { title: "" }])}>
                    <Plus size={13} /> Add item
                  </button>
                )}
              </fieldset>
            ))}
          </div>

          <aside className="space-y-3">
            <p className="text-xs font-medium text-white/60">From the call brief</p>
            {brief?.extraction ? (
              <BriefFacts brief={brief.extraction} calls={[]} recordingIds={brief.recordingIds} />
            ) : (
              <p className="text-sm text-white/50">This proposal wasn&apos;t drafted from a call.</p>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
