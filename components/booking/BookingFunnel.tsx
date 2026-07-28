"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { postJson, patchJson, getCsrfToken } from "@/lib/api";
import { Turnstile } from "@/components/Turnstile";
import { trackEvent } from "@/lib/events";
import {
  ProgressSteps,
  OptionCard,
  Field,
  ChoiceChips,
  Expandable,
  TimezoneSelect,
  inputClass,
  timezoneLabel,
} from "./ui";

type Service = { id: string; name: string; slug: string; description?: string };
type ApptType = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  durationMinutes: number;
  meetingFormats: string[];
};
type Config = {
  services: Service[];
  appointmentTypes: ApptType[];
  bookingsPaused: boolean;
  options: {
    employeeCount: string[];
    meetingFormats: Record<string, string>;
  };
  turnstileSiteKey: string | null;
};

type Slot = { start: string; end: string; label: string };

type Contact = {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  industry: string;
  website: string;
  preferredContact: "email" | "phone" | "text";
};

type ServicePlanAnswers = {
  hasMaintainer?: "yes" | "no" | "partially";
  ongoingNeeds?: "maintenance_only" | "occasional_changes" | "ongoing_improvements";
  automationInterest?: "yes" | "maybe" | "no";
  aiManagement?: "yes" | "planning_to" | "no";
  sensitiveData?: "yes" | "no" | "unsure";
  supportSpeed?: "same_day" | "next_day" | "within_days";
  billingPreference?: "monthly" | "annual" | "undecided";
};

type Answers = {
  problem: string;
  result: string;
  business_size: string;
  current_challenge: string;
  interested_services: string[];
  current_tools: string;
  private_ai_focus: string[];
  servicePlan: ServicePlanAnswers;
};

const EMPTY_CONTACT: Contact = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  industry: "",
  website: "",
  preferredContact: "email",
};

const EMPTY_ANSWERS: Answers = {
  problem: "",
  result: "",
  business_size: "",
  current_challenge: "",
  interested_services: [],
  current_tools: "",
  private_ai_focus: [],
  servicePlan: {},
};

const SERVICE_PLAN_QUESTIONS: {
  key: keyof ServicePlanAnswers;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "hasMaintainer",
    label: "Do you currently have someone maintaining your website and systems?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "partially", label: "Partially" },
    ],
  },
  {
    key: "ongoingNeeds",
    label: "Do you need ongoing changes or only technical maintenance?",
    options: [
      { value: "maintenance_only", label: "Maintenance only" },
      { value: "occasional_changes", label: "Occasional changes" },
      { value: "ongoing_improvements", label: "Ongoing improvements" },
    ],
  },
  {
    key: "automationInterest",
    label: "Are you interested in ongoing automation development?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "maybe", label: "Maybe" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "aiManagement",
    label: "Do you use AI systems that require management?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "planning_to", label: "Planning to" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "sensitiveData",
    label: "Do you handle confidential or sensitive business data?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  {
    key: "supportSpeed",
    label: "How quickly do you require support?",
    options: [
      { value: "same_day", label: "Same day" },
      { value: "next_day", label: "Next business day" },
      { value: "within_days", label: "Within a few days" },
    ],
  },
  {
    key: "billingPreference",
    label: "Would you prefer monthly or annual billing?",
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "annual", label: "Annual" },
      { value: "undecided", label: "Undecided" },
    ],
  },
];

const RESULT_OPTIONS = [
  "Generate more revenue",
  "Get more qualified leads",
  "Save time",
  "Improve customer experience",
  "Improve organization",
  "Reduce manual work",
  "Understand where AI could help",
  "Design a custom private AI system",
  "Not sure yet",
];

const PRIVATE_AI_FOCUS_OPTIONS = [
  "I need a fully private AI system",
  "I want AI running locally",
  "I need an internal company assistant",
  "I need secure document search",
  "I need to automate private workflows",
  "I am concerned about sending data to public AI",
  "I am not sure which system I need",
];

const PRIVATE_AI_SERVICE_SLUGS = new Set(["custom-private-ai", "explore-ai"]);

const STEP_LABELS = ["Topic", "Time", "Your details"];

