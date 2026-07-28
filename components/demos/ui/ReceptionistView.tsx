"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Phone, RotateCcw } from "lucide-react";
import type { ReceptionistNode } from "../types";
import { PanelHeading, SampleDataTag } from "./primitives";
import { applyNow, type ViewProps } from "./shared";

type Bubble = { id: string; from: "ai" | "caller"; text: string; meta?: string };

const AI_REPLY_DELAY_MS = 750;

/**
 * Interactive AI receptionist simulation. The visitor role-plays the caller by
 * choosing replies; the scripted assistant answers, qualifies, and books —
 * and the outcome lands in the demo's real records (lead, appointment, task).
 */
export function ReceptionistView(props: ViewProps) {
  const { config, dispatch, track, openRequest } = props;
  const r = config.receptionist;
  const nodeById = useCallback(
    (id: string): ReceptionistNode | undefined => r.nodes.find((n) => n.id === id),
    [r.nodes],
  );

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [outcome, setOutcome] = useState<string[] | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, typing, outcome]);

  const bubbleId = () => `b-${(seq.current += 1)}`;

  const showNode = useCallback(
    (id: string) => {
      const node = nodeById(id);
      if (!node) return;
      setTyping(true);
      timer.current = setTimeout(() => {
        setTyping(false);
        setBubbles((prev) => [
          ...prev,
          { id: bubbleId(), from: "ai", text: node.say, meta: node.meta },
        ]);
        setNodeId(node.id);
        if (node.outcome) {
          setOutcome(node.outcome.summary);
          applyNow(dispatch, node.outcome.effects);
          track("completed the AI receptionist conversation");
        }
      }, AI_REPLY_DELAY_MS);
    },
    [nodeById, dispatch, track],
  );

  const start = () => {
    setBubbles([]);
    setOutcome(null);
    setNodeId(null);
    track("started the AI receptionist simulation");
    showNode(r.start);
  };

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setTyping(false);
    start();
  };

  const choose = (choice: { id: string; label: string; next: string }) => {
    setBubbles((prev) => [...prev, { id: bubbleId(), from: "caller", text: choice.label }]);
    setNodeId(null); // hide choices while the assistant "types"
    showNode(choice.next);
  };

  const current = nodeId ? nodeById(nodeId) : null;
  const started = bubbles.length > 0 || typing;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Call window */}
      <div className="flex flex-col rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-3">
        <PanelHeading
          title={r.scenarioLabel}
          right={
            started ? (
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-[0.68rem] text-white/65 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
              >
                <RotateCcw size={11} aria-hidden /> Restart call
              </button>
            ) : undefined
          }
        />
        <div ref={scrollRef} className="min-h-[20rem] flex-1 space-y-3 overflow-y-auto p-4 no-scrollbar" aria-live="polite">
          {!started ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-crimson/30 bg-crimson/10">
                <Phone size={17} className="text-crimson-light" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-white/85">{r.description}</p>
                <p className="mt-1.5 text-xs text-white/45">
                  You play {r.callerRole}. Choose replies and watch the assistant qualify, answer, and book.
                </p>
              </div>
              <button type="button" onClick={start} className="btn-primary px-5 py-2.5 text-xs">
                <Phone size={12} className="mr-1.5" aria-hidden /> Start the call (simulated)
              </button>
            </div>
          ) : (
            <>
              {bubbles.map((b) =>
                b.from === "ai" ? (
                  <div key={b.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                      <Bot size={12} className="text-white/60" aria-hidden />
                    </span>
                    <div className="max-w-[85%]">
                      <div className="rounded-lg rounded-tl-sm border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                        <p className="text-xs leading-relaxed text-white/80">{b.text}</p>
                      </div>
                      <p className="mt-1 text-[0.58rem] uppercase tracking-wider text-white/30">
                        AI receptionist · simulated{b.meta ? ` · ${b.meta}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={b.id} className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="rounded-lg rounded-tr-sm border border-crimson/25 bg-crimson/[0.12] px-3 py-2">
                        <p className="text-xs leading-relaxed text-white/85">{b.text}</p>
                      </div>
                      <p className="mt-1 text-right text-[0.58rem] uppercase tracking-wider text-white/30">
                        You (the caller)
                      </p>
                    </div>
                  </div>
                ),
              )}
              {typing && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                    <Bot size={12} className="text-white/60" aria-hidden />
                  </span>
                  <div className="rounded-lg rounded-tl-sm border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                    <span className="flex gap-1" aria-label="Assistant is typing">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40"
                          style={{ animationDelay: `${i * 160}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              {outcome && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
                  <p className="flex items-center gap-2 text-xs font-medium text-emerald-300/90">
                    <CheckCircle2 size={13} aria-hidden /> Call handled — here&apos;s what the system just did
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {outcome.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-xs leading-relaxed text-white/65">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/60" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-[0.62rem] text-white/35">
                    Check Leads, Conversations, and the calendar — the records are really there.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Caller reply choices */}
        {current?.choices && !typing && !outcome && (
          <div className="border-t border-white/[0.07] p-3">
            <p className="mb-2 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white/35">
              Reply as the caller
            </p>
            <div className="flex flex-wrap gap-2">
              {current.choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choose(c)}
                  className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/75 transition-colors hover:border-crimson/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Why it matters */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
            Why this matters
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              "Every missed or after-hours call gets answered in seconds — not sent to voicemail.",
              "The assistant collects the details your team needs and creates a qualified record automatically.",
              "Urgent situations are flagged and routed to a human immediately.",
              `Everything lands in one place: the ${config.terminology.record} record, the conversation, and the follow-up task.`,
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-xs leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crimson-light/70" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => openRequest({ feature: "AI receptionist & missed-call recovery", source: "receptionist_view" })}
              className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            >
              Add this to my business
              <ArrowRight size={11} aria-hidden />
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
            Honest by design
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-white/55">
            This is a scripted demonstration — no live AI model, no real phone line, and nothing is
            sent to anyone. Production assistants are configured to your services, pricing rules,
            and escalation policies, and always identify themselves as automated.
          </p>
          <div className="mt-3">
            <SampleDataTag />
          </div>
        </div>
      </div>
    </div>
  );
}
