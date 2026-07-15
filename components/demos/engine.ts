import type {
  Automation,
  CalendarEvent,
  DemoNotification,
  Effect,
  IndustryConfig,
  IntakeField,
  Lead,
  Metric,
  MetricFormat,
  RoleId,
  Stage,
  Template,
  WidgetPref,
  WorkflowRun,
} from "./types";

/** Bump when the state shape changes — stale stored sessions are discarded. */
export const DEMO_SCHEMA_VERSION = 2;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export type DemoSettings = {
  businessName: string;
  accent: string;
  primaryService: string;
  staff: IndustryConfig["staff"];
  role: RoleId;
  widgets: WidgetPref[];
  intakeFields: IntakeField[];
  /** "Make This Your Business" answers (all optional, clearable). */
  personalization: {
    service?: string;
    problem?: string;
    monthlyLeads?: string;
    staffCount?: string;
  };
};

export type DemoState = {
  schema: number;
  introSeen: boolean;
  stages: Stage[];
  metrics: Metric[];
  leads: Lead[];
  conversations: IndustryConfig["conversations"];
  tasks: IndustryConfig["tasks"];
  activity: IndustryConfig["activity"];
  calendar: CalendarEvent[];
  reviews: IndustryConfig["reviews"];
  automations: Automation[];
  templates: Template[];
  workflowRuns: WorkflowRun[];
  notifications: DemoNotification[];
  toasts: DemoNotification[];
  settings: DemoSettings;
  /** Times each quick scenario has been run (for replay-safe ids). */
  scenarioRuns: Record<string, number>;
  /** Guided tour position: -1 = not started. */
  stepIndex: number;
  /** Feature areas the visitor has touched (for the CTA context summary). */
  explored: string[];
};

const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "metrics", visible: true },
  { id: "pipeline", visible: true },
  { id: "activity", visible: true },
  { id: "schedule", visible: true },
  { id: "tasks", visible: true },
];

export function defaultSettings(config: IndustryConfig): DemoSettings {
  return {
    businessName: config.businessName,
    accent: "#b3243a",
    primaryService: "",
    staff: config.staff.map((s) => ({ ...s })),
    role: "owner",
    widgets: DEFAULT_WIDGETS.map((w) => ({ ...w })),
    intakeFields: config.intakeFields.map((f) => ({
      ...f,
      options: f.options ? [...f.options] : undefined,
    })),
    personalization: {},
  };
}

export function initialDemoState(config: IndustryConfig): DemoState {
  return {
    schema: DEMO_SCHEMA_VERSION,
    introSeen: false,
    stages: config.stages.map((s) => ({ ...s })),
    metrics: config.metrics.map((m) => ({ ...m })),
    leads: config.leads.map((l) => ({ ...l, fields: l.fields ? { ...l.fields } : undefined })),
    conversations: config.conversations.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m })),
    })),
    tasks: config.tasks.map((t) => ({ ...t })),
    activity: config.activity.map((a) => ({ ...a })),
    calendar: config.calendar.map((e) => ({ ...e })),
    reviews: config.reviews.map((r) => ({ ...r })),
    automations: config.automations.map((a) => ({ ...a, steps: [...a.steps] })),
    templates: config.templates.map((t) => ({ ...t })),
    workflowRuns: [],
    notifications: [],
    toasts: [],
    settings: defaultSettings(config),
    scenarioRuns: {},
    stepIndex: -1,
    explored: [],
  };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type DemoAction =
  | { type: "effects"; effects: Effect[] }
  | { type: "set-step"; index: number }
  | { type: "intro-seen" }
  | { type: "explored"; key: string }
  | { type: "scenario-ran"; id: string }
  | { type: "dismiss-toast"; id: string }
  | { type: "clear-notifications" }
  /* pipeline customization */
  | { type: "stage-add"; label: string }
  | { type: "stage-rename"; stageId: string; label: string }
  | { type: "stage-move"; stageId: string; dir: -1 | 1 }
  | { type: "stage-archive"; stageId: string }
  | { type: "stages-restore"; stages: Stage[] }
  /* automations */
  | { type: "automation-toggle"; automationId: string }
  | { type: "automation-update"; automationId: string; patch: Partial<Pick<Automation, "delayLabel" | "message">> }
  | { type: "automations-restore"; automations: Automation[] }
  /* templates */
  | { type: "template-update"; templateId: string; patch: Partial<Pick<Template, "text" | "tone">> }
  | { type: "templates-restore"; templates: Template[] }
  /* settings */
  | { type: "settings-update"; patch: Partial<Omit<DemoSettings, "widgets" | "intakeFields" | "staff" | "personalization">> }
  | { type: "settings-staff"; staff: DemoSettings["staff"] }
  | { type: "settings-widgets"; widgets: WidgetPref[] }
  | { type: "settings-intake"; fields: IntakeField[] }
  | { type: "settings-personalization"; personalization: DemoSettings["personalization"] }
  | { type: "reset"; state: DemoState };

