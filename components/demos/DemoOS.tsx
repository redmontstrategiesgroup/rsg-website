"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
  LayoutDashboard,
  Users,
  Kanban,
  MessageSquare,
  Zap,
  CheckSquare,
  CalendarDays,
  Star,
  Megaphone,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { demoReducer, initialDemoState, type DemoState } from "./engine";
import { clearSession, loadSession, saveSession } from "./storage";
import type { Effect, IndustryConfig, NavId, Scenario } from "./types";
import { SampleDataTag } from "./ui/primitives";
import { ConfirmDialog, Modal } from "./ui/Modal";
import { trackEvent } from "@/lib/events";
import {
  AnalyticsView,
  CalendarView,
  CampaignsView,
  OverviewView,
  ReviewsView,
  TasksView,
} from "./ui/views";
import { LeadsView, PipelineView } from "./ui/LeadsViews";
import { ConversationsView } from "./ui/ConversationsView";
import { AutomationsView } from "./ui/AutomationsView";
import { SettingsView } from "./ui/SettingsView";
import { SmallButton } from "./ui/fields";

const NAV_ICONS: Record<NavId, LucideIcon> = {
  overview: LayoutDashboard,
  leads: Users,
  pipeline: Kanban,
  conversations: MessageSquare,
  automations: Zap,
  tasks: CheckSquare,
  calendar: CalendarDays,
  reviews: Star,
  campaigns: Megaphone,
  analytics: BarChart3,
  settings: Settings,
};

/* Unhurried pacing: each scenario step holds long enough to actually read
   the tab it switched to before the next one fires. */
const STEP_EFFECT_STAGGER = 500;
const AUTOPLAY_STEP_MS = 6500;
const QUICK_SCENARIO_STEP_MS = 4200;
const TOAST_MS = 6000;

const CONTACT_INDUSTRY: Record<string, string> = {
  "med-spa": "Med spa / aesthetic clinic",
  contractors: "Home services / contracting",
  gyms: "Gym / fitness studio",
  dental: "Dental office",
};