const STORAGE_KEY = "rsg_booking_v2";
const NOT_SURE_SLUG = "not-sure";
const CONTACT_METHODS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "text", label: "Text message" },
] as const;

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `+${d.slice(0, 1)} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
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

/** Local calendar date (YYYY-MM-DD) of a UTC instant in the given zone. */
function localDayKey(isoUtc: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(isoUtc));
  } catch {
    return isoUtc.slice(0, 10);
  }
}

function dayLabel(dayKey: string, isoUtc: string, timeZone: string) {
  try {
    const d = new Date(isoUtc);
    return {
      weekday: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d),
      date: new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(d),
    };
  } catch {
    return { weekday: "", date: dayKey };
  }
}

function formatSelectedSlot(isoUtc: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(isoUtc));
  } catch {
    return new Date(isoUtc).toLocaleString();
  }
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
  const [fatalError, setFatalError] = useState("");
  const [formError, setFormError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(detectTimezone);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [meetingFormat, setMeetingFormat] = useState("phone");
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const sessionTokenRef = useRef(initialSessionToken || "");
  const [hasSession, setHasSession] = useState(Boolean(initialSessionToken));
  const idempotencyKeyRef = useRef<string>("");
  const submittingRef = useRef(false);
  const completedRef = useRef(false);
  const formStartedRef = useRef(false);
  const restoredRef = useRef(false);

  // ---------------------------------------------------------------- tracking

  const track = useCallback(
    (
      event: string,
      meta?: { category?: string; step?: string; field?: string }
    ) => {
      try {
        void postJson("/api/booking/track", {
          token: sessionTokenRef.current || undefined,
          event,
          meta,
        });
      } catch {
        /* analytics never blocks the visitor */
      }
    },
    []
  );

  // ------------------------------------------------------------------ config

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
          if (svc) setServiceId((prev) => prev ?? svc.id);
        }
      })
      .catch(() =>
        setFatalError(
          "Scheduling is temporarily unavailable. Please try again shortly or email contact@redmontstrategiesgroup.com."
        )
      );
    track("booking_page_viewed");
    trackEvent("booking_page_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The single public appointment type (preset slug wins when present).
  const appointmentType = useMemo(() => {
    if (!config) return null;
    if (presetAppointmentSlug) {
      const preset = config.appointmentTypes.find(
        (t) => t.slug === presetAppointmentSlug
      );
      if (preset) return preset;
    }
    return config.appointmentTypes[0] ?? null;
  }, [config, presetAppointmentSlug]);

  useEffect(() => {
    if (appointmentType && !appointmentType.meetingFormats.includes(meetingFormat)) {
      setMeetingFormat(appointmentType.meetingFormats[0] || "phone");
    }
  }, [appointmentType, meetingFormat]);

  // ------------------------------------------------- restore saved progress

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{
        token: string;
        step: 1 | 2 | 3;
        serviceId: string;
        timezone: string;
        selectedDay: string;
        selectedSlot: string;
        contact: Contact;
        answers: Answers;
        notes: string;
      }>;
      if (saved.token && !sessionTokenRef.current) {
        sessionTokenRef.current = saved.token;
        setHasSession(true);
      }
      if (saved.serviceId) setServiceId((prev) => prev ?? saved.serviceId!);
      if (saved.timezone) setTimezone(saved.timezone);
      if (saved.selectedDay) setSelectedDay(saved.selectedDay);
      if (saved.selectedSlot) setSelectedSlot(saved.selectedSlot);
      if (saved.contact) setContact({ ...EMPTY_CONTACT, ...saved.contact });
      if (saved.answers) setAnswers({ ...EMPTY_ANSWERS, ...saved.answers });
      if (saved.notes) setNotes(saved.notes);
      if (saved.step && saved.serviceId) setStep(saved.step);
    } catch {
      /* corrupted storage — start fresh */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: sessionTokenRef.current,
          step,
          serviceId,
          timezone,
          selectedDay,
          selectedSlot,
          contact,
          answers,
          notes,
        })
      );
    } catch {
      /* storage unavailable */
    }
  }, [step, serviceId, timezone, selectedDay, selectedSlot, contact, answers, notes]);

  // Legacy resume links (?session=...) restore server-side progress.
  useEffect(() => {
    if (!initialSessionToken) return;
    fetch(`/api/booking/session?token=${encodeURIComponent(initialSessionToken)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        sessionTokenRef.current = data.token;
        setHasSession(true);
        if (data.serviceId) setServiceId(data.serviceId);
        if (data.timezone) setTimezone(data.timezone);
      })
      .catch(() => {});
  }, [initialSessionToken]);

  // Best-effort abandonment signal (keepalive request survives navigation).
  useEffect(() => {
    const onPageHide = () => {
      if (completedRef.current || !sessionTokenRef.current) return;
      if (!formStartedRef.current && step === 1) return;
      try {
        void fetch("/api/booking/track", {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          body: JSON.stringify({
            token: sessionTokenRef.current,
            event: "booking_abandoned",
            meta: { step: String(step) },
          }),
        });
      } catch {
        /* best effort */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [step]);

  // ----------------------------------------------------------------- session

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    if (config?.turnstileSiteKey && !turnstileToken) {
      throw new Error("Please complete the security check above.");
    }
    const res = await postJson("/api/booking/session", {
      turnstileToken,
      timezone,
      serviceId: serviceId || undefined,
      appointmentTypeId: appointmentType?.id,
      attribution: attributionFromPage(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to start your booking.");
    sessionTokenRef.current = data.token;
    setHasSession(true);
    return data.token as string;
  }, [config?.turnstileSiteKey, turnstileToken, timezone, serviceId, appointmentType?.id]);

  const autosave = useCallback(async (patch: Record<string, unknown>) => {
    const token = sessionTokenRef.current;
    if (!token) return;
    await patchJson("/api/booking/session", { token, ...patch }).catch(() => {});
  }, []);

  // ------------------------------------------------------------------- slots

  const loadSlots = useCallback(
    async (tz: string) => {
      if (!appointmentType) return;
      setSlotsLoading(true);
      setFormError("");
      try {
        const token = await ensureSession();
        const from = new Date().toISOString().slice(0, 10);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 28);
        const to = toDate.toISOString().slice(0, 10);
        const res = await fetch(
          `/api/booking/slots?token=${encodeURIComponent(token)}&appointmentTypeId=${appointmentType.id}&from=${from}&to=${to}&timezone=${encodeURIComponent(tz)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load available times.");
        setSlots(data.slots || []);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Unable to load available times."
        );
      } finally {
        setSlotsLoading(false);
      }
    },
    [appointmentType, ensureSession]
  );

  // Load availability whenever step 2 is shown for a type/timezone we haven't
  // fetched yet (covers page-refresh restores, not just the step transition).
  const slotsFetchedForRef = useRef("");
  useEffect(() => {
    if (step !== 2 || !config || !appointmentType) return;
    const key = `${appointmentType.id}:${timezone}`;
    if (slotsFetchedForRef.current === key) return;
    slotsFetchedForRef.current = key;
    void loadSlots(timezone);
  }, [step, config, appointmentType, timezone, loadSlots]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const day = localDayKey(s.start, timezone);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return map;
  }, [slots, timezone]);

  const availableDays = useMemo(() => [...slotsByDay.keys()].sort(), [slotsByDay]);

  useEffect(() => {
    if (step !== 2) return;
    if (availableDays.length === 0) return;
    if (!selectedDay || !slotsByDay.has(selectedDay)) {
      setSelectedDay(availableDays[0]);
    }
  }, [step, availableDays, selectedDay, slotsByDay]);

  const selectedService = config?.services.find((s) => s.id === serviceId) ?? null;
  const notSureSelected = selectedService?.slug === NOT_SURE_SLUG;

  // ------------------------------------------------------------- transitions

  async function continueFromCategory() {
    if (!serviceId || !config) {
      setErrors({ service: "Choose the option closest to what you need — “I’m not sure yet” is fine." });
      track("validation_error", { step: "1" });
      return;
    }
    setBusy(true);
    setFormError("");
    setErrors({});
    try {
      await ensureSession();
      await autosave({ step: "schedule", serviceId, timezone });
      const svc = config.services.find((s) => s.id === serviceId);
      track("help_category_selected", { category: svc?.slug });
      if (svc?.slug === NOT_SURE_SLUG) track("not_sure_selected");
      trackEvent("booking_category_select", { category: svc?.slug ?? "" });
      setStep(2);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function continueFromSchedule() {
    if (!selectedSlot) {
      setErrors({ slot: "Choose a day and time to continue." });
      track("validation_error", { step: "2" });
      return;
    }
    setErrors({});
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void autosave({ step: "details", timezone, meetingFormat });
    setStep(3);
    window.scrollTo({ top: 0 });
  }

  function validateDetails(): boolean {
    const next: Record<string, string> = {};
    if (contact.fullName.trim().length < 2) next.fullName = "Please enter your name.";
    if (!contact.businessName.trim()) next.businessName = "Please enter your business name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
      next.email = "Enter a valid email address.";
    if (contact.phone.replace(/\D/g, "").length < 10)
      next.phone = "Enter a valid phone number.";
    if (!consent) next.consent = "Please check this box so we can contact you about your appointment.";
    setErrors(next);
    if (Object.keys(next).length) {
      track("validation_error", { step: "3", field: Object.keys(next)[0] });
    }
    return Object.keys(next).length === 0;
  }

  async function submitBooking() {
    // Ref guard runs synchronously — a double-click can land before React
    // re-renders the disabled state.
    if (submittingRef.current || completedRef.current) return;
    if (!validateDetails()) return;
    if (!appointmentType || !selectedSlot) {
      setStep(2);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setFormError("");
    track("booking_submitted");
    try {
      const token = await ensureSession();
      const res = await postJson("/api/booking/create", {
        sessionToken: token,
        appointmentTypeId: appointmentType.id,
        startsAt: selectedSlot,
        meetingFormat,
        visitorTimezone: timezone,
        visitorNotes: notes || undefined,
        idempotencyKey: idempotencyKeyRef.current || undefined,
        intake: {
          contact,
          answers: {
            ...answers,
            interested_services: answers.interested_services.length
              ? answers.interested_services
              : undefined,
            private_ai_focus: answers.private_ai_focus.length
              ? answers.private_ai_focus
              : undefined,
            servicePlan: Object.values(answers.servicePlan).some(Boolean)
              ? answers.servicePlan
              : undefined,
          },
          consent,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "conflict" || data.code === "time") {
          setSelectedSlot(null);
          setStep(2);
          setFormError(
            "That time was just booked by someone else. Please pick another time — everything else you entered is saved."
          );
          void loadSlots(timezone);
          return;
        }
        if (res.status === 401 || data.code === "session" || data.code === "expired") {
          sessionTokenRef.current = "";
          setHasSession(false);
          setFormError(
            "Your session timed out. Please press “Confirm booking” again to retry."
          );
          return;
        }
        throw new Error(data.error || "Unable to complete your booking.");
      }
      completedRef.current = true;
      track("booking_completed");
      trackEvent("booking_complete");
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      router.push(data.confirmedUrl || `/booking/confirmed?token=${data.manageToken}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Your details are saved — please try again.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  function goBack() {
    setFormError("");
    setErrors({});
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    window.scrollTo({ top: 0 });
  }

  // ---------------------------------------------------------------- render

  if (fatalError && !config) {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-crimson" />
        <p className="text-white/70">{fatalError}</p>
        <Link href="/connect" className="link-underline mt-6 inline-block">
          Reach us another way
        </Link>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-24 text-white/50" role="status" aria-label="Loading booking options">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (config.bookingsPaused) {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-lg text-white">Online booking is temporarily paused.</p>
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

  const daySlots = slotsByDay.get(selectedDay) || [];

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressSteps current={step} labels={STEP_LABELS} />

      {formError && (
        <div
          role="alert"
          className="mt-6 border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson-light"
        >
          {formError}
        </div>
      )}

      {/* ---------------------------------------------- Step 1: category */}
      {step === 1 && (
        <section className="mt-8" aria-labelledby="booking-step1-heading">
          <h2 id="booking-step1-heading" className="display text-2xl sm:text-3xl">
            What would you like help with?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">
            Pick whatever is closest. You don’t need to know the right service —
            that’s our job.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {config.services.map((s) => (
              <OptionCard
                key={s.id}
                selected={serviceId === s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setErrors({});
                }}
                title={s.name}
                description={s.description}
              />
            ))}
          </div>
          {notSureSelected && (
            <p className="mt-4 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/70">
              That’s completely fine. You’ll book a general strategy consultation
              and we’ll help identify the best opportunities for your business.
            </p>
          )}
          {errors.service && (
            <p role="alert" className="mt-4 text-sm text-crimson-light">
              {errors.service}
            </p>
          )}

          {!hasSession && config.turnstileSiteKey && (
            <div className="mt-8">
              <Turnstile siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} />
            </div>
          )}

          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={continueFromCategory}
              disabled={busy}
              className="btn-primary min-h-[52px] w-full px-6 py-3 text-sm sm:w-auto"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- Step 2: time */}
      {step === 2 && (
        <section className="mt-8" aria-labelledby="booking-step2-heading">
          <h2 id="booking-step2-heading" className="display text-2xl sm:text-3xl">
            Choose a time
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            {appointmentType
              ? `${appointmentType.name} — ${appointmentType.durationMinutes} minutes, free.`
              : "Free consultation."}
          </p>

          <div className="mt-8 space-y-7">
            <Field label="Your time zone" hint="Detected automatically — change it if it’s wrong. All times below are shown in this time zone.">
              {(props) => (
                <TimezoneSelect
                  id={props.id}
                  describedBy={props["aria-describedby"]}
                  value={timezone}
                  onChange={(tz) => {
                    setTimezone(tz);
                    setSelectedSlot(null);
                  }}
                />
              )}
            </Field>

            {slotsLoading ? (
              <div className="flex items-center gap-3 py-10 text-white/50" role="status">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading available times…</span>
              </div>
            ) : availableDays.length === 0 ? (
              <div className="border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
                No online times are open in the next four weeks. Email{" "}
                <a className="underline" href="mailto:contact@redmontstrategiesgroup.com">
                  contact@redmontstrategiesgroup.com
                </a>{" "}
                and we’ll find a time that works.
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="h-4 w-4" aria-hidden="true" /> Pick a day
                  </p>
                  <div
                    role="group"
                    aria-label="Available days"
                    className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
                  >
                    {availableDays.map((day) => {
                      const first = slotsByDay.get(day)![0];
                      const { weekday, date } = dayLabel(day, first.start, timezone);
                      const active = selectedDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedDay(day);
                            setSelectedSlot(null);
                            track("date_selected");
                          }}
                          className={`min-w-[76px] shrink-0 border px-3 py-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
                            active
                              ? "border-crimson/70 bg-crimson/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/30"
                          }`}
                        >
                          <span className="block text-[0.65rem] uppercase tracking-wider text-white/45">
                            {weekday}
                          </span>
                          <span className="mt-1 block text-sm font-medium text-white">
                            {date}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm text-white/60">
                    <Clock className="h-4 w-4" aria-hidden="true" /> Available times
                    <span className="text-xs text-white/35">· {timezoneLabel(timezone)}</span>
                  </p>
                  <div
                    role="group"
                    aria-label="Available times"
                    className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                  >
                    {daySlots.map((s) => {
                      const active = selectedSlot === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedSlot(s.start);
                            track("time_selected");
                          }}
                          className={`min-h-[48px] border px-2 py-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
                            active
                              ? "border-crimson bg-crimson text-white"
                              : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  {!daySlots.length && (
                    <p className="mt-2 text-sm text-white/40">
                      No times left on this day — pick another day above.
                    </p>
                  )}
                </div>

                {selectedSlot && (
                  <p className="border border-crimson/30 bg-crimson/[0.06] px-4 py-3 text-sm text-white/80">
                    Selected: <strong>{formatSelectedSlot(selectedSlot, timezone)}</strong>
                  </p>
                )}
              </>
            )}

            {errors.slot && (
              <p role="alert" className="text-sm text-crimson-light">
                {errors.slot}
              </p>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="btn-ghost min-h-[52px] px-5 py-3 text-sm"
            >
              <ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={continueFromSchedule}
              disabled={busy || slotsLoading}
              className="btn-primary min-h-[52px] px-6 py-3 text-sm"
            >
              Continue
              <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* ---------------------------------------------- Step 3: details */}
      {step === 3 && (
        <section className="mt-8" aria-labelledby="booking-step3-heading">
          <h2 id="booking-step3-heading" className="display text-2xl sm:text-3xl">
            Tell us about your business
          </h2>
          {selectedSlot && (
            <p className="mt-4 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
              <Calendar className="mr-2 inline h-4 w-4 text-crimson" aria-hidden="true" />
              {formatSelectedSlot(selectedSlot, timezone)}
              {appointmentType ? ` · ${appointmentType.durationMinutes} min · Free` : ""}
              {" · "}
              <button
                type="button"
                onClick={goBack}
                className="underline decoration-white/30 underline-offset-4 hover:text-white"
              >
                Change time
              </button>
            </p>
          )}

          <form
            className="mt-8 space-y-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submitBooking();
            }}
            onFocusCapture={() => {
              if (!formStartedRef.current) {
                formStartedRef.current = true;
                track("form_started");
              }
            }}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName}>
                {(props) => (
                  <input
                    {...props}
                    className={inputClass(Boolean(errors.fullName))}
                    autoComplete="name"
                    value={contact.fullName}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, fullName: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Business name" error={errors.businessName}>
                {(props) => (
                  <input
                    {...props}
                    className={inputClass(Boolean(errors.businessName))}
                    autoComplete="organization"
                    value={contact.businessName}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, businessName: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Email" error={errors.email}>
                {(props) => (
                  <input
                    {...props}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputClass(Boolean(errors.email))}
                    value={contact.email}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Phone" error={errors.phone}>
                {(props) => (
                  <input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputClass(Boolean(errors.phone))}
                    value={contact.phone}
                    onChange={(e) =>
                      setContact((c) => ({
                        ...c,
                        phone: formatPhone(e.target.value),
                      }))
                    }
                  />
                )}
              </Field>
              <Field label="Business type or industry" optional>
                {(props) => (
                  <input
                    {...props}
                    className={inputClass()}
                    placeholder="e.g. Contractor, retail store, dental office, gym"
                    value={contact.industry}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, industry: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Website" optional>
                {(props) => (
                  <input
                    {...props}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    className={inputClass()}
                    placeholder="yourbusiness.com"
                    value={contact.website}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, website: e.target.value }))
                    }
                  />
                )}
              </Field>
            </div>

            <Field
              label="What would you most like help improving?"
              optional
              hint="A sentence or two is plenty."
            >
              {(props) => (
                <textarea
                  {...props}
                  className={`${inputClass()} min-h-[88px]`}
                  value={answers.problem}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, problem: e.target.value }))
                  }
                />
              )}
            </Field>

            <fieldset>
              <legend className="mb-3 block text-sm text-white/60">
                Preferred contact method
              </legend>
              <div className="flex flex-wrap gap-2">
                {CONTACT_METHODS.map((m) => (
                  <label
                    key={m.value}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 border px-4 py-2.5 text-sm transition ${
                      contact.preferredContact === m.value
                        ? "border-crimson/70 bg-crimson/10 text-white"
                        : "border-white/15 text-white/70 hover:border-white/35"
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferredContact"
                      value={m.value}
                      checked={contact.preferredContact === m.value}
                      onChange={() =>
                        setContact((c) => ({ ...c, preferredContact: m.value }))
                      }
                      className="sr-only"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Expandable label="Add more details (optional)">
              <Field label="What is the biggest result you are trying to achieve?" optional>
                {() => (
                  <ChoiceChips
                    label="Biggest result you are trying to achieve"
                    options={RESULT_OPTIONS}
                    value={answers.result}
                    onChange={(v) =>
                      setAnswers((a) => ({ ...a, result: v as string }))
                    }
                  />
                )}
              </Field>
              <Field label="Approximate business size" optional>
                {() => (
                  <ChoiceChips
                    label="Approximate business size"
                    options={config.options.employeeCount.map((o) => `${o} people`)}
                    value={
                      answers.business_size ? `${answers.business_size} people` : ""
                    }
                    onChange={(v) =>
                      setAnswers((a) => ({
                        ...a,
                        business_size: String(v).replace(/ people$/, ""),
                      }))
                    }
                  />
                )}
              </Field>
              <Field label="What’s the biggest challenge right now?" optional>
                {(props) => (
                  <textarea
                    {...props}
                    className={`${inputClass()} min-h-[72px]`}
                    value={answers.current_challenge}
                    onChange={(e) =>
                      setAnswers((a) => ({
                        ...a,
                        current_challenge: e.target.value,
                      }))
                    }
                  />
                )}
              </Field>
              <Field label="Anything you already know you’re interested in?" optional>
                {() => (
                  <ChoiceChips
                    label="Areas of interest"
                    multi
                    options={config.services
                      .filter((s) => s.slug !== NOT_SURE_SLUG)
                      .map((s) => s.name)}
                    value={answers.interested_services}
                    onChange={(v) =>
                      setAnswers((a) => ({
                        ...a,
                        interested_services: v as string[],
                      }))
                    }
                  />
                )}
              </Field>
              {selectedService &&
              PRIVATE_AI_SERVICE_SLUGS.has(selectedService.slug) ? (
                <Field
                  label="What kind of private AI help are you looking for?"
                  optional
                >
                  {() => (
                    <ChoiceChips
                      label="Private AI focus"
                      multi
                      options={PRIVATE_AI_FOCUS_OPTIONS}
                      value={answers.private_ai_focus}
                      onChange={(v) =>
                        setAnswers((a) => ({
                          ...a,
                          private_ai_focus: v as string[],
                        }))
                      }
                    />
                  )}
                </Field>
              ) : null}
              <Field label="Software or tools you currently use" optional>
                {(props) => (
                  <input
                    {...props}
                    className={inputClass()}
                    placeholder="e.g. QuickBooks, Google Sheets, Jobber"
                    value={answers.current_tools}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, current_tools: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Anything else we should know?" optional>
                {(props) => (
                  <textarea
                    {...props}
                    className={`${inputClass()} min-h-[72px]`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </Field>

              <fieldset className="border-t border-white/10 pt-5">
                <legend className="float-left mb-1 w-full text-sm font-medium text-white/70">
                  Ongoing support &amp; management (optional)
                </legend>
                <p className="mb-5 clear-left text-xs leading-relaxed text-white/40">
                  A few quick questions about what happens after launch, so we
                  can come prepared to discuss ongoing system management.
                </p>
                <div className="space-y-5">
                  {SERVICE_PLAN_QUESTIONS.map((q) => {
                    const current = answers.servicePlan[q.key] ?? "";
                    const currentLabel =
                      q.options.find((o) => o.value === current)?.label ?? "";
                    return (
                      <Field key={q.key} label={q.label} optional>
                        {() => (
                          <ChoiceChips
                            label={q.label}
                            options={q.options.map((o) => o.label)}
                            value={currentLabel}
                            onChange={(v) => {
                              const picked = q.options.find(
                                (o) => o.label === v
                              )?.value;
                              setAnswers((a) => ({
                                ...a,
                                servicePlan: {
                                  ...a.servicePlan,
                                  [q.key]: picked,
                                },
                              }));
                            }}
                          />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            </Expandable>

            {appointmentType && appointmentType.meetingFormats.length > 1 && (
              <fieldset>
                <legend className="mb-3 block text-sm text-white/60">
                  How would you like to meet?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {appointmentType.meetingFormats.map((f) => (
                    <label
                      key={f}
                      className={`flex min-h-[44px] cursor-pointer items-center gap-2 border px-4 py-2.5 text-sm transition ${
                        meetingFormat === f
                          ? "border-crimson/70 bg-crimson/10 text-white"
                          : "border-white/15 text-white/70 hover:border-white/35"
                      }`}
                    >
                      <input
                        type="radio"
                        name="meetingFormat"
                        value={f}
                        checked={meetingFormat === f}
                        onChange={() => setMeetingFormat(f)}
                        className="sr-only"
                      />
                      {config.options.meetingFormats[f] || f}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[#b3243a]"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                />
                <span>
                  I agree to be contacted about this appointment and consent to the{" "}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="underline">
                    Terms
                  </Link>
                  .
                </span>
              </label>
              {errors.consent && (
                <p role="alert" className="mt-1.5 text-xs text-crimson-light">
                  {errors.consent}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="btn-ghost min-h-[52px] px-5 py-3 text-sm"
              >
                <ArrowLeft className="mr-2 inline h-4 w-4" aria-hidden="true" />
                Back
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary min-h-[52px] px-6 py-3 text-sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Booking…
                  </>
                ) : (
                  "Confirm booking"
                )}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
