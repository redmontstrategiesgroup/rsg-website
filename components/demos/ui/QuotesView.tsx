"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, FileText, Send } from "lucide-react";
import { quoteAcceptedEffects, quoteSentEffects, uid } from "../engine";
import type { QuoteRecord } from "../types";
import { EmptyState, PanelHeading, SampleDataTag, StatusPill } from "./primitives";
import { SelectInput, SmallButton, TextInput } from "./fields";
import { applyNow, type ViewProps } from "./shared";

/**
 * Instant-quote / estimate builder. The left panel is the same calculator a
 * visitor would use on the business's website; generated documents become
 * demo records that can be sent (simulated) and accepted, moving the linked
 * lead through the pipeline.
 */
export function QuotesView(props: ViewProps) {
  const { state, config, dispatch, track, openRequest } = props;
  const q = config.quote;
  const [selections, setSelections] = useState<Record<string, number>>(
    () => Object.fromEntries(q.fields.map((f) => [f.id, 0])),
  );
  const [leadId, setLeadId] = useState("");
  const [contact, setContact] = useState("");
  const [generating, setGenerating] = useState(false);

  const lines = useMemo(() => {
    const items = [{ label: q.base.label, amount: q.base.amount }];
    for (const f of q.fields) {
      const opt = f.options[selections[f.id] ?? 0];
      if (opt && opt.amount !== 0) items.push({ label: `${f.label}: ${opt.label}`, amount: opt.amount });
    }
    return items;
  }, [q, selections]);

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const linkedLead = state.leads.find((l) => l.id === leadId);
  const contactName = linkedLead?.name ?? contact.trim();

  const generate = () => {
    if (!contactName || generating) return;
    setGenerating(true);
    const quote: QuoteRecord = {
      id: uid("q"),
      contact: contactName,
      leadId: linkedLead?.id,
      lines,
      total,
      status: "draft",
      createdAt: "Just now",
    };
    // Brief delay so generation feels like real work, then create the record.
    setTimeout(() => {
      applyNow(dispatch, [
        { kind: "quote", quote },
        {
          kind: "activity",
          item: {
            id: uid("act"),
            icon: "automation",
            text: `${q.documentLabel} drafted for ${contactName} — $${total.toLocaleString()}.`,
            time: "Just now",
          },
        },
      ]);
      track(`built an instant ${q.documentLabel.toLowerCase()}`);
      setGenerating(false);
      setContact("");
    }, 450);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Builder */}
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-3">
          <PanelHeading title={q.title} right={<SampleDataTag className="hidden sm:inline-flex" />} />
          <div className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-white/50">{q.description}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.fields.map((f) => (
                <SelectInput
                  key={f.id}
                  label={f.label}
                  value={String(selections[f.id] ?? 0)}
                  onChange={(v) => {
                    setSelections((prev) => ({ ...prev, [f.id]: Number(v) }));
                    track(`used the instant ${q.documentLabel.toLowerCase()} calculator`);
                  }}
                  helper={f.helper}
                  options={f.options.map((o, i) => ({
                    value: String(i),
                    label: o.amount ? `${o.label} · ${o.amount > 0 ? "+" : "−"}$${Math.abs(o.amount).toLocaleString()}` : o.label,
                  }))}
                />
              ))}
            </div>

            {/* Live line items */}
            <div className="rounded border border-white/[0.08] bg-base-900/50">
              <ul className="divide-y divide-white/[0.05]">
                {lines.map((l) => (
                  <li key={l.label} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-white/60">{l.label}</span>
                    <span className={`tabular-nums ${l.amount < 0 ? "text-emerald-400/80" : "text-white/75"}`}>
                      {l.amount < 0 ? "−" : ""}${Math.abs(l.amount).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-white/[0.1] px-3 py-2.5">
                <span className="text-[0.64rem] font-medium uppercase tracking-[0.14em] text-white/45">
                  Estimated total
                </span>
                <span className="text-base font-medium tabular-nums text-white">
                  ${total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                label={`Attach to ${config.terminology.record}`}
                value={leadId}
                onChange={(v) => {
                  setLeadId(v);
                  if (v) setContact("");
                }}
                options={state.leads.map((l) => ({ value: l.id, label: `${l.name} — ${l.service}` }))}
                placeholder="No — type a name instead"
              />
              {!linkedLead && (
                <TextInput label="Customer name" value={contact} onChange={setContact} placeholder="Jordan Ellis" required />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="max-w-[18rem] text-[0.62rem] leading-relaxed text-white/35">{q.disclaimer}</p>
              <button
                type="button"
                onClick={generate}
                disabled={!contactName || generating}
                className="btn-primary shrink-0 px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText size={12} className="mr-1.5" aria-hidden />
                {generating ? "Generating…" : `Generate ${q.documentLabel.toLowerCase()} (simulated)`}
              </button>
            </div>
          </div>
        </div>

        {/* Records */}
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-2">
          <PanelHeading title={`${q.documentLabel}s · ${state.quotes.length}`} />
          {state.quotes.length === 0 ? (
            <EmptyState text={`No ${q.documentLabel.toLowerCase()}s yet — build one with the calculator.`} />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {state.quotes.map((quote) => (
                <li key={quote.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white/85">{quote.contact}</p>
                      <p className="mt-0.5 text-[0.62rem] tabular-nums text-white/40">
                        ${quote.total.toLocaleString()} · {quote.lines.length} line items · {quote.createdAt}
                      </p>
                    </div>
                    <StatusPill tone={quote.status === "accepted" ? "green" : quote.status === "sent" ? "amber" : "gray"}>
                      {quote.status}
                    </StatusPill>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quote.status === "draft" && (
                      <SmallButton
                        tone="primary"
                        onClick={() => {
                          applyNow(dispatch, quoteSentEffects(quote, state, config));
                          track(`sent a ${q.documentLabel.toLowerCase()} with automated follow-up`);
                        }}
                      >
                        <Send size={10} aria-hidden /> Send (simulated)
                      </SmallButton>
                    )}
                    {quote.status === "sent" && (
                      <SmallButton
                        onClick={() => {
                          applyNow(dispatch, quoteAcceptedEffects(quote, state, config));
                          track(`marked a ${q.documentLabel.toLowerCase()} accepted`);
                        }}
                      >
                        <Check size={10} aria-hidden /> Mark accepted
                      </SmallButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-white/[0.06] px-4 py-3">
            <button
              type="button"
              onClick={() => openRequest({ feature: "Instant quotes & estimate follow-up", source: "quotes_view" })}
              className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            >
              See what this would cost for my business
              <ArrowRight size={11} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