function applyEffect(state: DemoState, effect: Effect): DemoState {
  switch (effect.kind) {
    case "metric":
      return {
        ...state,
        metrics: state.metrics.map((m) =>
          m.id === effect.id ? { ...m, value: Math.max(0, m.value + effect.delta) } : m,
        ),
      };
    case "stage": {
      // Fall back to the first stage if the target was archived by the visitor.
      const target = state.stages.some((s) => s.id === effect.stageId)
        ? effect.stageId
        : state.stages[0]?.id;
      if (!target) return state;
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === effect.leadId ? { ...l, stageId: target, lastActivity: "Just now" } : l,
        ),
      };
    }
    case "lead":
      return state.leads.some((l) => l.id === effect.lead.id)
        ? state
        : { ...state, leads: [effect.lead, ...state.leads] };
    case "updateLead":
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === effect.leadId ? { ...l, ...effect.patch, lastActivity: "Just now" } : l,
        ),
      };
    case "message": {
      const exists = state.conversations.some((c) => c.id === effect.conversationId);
      if (!exists) return state;
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === effect.conversationId
            ? {
                ...c,
                unread: effect.message.from === "contact",
                messages: c.messages.some((m) => m.id === effect.message.id)
                  ? c.messages
                  : [...c.messages, effect.message],
              }
            : c,
        ),
      };
    }
    case "conversation":
      return state.conversations.some((c) => c.id === effect.conversation.id)
        ? state
        : { ...state, conversations: [effect.conversation, ...state.conversations] };
    case "conversationMeta":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === effect.conversationId ? { ...c, ...effect.patch } : c,
        ),
      };
    case "task":
      return state.tasks.some((t) => t.id === effect.task.id)
        ? state
        : { ...state, tasks: [effect.task, ...state.tasks] };
    case "completeTask":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === effect.taskId ? { ...t, done: true } : t)),
      };
    case "reopenTask":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === effect.taskId ? { ...t, done: false } : t)),
      };
    case "activity":
      return state.activity.some((a) => a.id === effect.item.id)
        ? state
        : { ...state, activity: [effect.item, ...state.activity] };
    case "calendar":
      return state.calendar.some((e) => e.id === effect.event.id)
        ? state
        : { ...state, calendar: [effect.event, ...state.calendar] };
    case "appointmentStatus":
      return {
        ...state,
        calendar: state.calendar.map((e) =>
          e.id === effect.eventId ? { ...e, status: effect.status } : e,
        ),
      };
    case "review":
      return state.reviews.some((r) => r.id === effect.item.id)
        ? state
        : { ...state, reviews: [effect.item, ...state.reviews] };
    case "reviewStatus":
      return {
        ...state,
        reviews: state.reviews.map((r) =>
          r.id === effect.reviewId
            ? { ...r, status: effect.status, rating: effect.rating ?? r.rating }
            : r,
        ),
      };
    case "workflowRun":
      return state.workflowRuns.some((r) => r.id === effect.run.id)
        ? state
        : { ...state, workflowRuns: [effect.run, ...state.workflowRuns].slice(0, 60) };
    case "notify": {
      const n = effect.notification;
      if (state.notifications.some((x) => x.id === n.id)) return state;
      return {
        ...state,
        notifications: [n, ...state.notifications],
        toasts: [...state.toasts, n],
      };
    }
  }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "effects":
      return action.effects.reduce(applyEffect, state);
    case "set-step":
      return { ...state, stepIndex: action.index };
    case "intro-seen":
      return { ...state, introSeen: true };
    case "explored":
      return state.explored.includes(action.key)
        ? state
        : { ...state, explored: [...state.explored, action.key] };
    case "scenario-ran":
      return {
        ...state,
        scenarioRuns: { ...state.scenarioRuns, [action.id]: (state.scenarioRuns[action.id] ?? 0) + 1 },
      };
    case "dismiss-toast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "clear-notifications":
      return { ...state, notifications: [] };
    case "stage-add": {
      const id = `custom-${state.stages.length}-${action.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
      if (state.stages.some((s) => s.id === id) || !action.label.trim()) return state;
      return { ...state, stages: [...state.stages, { id, label: action.label.trim() }] };
    }
    case "stage-rename":
      return {
        ...state,
        stages: state.stages.map((s) =>
          s.id === action.stageId ? { ...s, label: action.label } : s,
        ),
      };
    case "stage-move": {
      const i = state.stages.findIndex((s) => s.id === action.stageId);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= state.stages.length) return state;
      const stages = [...state.stages];
      [stages[i], stages[j]] = [stages[j], stages[i]];
      return { ...state, stages };
    }
    case "stage-archive": {
      if (state.stages.length <= 2) return state;
      const remaining = state.stages.filter((s) => s.id !== action.stageId);
      const fallback = remaining[0].id;
      return {
        ...state,
        stages: remaining,
        leads: state.leads.map((l) =>
          l.stageId === action.stageId ? { ...l, stageId: fallback } : l,
        ),
      };
    }
    case "stages-restore":
      return { ...state, stages: action.stages.map((s) => ({ ...s })) };
    case "automation-toggle":
      return {
        ...state,
        automations: state.automations.map((a) =>
          a.id === action.automationId
            ? { ...a, status: a.status === "active" ? "paused" : "active" }
            : a,
        ),
      };
    case "automation-update":
      return {
        ...state,
        automations: state.automations.map((a) =>
          a.id === action.automationId ? { ...a, ...action.patch } : a,
        ),
      };
    case "automations-restore":
      return { ...state, automations: action.automations.map((a) => ({ ...a, steps: [...a.steps] })) };
    case "template-update":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId ? { ...t, ...action.patch } : t,
        ),
      };
    case "templates-restore":
      return { ...state, templates: action.templates.map((t) => ({ ...t })) };
    case "settings-update":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "settings-staff":
      return { ...state, settings: { ...state.settings, staff: action.staff } };
    case "settings-widgets":
      return { ...state, settings: { ...state.settings, widgets: action.widgets } };
    case "settings-intake":
      return { ...state, settings: { ...state.settings, intakeFields: action.fields } };
    case "settings-personalization":
      return { ...state, settings: { ...state.settings, personalization: action.personalization } };
    case "reset":
      return action.state;
  }
}

/* ------------------------------------------------------------------ */
/* Formatting + templates                                              */
/* ------------------------------------------------------------------ */

export function formatMetric(value: number, format: MetricFormat = "number"): string {
  switch (format) {
    case "percent":
      return `${value}%`;
    case "currency":
      return value >= 1000
        ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
        : `$${value}`;
    case "minutes":
      return `${value} min`;
    case "hours":
      return `${value} hrs`;
    default:
      return `${value}`;
  }
}

/** Replace {variable} tokens; unknown tokens are left visible so editors catch them. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (raw, key: string) => vars[key] ?? raw);
}

/** Returns {variable} tokens that are not in the allowed list. */
export function unknownVariables(text: string, allowed: readonly string[]): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((v) => !allowed.includes(v)))];
}

export function templateVars(
  state: DemoState,
  config: IndustryConfig,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    business_name: state.settings.businessName,
    staff_name: state.settings.staff[0]?.name ?? "our team",
    booking_link: `${config.slug}.demo/book`,
    review_link: `${config.slug}.demo/review`,
    location: "our main location",
    phone: "(508) 555-0100",
    ...config.sampleCustomer,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Workflow simulation                                                 */
/* ------------------------------------------------------------------ */

let seq = 0;
/** Unique-enough ids for user-generated records within a session. */
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function run(automation: Automation, detail: string): Effect[] {
  return [
    {
      kind: "workflowRun",
      run: {
        id: uid("run"),
        automationId: automation.id,
        name: automation.name,
        detail,
        time: "Just now",
        simulated: true,
      },
    },
  ];
}

/**
 * Simulated "test this workflow" run — generates visible, honest activity
 * describing what the workflow would do. Never contacts anyone.
 */
export function testAutomationEffects(automation: Automation): Effect[] {
  const detail = `Test run: ${automation.steps.join(" → ")}`;
  return [
    ...run(automation, detail),
    {
      kind: "activity",
      item: {
        id: uid("act"),
        icon: "automation",
        text: `Simulated test of "${automation.name}" — ${automation.steps.length} steps executed against sample data.`,
        time: "Just now",
      },
    },
    {
      kind: "notify",
      notification: {
        id: uid("n"),
        title: `Workflow test complete: ${automation.name}`,
        body: "Simulation only — no real messages were sent.",
        tone: "success",
      },
    },
  ];
}

/** Effects when a demo intake form creates a new record. */
export function intakeEffects(
  lead: Lead,
  state: DemoState,
  config: IndustryConfig,
): Effect[] {
  const effects: Effect[] = [
    { kind: "lead", lead },
    {
      kind: "activity",
      item: {
        id: uid("act"),
        icon: "automation",
        text: `New ${config.terminology.record} captured from the intake form: ${lead.name} (${lead.service}).`,
        time: "Just now",
      },
    },
  ];
  const intake = state.automations.find((a) => a.kind === "intake");
  if (intake && intake.status === "active") {
    const convoId = uid("c");
    const text = renderTemplate(
      intake.message ??
        `Hi {first_name}, thanks for reaching out to {business_name}! We received your request and will follow up shortly.`,
      templateVars(state, config, { first_name: lead.name.split(" ")[0], service: lead.service }),
    );
    effects.push(
      {
        kind: "conversation",
        conversation: {
          id: convoId,
          contact: lead.name,
          channel: "sms",
          topic: `${lead.service} — intake`,
          unread: false,
          messages: [
            { id: uid("m"), from: "system", meta: `Automated · ${intake.name}`, text, time: "Just now" },
          ],
        },
      },
      {
        kind: "task",
        task: {
          id: uid("t"),
          title: `Follow up with ${lead.name} — new ${lead.service} inquiry from intake form`,
          assignee: lead.assignee ?? state.settings.staff[0]?.name ?? "Team",
          due: "Today",
          auto: true,
        },
      },
      ...run(intake, `Confirmation sent to ${lead.name}; follow-up task created.`),
    );
  } else {
    effects.push({
      kind: "notify",
      notification: {
        id: uid("n"),
        title: "Intake workflow is paused",
        body: `${lead.name} was created, but no automated confirmation was sent. Re-enable the intake workflow in Automations.`,
        tone: "alert",
      },
    });
  }
  effects.push({
    kind: "notify",
    notification: {
      id: uid("n"),
      title: `New ${config.terminology.record}: ${lead.name}`,
      body: `${lead.service} · added to ${state.stages[0]?.label ?? "pipeline"}.`,
      tone: "success",
    },
  });
  return effects;
}

/** Effects when an appointment is marked no-show. */
export function noShowEffects(
  event: CalendarEvent,
  state: DemoState,
  config: IndustryConfig,
): Effect[] {
  const contact = event.title.split("—").pop()?.trim() ?? event.title;
  const first = contact.split(" ")[0];
  const auto = state.automations.find((a) => a.kind === "no-show");
  const effects: Effect[] = [
    {
      kind: "activity",
      item: {
        id: uid("act"),
        icon: "alert",
        text: `${contact} marked as a no-show for ${event.time}.`,
        time: "Just now",
      },
    },
  ];
  if (auto && auto.status === "active") {
    const text = renderTemplate(
      auto.message ??
        `Hi {first_name}, we missed you today — no stress! Want to grab a new time? Reply here and we'll get you rebooked.`,
      templateVars(state, config, { first_name: first }),
    );
    const existing = state.conversations.find((c) =>
      contact.toLowerCase().includes(c.contact.split(" ")[0].toLowerCase()) ||
      c.contact.toLowerCase().includes(first.toLowerCase()),
    );
    if (existing) {
      effects.push({
        kind: "message",
        conversationId: existing.id,
        message: { id: uid("m"), from: "system", meta: `Automated · ${auto.name}`, text, time: "Just now" },
      });
    } else {
      effects.push({
        kind: "conversation",
        conversation: {
          id: uid("c"),
          contact,
          channel: "sms",
          topic: "No-show recovery",
          messages: [
            { id: uid("m"), from: "system", meta: `Automated · ${auto.name}`, text, time: "Just now" },
          ],
        },
      });
    }
    effects.push(
      {
        kind: "task",
        task: {
          id: uid("t"),
          title: `Call ${contact} if no reply to the no-show recovery message by tomorrow`,
          assignee: state.settings.staff[0]?.name ?? "Team",
          due: "Tomorrow",
          auto: true,
        },
      },
      ...run(auto, `Recovery message queued for ${contact}; staff call task created.`),
      {
        kind: "notify",
        notification: {
          id: uid("n"),
          title: `No-show recovery started: ${contact}`,
          body: "Simulated recovery message sent and call task created.",
          tone: "alert",
        },
      },
    );
  } else {
    effects.push({
      kind: "notify",
      notification: {
        id: uid("n"),
        title: `No-show logged: ${contact}`,
        body: "The no-show recovery workflow is paused, so no follow-up was sent.",
        tone: "alert",
      },
    });
  }
  return effects;
}

