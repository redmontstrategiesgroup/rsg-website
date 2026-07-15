"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, Lock, Send, Sparkles, Zap } from "lucide-react";
import { renderTemplate, templateVars, uid } from "../engine";
import type { Conversation } from "../types";
import { ChannelBadge, EmptyState, PanelHeading, StatusPill } from "./primitives";
import { SmallButton } from "./fields";
import { applyNow, type ViewProps } from "./shared";

/**
 * Deterministic draft helpers — clearly labeled simulations built from the
 * actual thread contents. No live model is called from the demo.
 */
function simulatedSummary(convo: Conversation): string {
  const contactMsgs = convo.messages.filter((m) => m.from === "contact");
  const autoCount = convo.messages.filter((m) => m.from === "system").length;
  const lastContact = contactMsgs[contactMsgs.length - 1];
  return [
    `${convo.contact} reached out via ${convo.channel.toUpperCase()}${convo.topic ? ` about ${convo.topic.toLowerCase()}` : ""}.`,
    contactMsgs.length
      ? `They have sent ${contactMsgs.length} message${contactMsgs.length === 1 ? "" : "s"}; the latest: "${lastContact.text.slice(0, 80)}${lastContact.text.length > 80 ? "…" : ""}"`
      : "They have not replied yet.",
    autoCount ? `${autoCount} automated message${autoCount === 1 ? "" : "s"} have gone out so far.` : "",
    lastContact ? "Suggested urgency: respond today while intent is high." : "Suggested urgency: allow the sequence to continue.",
  ]
    .filter(Boolean)
    .join(" ");
}

function simulatedReply(convo: Conversation, businessName: string): string {
  const first = convo.contact.split(" ")[0];
  const lastContact = [...convo.messages].reverse().find((m) => m.from === "contact");
  if (!lastContact) {
    return `Hi ${first}, just checking in from ${businessName} — happy to answer any questions whenever you're ready.`;
  }
  const t = lastContact.text.toLowerCase();
  if (t.includes("price") || t.includes("cost") || t.includes("how much") || t.includes("$")) {
    return `Great question, ${first} — pricing depends on a couple of details, and we'd rather give you a real number than a range. Want me to grab you a quick call time, or text over the two things we'd need to quote it exactly?`;
  }
  if (t.includes("resched") || t.includes("cancel") || t.includes("move")) {
    return `No problem at all, ${first} — we can move that for you. What days work best this week or next? I'll send a couple of open times.`;
  }
  if (t.includes("book") || t.includes("time") || t.includes("schedule") || t.includes("when")) {
    return `Perfect, ${first}! I have a few openings this week — want me to send the booking link so you can grab whichever works best?`;
  }
  return `Thanks for the note, ${first}! Happy to help with that — want me to send over the details, or would a quick call be easier?`;
}

