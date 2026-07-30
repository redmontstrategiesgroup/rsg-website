"use client";

import { useId, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical, WorkflowStage } from "@/lib/industries/types";

/**
 * Interactive workflow map. Selecting a stage reveals what happens there,
 * where it commonly fails, the RSG system responsible, automation
 * opportunities, KPIs, and recommended integrations.
 *
 * Layout variants keep the three vertical pages structurally distinct:
 *  - "pipeline": horizontal job pipeline (home services)
 *  - "journey":  vertical patient-journey rail (dental)
 *  - "loop":     wrapping lifecycle grid that closes back on itself (retail)
 */
export function WorkflowMap({
  vertical,
  variant,
}: {
  vertical: IndustryVertical;
  variant: "pipeline" | "journey" | "loop";
}) {
  const stages = vertical.workflow.stages;
  const [activeId, setActiveId] = useState(stages[0]?.id ?? "");
  const active = stages.find((s) => s.id === activeId) ?? stages[0];
  const panelId = useId();

  if (!active) return null;
  const activeIndex = stages.findIndex((s) => s.id === active.id);

  return (
    <section id="workflow" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">The full workflow</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">
              {vertical.workflow.title}
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">
              {vertical.workflow.intro}
            </p>
          </Reveal>
        </div>

        <Reveal y={14} delay={0.1}>
          <div
            className={`mt-9 sm:mt-14 ${
              variant === "journey" ? "grid gap-8 lg:grid-cols-12" : "space-y-8"
            }`}
          >
            {/* Stage selector */}
            {variant === "pipeline" && (
              <div className="-mx-6 min-w-0 max-w-full overflow-x-auto px-6 pb-2 sm:mx-0 sm:px-0" role="tablist" aria-label="Workflow stages">
                <ol className="flex min-w-max items-stretch gap-0">
                  {stages.map((s, i) => (
                    <li key={s.id} className="flex items-center">
                      <StageButton
                        stage={s}
                        index={i}
                        active={s.id === active.id}
                        onSelect={() => setActiveId(s.id)}
                        panelId={panelId}
                        shape="node"
                      />
                      {i < stages.length - 1 && (
                        <span
                          aria-hidden
                          className={`mx-1 h-px w-6 sm:w-8 ${i < activeIndex ? "bg-crimson/60" : "bg-white/15"}`}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {variant === "journey" && (
              <div className="lg:col-span-4" role="tablist" aria-label="Patient journey stages">
                <ol className="relative space-y-1 border-l border-white/10 pl-5">
                  {stages.map((s, i) => (
                    <li key={s.id} className="relative">
                      <span
                        aria-hidden
                        className={`absolute -left-[23px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full transition-colors ${
                          s.id === active.id
                            ? "bg-crimson-light shadow-glow-sm"
                            : i <= activeIndex
                              ? "bg-crimson/50"
                              : "bg-white/20"
                        }`}
                      />
                      <StageButton
                        stage={s}
                        index={i}
                        active={s.id === active.id}
                        onSelect={() => setActiveId(s.id)}
                        panelId={panelId}
                        shape="row"
                      />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {variant === "loop" && (
              <div role="tablist" aria-label="Customer lifecycle stages">
                <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {stages.map((s, i) => (
                    <li key={s.id}>
                      <StageButton
                        stage={s}
                        index={i}
                        active={s.id === active.id}
                        onSelect={() => setActiveId(s.id)}
                        panelId={panelId}
                        shape="tile"
                      />
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex items-center gap-2 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/30">
                  <ArrowRight size={11} aria-hidden />
                  Stage {stages.length} feeds stage 1 — the lifecycle is a loop, not a funnel
                </p>
              </div>
            )}

            {/* Detail panel */}
            <div
              id={panelId}
              role="tabpanel"
              aria-label={`Stage details: ${active.label}`}
              className={variant === "journey" ? "lg:col-span-8" : ""}
            >
              <div className="overflow-hidden rounded-xl border border-white/10 bg-base-900/70">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-crimson/40 bg-crimson/10 font-mono text-[0.72rem] sm:text-[0.62rem] text-crimson-light">
                      {activeIndex + 1}
                    </span>
                    <h3 className="font-display text-lg text-white">{active.label}</h3>
                  </div>
                  <span className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/30">
                    Stage {activeIndex + 1} of {stages.length}
                  </span>
                </div>

                <div className="grid gap-px bg-white/[0.06] lg:grid-cols-2">
                  <DetailCell icon={<WorkflowIcon size={13} aria-hidden />} title="What happens here">
                    <p className="text-sm leading-relaxed text-white/60">{active.happens}</p>
                  </DetailCell>
                  <DetailCell
                    icon={<AlertTriangle size={13} aria-hidden />}
                    title="Where it commonly fails"
                    tone="risk"
                  >
                    <ul className="space-y-2">
                      {active.failures.map((f) => (
                        <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                          <span aria-hidden className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-crimson-light/70" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </DetailCell>
                  <DetailCell icon={<Cpu size={13} aria-hidden />} title="RSG system responsible">
                    <p className="inline-flex items-center gap-2 rounded-lg border border-crimson/30 bg-crimson/[0.08] px-3 py-2 text-sm text-white/85">
                      {active.system}
                    </p>
                    <p className="mt-3 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/30">
                      Automation opportunities
                    </p>
                    <ul className="mt-2 space-y-2">
                      {active.automations.map((a) => (
                        <li key={a} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                          <Activity size={13} aria-hidden className="mt-1 shrink-0 text-crimson-light/60" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </DetailCell>
                  <DetailCell icon={<Gauge size={13} aria-hidden />} title="KPIs worth watching">
                    <ul className="flex flex-wrap gap-2">
                      {active.kpis.map((k) => (
                        <li
                          key={k}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-white/60"
                        >
                          {k}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/30">
                      Recommended integrations
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {active.integrations.map((n) => (
                        <li
                          key={n}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-white/60"
                        >
                          <Boxes size={11} aria-hidden className="text-white/35" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </DetailCell>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StageButton({
  stage,
  index,
  active,
  onSelect,
  panelId,
  shape,
}: {
  stage: WorkflowStage;
  index: number;
  active: boolean;
  onSelect: () => void;
  panelId: string;
  shape: "node" | "row" | "tile";
}) {
  const base =
    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson";
  if (shape === "row") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={panelId}
        onClick={onSelect}
        className={`${base} block w-full rounded-lg px-3 py-2.5 text-left ${
          active ? "bg-crimson/[0.08] text-white" : "text-white/45 hover:bg-white/[0.03] hover:text-white/75"
        }`}
      >
        <span className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/30">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="mt-0.5 block text-sm leading-snug">{stage.label}</span>
      </button>
    );
  }
  if (shape === "tile") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={panelId}
        onClick={onSelect}
        className={`${base} flex h-full w-full flex-col rounded-lg border px-3 py-3 text-left ${
          active
            ? "border-crimson/50 bg-crimson/[0.08]"
            : "border-white/10 bg-white/[0.02] hover:border-white/25"
        }`}
      >
        <span className={`font-mono text-[0.7rem] sm:text-[0.55rem] ${active ? "text-crimson-light" : "text-white/30"}`}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={`mt-1 text-[0.78rem] leading-snug ${active ? "text-white" : "text-white/55"}`}>
          {stage.label}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onSelect}
      className={`${base} flex flex-col items-center gap-2 rounded-lg px-2 py-1.5 ${
        active ? "" : "opacity-80 hover:opacity-100"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border font-mono text-[0.72rem] sm:text-[0.62rem] transition-colors ${
          active
            ? "border-crimson bg-crimson/15 text-crimson-light shadow-glow-sm"
            : "border-white/15 bg-white/[0.03] text-white/45"
        }`}
      >
        {index + 1}
      </span>
      <span
        className={`max-w-[6.5rem] text-center text-[0.72rem] sm:text-[0.62rem] leading-tight ${
          active ? "text-white" : "text-white/45"
        }`}
      >
        {stage.label}
      </span>
    </button>
  );
}

function DetailCell({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "risk";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-base-900 p-6">
      <p
        className={`flex items-center gap-2 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label ${
          tone === "risk" ? "text-crimson-light/80" : "text-white/35"
        }`}
      >
        {icon}
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
