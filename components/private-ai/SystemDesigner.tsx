"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { postJson } from "@/lib/api";
import { buildSimulatedArchitecture } from "@/lib/private-ai/architecture";
import {
  DEPLOYMENT_OPTIONS,
  DESIGNER_BUSINESS_TYPES,
  DESIGNER_DATA_SOURCES,
  DESIGNER_PRIVACY_CONTROLS,
  DESIGNER_SYSTEM_TYPES,
} from "@/lib/private-ai/content";
import type {
  DesignerConfig,
  DeploymentModelId,
  SimulatedArchitecture,
  SystemTypeId,
} from "@/lib/private-ai/types";

const STORAGE_KEY = "rsg_private_ai_designer_v1";
const STEPS = [
  "Business type",
  "System type",
  "Deployment",
  "Data sources",
  "Privacy controls",
  "Architecture",
] as const;

type ContactForm = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  industry: string;
  employees: string;
  locations: string;
  currentSoftware: string;
  privacyConcerns: string;
  timeline: string;
  notes: string;
  company_site: string;
};

const emptyContact = (): ContactForm => ({
  name: "",
  businessName: "",
  email: "",
  phone: "",
  industry: "",
  employees: "",
  locations: "",
  currentSoftware: "",
  privacyConcerns: "",
  timeline: "",
  notes: "",
  company_site: "",
});

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center rounded-lg border px-3.5 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/50 lg:min-h-0 ${
        selected
          ? "border-crimson/45 bg-crimson/10 text-white"
          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function SystemDesigner() {
  const [step, setStep] = useState(0);
  const [mountedAt] = useState(() => Date.now());
  const [config, setConfig] = useState<DesignerConfig>({
    businessType: "",
    systemType: "internal_assistant",
    deployment: "private_cloud",
    dataSources: [],
    privacyControls: ["Role-based permissions", "Audit logs"],
  });
  const [architecture, setArchitecture] = useState<SimulatedArchitecture | null>(
    null
  );
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState<ContactForm>(emptyContact);
  const [saving, setSaving] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  const [submitState, setSubmitState] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { config?: DesignerConfig };
      if (parsed.config) setConfig(parsed.config);
    } catch {
      /* ignore */
    }
  }, []);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(config.businessType);
    if (step === 1) return Boolean(config.systemType);
    if (step === 2) return Boolean(config.deployment);
    if (step === 3) return config.dataSources.length > 0;
    if (step === 4) return config.privacyControls.length > 0;
    return true;
  }, [config, step]);

  function generateArchitecture() {
    const result = buildSimulatedArchitecture(config);
    setArchitecture(result);
    setStep(5);
  }

  function saveLocal() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ config, architecture, savedAt: new Date().toISOString() })
      );
      setSavedLocal(true);
      setTimeout(() => setSavedLocal(false), 2500);
    } catch {
      setError("Could not save to this browser.");
    }
  }

  async function submitConfiguration(intent: "build" | "consult") {
    setSaving(true);
    setError("");
    setFieldErrors({});
    setSubmitState("idle");

    const payload = {
      config,
      ...contact,
      elapsedMs: Date.now() - mountedAt,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      referrer: typeof document !== "undefined" ? document.referrer : "",
      utmSource: "website",
      utmMedium: "private_ai_designer",
      utmCampaign: intent === "consult" ? "technical_consultation" : "build_system",
      notes:
        intent === "consult"
          ? `${contact.notes}\n\nRequested: technical consultation`.trim()
          : contact.notes,
    };

    const res = await postJson("/api/privateai/configure", payload);
    setSaving(false);

    let data: {
      ok?: boolean;
      error?: string;
      fields?: Record<string, string>;
      architecture?: SimulatedArchitecture;
    } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      setSubmitState("error");
      setError("Submission failed. Please try again.");
      return;
    }

    if (!res.ok || data.error) {
      setSubmitState("error");
      setError(data.error ?? "Submission failed. Please try again.");
      if (data.fields) setFieldErrors(data.fields);
      return;
    }

    if (data.architecture) setArchitecture(data.architecture);
    saveLocal();
    setSubmitState("success");
  }

  return (
    <section
      id="private-ai-designer"
      className="scroll-mt-24 border-b border-white/[0.08] bg-base-900/40"
    >
      <div className="container-px section-y">
        <Reveal y={12}>
          <p className="label">Interactive demo</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Private AI System Designer
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/50">
            Configure a simulated private AI system. This is an illustrative
            concept—not a final technical assessment or binding quote.
          </p>
        </Reveal>

        <div className="mt-10">
          <ol className="flex flex-wrap gap-2" aria-label="Designer steps">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`rounded-md border px-2.5 py-1 font-mono text-[0.7rem] sm:text-[0.58rem] uppercase tracking-label ${
                  i === step
                    ? "border-crimson/40 text-crimson-light"
                    : i < step
                      ? "border-white/15 text-white/55"
                      : "border-white/8 text-white/30"
                }`}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-white/10 bg-base/60 p-5 sm:p-8">
            {step === 0 && (
              <fieldset>
                <legend className="text-lg font-medium text-white">
                  Select the business type
                </legend>
                <div className="mt-5 flex flex-wrap gap-2">
                  {DESIGNER_BUSINESS_TYPES.map((type) => (
                    <ChipButton
                      key={type}
                      selected={config.businessType === type}
                      onClick={() =>
                        setConfig((c) => ({ ...c, businessType: type }))
                      }
                    >
                      {type}
                    </ChipButton>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 1 && (
              <fieldset>
                <legend className="text-lg font-medium text-white">
                  Select the system type
                </legend>
                <div className="mt-5 flex flex-wrap gap-2">
                  {DESIGNER_SYSTEM_TYPES.map((type) => (
                    <ChipButton
                      key={type.id}
                      selected={config.systemType === type.id}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          systemType: type.id as SystemTypeId,
                        }))
                      }
                    >
                      {type.label}
                    </ChipButton>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 2 && (
              <fieldset>
                <legend className="text-lg font-medium text-white">
                  Select the deployment model
                </legend>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {DEPLOYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={config.deployment === opt.id}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          deployment: opt.id as DeploymentModelId,
                        }))
                      }
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        config.deployment === opt.id
                          ? "border-crimson/45 bg-crimson/[0.08]"
                          : "border-white/10 hover:border-white/25"
                      }`}
                    >
                      <span className="block font-medium text-white">
                        {opt.name}
                      </span>
                      <span className="mt-2 block text-sm text-white/45">
                        {opt.summary}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <fieldset>
                <legend className="text-lg font-medium text-white">
                  Select data sources
                </legend>
                <div className="mt-5 flex flex-wrap gap-2">
                  {DESIGNER_DATA_SOURCES.map((source) => (
                    <ChipButton
                      key={source}
                      selected={config.dataSources.includes(source)}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          dataSources: toggleValue(c.dataSources, source),
                        }))
                      }
                    >
                      {source}
                    </ChipButton>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 4 && (
              <fieldset>
                <legend className="text-lg font-medium text-white">
                  Select privacy controls
                </legend>
                <div className="mt-5 flex flex-wrap gap-2">
                  {DESIGNER_PRIVACY_CONTROLS.map((control) => (
                    <ChipButton
                      key={control}
                      selected={config.privacyControls.includes(control)}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          privacyControls: toggleValue(c.privacyControls, control),
                        }))
                      }
                    >
                      {control}
                    </ChipButton>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 5 && architecture && (
              <div>
                <h3 className="display text-2xl text-white">
                  Simulated system architecture
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-200/80">
                  {architecture.disclaimer}
                </p>
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <ArchBlock title="Recommended deployment" body={architecture.recommendedDeployment} />
                  <ArchList title="Core AI components" items={architecture.coreComponents} />
                  <ArchList title="Proposed integrations" items={architecture.integrations} />
                  <ArchList title="Security controls" items={architecture.securityControls} />
                  <ArchList title="Example user roles" items={architecture.exampleRoles} />
                  <ArchList title="Example workflow" items={architecture.exampleWorkflow} />
                  <ArchList title="Implementation phases" items={architecture.implementationPhases} />
                  <ArchBlock title="Recommended next step" body={architecture.nextStep} />
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-primary px-5 py-3"
                    onClick={() => {
                      setShowContact(true);
                      setSubmitState("idle");
                    }}
                  >
                    Build This System
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-5 py-3"
                    onClick={() => {
                      setShowContact(true);
                      setSubmitState("idle");
                    }}
                  >
                    Request a Technical Consultation
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-5 py-3"
                    onClick={saveLocal}
                  >
                    {savedLocal ? "Saved" : "Save My Configuration"}
                  </button>
                </div>

                {showContact && (
                  <form
                    className="mt-8 space-y-4 border-t border-white/10 pt-8"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitConfiguration("build");
                    }}
                  >
                    <p className="text-sm text-white/50">
                      Share your details and we&apos;ll save this configuration to
                      the RSG team for follow-up.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Name"
                        required
                        value={contact.name}
                        error={fieldErrors.name}
                        onChange={(v) => setContact((c) => ({ ...c, name: v }))}
                      />
                      <Field
                        label="Business name"
                        required
                        value={contact.businessName}
                        error={fieldErrors.businessName}
                        onChange={(v) =>
                          setContact((c) => ({ ...c, businessName: v }))
                        }
                      />
                      <Field
                        label="Email"
                        type="email"
                        required
                        value={contact.email}
                        error={fieldErrors.email}
                        onChange={(v) => setContact((c) => ({ ...c, email: v }))}
                      />
                      <Field
                        label="Phone"
                        required
                        value={contact.phone}
                        error={fieldErrors.phone}
                        onChange={(v) => setContact((c) => ({ ...c, phone: v }))}
                      />
                      <Field
                        label="Industry"
                        value={contact.industry}
                        onChange={(v) =>
                          setContact((c) => ({ ...c, industry: v }))
                        }
                      />
                      <Field
                        label="Number of employees"
                        value={contact.employees}
                        onChange={(v) =>
                          setContact((c) => ({ ...c, employees: v }))
                        }
                      />
                      <Field
                        label="Number of locations"
                        value={contact.locations}
                        onChange={(v) =>
                          setContact((c) => ({ ...c, locations: v }))
                        }
                      />
                      <Field
                        label="Desired timeline"
                        value={contact.timeline}
                        onChange={(v) =>
                          setContact((c) => ({ ...c, timeline: v }))
                        }
                      />
                    </div>
                    <Field
                      label="Current software"
                      value={contact.currentSoftware}
                      onChange={(v) =>
                        setContact((c) => ({ ...c, currentSoftware: v }))
                      }
                    />
                    <Field
                      label="Privacy concerns"
                      multiline
                      value={contact.privacyConcerns}
                      onChange={(v) =>
                        setContact((c) => ({ ...c, privacyConcerns: v }))
                      }
                    />
                    <Field
                      label="Additional notes"
                      multiline
                      value={contact.notes}
                      onChange={(v) => setContact((c) => ({ ...c, notes: v }))}
                    />
                    {/* honeypot */}
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      className="hidden"
                      aria-hidden
                      value={contact.company_site}
                      onChange={(e) =>
                        setContact((c) => ({
                          ...c,
                          company_site: e.target.value,
                        }))
                      }
                    />

                    {error ? (
                      <p className="text-sm text-red-300" role="alert">
                        {error}
                      </p>
                    ) : null}
                    {submitState === "success" ? (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                        Configuration received. An RSG strategist will follow up.
                        You can also{" "}
                        <Link
                          href="/book?service=custom-private-ai"
                          className="underline"
                        >
                          book a consultation
                        </Link>{" "}
                        now.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={saving}
                          className="btn-primary px-5 py-3 disabled:opacity-50"
                        >
                          {saving ? "Submitting…" : "Submit configuration"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="btn-ghost px-5 py-3 disabled:opacity-50"
                          onClick={() => void submitConfiguration("consult")}
                        >
                          Request consultation
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {step < 5 && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn-ghost px-5 py-3 disabled:opacity-40"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </button>
                {step < 4 ? (
                  <button
                    type="button"
                    className="btn-primary px-5 py-3 disabled:opacity-40"
                    disabled={!canNext}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary px-5 py-3 disabled:opacity-40"
                    disabled={!canNext}
                    onClick={generateArchitecture}
                  >
                    Generate architecture
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4">
      <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>
    </div>
  );
}

function ArchList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4">
      <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-white/65">
            <span className="mr-2 text-crimson-light">—</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  multiline,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  type?: string;
  error?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const cls =
    "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-crimson/40";
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/45">
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          required={required}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  );
}