/** Effects when an appointment is marked completed. */
export function completedEffects(
  event: CalendarEvent,
  state: DemoState,
  config: IndustryConfig,
): Effect[] {
  const contact = event.title.split("—").pop()?.trim() ?? event.title;
  const auto = state.automations.find((a) => a.kind === "review");
  const effects: Effect[] = [
    {
      kind: "activity",
      item: {
        id: uid("act"),
        icon: "calendar",
        text: `${event.title} marked complete.`,
        time: "Just now",
      },
    },
  ];
  if (auto && auto.status === "active") {
    effects.push(
      {
        kind: "review",
        item: {
          id: uid("r"),
          name: contact,
          service: event.title.split("—")[0]?.trim() ?? config.terminology.appointment,
          status: "requested",
          time: "Just now",
        },
      },
      ...run(auto, `Review request scheduled for ${contact} (feedback collected first).`),
      {
        kind: "notify",
        notification: {
          id: uid("n"),
          title: `Review request queued: ${contact}`,
          body: "Simulated — feedback is collected before any public review link.",
          tone: "success",
        },
      },
    );
  }
  return effects;
}

/* ------------------------------------------------------------------ */
/* Derived analytics                                                   */
/* ------------------------------------------------------------------ */

export type DerivedAnalytics = {
  sources: { name: string; leads: number; booked: number }[];
  funnel: { label: string; value: number }[];
  pipelineValue: number;
  openTasks: number;
  workflowExecutions: number;
};

