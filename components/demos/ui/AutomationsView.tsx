"use client";

import { useState } from "react";
import { ChevronDown, FlaskConical, History, PlusCircle, RotateCcw, Zap } from "lucide-react";
import { testAutomationEffects } from "../engine";
import type { Automation } from "../types";
import { PanelHeading, SampleDataTag, StatusPill } from "./primitives";
import { SmallButton, TextArea, TextInput } from "./fields";
import { applyNow, type ViewProps } from "./shared";

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
        on ? "border-emerald-500/50 bg-emerald-500/25" : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
          on ? "left-[18px] bg-emerald-400" : "left-0.5 bg-white/40"
        }`}
        aria-hidden
      />
    </button>
  );
}

function AutomationCard({
  automation,
  state,
  dispatch,
  track,
  openRequest,
}: ViewProps & { automation: Automation }) {
  const [open, setOpen] = useState(false);
  const runs = state.workflowRuns.filter((r) => r.automationId === automation.id);
  const active = automation.status === "active";

  return (
    <div className={`rounded-lg border bg-white/[0.02] ${active ? "border-white/[0.07]" : "border-white/[0.05] opacity-80"}`}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/85">{automation.name}</p>
          <p className="mt-0.5 text-[0.66rem] text-white/40">Trigger: {automation.trigger}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill tone={active ? "green" : "gray"}>{active ? "Active" : "Paused"}</StatusPill>
          <Toggle
            on={active}
            label={`${active ? "Pause" : "Enable"} ${automation.name}`}
            onChange={() => {
              dispatch({ type: "automation-toggle", automationId: automation.id });
              track("toggled workflows");
            }}
          />
        </div>
      </div>
      <ol className="space-y-1.5 px-4">
        {automation.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2 text-[0.68rem] text-white/55">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/15 text-[0.55rem] tabular-nums text-white/40">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
        <span className="mr-auto text-[0.62rem] tabular-nums text-white/35">
          {automation.runsThisMonth.toLocaleString()} baseline runs · {runs.length} in your session
        </span>
        <SmallButton
          onClick={() => {
            applyNow(dispatch, testAutomationEffects(automation));
            track("tested workflows");
          }}
          disabled={!active}
          ariaLabel={`Test ${automation.name}`}
        >
          <FlaskConical size={10} aria-hidden /> Test
        </SmallButton>
        <SmallButton
          onClick={() =>
            openRequest({ feature: "Automated follow-up sequences", source: "automation_card" })
          }
          ariaLabel={`Add ${automation.name} to my system`}
        >
          <PlusCircle size={10} aria-hidden /> Add to my system
        </SmallButton>
        <SmallButton onClick={() => setOpen((v) => !v)} ariaLabel={`${open ? "Collapse" : "Edit"} ${automation.name}`}>
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          {open ? "Close" : "Edit"}
        </SmallButton>
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
          {automation.delayLabel !== undefined && (
            <TextInput
              label="Delay before first follow-up"
              value={automation.delayLabel}
              onChange={(v) => {
                dispatch({ type: "automation-update", automationId: automation.id, patch: { delayLabel: v } });
                track("edited workflow timing");
              }}
              helper="Changes apply to your demo session immediately."
            />
          )}
          {automation.message !== undefined && (
            <TextArea
              label="First outbound message"
              value={automation.message}
              onChange={(v) => {
                dispatch({ type: "automation-update", automationId: automation.id, patch: { message: v } });
                track("edited workflow messages");
              }}
              rows={3}
              helper="Variables like {first_name} and {business_name} are filled at send time. Used by live simulations (e.g. mark an appointment as a no-show)."
            />
          )}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/45">
              <History size={11} aria-hidden /> Execution history (this session)
            </p>
            {runs.length === 0 ? (
              <p className="text-[0.66rem] text-white/30">
                No runs yet — press Test, or trigger it live (submit the intake form, mark a no-show…).
              </p>
            ) : (
              <ul className="space-y-1.5">
                {runs.slice(0, 5).map((r) => (
                  <li key={r.id} className="rounded border border-white/[0.07] bg-base-900/60 px-2.5 py-1.5 text-[0.64rem] text-white/55">
                    <span className="mr-1.5 text-emerald-400/70">✓ simulated</span>
                    {r.detail}
                    <span className="ml-1.5 text-white/25">{r.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutomationsView(props: ViewProps) {
  const { state, config, dispatch, track } = props;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Toggles and edits change how this demo actually behaves — pause the intake workflow, then
          submit the form and watch the difference.
        </p>
        <div className="flex items-center gap-3">
          <SampleDataTag className="hidden lg:inline-flex" />
          <SmallButton
            onClick={() => {
              dispatch({ type: "automations-restore", automations: config.automations });
              track("restored workflow defaults");
            }}
          >
            <RotateCcw size={11} aria-hidden /> Restore defaults
          </SmallButton>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {state.automations.map((a) => (
          <AutomationCard key={a.id} {...props} automation={a} />
        ))}
      </div>

      {state.workflowRuns.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02]">
          <PanelHeading
            title={`All executions this session · ${state.workflowRuns.length}`}
            right={
              <span className="inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-white/30">
                <Zap size={9} aria-hidden /> Simulations only
              </span>
            }
          />
          <ul className="max-h-56 divide-y divide-white/[0.05] overflow-y-auto no-scrollbar">
            {state.workflowRuns.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <p className="text-xs text-white/70">{r.name}</p>
                <p className="mt-0.5 text-[0.64rem] text-white/40">
                  {r.detail} · {r.time}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
