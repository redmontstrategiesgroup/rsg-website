/**
 * Data model for the RSG industry demo systems.
 *
 * Every demo is a single interactive "operating system" (components/demos/DemoOS.tsx)
 * driven entirely by an IndustryConfig. All interactions mutate one serializable
 * DemoState through a pure reducer (engine.ts), persisted per-visitor in
 * localStorage (storage.ts). Nothing here ever touches production data, and no
 * real messages, appointments, or payments are created — every external action
 * is an explicitly labeled simulation.
 */

export type NavId =
  | "overview"
  | "leads"
  | "pipeline"
  | "conversations"
  | "automations"
  | "tasks"
  | "calendar"
  | "reviews"
  | "campaigns"
  | "analytics"
  | "settings";

export type Channel = "sms" | "instagram" | "facebook" | "phone" | "email" | "web";

export type MetricFormat = "number" | "percent" | "currency" | "minutes" | "hours";

export type Metric = {
  id: string;
  label: string;
  value: number;
  format?: MetricFormat;
  delta?: string;
  deltaDir?: "up" | "down";
  /** Marks the delta as good/bad independent of direction (e.g. no-shows down = good). */
  deltaGood?: boolean;
  hint?: string;
};

export type Stage = { id: string; label: string };

export type LeadTemp = "hot" | "warm" | "cold";

export type Lead = {
  id: string;
  name: string;
  service: string;
  source: string;
  stageId: string;
  value?: number;
  lastActivity: string;
  temp?: LeadTemp;
  note?: string;
  assignee?: string;
  phone?: string;
  email?: string;
  /** Industry-specific extra fields shown/edited in the record drawer. */
  fields?: Record<string, string>;
  createdAt?: string;
};

export type MessageFrom = "contact" | "system" | "staff";

export type Message = {
  id: string;
  from: MessageFrom;
  text: string;
  time: string;
  /** Small caption under the bubble, e.g. "Automated · Missed-call text-back". */
  meta?: string;
  /** Staff-only internal note — never "sent" to the contact. */
  internal?: boolean;
};

export type Conversation = {
  id: string;
  contact: string;
  channel: Channel;
  topic?: string;
  unread?: boolean;
  resolved?: boolean;
  assignee?: string;
  messages: Message[];
};

export type Task = {
  id: string;
  title: string;
  assignee: string;
  due: string;
  done?: boolean;
  priority?: "high" | "normal";
  auto?: boolean;
};

export type ActivityIcon =
  | "automation"
  | "message"
  | "call"
  | "calendar"
  | "pipeline"
  | "alert"
  | "review"
  | "task"
  | "campaign";

export type ActivityItem = {
  id: string;
  icon: ActivityIcon;
  text: string;
  time: string;
};

export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "risk"
  | "completed"
  | "no-show"
  | "canceled";

export type CalendarEvent = {
  id: string;
  day: string;
  date: string;
  time: string;
  title: string;
  withWhom?: string;
  status?: AppointmentStatus;
  note?: string;
};

export type ReviewItem = {
  id: string;
  name: string;
  service: string;
  status: "scheduled" | "requested" | "completed" | "flagged";
  rating?: number;
  note?: string;
  time: string;
};

export type Campaign = {
  id: string;
  name: string;
  audience: string;
  filters: string[];
  message: string;
  stats: { sent: number; replied: number; booked: number };
  status: "active" | "draft" | "completed";
};

/** Behavior category used by the generic workflow simulator. */
export type AutomationKind =
  | "intake"
  | "missed-call"
  | "reminders"
  | "no-show"
  | "follow-up"
  | "reactivation"
  | "review"
  | "updates"
  | "routing"
  | "onboarding"
  | "referral"
  | "billing";

export type Automation = {
  id: string;
  /** Behavior category for the workflow simulator. Optional on older demo datasets. */
  kind?: AutomationKind;
  name: string;
  trigger: string;
  steps: string[];
  runsThisMonth: number;
  status: "active" | "paused";
  /** Editable in the demo — e.g. "2 days", "10 minutes". */
  delayLabel?: string;
  /** Editable first outbound message for this workflow, if it sends one. */
  message?: string;
};

export type WorkflowRun = {
  id: string;
  automationId: string;
  name: string;
  detail: string;
  time: string;
  /** Always true — demo runs never contact real people. */
  simulated: true;
};

export type TemplateTone = "professional" | "friendly" | "premium" | "direct" | "conversational";

export type Template = {
  id: string;
  name: string;
  channel: "sms" | "email" | "internal";
  tone: TemplateTone;
  text: string;
};

export type NotificationTone = "default" | "alert" | "success";

export type DemoNotification = {
  id: string;
  title: string;
  body?: string;
  tone?: NotificationTone;
};

export type StaffMember = { id: string; name: string; role: string };

export type RoleId = "owner" | "manager" | "staff" | "provider";

export type RoleConfig = {
  id: RoleId;
  label: string;
  description: string;
  nav: NavId[];
};