/**
 * Analytics computed live from the visitor's demo records — filters and edits
 * change these numbers immediately.
 */
export function deriveAnalytics(
  state: DemoState,
  opts: { source?: string; assignee?: string } = {},
): DerivedAnalytics {
  const leads = state.leads.filter(
    (l) =>
      (!opts.source || l.source === opts.source) &&
      (!opts.assignee || l.assignee === opts.assignee),
  );
  const bySource = new Map<string, { leads: number; booked: number }>();
  const stageIndex = new Map(state.stages.map((s, i) => [s.id, i]));
  const bookedThreshold = Math.min(2, state.stages.length - 1);
  for (const l of leads) {
    const entry = bySource.get(l.source) ?? { leads: 0, booked: 0 };
    entry.leads += 1;
    if ((stageIndex.get(l.stageId) ?? 0) >= bookedThreshold) entry.booked += 1;
    bySource.set(l.source, entry);
  }
  const funnel = state.stages.map((s) => ({
    label: s.label,
    value: leads.filter((l) => l.stageId === s.id).length,
  }));
  return {
    sources: [...bySource.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.leads - a.leads),
    funnel,
    pipelineValue: leads.reduce((sum, l) => sum + (l.value ?? 0), 0),
    openTasks: state.tasks.filter((t) => !t.done).length,
    workflowExecutions: state.workflowRuns.length,
  };
}

export function metricById(metrics: Metric[], id: string): Metric | undefined {
  return metrics.find((m) => m.id === id);
}
