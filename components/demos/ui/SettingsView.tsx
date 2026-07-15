"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
  Wand2,
} from "lucide-react";
import {
  initialDemoState,
  renderTemplate,
  templateVars,
  unknownVariables,
  uid,
} from "../engine";
import { clearSession } from "../storage";
import { TEMPLATE_VARIABLES, type IntakeField, type TemplateTone } from "../types";
import { PanelHeading } from "./primitives";
import { ConfirmDialog } from "./Modal";
import { SelectInput, SmallButton, TextArea, TextInput } from "./fields";
import { IntakeFormModal } from "./LeadsViews";
import { applyNow, type ViewProps } from "./shared";

const ACCENTS = ["#b3243a", "#2563eb", "#0d9488", "#7c3aed", "#b45309", "#475569"];

const TONES: TemplateTone[] = ["professional", "friendly", "premium", "direct", "conversational"];

type Section = "business" | "team" | "templates" | "intake" | "personalize" | "reset";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "business", label: "Business profile" },
  { id: "team", label: "Team & roles" },
  { id: "templates", label: "Message templates" },
  { id: "intake", label: "Intake form" },
  { id: "personalize", label: "Make this your business" },
  { id: "reset", label: "Reset & data" },
];

export function SettingsView(props: ViewProps) {
  const { state, config, dispatch, track } = props;
  const [section, setSection] = useState<Section>("business");
  const [confirmReset, setConfirmReset] = useState(false);
  const [previewForm, setPreviewForm] = useState(false);
  const s = state.settings;

  const fullReset = () => {
    clearSession(config.slug);
    dispatch({ type: "reset", state: { ...initialDemoState(config), introSeen: true } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <nav aria-label="Settings sections" className="lg:col-span-1">
        <ul className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
          {SECTIONS.map((sec) => (
            <li key={sec.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setSection(sec.id)}
                aria-current={section === sec.id ? "page" : undefined}
                className={`w-full whitespace-nowrap rounded px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
                  section === sec.id ? "bg-white/[0.06] text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {sec.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:col-span-3">
        {/* ------------------------------------------------ Business */}
        {section === "business" && (
          <div className="space-y-4 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs text-white/40">
              Changes preview instantly across the whole demo and stay isolated to your session.
            </p>
            <TextInput
              label="Business name"
              value={s.businessName}
              onChange={(v) => {
                dispatch({ type: "settings-update", patch: { businessName: v } });
                track("customized branding");
              }}
            />
            <div>
              <p className="mb-1.5 text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/45">
                Accent color
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      dispatch({ type: "settings-update", patch: { accent: c } });
                      track("customized branding");
                    }}
                    aria-label={`Set accent color ${c}`}
                    aria-pressed={s.accent === c}
                    className={`h-8 w-8 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                      s.accent === c ? "scale-110 border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[0.64rem] text-white/35">
                Applied to the OS chrome, navigation, and highlights.
              </p>
            </div>
            <TextInput
              label="Primary service (optional)"
              value={s.primaryService}
              onChange={(v) => dispatch({ type: "settings-update", patch: { primaryService: v } })}
              placeholder={config.leads[0]?.service ?? ""}
              helper="Shown in the OS header as your focus service."
            />
          </div>
        )}

        {/* ------------------------------------------------ Team & roles */}
        {section === "team" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
              <PanelHeading title="View the demo as…" />
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {config.roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      dispatch({ type: "settings-update", patch: { role: r.id } });
                      track("switched roles");
                    }}
                    aria-pressed={s.role === r.id}
                    className={`rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson ${
                      s.role === r.id
                        ? "border-crimson/50 bg-crimson/[0.07]"
                        : "border-white/[0.08] hover:border-white/20"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium text-white/85">
                      <UserRound size={12} aria-hidden /> {r.label}
                    </p>
                    <p className="mt-1 text-[0.66rem] leading-snug text-white/45">{r.description}</p>
                  </button>
                ))}
              </div>
              <p className="px-4 pb-3 text-[0.64rem] text-white/35">
                Role views are a demonstration of role-based access — navigation adapts to the selected role.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
              <PanelHeading
                title={`Team · ${s.staff.length}`}
                right={
                  <SmallButton
                    onClick={() => {
                      dispatch({
                        type: "settings-staff",
                        staff: [...s.staff, { id: uid("staff"), name: "New team member", role: "Staff" }],
                      });
                      track("customized team");
                    }}
                  >
                    <Plus size={11} aria-hidden /> Add
                  </SmallButton>
                }
              />
              <ul className="divide-y divide-white/[0.05]">
                {s.staff.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <input
                      value={m.name}
                      onChange={(e) =>
                        dispatch({
                          type: "settings-staff",
                          staff: s.staff.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                        })
                      }
                      aria-label={`Name for ${m.name}`}
                      className="min-w-[8rem] flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-white/80 focus:border-crimson/50 focus:bg-base-900 focus:outline-none"
                    />
                    <input
                      value={m.role}
                      onChange={(e) =>
                        dispatch({
                          type: "settings-staff",
                          staff: s.staff.map((x) => (x.id === m.id ? { ...x, role: e.target.value } : x)),
                        })
                      }
                      aria-label={`Role for ${m.name}`}
                      className="w-36 rounded border border-transparent bg-transparent px-1.5 py-1 text-[0.68rem] text-white/50 focus:border-crimson/50 focus:bg-base-900 focus:outline-none"
                    />
                    <SmallButton
                      tone="danger"
                      onClick={() =>
                        dispatch({ type: "settings-staff", staff: s.staff.filter((x) => x.id !== m.id) })
                      }
                      disabled={s.staff.length <= 1}
                      ariaLabel={`Remove ${m.name}`}
                    >
                      <Trash2 size={11} aria-hidden />
                    </SmallButton>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Templates */}
        {section === "templates" && (
          <TemplatesEditor {...props} />
        )}

        {/* ------------------------------------------------ Intake builder */}
        {section === "intake" && (
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
            <PanelHeading
              title="Intake form builder"
              right={
                <div className="flex gap-2">
                  <SmallButton onClick={() => setPreviewForm(true)}>
                    <Eye size={11} aria-hidden /> Preview & test
                  </SmallButton>
                  <SmallButton
                    onClick={() => {
                      dispatch({ type: "settings-intake", fields: config.intakeFields });
                      track("customized the intake form");
                    }}
                  >
                    <RotateCcw size={11} aria-hidden /> Defaults
                  </SmallButton>
                </div>
              }
            />
            <p className="border-b border-white/[0.06] px-4 py-2.5 text-[0.66rem] text-white/40">
              This form powers &ldquo;New {config.terminology.record}&rdquo; — test submissions create real demo
              records and trigger the intake workflow.
            </p>
            <ul className="divide-y divide-white/[0.05]">
              {s.intakeFields.map((f, i) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <input
                    value={f.label}
                    onChange={(e) => {
                      dispatch({
                        type: "settings-intake",
                        fields: s.intakeFields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                      });
                      track("customized the intake form");
                    }}
                    aria-label={`Label for field ${f.label}`}
                    className="min-w-[9rem] flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-white/80 focus:border-crimson/50 focus:bg-base-900 focus:outline-none"
                  />
                  <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-white/40">
                    {f.type}
                  </span>
                  <label className="flex items-center gap-1 text-[0.62rem] text-white/50">
                    <input
                      type="checkbox"
                      checked={!!f.required}
                      onChange={(e) =>
                        dispatch({
                          type: "settings-intake",
                          fields: s.intakeFields.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)),
                        })
                      }
                      className="h-3 w-3 accent-[#b3243a]"
                    />
                    Required
                  </label>
                  <SmallButton
                    onClick={() => {
                      const fields = [...s.intakeFields];
                      if (i === 0) return;
                      [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
                      dispatch({ type: "settings-intake", fields });
                    }}
                    disabled={i === 0}
                    ariaLabel={`Move ${f.label} up`}
                  >
                    <ArrowUp size={11} aria-hidden />
                  </SmallButton>
                  <SmallButton
                    onClick={() => {
                      const fields = [...s.intakeFields];
                      if (i === fields.length - 1) return;
                      [fields[i + 1], fields[i]] = [fields[i], fields[i + 1]];
                      dispatch({ type: "settings-intake", fields });
                    }}
                    disabled={i === s.intakeFields.length - 1}
                    ariaLabel={`Move ${f.label} down`}
                  >
                    <ArrowDown size={11} aria-hidden />
                  </SmallButton>
                  <SmallButton
                    tone="danger"
                    onClick={() =>
                      dispatch({ type: "settings-intake", fields: s.intakeFields.filter((x) => x.id !== f.id) })
                    }
                    disabled={["name"].includes(f.id) || s.intakeFields.length <= 2}
                    ariaLabel={`Remove field ${f.label}`}
                  >
                    <Trash2 size={11} aria-hidden />
                  </SmallButton>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
              {(["text", "textarea", "select", "phone", "email", "checkbox"] as const).map((t) => (
                <SmallButton
                  key={t}
                  onClick={() => {
                    const field: IntakeField = {
                      id: uid("f"),
                      label: t === "select" ? "New dropdown" : `New ${t} field`,
                      type: t,
                      options: t === "select" ? ["Option A", "Option B"] : undefined,
                    };
                    dispatch({ type: "settings-intake", fields: [...s.intakeFields, field] });
                    track("customized the intake form");
                  }}
                >
                  <Plus size={10} aria-hidden /> {t}
                </SmallButton>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Personalization */}
        {section === "personalize" && (
          <div className="space-y-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs leading-relaxed text-white/50">
              Answer a few optional questions and the demo reshapes itself around your business. No
              account needed; nothing is submitted anywhere — answers stay in your browser and you
              can clear them anytime.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Business name"
                value={s.businessName === config.businessName ? "" : s.businessName}
                onChange={(v) =>
                  dispatch({ type: "settings-update", patch: { businessName: v || config.businessName } })
                }
                placeholder={config.businessName}
              />
              <TextInput
                label="Primary service"
                value={s.personalization.service ?? ""}
                onChange={(v) => {
                  dispatch({ type: "settings-personalization", personalization: { ...s.personalization, service: v } });
                  dispatch({ type: "settings-update", patch: { primaryService: v } });
                }}
              />
              <SelectInput
                label="Approx. monthly lead volume"
                value={s.personalization.monthlyLeads ?? ""}
                onChange={(v) =>
                  dispatch({ type: "settings-personalization", personalization: { ...s.personalization, monthlyLeads: v } })
                }
                options={["Under 20", "20–50", "50–150", "150+"].map((x) => ({ value: x, label: x }))}
                placeholder="Select…"
              />
              <SelectInput
                label="Biggest operational problem"
                value={s.personalization.problem ?? ""}
                onChange={(v) => {
                  dispatch({ type: "settings-personalization", personalization: { ...s.personalization, problem: v } });
                  track("personalized the demo");
                }}
                options={[
                  "Slow response to new leads",
                  "No follow-up after quotes/consults",
                  "Missed calls going to voicemail",
                  "No-shows and cancellations",
                  "Old leads never re-contacted",
                  "Front desk / admin overload",
                ].map((x) => ({ value: x, label: x }))}
                placeholder="Select…"
              />
            </div>
            {s.personalization.problem && (
              <div className="rounded-lg border border-crimson/25 bg-crimson/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-crimson-light">
                  <Wand2 size={11} aria-hidden /> Suggested starting point
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/75">
                  {recommendationFor(s.personalization.problem, config.automations.map((a) => a.name))}
                </p>
              </div>
            )}
            <div className="flex justify-end border-t border-white/[0.06] pt-3">
              <SmallButton
                onClick={() => {
                  dispatch({ type: "settings-personalization", personalization: {} });
                  dispatch({
                    type: "settings-update",
                    patch: { businessName: config.businessName, primaryService: "" },
                  });
                }}
              >
                <RotateCcw size={11} aria-hidden /> Clear my answers
              </SmallButton>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Reset */}
        {section === "reset" && (
          <div className="space-y-4 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <div>
              <p className="text-xs font-medium text-white/80">Demo environment</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-white/45">
                Your session lives only in this browser, expires automatically after 24 hours, and
                never mixes with any real business data. No real messages, appointments, or payments
                are ever created from this demo.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <SmallButton
                onClick={() => {
                  dispatch({ type: "stages-restore", stages: config.stages });
                  dispatch({ type: "automations-restore", automations: config.automations });
                  dispatch({ type: "templates-restore", templates: config.templates });
                  dispatch({ type: "settings-intake", fields: config.intakeFields });
                  applyNow(dispatch, [
                    {
                      kind: "notify",
                      notification: { id: uid("n"), title: "Customizations restored", body: "Stages, workflows, templates, and the intake form are back to defaults. Your records were kept.", tone: "success" },
                    },
                  ]);
                }}
              >
                <RotateCcw size={11} aria-hidden /> Reset customizations only
              </SmallButton>
              <SmallButton tone="danger" onClick={() => setConfirmReset(true)}>
                <Trash2 size={11} aria-hidden /> Reset entire demo
              </SmallButton>
            </div>
          </div>
        )}
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reset the entire demo?"
          body="All records, conversations, appointments, workflow history, and customizations from your session will be discarded and the original sample data restored."
          confirmLabel="Reset everything"
          onConfirm={fullReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
      {previewForm && (
        <IntakeFormModal {...props} onClose={() => setPreviewForm(false)} title="Intake form preview (test submission)" />
      )}
    </div>
  );
}

function recommendationFor(problem: string, automationNames: string[]): string {
  const pick = (needle: string) =>
    automationNames.find((n) => n.toLowerCase().includes(needle)) ?? automationNames[0];
  switch (problem) {
    case "Slow response to new leads":
      return `Start with "${pick("intake")}" — every inquiry gets an answer in under a minute, then a staff task with full context. Test it now: submit the intake form from the ${""}records tab.`;
    case "No follow-up after quotes/consults":
      return `Start with "${pick("follow")}" — a paced sequence that keeps nudging until someone replies, and pauses the moment your team responds manually.`;
    case "Missed calls going to voicemail":
      return `Start with "${pick("missed")}" — run the missed-call scenario from the scenario menu to watch a voicemail turn into a captured, qualified record.`;
    case "No-shows and cancellations":
      return `Start with "${pick("no-show")}" — open the calendar and mark any appointment as a no-show to watch the recovery sequence fire in real time.`;
    case "Old leads never re-contacted":
      return `Start with "${pick("reactivation")}" — check the campaigns tab and send a simulated batch to see how dormant records come back.`;
    default:
      return `Start with "${pick("intake")}" and the task automations — most of the repetitive work in this demo's Tasks tab was created (and can be resolved) automatically.`;
  }
}

/* ------------------------------------------------------------------ */
/* Templates editor                                                    */
/* ------------------------------------------------------------------ */

function TemplatesEditor({ state, config, dispatch, track }: ViewProps) {
  const [selectedId, setSelectedId] = useState(state.templates[0]?.id ?? "");
  const t = state.templates.find((x) => x.id === selectedId) ?? state.templates[0];
  if (!t) return null;
  const unknown = unknownVariables(t.text, TEMPLATE_VARIABLES);
  const preview = renderTemplate(t.text, templateVars(state, config));

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-1">
        <PanelHeading title="Templates" />
        <ul className="divide-y divide-white/[0.05]">
          {state.templates.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => setSelectedId(x.id)}
                aria-current={t.id === x.id ? "true" : undefined}
                className={`w-full px-4 py-2.5 text-left text-xs transition-colors ${
                  t.id === x.id ? "bg-white/[0.05] text-white" : "text-white/55 hover:text-white/85"
                }`}
              >
                {x.name}
                <span className="ml-1.5 text-[0.58rem] uppercase text-white/30">{x.channel}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-white/[0.06] p-3">
          <SmallButton
            onClick={() => {
              dispatch({ type: "templates-restore", templates: config.templates });
              track("edited message templates");
            }}
          >
            <RotateCcw size={11} aria-hidden /> Restore all defaults
          </SmallButton>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/85">{t.name}</p>
          <SelectInput
            label="Tone"
            value={t.tone}
            onChange={(v) => {
              dispatch({ type: "template-update", templateId: t.id, patch: { tone: v as TemplateTone } });
              track("edited message templates");
            }}
            options={TONES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))}
          />
        </div>
        <TextArea
          label="Message"
          value={t.text}
          onChange={(v) => {
            dispatch({ type: "template-update", templateId: t.id, patch: { text: v } });
            track("edited message templates");
          }}
          rows={4}
          error={unknown.length ? `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((v) => `{${v}}`).join(", ")}` : undefined}
        />
        <div>
          <p className="mb-1.5 text-[0.66rem] font-medium uppercase tracking-[0.12em] text-white/45">
            Available variables
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() =>
                  dispatch({ type: "template-update", templateId: t.id, patch: { text: `${t.text} {${v}}` } })
                }
                className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.6rem] text-white/55 transition-colors hover:border-crimson/50 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-crimson"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-base-900/70 p-3">
          <p className="text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white/35">
            Live preview · sample {config.terminology.record}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/75">{preview}</p>
        </div>
        <p className="text-[0.64rem] text-white/35">
          Edited templates are used by the Conversations composer and workflow simulations in this
          session.
        </p>
      </div>
    </div>
  );
}
