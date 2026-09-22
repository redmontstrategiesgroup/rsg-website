"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Effect, FreshKind, IndustryConfig, NavId, Stage } from "../types";

export type Chip = { label: string; tab: NavId; kind: FreshKind };

export const KIND_COLOR: Record<FreshKind, string> = {
  record: "var(--demo-accent)",
  message: "#38bdf8",
  task: "#fbbf24",
  calendar: "#34d399",
  metric: "#34d399",
  recovery: "#34d399",
  boundary: "#fb7185",
};

/** One chip per kind of change a step makes, in effect order, de-duplicated. */
export function chipsForEffects(effects: Effect[], config: IndustryConfig, stages: Stage[]): Chip[] {
  const chips: Chip[] = [];
  const push = (c: Chip) => { if (!chips.some((x) => x.label === c.label)) chips.push(c); };
  for (const e of effects) {
    switch (e.kind) {
      case "lead": push({ label: `+1 ${config.terminology.record}`, tab: "leads", kind: "record" }); break;
      case "updateLead": push({ label: `${config.terminology.record} updated`, tab: "leads", kind: "record" }); break;
      case "stage": push({ label: `stage → ${stages.find((s) => s.id === e.stageId)?.label ?? e.stageId}`, tab: "pipeline", kind: "record" }); break;
      case "message": case "conversation": push({ label: "message", tab: "conversations", kind: "message" }); break;
      case "task": push({ label: "task", tab: "tasks", kind: "task" }); break;
      case "completeTask": push({ label: "task done", tab: "tasks", kind: "task" }); break;
      case "calendar": case "calendarUpdate": case "appointmentStatus": push({ label: "calendar", tab: "calendar", kind: "calendar" }); break;
      case "metric": push({ label: "metric", tab: "overview", kind: "metric" }); break;
      case "review": case "reviewStatus": push({ label: "review", tab: "reviews", kind: "record" }); break;
      case "quote": case "quoteStatus": push({ label: "quote", tab: "quotes", kind: "record" }); break;
      case "workflowRun": push({ label: "automation", tab: "automations", kind: "record" }); break;
      case "boundary": push({ label: "guardrail", tab: "boundaries", kind: "boundary" }); break;
      case "recovery": push({ label: `recovered $${e.event.amount.toLocaleString()}`, tab: "recovered", kind: "recovery" }); break;
      case "activity": case "notify": case "conversationMeta": case "reopenTask": break;
    }
  }
  return chips;
}

export function TourCaption({ eyebrow, title, detail, chips, accent, onChip, controls }: {
  eyebrow: string;
  title: string;
  detail: string;
  chips: Chip[];
  accent: string;
  onChip: (tab: NavId) => void;
  controls?: { playing: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; onToggle: () => void };
}) {
  const accentText = accent === "#b3243a" ? "#d94b5e" : accent;
  /*
    Sticks to the top of the demo pane, which is its own scroll container. It
    is a direct, unpadded child of that pane on purpose: a sticky box cannot
    leave its containing block, so pane padding would hold the caption that
    far down and leave a band the board scrolls up into behind it.
  */
  return (
    <div
      data-tour-caption
      className="sticky top-0 z-20 border-b px-4 py-3 backdrop-blur sm:px-5"
      style={{ borderColor: `${accent}66`, backgroundColor: `color-mix(in srgb, ${accent} 10%, #0b0b0f)` }}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.2em]" style={{ color: accentText }}>{eyebrow}</p>
          <p className="mt-0.5 text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/60">{detail}</p>
          {chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="What this step changed">
              {chips.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => onChip(c.tab)}
                    className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[0.62rem] text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    style={{ borderColor: `color-mix(in srgb, ${KIND_COLOR[c.kind]} 55%, transparent)`, backgroundColor: `color-mix(in srgb, ${KIND_COLOR[c.kind]} 14%, transparent)` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KIND_COLOR[c.kind] }} aria-hidden />
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {controls && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton onClick={controls.onPrev} disabled={!controls.canPrev || controls.playing} aria-label="Previous tour step" className="rounded border border-white/10 text-white/60 hover:text-white">
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton onClick={controls.onToggle} disabled={!controls.canNext} aria-label={controls.playing ? "Pause tour" : "Resume tour"} className="rounded border border-white/10 text-white/60 hover:text-white">
              {controls.playing ? <Pause size={14} /> : <Play size={14} />}
            </IconButton>
            <IconButton onClick={controls.onNext} disabled={!controls.canNext || controls.playing} aria-label="Next tour step" className="rounded border border-white/10 text-white/60 hover:text-white">
              <ChevronRight size={14} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}