export function ConversationsView({ state, config, dispatch, track }: ViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [aiOutput, setAiOutput] = useState<{ kind: "summary" | "reply"; text: string } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const selected =
    state.conversations.find((c) => c.id === selectedId) ?? state.conversations[0];
  const showThreadMobile = selectedId !== null;

  const send = () => {
    if (!selected || !reply.trim()) return;
    const staffName =
      state.settings.staff.find((s) => s.name === selected.assignee)?.name ??
      state.settings.staff[0]?.name ??
      "Staff";
    applyNow(dispatch, [
      {
        kind: "message",
        conversationId: selected.id,
        message: {
          id: uid("m"),
          from: "staff",
          internal,
          meta: internal ? `Internal note · ${staffName}` : `${staffName} · simulated send`,
          text: reply.trim(),
          time: "Just now",
        },
      },
      { kind: "conversationMeta", conversationId: selected.id, patch: { unread: false } },
      {
        kind: "activity",
        item: {
          id: uid("act"),
          icon: "message",
          text: internal
            ? `Internal note added to ${selected.contact}'s conversation.`
            : `Simulated ${selected.channel.toUpperCase()} reply sent to ${selected.contact}.`,
          time: "Just now",
        },
      },
    ]);
    track(internal ? "added internal notes" : "sent simulated replies");
    setReply("");
    setAiOutput(null);
  };

  const insertTemplate = (templateId: string) => {
    if (!selected) return;
    const t = state.templates.find((x) => x.id === templateId);
    if (!t) return;
    setReply(
      renderTemplate(
        t.text,
        templateVars(state, config, { first_name: selected.contact.split(" ")[0] }),
      ),
    );
    setTemplateOpen(false);
    track("used message templates");
  };

  return (
    <div className="grid overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02] lg:grid-cols-5">
      {/* Contact list */}
      <div className={`border-white/[0.07] lg:col-span-2 lg:block lg:border-r ${showThreadMobile ? "hidden" : "block"}`}>
        <PanelHeading title={`Unified inbox · ${state.conversations.length}`} />
        <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto no-scrollbar">
          {state.conversations.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const active = selected?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setAiOutput(null);
                  }}
                  className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus-visible:bg-white/[0.05] ${
                    active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                  } ${c.resolved ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-white/85">
                      {c.unread && <span className="h-1.5 w-1.5 rounded-full bg-crimson" aria-label="Unread" />}
                      {c.contact}
                    </span>
                    <ChannelBadge channel={c.channel} />
                  </div>
                  {c.topic && <p className="mt-0.5 text-[0.62rem] text-white/40">{c.topic}</p>}
                  {last && (
                    <p className="mt-1 truncate text-[0.68rem] text-white/45">
                      {last.internal ? "Note: " : last.from === "contact" ? "" : last.from === "system" ? "Auto: " : "Staff: "}
                      {last.text}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Thread */}
      <div className={`flex flex-col lg:col-span-3 ${showThreadMobile ? "flex" : "hidden lg:flex"}`}>
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/10 text-white/50 hover:text-white lg:hidden"
                aria-label="Back to inbox"
              >
                <ChevronLeft size={13} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/85">{selected.contact}</p>
                {selected.topic && <p className="text-[0.62rem] text-white/40">{selected.topic}</p>}
              </div>
              <label className="sr-only" htmlFor="assign-convo">Assign conversation</label>
              <select
                id="assign-convo"
                value={selected.assignee ?? ""}
                onChange={(e) => {
                  applyNow(dispatch, [
                    { kind: "conversationMeta", conversationId: selected.id, patch: { assignee: e.target.value || undefined } },
                  ]);
                  track("assigned conversations");
                }}
                className="rounded border border-white/10 bg-base-900 px-1.5 py-1 text-[0.62rem] text-white/60 focus:border-crimson/60 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {state.settings.staff.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <SmallButton
                onClick={() => {
                  applyNow(dispatch, [
                    { kind: "conversationMeta", conversationId: selected.id, patch: { resolved: !selected.resolved, unread: false } },
                  ]);
                  track("resolved conversations");
                }}
                ariaLabel={selected.resolved ? "Reopen conversation" : "Mark conversation resolved"}
              >
                <CheckCircle2 size={11} aria-hidden />
                {selected.resolved ? "Reopen" : "Resolve"}
              </SmallButton>
              <ChannelBadge channel={selected.channel} />
            </div>

            <div className="flex max-h-[19rem] min-h-[13rem] flex-1 flex-col gap-3 overflow-y-auto p-4 no-scrollbar">
              {selected.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] sm:max-w-[75%] ${m.from === "contact" ? "self-start" : "self-end"}`}>
                  <div
                    className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.internal
                        ? "border border-dashed border-amber-400/40 bg-amber-500/[0.06] text-amber-100/85"
                        : m.from === "contact"
                          ? "border border-white/[0.08] bg-white/[0.05] text-white/80"
                          : m.from === "system"
                            ? "border border-crimson/25 bg-crimson/[0.09] text-white/85"
                            : "border border-white/[0.08] bg-base-700 text-white/85"
                    }`}
                  >
                    {m.text}
                  </div>
                  <p className={`mt-1 text-[0.6rem] text-white/30 ${m.from === "contact" ? "text-left" : "text-right"}`}>
                    {m.internal && (
                      <span className="mr-1 inline-flex items-center gap-1 text-amber-300/70">
                        <Lock size={9} aria-hidden /> {m.meta ?? "Internal note"}
                      </span>
                    )}
                    {!m.internal && m.from === "system" && (
                      <span className="mr-1 inline-flex items-center gap-1 text-crimson-light/80">
                        <Zap size={9} aria-hidden /> {m.meta ?? "Automated"}
                      </span>
                    )}
                    {!m.internal && m.from === "staff" && <span className="mr-1">{m.meta ?? "Staff"}</span>}
                    {m.time}
                  </p>
                </div>
              ))}
            </div>

            {/* Draft assist output */}
            {aiOutput && (
              <div className="mx-4 mb-2 rounded-lg border border-white/12 bg-base-700/70 p-3">
                <p className="flex items-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/45">
                  <Sparkles size={10} className="text-crimson-light" aria-hidden />
                  Suggested draft — review and edit before use
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/75">{aiOutput.text}</p>
                {aiOutput.kind === "reply" && (
                  <div className="mt-2 flex gap-2">
                    <SmallButton
                      tone="primary"
                      onClick={() => {
                        setReply(aiOutput.text);
                        setAiOutput(null);
                      }}
                    >
                      Use as draft
                    </SmallButton>
                    <SmallButton onClick={() => setAiOutput(null)}>Dismiss</SmallButton>
                  </div>
                )}
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-white/[0.07] p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <SmallButton onClick={() => setTemplateOpen((v) => !v)}>Templates</SmallButton>
                  {templateOpen && (
                    <div className="absolute bottom-9 left-0 z-30 w-64 rounded-lg border border-white/10 bg-base-800 shadow-lift">
                      {state.templates.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => insertTemplate(t.id)}
                          className="block w-full border-b border-white/[0.06] px-3 py-2 text-left text-[0.68rem] text-white/70 last:border-0 hover:bg-white/[0.04]"
                        >
                          {t.name}
                          <span className="ml-1.5 text-[0.58rem] uppercase text-white/30">{t.channel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <SmallButton
                  onClick={() => {
                    setAiOutput({ kind: "summary", text: simulatedSummary(selected) });
                    track("used draft assist");
                  }}
                >
                  <Sparkles size={10} aria-hidden /> Summarize
                </SmallButton>
                <SmallButton
                  onClick={() => {
                    setAiOutput({ kind: "reply", text: simulatedReply(selected, state.settings.businessName) });
                    track("used draft assist");
                  }}
                >
                  <Sparkles size={10} aria-hidden /> Suggest reply
                </SmallButton>
                <label className="ml-auto flex items-center gap-1.5 text-[0.64rem] text-white/50">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#b3243a]"
                  />
                  Internal note
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="reply-box">
                  {internal ? "Internal note" : `Reply to ${selected.contact}`}
                </label>
                <textarea
                  id="reply-box"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder={internal ? "Add a note only your team can see…" : `Reply to ${selected.contact.split(" ")[0]}… (simulated — nothing is really sent)`}
                  className="min-h-[2.5rem] flex-1 resize-y rounded border border-white/12 bg-base-900 px-3 py-2 text-xs text-white/85 placeholder:text-white/25 focus:border-crimson/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!reply.trim()}
                  className="btn-primary px-4 py-2.5 text-xs disabled:opacity-40"
                  aria-label={internal ? "Save internal note" : "Send simulated reply"}
                >
                  <Send size={12} className="mr-1.5" aria-hidden />
                  {internal ? "Save note" : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState text="Select a conversation." />
        )}
      </div>
      {selected?.resolved && (
        <div className="col-span-full border-t border-white/[0.07] px-4 py-2">
          <StatusPill tone="green">Resolved</StatusPill>
        </div>
      )}
    </div>
  );
}