export function DemoOS({ config }: { config: IndustryConfig }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(demoReducer, config, initialDemoState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<NavId>(config.nav[0]?.id ?? "overview");
  const [playing, setPlaying] = useState(false);
  const [_tourOpen, _setTourOpen] = useState(false);
  const [runningScenario, setRunningScenario] = useState<{ id: string; step: number; total: number } | null>(null);
  const [scenarioMenu, setScenarioMenu] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tourSnapshot = useRef<DemoState | null>(null);

  /* ---------------------------------------------- session lifecycle */
  useEffect(() => {
    const stored = loadSession(config.slug);
    if (stored) dispatch({ type: "reset", state: stored });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug]);

  useEffect(() => {
    if (hydrated) saveSession(config.slug, state);
  }, [state, hydrated, config.slug]);

  const track = useCallback((key: string) => dispatch({ type: "explored", key }), []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timeouts.current.push(t);
    return t;
  }, []);

  const clearTimers = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /* Auto-dismiss toasts */
  useEffect(() => {
    if (state.toasts.length === 0) return;
    const t = setTimeout(() => dispatch({ type: "dismiss-toast", id: state.toasts[0].id }), TOAST_MS);
    return () => clearTimeout(t);
  }, [state.toasts]);

  const applyEffectsStaggered = useCallback(
    (effects: Effect[], onDone?: () => void) => {
      effects.forEach((effect, i) => {
        schedule(() => {
          dispatch({ type: "effects", effects: [effect] });
          if (i === effects.length - 1) onDone?.();
        }, i * STEP_EFFECT_STAGGER);
      });
      if (effects.length === 0) onDone?.();
    },
    [schedule],
  );

  /* ---------------------------------------------- guided tour */
  const steps = config.scenario.steps;
  const stepIndex = state.stepIndex;
  const tourDone = stepIndex >= steps.length - 1;

  const runStep = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;
      if (index === 0 && stepIndex === -1) tourSnapshot.current = state;
      dispatch({ type: "set-step", index });
      if (step.tab) setTab(step.tab);
      applyEffectsStaggered(step.effects);
    },
    [steps, applyEffectsStaggered, state, stepIndex],
  );

  const nextStep = useCallback(() => {
    if (!tourDone) runStep(stepIndex + 1);
  }, [tourDone, runStep, stepIndex]);

  /** Previous step: rebuild deterministically from the tour-start snapshot. */
  const prevStep = useCallback(() => {
    if (stepIndex < 0 || !tourSnapshot.current) return;
    clearTimers();
    setPlaying(false);
    const target = stepIndex - 1;
    let rebuilt = tourSnapshot.current;
    for (let i = 0; i <= target; i++) {
      rebuilt = demoReducer(rebuilt, { type: "effects", effects: steps[i].effects });
    }
    rebuilt = { ...rebuilt, stepIndex: target, toasts: [] };
    dispatch({ type: "reset", state: rebuilt });
    const stepTab = target >= 0 ? steps[target].tab : undefined;
    if (stepTab) setTab(stepTab);
  }, [stepIndex, steps, clearTimers]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => runStep(stepIndex + 1), stepIndex === -1 ? 250 : AUTOPLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, stepIndex, steps.length, runStep]);

  /* ---------------------------------------------- quick scenarios */
  const runScenario = useCallback(
    (scenario: Scenario) => {
      clearTimers();
      setScenarioMenu(false);
      setPlaying(false);
      dispatch({ type: "scenario-ran", id: scenario.id });
      track(`ran the "${scenario.label}" scenario`);
      setRunningScenario({ id: scenario.id, step: 0, total: scenario.steps.length });
      scenario.steps.forEach((step, i) => {
        schedule(() => {
          setRunningScenario({ id: scenario.id, step: i + 1, total: scenario.steps.length });
          if (step.tab) setTab(step.tab);
          applyEffectsStaggered(step.effects);
          if (i === scenario.steps.length - 1) {
            schedule(() => setRunningScenario(null), 2500);
          }
        }, i * QUICK_SCENARIO_STEP_MS);
      });
    },
    [applyEffectsStaggered, clearTimers, schedule, track],
  );

  /** Replay = deterministic: restore fresh data first, then run the scenario. */
  const replayScenario = useCallback(
    (scenario: Scenario) => {
      clearTimers();
      const fresh: DemoState = {
        ...initialDemoState(config),
        introSeen: true,
        explored: state.explored,
        scenarioRuns: state.scenarioRuns,
        settings: state.settings,
      };
      dispatch({ type: "reset", state: fresh });
      schedule(() => runScenario(scenario), 300);
    },
    [clearTimers, config, runScenario, schedule, state.explored, state.scenarioRuns, state.settings],
  );

  const fullReset = useCallback(() => {
    clearTimers();
    setPlaying(false);
    setRunningScenario(null);
    setBellOpen(false);
    tourSnapshot.current = null;
    setTab(config.nav[0]?.id ?? "overview");
    clearSession(config.slug);
    dispatch({ type: "reset", state: { ...initialDemoState(config), introSeen: true } });
  }, [clearTimers, config]);

  /* ---------------------------------------------- role-aware nav */
  const role = config.roles.find((r) => r.id === state.settings.role) ?? config.roles[0];
  const nav = config.nav.filter((n) => role.nav.includes(n.id));
  useEffect(() => {
    if (!nav.some((n) => n.id === tab)) setTab(nav[0]?.id ?? "overview");
  }, [role.id, nav, tab]);

  const accent = state.settings.accent;
  const currentStep = stepIndex >= 0 ? steps[stepIndex] : null;
  const unread = state.notifications.length;

  const setTabTracked = useCallback(
    (id: NavId) => {
      setTab(id);
      track(`explored ${id}`);
    },
    [track],
  );

  const viewProps = useMemo(
    () => ({ state, config, dispatch, track }),
    [state, config, track],
  );

  const view = useMemo(() => {
    switch (tab) {
      case "overview":
        return <OverviewView {...viewProps} />;
      case "leads":
        return <LeadsView {...viewProps} />;
      case "pipeline":
        return <PipelineView {...viewProps} />;
      case "conversations":
        return <ConversationsView {...viewProps} />;
      case "automations":
        return <AutomationsView {...viewProps} />;
      case "tasks":
        return <TasksView {...viewProps} />;
      case "calendar":
        return <CalendarView {...viewProps} />;
      case "reviews":
        return <ReviewsView {...viewProps} />;
      case "campaigns":
        return <CampaignsView {...viewProps} />;
      case "analytics":
        return <AnalyticsView {...viewProps} />;
      case "settings":
        return <SettingsView {...viewProps} />;
    }
  }, [tab, viewProps]);

  const openContactWithContext = () => {
    trackEvent("demo_cta_click", { demo: config.slug, cta: "build_in_os" });
    router.push("/book");
  };

  return (
    <div style={{ ["--demo-accent" as string]: accent }}>
      {/* ------------------------------------------------ Control deck */}
      <div className="mb-5 rounded-xl border border-white/10 bg-base-900/80">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.2em]" style={{ color: accent === "#b3243a" ? "#d94b5e" : accent }}>
              {runningScenario
                ? `Scenario running · step ${runningScenario.step} of ${runningScenario.total}`
                : `Guided tour · step ${Math.max(stepIndex + 1, 0)} of ${steps.length}`}
            </p>
            <p className="mt-1.5 text-sm font-medium text-white">
              {runningScenario
                ? config.scenarios.find((s) => s.id === runningScenario.id)?.label
                : currentStep
                  ? currentStep.title
                  : config.scenario.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {runningScenario
                ? config.scenarios.find((s) => s.id === runningScenario.id)?.description
                : currentStep
                  ? currentStep.detail
                  : config.scenario.intro}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!tourDone && (
              <button type="button" onClick={() => setPlaying((p) => !p)} className="btn-primary px-5 py-2.5 text-xs">
                {playing ? (
                  <>
                    <Loader2 size={13} className="mr-2 animate-spin" aria-hidden /> Pause tour
                  </>
                ) : (
                  <>
                    <Play size={13} className="mr-2" aria-hidden />
                    {stepIndex === -1 ? "Start guided tour" : "Resume tour"}
                  </>
                )}
              </button>
            )}
            {stepIndex >= 0 && (
              <button
                type="button"
                onClick={prevStep}
                disabled={playing}
                className="btn-ghost px-4 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous tour step"
              >
                <ChevronLeft size={13} aria-hidden />
              </button>
            )}
            {!tourDone && (
              <button
                type="button"
                onClick={nextStep}
                disabled={playing}
                className="btn-ghost px-4 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next tour step"
              >
                Next
                <ChevronRight size={13} className="ml-1" aria-hidden />
              </button>
            )}
            {tourDone && (
              <span className="inline-flex items-center gap-2 border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300/90">
                <CheckCircle2 size={13} aria-hidden /> Tour complete
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setScenarioMenu((v) => !v)}
                aria-expanded={scenarioMenu}
                className="btn-ghost px-4 py-2.5 text-xs"
              >
                <ListVideo size={13} className="mr-1.5" aria-hidden />
                Scenarios
              </button>
              {scenarioMenu && (
                <div className="absolute right-0 top-11 z-40 w-80 rounded-lg border border-white/10 bg-base-800 shadow-lift">
                  <p className="border-b border-white/[0.08] px-3 py-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-white/40">
                    Launch a scenario
                  </p>
                  <ul className="max-h-72 overflow-y-auto no-scrollbar">
                    {config.scenarios.map((sc) => {
                      const runs = state.scenarioRuns[sc.id] ?? 0;
                      return (
                        <li key={sc.id} className="border-b border-white/[0.06] last:border-0">
                          <div className="px-3 py-2.5">
                            <p className="text-xs text-white/80">{sc.label}</p>
                            <p className="mt-0.5 text-[0.64rem] leading-snug text-white/40">{sc.description}</p>
                            <div className="mt-1.5 flex gap-2">
                              {runs === 0 ? (
                                <SmallButton tone="primary" onClick={() => runScenario(sc)} disabled={!!runningScenario}>
                                  <Play size={10} aria-hidden /> Run
                                </SmallButton>
                              ) : (
                                <SmallButton onClick={() => replayScenario(sc)} disabled={!!runningScenario}>
                                  <RotateCcw size={10} aria-hidden /> Reset data & replay
                                </SmallButton>
                              )}
                              {runs > 0 && (
                                <span className="self-center text-[0.6rem] text-emerald-400/70">
                                  ✓ run {runs}×
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 border border-white/15 px-3.5 py-2.5 text-xs text-white/55 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              aria-label="Reset the entire demo"
            >
              <RotateCcw size={12} aria-hidden /> Reset
            </button>
          </div>
        </div>

        {/* Tour progress */}
        <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5">
          <ol className="flex items-center gap-1.5" aria-label="Guided tour progress">
            {steps.map((s, i) => (
              <li key={s.id} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? "" : "bg-white/10"}`}
                  style={i <= stepIndex ? { backgroundColor: accent } : undefined}
                  title={s.title}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ------------------------------------------------ OS window */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-base-900 shadow-lift">
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] bg-base-800/60 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white/85">
              {state.settings.businessName}
              <span className="ml-2 hidden text-white/35 sm:inline">
                · {config.osName}
                {state.settings.primaryService ? ` · ${state.settings.primaryService}` : ""}
              </span>
            </p>
          </div>
          <span className="hidden rounded border px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] md:inline-flex" style={{ borderColor: `${accent}55`, color: accent === "#b3243a" ? "#d94b5e" : accent, backgroundColor: `${accent}18` }}>
            {role.label} view
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setBellOpen((v) => !v)}
              className="relative inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-white/55 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
              aria-label={`Staff notifications (${unread})`}
              aria-expanded={bellOpen}
            >
              <Bell size={13} aria-hidden />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[0.55rem] font-medium tabular-nums text-white" style={{ backgroundColor: accent }}>
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-white/10 bg-base-800 shadow-lift">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
                  <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-white/45">
                    Staff notifications
                  </span>
                  {unread > 0 && (
                    <button type="button" onClick={() => dispatch({ type: "clear-notifications" })} className="text-[0.62rem] text-white/40 hover:text-white">
                      Clear all
                    </button>
                  )}
                </div>
                {state.notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-white/35">No notifications yet. Run a scenario.</p>
                ) : (
                  <ul className="max-h-64 divide-y divide-white/[0.06] overflow-y-auto no-scrollbar">
                    {state.notifications.map((n) => (
                      <li key={n.id} className="flex items-start gap-2.5 px-3 py-2.5">
                        {n.tone === "alert" ? (
                          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-crimson-light" aria-hidden />
                        ) : (
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400/80" aria-hidden />
                        )}
                        <div>
                          <p className="text-xs text-white/80">{n.title}</p>
                          {n.body && <p className="mt-0.5 text-[0.64rem] text-white/45">{n.body}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[32rem] flex-col lg:flex-row">
          {/* Nav */}
          <nav aria-label={`${config.osName} sections`} className="border-b border-white/[0.08] lg:w-48 lg:shrink-0 lg:border-b-0 lg:border-r">
            <ul className="flex overflow-x-auto no-scrollbar lg:block lg:py-3">
              {nav.map((item) => {
                const Icon = NAV_ICONS[item.id];
                const active = tab === item.id;
                return (
                  <li key={item.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setTabTracked(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-2.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs transition-colors focus:outline-none focus-visible:bg-white/[0.06] lg:border-b-0 lg:border-l-2 lg:py-2.5 ${
                        active ? "bg-white/[0.04] text-white" : "border-transparent text-white/50 hover:text-white/85"
                      }`}
                      style={active ? { borderColor: accent } : undefined}
                    >
                      <Icon size={14} style={active ? { color: accent === "#b3243a" ? "#d94b5e" : accent } : undefined} className={active ? "" : "text-white/35"} aria-hidden />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Main content */}
          <div className="min-w-0 flex-1 p-4 sm:p-5">{view}</div>
        </div>

        {/* Persistent demo-environment indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-base-800/40 px-4 py-2">
          <p className="flex items-center gap-1.5 text-[0.62rem] text-white/40">
            <ShieldCheck size={11} className="shrink-0 text-emerald-400/60" aria-hidden />
            Demo environment — no real messages, appointments, or payments will be sent.
          </p>
          <button
            type="button"
            onClick={() => setCtaOpen(true)}
            className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
            style={{ color: accent === "#b3243a" ? "#d94b5e" : accent }}
          >
            Build this for my business
            <ArrowRight size={11} aria-hidden />
          </button>
        </div>

        {/* Toasts */}
        <div className="pointer-events-none absolute bottom-12 right-4 z-40 flex w-72 max-w-[calc(100%-2rem)] flex-col gap-2" aria-live="polite">
          {state.toasts.slice(-3).map((toast) => (
            <div key={toast.id} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-white/15 bg-base-700/95 p-3 shadow-lift backdrop-blur animate-fade-up">
              {toast.tone === "alert" ? (
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-crimson-light" aria-hidden />
              ) : (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400/90" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/90">{toast.title}</p>
                {toast.body && <p className="mt-0.5 text-[0.66rem] leading-snug text-white/55">{toast.body}</p>}
              </div>
              <button type="button" onClick={() => dispatch({ type: "dismiss-toast", id: toast.id })} className="shrink-0 text-white/35 transition-colors hover:text-white" aria-label="Dismiss notification">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <SampleDataTag />
      </div>

      {/* ------------------------------------------------ Intro dialog */}
      {hydrated && !state.introSeen && (
        <Modal
          title="This is an interactive demonstration"
          subtitle={config.systemName}
          onClose={() => dispatch({ type: "intro-seen" })}
        >
          <p className="text-sm leading-relaxed text-white/65">
            You can edit records, move {config.terminology.records.toLowerCase()} through the
            pipeline, reply in conversations, trigger workflows, change business settings, and reset
            the demo at any time. Everything is sample data in an isolated session — no real
            messages, appointments, or payments are ever sent.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dispatch({ type: "intro-seen" })}
              className="btn-ghost px-4 py-2.5 text-xs"
            >
              Explore on my own
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "intro-seen" });
                setPlaying(true);
              }}
              className="btn-primary px-4 py-2.5 text-xs"
            >
              <Play size={12} className="mr-1.5" aria-hidden /> Start the guided tour
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------ Reset confirm */}
      {confirmReset && (
        <ConfirmDialog
          title="Reset the entire demo?"
          body="All records, conversations, appointments, workflow history, and customizations from your session will be discarded and the original sample data restored."
          confirmLabel="Reset everything"
          onConfirm={fullReset}
          onClose={() => setConfirmReset(false)}
        />
      )}

      {/* ------------------------------------------------ CTA context dialog */}
      {ctaOpen && (
        <Modal
          title="Build this for my business"
          subtitle="Here's the demo context we'll pre-fill into the inquiry form — you can review and edit all of it before sending."
          onClose={() => setCtaOpen(false)}
        >
          <ul className="space-y-1.5 text-xs text-white/65">
            <li>• Demo viewed: {config.systemName}</li>
            <li>• Industry: {CONTACT_INDUSTRY[config.slug] ?? config.industry}</li>
            {state.settings.businessName !== config.businessName && (
              <li>• Business name: {state.settings.businessName}</li>
            )}
            {state.explored.length > 0 && (
              <li>• Features explored: {state.explored.slice(0, 8).join(", ")}</li>
            )}
            {Object.keys(state.scenarioRuns).length > 0 && (
              <li>• Scenarios completed: {Object.keys(state.scenarioRuns).length}</li>
            )}
            {state.settings.personalization.problem && (
              <li>• Main operational problem: {state.settings.personalization.problem}</li>
            )}
          </ul>
          <p className="mt-3 text-[0.64rem] leading-relaxed text-white/35">
            Nothing is sent until you submit the form yourself. This context appears in the visible
            message field where you can change or delete it.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCtaOpen(false)} className="btn-ghost px-4 py-2 text-xs">
              Cancel
            </button>
            <button type="button" onClick={openContactWithContext} className="btn-primary px-4 py-2 text-xs">
              Continue to inquiry form
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