export type IntakeFieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "select"
  | "checkbox";

export type IntakeField = {
  id: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  helper?: string;
  options?: string[];
};

export type AppointmentType = { id: string; label: string; duration: number };

export type WidgetId = "metrics" | "activity" | "schedule" | "tasks" | "pipeline";

export type WidgetPref = { id: WidgetId; visible: boolean };

/** A single state mutation applied by the reducer. */
export type Effect =
  | { kind: "metric"; id: string; delta: number }
  | { kind: "stage"; leadId: string; stageId: string }
  | { kind: "lead"; lead: Lead }
  | { kind: "updateLead"; leadId: string; patch: Partial<Lead> }
  | { kind: "message"; conversationId: string; message: Message }
  | { kind: "conversation"; conversation: Conversation }
  | { kind: "conversationMeta"; conversationId: string; patch: Partial<Pick<Conversation, "unread" | "resolved" | "assignee" | "topic">> }
  | { kind: "task"; task: Task }
  | { kind: "completeTask"; taskId: string }
  | { kind: "reopenTask"; taskId: string }
  | { kind: "activity"; item: ActivityItem }
  | { kind: "calendar"; event: CalendarEvent }
  | { kind: "appointmentStatus"; eventId: string; status: AppointmentStatus }
  | { kind: "review"; item: ReviewItem }
  | { kind: "reviewStatus"; reviewId: string; status: ReviewItem["status"]; rating?: number }
  | { kind: "workflowRun"; run: WorkflowRun }
  | { kind: "notify"; notification: DemoNotification };

export type ScenarioStep = {
  id: string;
  title: string;
  detail: string;
  /** Tab the OS switches to so the update is visible. */
  tab?: NavId;
  effects: Effect[];
};

/** A predefined situation the visitor can launch, watch, and replay. */
export type Scenario = {
  id: string;
  label: string;
  description: string;
  steps: ScenarioStep[];
};

export type AnalyticsPoint = { label: string; value: number };

export type AnalyticsConfig = {
  volume: { title: string; unit: string; points: AnalyticsPoint[] };
  responseTime: { title: string; unit: string; points: AnalyticsPoint[] };
  funnel: { title: string; points: AnalyticsPoint[] };
  sources: { name: string; leads: number; booked: number }[];
  kpis: Metric[];
};

export type BreakdownConfig = {
  inputs: string[];
  systemDoes: string[];
  teamControls: string[];
  integrations: string[];
};

export type Terminology = {
  /** Singular/plural for the primary record, e.g. "patient"/"Patients". */
  record: string;
  records: string;
  appointment: string;
  appointments: string;
};

export type IndustryConfig = {
  slug: string;
  /** e.g. "Med Spas & Aesthetic Clinics" */
  industry: string;
  /** e.g. "RSG Med Spa Growth System" */
  systemName: string;
  /** Short name shown in the OS chrome, e.g. "Med Spa Growth System". */
  osName: string;
  /** Fictional demo business the sample data belongs to. */
  businessName: string;
  description: string;
  /** One-sentence outcome used on the directory card. */
  outcome: string;
  /** The operational problem framed at the top of the demo. */
  problem: string;
  /** Directory card workflow bullets (3–5). */
  workflows: string[];
  accentLabel: string;
  terminology: Terminology;
  nav: { id: NavId; label: string }[];
  leadsLabel: string;
  staff: StaffMember[];
  roles: RoleConfig[];
  metrics: Metric[];
  stages: Stage[];
  leads: Lead[];
  conversations: Conversation[];
  tasks: Task[];
  activity: ActivityItem[];
  calendar: CalendarEvent[];
  reviews: ReviewItem[];
  campaigns: Campaign[];
  automations: Automation[];
  templates: Template[];
  intakeFields: IntakeField[];
  appointmentTypes: AppointmentType[];
  /** Bookable day options for the demo scheduler. */
  scheduleDays: { day: string; date: string }[];
  /** Sample values used for template previews. */
  sampleCustomer: Record<string, string>;
  analytics: AnalyticsConfig;
  /** The featured guided tour. */
  scenario: { title: string; intro: string; steps: ScenarioStep[] };
  /** Quick-launch scenario library (replayable). */
  scenarios: Scenario[];
  /** One-click simulated actions (missed call, reactivation, etc.). */
  simActions?: {
    id: string;
    label: string;
    description: string;
    tab?: NavId;
    effects: Effect[];
  }[];
  builderFlow: { title: string; steps: { label: string; sub?: string }[] };
  breakdown: BreakdownConfig;
  cta: { headline: string; button: string };
  seo: { title: string; description: string };
};

/** Allowed template variables (validated by the template editor). */
export const TEMPLATE_VARIABLES = [
  "first_name",
  "business_name",
  "staff_name",
  "appointment_date",
  "appointment_time",
  "service",
  "estimate_amount",
  "booking_link",
  "review_link",
  "location",
  "phone",
] as const;
