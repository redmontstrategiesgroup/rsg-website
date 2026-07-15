"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { postJson, patchJson } from "@/lib/api";
import { Turnstile } from "@/components/Turnstile";
import Link from "next/link";

type Service = { id: string; name: string; slug: string; description?: string };
type ApptType = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  durationMinutes: number;
  meetingFormats: string[];
  color: string;
};
type Question = {
  id: string;
  key: string;
  label: string;
  helpText?: string;
  type: string;
  options: string[];
  required: boolean;
  sortOrder: number;
  showWhen?: { parent_key?: string; equals?: string | string[] } | null;
};

type Config = {
  services: Service[];
  appointmentTypes: ApptType[];
  questions: Question[];
  bookingsPaused: boolean;
  options: {
    employeeCount: string[];
    monthlyRevenue: string[];
    heardAbout: string[];
    meetingFormats: Record<string, string>;
  };
  turnstileSiteKey: string | null;
};

type Contact = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  businessLocation: string;
  employeeCount: string;
  monthlyRevenueRange: string;
  heardAbout: string;
};

type Step = "service" | "info" | "qualify" | "calendar" | "confirm";

const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Service" },
  { id: "info", label: "About you" },
  { id: "qualify", label: "Eligibility" },
  { id: "calendar", label: "Schedule" },
  { id: "confirm", label: "Confirm" },
];

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `+${d.slice(0, 1)} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
}

function fieldClass(error?: boolean) {
  return `w-full border bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-crimson/60 ${
    error ? "border-crimson/70" : "border-white/15"
  }`;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function attributionFromPage() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    pageUrl: window.location.href,
    referrer: document.referrer || "",
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    utmContent: params.get("utm_content") || undefined,
    utmTerm: params.get("utm_term") || undefined,
    landingPage: window.location.pathname,
    deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
  };
}

export function BookingFunnel({
  presetServiceSlug,
  presetAppointmentSlug,
  initialSessionToken,
}: {
  presetServiceSlug?: string;
  presetAppointmentSlug?: string;
  initialSessionToken?: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sessionToken, setSessionToken] = useState(initialSessionToken || "");
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [appointmentTypeId, setAppointmentTypeId] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({
    firstName: "",
    lastName: "",
    businessName: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    businessLocation: "",
    employeeCount: "",
    monthlyRevenueRange: "",
    heardAbout: "",
  });
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcomeMessage, setOutcomeMessage] = useState("");
  const [allowCalendar, setAllowCalendar] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(detectTimezone);
  const [slots, setSlots] = useState<{ start: string; end: string; label: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [meetingFormat, setMeetingFormat] = useState("phone");
  const [visitorNotes, setVisitorNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/booking/config")
      .then(async (r) => {
        if (!r.ok) throw new Error("config");
        return r.json();
      })
      .then((data: Config) => {
        setConfig(data);
        if (presetServiceSlug) {
          const svc = data.services.find((s) => s.slug === presetServiceSlug);
          if (svc) setServiceId(svc.id);
        }
        if (presetAppointmentSlug) {
          const t = data.appointmentTypes.find(
            (a) => a.slug === presetAppointmentSlug
          );
          if (t) {
            setAppointmentTypeId(t.id);
            if (t.meetingFormats?.[0]) setMeetingFormat(t.meetingFormats[0]);
          }
        }
      })
      .catch(() =>
        setLoadError(
          "Scheduling is temporarily unavailable. Please try again shortly or email contact@redmontstrategiesgroup.com."
        )
      );
  }, [presetServiceSlug, presetAppointmentSlug]);

  useEffect(() => {
    if (!initialSessionToken) return;
    fetch(`/api/booking/session?token=${encodeURIComponent(initialSessionToken)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSessionToken(data.token);
        if (data.serviceId) setServiceId(data.serviceId);
        if (data.appointmentTypeId) setAppointmentTypeId(data.appointmentTypeId);
        if (data.contact) setContact((c) => ({ ...c, ...data.contact }));
        if (data.answers) setAnswers(data.answers);
        if (data.timezone) setTimezone(data.timezone);
        if (data.qualificationOutcome === "qualified" || data.allowCalendar) {
          setAllowCalendar(true);
          setOutcome(data.qualificationOutcome);
          setStep("calendar");
        }
      })
      .catch(() => {});
  }, [initialSessionToken]);

  const ensureSession = useCallback(async () => {
    if (sessionToken) return sessionToken;
    if (config?.turnstileSiteKey && !turnstileToken) {
      throw new Error("Please complete the security check.");
    }
    const res = await postJson("/api/booking/session", {
      turnstileToken,
      timezone,
      serviceId: serviceId || undefined,
      appointmentTypeId: appointmentTypeId || undefined,
      attribution: attributionFromPage(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to start session");
    setSessionToken(data.token);
    return data.token as string;
  }, [
    sessionToken,
    config?.turnstileSiteKey,
    turnstileToken,
    timezone,
    serviceId,
    appointmentTypeId,
  ]);

  const autosave = useCallback(
    async (patch: Record<string, unknown>) => {
      const token = sessionToken || (await ensureSession().catch(() => ""));
      if (!token) return;
      await patchJson("/api/booking/session", { token, ...patch });
    },
    [sessionToken, ensureSession]
  );

  const visibleQuestions = useMemo(() => {
    if (!config) return [];
    return config.questions
      .filter((q) => {
        if (!q.showWhen?.parent_key) return true;
        const parentVal = String(answers[q.showWhen.parent_key] ?? "");
        if (q.showWhen.equals == null) return Boolean(parentVal);
        if (Array.isArray(q.showWhen.equals))
          return q.showWhen.equals.map(String).includes(parentVal);
        return parentVal === String(q.showWhen.equals);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [config, answers]);

  const selectedType = config?.appointmentTypes.find(
    (t) => t.id === appointmentTypeId
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, { start: string; end: string; label: string }[]>();
    for (const s of slots) {
      const day = s.start.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return map;
  }, [slots]);

  async function loadSlots(typeId: string, tz: string) {
    const token = sessionToken || (await ensureSession());
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 28);
    const to = toDate.toISOString().slice(0, 10);
    const res = await fetch(
      `/api/booking/slots?token=${encodeURIComponent(token)}&appointmentTypeId=${typeId}&from=${from}&to=${to}&timezone=${encodeURIComponent(tz)}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to load times");
    setSlots(data.slots || []);
    const days = Object.keys(
      (data.slots || []).reduce(
        (acc: Record<string, boolean>, s: { start: string }) => {
          acc[s.start.slice(0, 10)] = true;
          return acc;
        },
        {}
      )
    ).sort();
    if (days[0]) setSelectedDay(days[0]);
  }

  function validateInfo(): boolean {
    const next: Record<string, string> = {};
    if (!contact.firstName.trim()) next.firstName = "Required";
    if (!contact.lastName.trim()) next.lastName = "Required";
    if (!contact.businessName.trim()) next.businessName = "Required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
      next.email = "Valid email required";
    if (contact.phone.replace(/\D/g, "").length < 10)
      next.phone = "Valid phone required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function goNext() {
    setBusy(true);
    setLoadError("");
    try {
      if (step === "service") {
        if (!serviceId) {
          setErrors({ service: "Select a service to continue." });
          return;
        }
        await ensureSession();
        await autosave({ step: "info", serviceId });
        setStep("info");
      } else if (step === "info") {
        if (!validateInfo()) return;
        await autosave({ step: "qualify", contact });
        setStep("qualify");
      } else if (step === "qualify") {
        const missing = visibleQuestions.filter(
          (q) =>
            q.required &&
            (answers[q.key] == null ||
              answers[q.key] === "" ||
              (Array.isArray(answers[q.key]) &&
                (answers[q.key] as unknown[]).length === 0))
        );
        if (missing.length) {
          setErrors(
            Object.fromEntries(missing.map((m) => [m.key, "Required"]))
          );
          return;
        }
        if (!consent) {
          setErrors({ consent: "Please accept to continue." });
          return;
        }
        const token = await ensureSession();
        const res = await postJson("/api/booking/qualify", {
          sessionToken: token,
          contact,
          answers,
          consent,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to evaluate");
        setOutcome(data.outcome);
        setOutcomeMessage(data.message);
        setAllowCalendar(data.allowCalendar);
        if (data.outcome === "not_eligible") {
          router.push("/booking/not-eligible");
          return;
        }
        if (data.outcome === "manual_review" && !data.allowCalendar) {
          router.push("/booking/review");
          return;
        }
        if (!appointmentTypeId && config?.appointmentTypes[1]) {
          setAppointmentTypeId(config.appointmentTypes[1].id);
        }
        setStep("calendar");
        const typeId =
          appointmentTypeId || config?.appointmentTypes[1]?.id || "";
        if (typeId) await loadSlots(typeId, timezone);
      } else if (step === "calendar") {
        if (!appointmentTypeId || !selectedSlot || !meetingFormat) {
          setErrors({ calendar: "Select an appointment type, time, and format." });
          return;
        }
        setStep("confirm");
      } else if (step === "confirm") {
        const token = await ensureSession();
        const idempotencyKey =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`;
        const res = await postJson("/api/booking/create", {
          sessionToken: token,
          appointmentTypeId,
          startsAt: selectedSlot,
          meetingFormat,
          visitorTimezone: timezone,
          visitorNotes,
          idempotencyKey,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === "conflict") {
            setStep("calendar");
            if (appointmentTypeId) await loadSlots(appointmentTypeId, timezone);
          }
          throw new Error(data.error || "Unable to book");
        }
        router.push(data.confirmedUrl || `/booking/confirmed?token=${data.manageToken}`);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    const order: Step[] = ["service", "info", "qualify", "calendar", "confirm"];
    const idx = order.indexOf(step);
    if (idx > 0) {
      if (step === "calendar" && outcome && !allowCalendar) return;
      setStep(order[idx - 1]);
    }
  }

  if (loadError && !config) {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-crimson" />
        <p className="text-white/70">{loadError}</p>
        <Link href="/connect" className="link-underline mt-6 inline-block">
          Reach us another way
        </Link>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-24 text-white/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (config.bookingsPaused) {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-lg text-white">
          Online booking is temporarily paused.
        </p>
        <p className="mt-3 text-sm text-white/55">
          Please email{" "}
          <a
            className="text-crimson-light underline"
            href="mailto:contact@redmontstrategiesgroup.com"
          >
            contact@redmontstrategiesgroup.com
          </a>
        </p>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <div className="mb-10 flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center text-[0.65rem] font-medium ${
                i < stepIndex
                  ? "bg-crimson text-white"
                  : i === stepIndex
                    ? "border border-crimson text-white"
                    : "border border-white/15 text-white/35"
              }`}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`hidden text-[0.68rem] uppercase tracking-[0.18em] sm:inline ${
                i === stepIndex ? "text-white/70" : "text-white/30"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-1 hidden h-px w-6 bg-white/10 sm:block" />
            )}
          </div>
        ))}
      </div>

      {!sessionToken && config.turnstileSiteKey && (
        <div className="mb-8">
          <Turnstile
            siteKey={config.turnstileSiteKey}
            onToken={setTurnstileToken}
          />
        </div>
      )}

      {loadError && (
        <div className="mb-6 border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson-light">
          {loadError}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
        >
          {step === "service" && (
            <section>
              <h2 className="display text-2xl sm:text-3xl">
                What are you interested in?
              </h2>
              <p className="mt-3 max-w-xl text-sm text-white/55">
                Select the primary focus for your consultation. You can refine
                details in the next steps.
              </p>
              <div className="mt-8 grid gap-3">
                {config.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setErrors({});
                    }}
                    className={`border px-5 py-4 text-left transition ${
                      serviceId === s.id
                        ? "border-crimson/70 bg-crimson/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <div className="text-sm font-medium text-white">{s.name}</div>
                    {s.description && (
                      <div className="mt-1 text-xs text-white/45">
                        {s.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {errors.service && (
                <p className="mt-3 text-sm text-crimson-light">{errors.service}</p>
              )}
            </section>
          )}

          {step === "info" && (
            <section>
              <h2 className="display text-2xl sm:text-3xl">About you</h2>
              <p className="mt-3 text-sm text-white/55">
                Tell us how to reach you and a little about the business.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["businessName", "Business name"],
                    ["email", "Work email"],
                    ["phone", "Phone"],
                    ["website", "Website"],
                    ["industry", "Industry"],
                    ["businessLocation", "Business location"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="mb-2 block text-white/50">{label}</span>
                    <input
                      className={fieldClass(Boolean(errors[key]))}
                      value={contact[key]}
                      onChange={(e) => {
                        const v =
                          key === "phone"
                            ? formatPhone(e.target.value)
                            : e.target.value;
                        setContact((c) => ({ ...c, [key]: v }));
                      }}
                      onBlur={() =>
                        autosave({ contact }).catch(() => {})
                      }
                      type={key === "email" ? "email" : "text"}
                      autoComplete={
                        key === "email"
                          ? "email"
                          : key === "phone"
                            ? "tel"
                            : "organization"
                      }
                    />
                    {errors[key] && (
                      <span className="mt-1 block text-xs text-crimson-light">
                        {errors[key]}
                      </span>
                    )}
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="mb-2 block text-white/50">Employees</span>
                  <select
                    className={fieldClass()}
                    value={contact.employeeCount}
                    onChange={(e) =>
                      setContact((c) => ({
                        ...c,
                        employeeCount: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {config.options.employeeCount.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block text-white/50">
                    Estimated monthly revenue
                  </span>
                  <select
                    className={fieldClass()}
                    value={contact.monthlyRevenueRange}
                    onChange={(e) =>
                      setContact((c) => ({
                        ...c,
                        monthlyRevenueRange: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {config.options.monthlyRevenue.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-2 block text-white/50">
                    How did you hear about us?
                  </span>
                  <select
                    className={fieldClass()}
                    value={contact.heardAbout}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, heardAbout: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    {config.options.heardAbout.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {step === "qualify" && (
            <section>
              <h2 className="display text-2xl sm:text-3xl">
                Eligibility &amp; qualification
              </h2>
              <p className="mt-3 text-sm text-white/55">
                These questions help us determine whether a strategy consultation
                is the right next step.
              </p>
              <div className="mt-8 space-y-6">
                {visibleQuestions.map((q) => (
                  <label key={q.id} className="block text-sm">
                    <span className="mb-2 block text-white/70">
                      {q.label}
                      {q.required && (
                        <span className="text-crimson-light"> *</span>
                      )}
                    </span>
                    {q.helpText && (
                      <span className="mb-2 block text-xs text-white/40">
                        {q.helpText}
                      </span>
                    )}
                    {q.type === "long_text" ? (
                      <textarea
                        className={`${fieldClass(Boolean(errors[q.key]))} min-h-[100px]`}
                        value={String(answers[q.key] ?? "")}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [q.key]: e.target.value }))
                        }
                      />
                    ) : q.type === "yes_no" ||
                      q.type === "dropdown" ||
                      q.type === "multiple_choice" ? (
                      <select
                        className={fieldClass(Boolean(errors[q.key]))}
                        value={String(answers[q.key] ?? "")}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [q.key]: e.target.value }))
                        }
                      >
                        <option value="">Select</option>
                        {(q.options.length
                          ? q.options
                          : q.type === "yes_no"
                            ? ["Yes", "No"]
                            : []
                        ).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : q.type === "checkboxes" ? (
                      <div className="space-y-2">
                        {q.options.map((o) => {
                          const arr = Array.isArray(answers[q.key])
                            ? (answers[q.key] as string[])
                            : [];
                          return (
                            <label
                              key={o}
                              className="flex items-center gap-3 text-white/70"
                            >
                              <input
                                type="checkbox"
                                checked={arr.includes(o)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...arr, o]
                                    : arr.filter((x) => x !== o);
                                  setAnswers((a) => ({ ...a, [q.key]: next }));
                                }}
                              />
                              {o}
                            </label>
                          );
                        })}
                      </div>
                    ) : q.type === "rating" ? (
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              setAnswers((a) => ({ ...a, [q.key]: n }))
                            }
                            className={`h-10 w-10 border text-sm ${
                              answers[q.key] === n
                                ? "border-crimson bg-crimson/20"
                                : "border-white/15"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        className={fieldClass(Boolean(errors[q.key]))}
                        type={
                          q.type === "number" || q.type === "currency"
                            ? "number"
                            : q.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={String(answers[q.key] ?? "")}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            [q.key]:
                              q.type === "number" || q.type === "currency"
                                ? Number(e.target.value)
                                : e.target.value,
                          }))
                        }
                      />
                    )}
                    {errors[q.key] && (
                      <span className="mt-1 block text-xs text-crimson-light">
                        {errors[q.key]}
                      </span>
                    )}
                  </label>
                ))}
                <label className="flex items-start gap-3 text-sm text-white/60">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/privacy" className="underline">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/terms" className="underline">
                      Terms
                    </Link>
                    , and consent to Redmont Strategies Group contacting me about
                    this request.
                  </span>
                </label>
                {errors.consent && (
                  <p className="text-sm text-crimson-light">{errors.consent}</p>
                )}
              </div>
            </section>
          )}

          {step === "calendar" && (
            <section>
              <h2 className="display text-2xl sm:text-3xl">
                Select a time
              </h2>
              {outcomeMessage && (
                <p className="mt-3 text-sm text-white/60">{outcomeMessage}</p>
              )}

              <div className="mt-8 space-y-6">
                <div>
                  <p className="label mb-3">Appointment type</p>
                  <div className="grid gap-2">
                    {config.appointmentTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={async () => {
                          setAppointmentTypeId(t.id);
                          setSelectedSlot(null);
                          setMeetingFormat(t.meetingFormats[0] || "phone");
                          setBusy(true);
                          try {
                            await loadSlots(t.id, timezone);
                          } catch (e) {
                            setLoadError(
                              e instanceof Error ? e.message : "Failed to load"
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className={`border px-4 py-3 text-left text-sm ${
                          appointmentTypeId === t.id
                            ? "border-crimson/70 bg-crimson/10"
                            : "border-white/10"
                        }`}
                      >
                        <span className="font-medium text-white">{t.name}</span>
                        <span className="ml-2 text-white/40">
                          {t.durationMinutes} min
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm">
                  <span className="mb-2 flex items-center gap-2 text-white/50">
                    <Clock className="h-3.5 w-3.5" /> Time zone
                  </span>
                  <input
                    className={fieldClass()}
                    value={timezone}
                    onChange={async (e) => {
                      setTimezone(e.target.value);
                      if (appointmentTypeId) {
                        try {
                          await loadSlots(appointmentTypeId, e.target.value);
                        } catch {
                          /* ignore */
                        }
                      }
                    }}
                  />
                </label>

                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="label">
                        <Calendar className="mr-2 inline h-3.5 w-3.5" />
                        {monthCursor.toLocaleString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="border border-white/15 px-2 py-1 text-xs"
                          onClick={() =>
                            setMonthCursor(
                              new Date(
                                monthCursor.getFullYear(),
                                monthCursor.getMonth() - 1,
                                1
                              )
                            )
                          }
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          className="border border-white/15 px-2 py-1 text-xs"
                          onClick={() =>
                            setMonthCursor(
                              new Date(
                                monthCursor.getFullYear(),
                                monthCursor.getMonth() + 1,
                                1
                              )
                            )
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] text-white/35">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                      {Array.from({ length: monthCursor.getDay() }).map(
                        (_, i) => (
                          <div key={`e-${i}`} />
                        )
                      )}
                      {Array.from({
                        length: new Date(
                          monthCursor.getFullYear(),
                          monthCursor.getMonth() + 1,
                          0
                        ).getDate(),
                      }).map((_, i) => {
                        const day = i + 1;
                        const iso = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const has = slotsByDay.has(iso);
                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={!has}
                            onClick={() => {
                              setSelectedDay(iso);
                              setSelectedSlot(null);
                            }}
                            className={`aspect-square text-sm ${
                              selectedDay === iso
                                ? "bg-crimson text-white"
                                : has
                                  ? "bg-white/5 text-white hover:bg-white/10"
                                  : "text-white/20"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="label mb-3">Available times</p>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {(slotsByDay.get(selectedDay) || []).map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelectedSlot(s.start)}
                          className={`block w-full border px-3 py-2 text-left text-sm ${
                            selectedSlot === s.start
                              ? "border-crimson/70 bg-crimson/10"
                              : "border-white/10"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                      {selectedDay &&
                        !(slotsByDay.get(selectedDay) || []).length && (
                          <p className="text-sm text-white/40">
                            No times on this day.
                          </p>
                        )}
                      {!selectedDay && (
                        <p className="text-sm text-white/40">
                          Select a highlighted day.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {selectedType && (
                  <div>
                    <p className="label mb-3">Meeting format</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedType.meetingFormats.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setMeetingFormat(f)}
                          className={`border px-3 py-2 text-xs ${
                            meetingFormat === f
                              ? "border-crimson/70 bg-crimson/10"
                              : "border-white/10"
                          }`}
                        >
                          {config.options.meetingFormats[f] || f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {errors.calendar && (
                  <p className="text-sm text-crimson-light">{errors.calendar}</p>
                )}
              </div>
            </section>
          )}

          {step === "confirm" && (
            <section>
              <h2 className="display text-2xl sm:text-3xl">Confirm booking</h2>
              <p className="mt-3 text-sm text-white/55">
                Review your details before confirming.
              </p>
              <div className="mt-8 space-y-4 border border-white/10 bg-white/[0.02] p-6 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Name</span>
                  <span>
                    {contact.firstName} {contact.lastName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Business</span>
                  <span>{contact.businessName}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Appointment</span>
                  <span>{selectedType?.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Time</span>
                  <span>
                    {selectedSlot
                      ? new Date(selectedSlot).toLocaleString(undefined, {
                          timeZone: timezone,
                          dateStyle: "full",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Format</span>
                  <span>
                    {config.options.meetingFormats[meetingFormat] ||
                      meetingFormat}
                  </span>
                </div>
              </div>
              <label className="mt-6 block text-sm">
                <span className="mb-2 block text-white/50">
                  Notes for the strategist (optional)
                </span>
                <textarea
                  className={`${fieldClass()} min-h-[80px]`}
                  value={visitorNotes}
                  onChange={(e) => setVisitorNotes(e.target.value)}
                />
              </label>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === "service" || busy}
          className="btn-ghost px-5 py-3 text-sm disabled:opacity-30"
        >
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={busy}
          className="btn-primary px-6 py-3 text-sm"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step === "confirm" ? (
            "Confirm appointment"
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 inline h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
