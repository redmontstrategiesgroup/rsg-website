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
  | "receptionist"
  | "quotes"
  | "loyalty"
  | "inventory"
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

/** A saved estimate/quote generated inside the demo. */
export type QuoteRecord = {
  id: string;
  contact: string;
  /** Linked demo lead, when the quote was built from a record. */
  leadId?: string;
  lines: { label: string; amount: number }[];
  total: number;
  status: "draft" | "sent" | "accepted";
  createdAt: string;
};

export type QuoteFieldOption = { label: string; amount: number };

export type QuoteField = {
  id: string;
  label: string;
  options: QuoteFieldOption[];
  helper?: string;
};

/** Config for the industry's instant-quote / estimate builder. */
export type QuoteConfig = {
  /** e.g. "Instant project estimate" */
  title: string;
  description: string;
  /** What the generated document is called, e.g. "Estimate", "Treatment plan". */
  documentLabel: string;
  base: { label: string; amount: number };
  fields: QuoteField[];
  /** Stage a linked lead moves to when its quote is sent (if the stage exists). */
  sentStageId?: string;
  /** Stage a linked lead moves to when its quote is accepted (if the stage exists). */
  acceptedStageId?: string;
  disclaimer: string;
};

/* ------------------------------------------------------------------ */
/* Loyalty module (industries that sell to repeat customers)           */
/* ------------------------------------------------------------------ */

export type LoyaltyTier = {
  id: string;
  label: string;
  /** Points needed to reach the tier. */
  threshold: number;
  perks: string;
};

export type LoyaltyReward = {
  id: string;
  label: string;
  /** Points required to redeem. */
  cost: number;
  redeemedThisMonth: number;
};

export type LoyaltyMember = {
  id: string;
  name: string;
  /** LoyaltyTier id. */
  tierId: string;
  points: number;
  visits: number;
  joined: string;
  lastActivity: string;
};

export type LoyaltyActivityItem = {
  id: string;
  member: string;
  action: string;
  time: string;
};

/** Config for the loyalty & referral module (rendered when nav includes "loyalty"). */
export type LoyaltyConfig = {
  programName: string;
  description: string;
  pointsPerDollar: number;
  /** Baseline program stats shown alongside live session counts. */
  baseline: { issued: number; redeemed: number; members: number; referrals: number };
  tiers: LoyaltyTier[];
  rewards: LoyaltyReward[];
  members: LoyaltyMember[];
  activity: LoyaltyActivityItem[];
  /** Reward-notification template previewed in the demo ({first_name}, {reward}, {points}). */
  notificationPreview: string;
};

/* ------------------------------------------------------------------ */
/* Inventory module (product-based industries)                         */
/* ------------------------------------------------------------------ */

export type ProductStatus =
  | "in-stock"
  | "low-stock"
  | "reorder"
  | "overstocked"
  | "out-of-stock"
  | "slow-moving";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  reorderPoint: number;
  /** Average units sold per week. */
  velocity: number;
  status: ProductStatus;
  supplier: string;
  lastReorder: string;
};

/** Config for the inventory module (rendered when nav includes "inventory"). */
export type InventoryConfig = {
  title: string;
  description: string;
  products: Product[];
};

/** One turn in the scripted AI receptionist conversation. */
export type ReceptionistNode = {
  id: string;
  /** What the AI receptionist says. */
  say: string;
  /** Caption under the bubble, e.g. "Checks the live schedule". */
  meta?: string;
  /** Caller reply options. Omit on terminal nodes. */
  choices?: { id: string; label: string; next: string }[];
  /** Terminal node: what the system did, applied as real demo effects. */
  outcome?: { summary: string[]; effects: Effect[] };
};

/** Config for the interactive AI receptionist simulation. */
export type ReceptionistConfig = {
  /** e.g. "After-hours call — burst pipe" */
  scenarioLabel: string;
  description: string;
  /** Who the visitor role-plays, e.g. "a homeowner calling after hours". */
  callerRole: string;
  start: string;
  nodes: ReceptionistNode[];
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
  | { kind: "calendarUpdate"; eventId: string; patch: Partial<CalendarEvent> }
  | { kind: "appointmentStatus"; eventId: string; status: AppointmentStatus }
  | { kind: "review"; item: ReviewItem }
  | { kind: "reviewStatus"; reviewId: string; status: ReviewItem["status"]; rating?: number }
  | { kind: "workflowRun"; run: WorkflowRun }
  | { kind: "quote"; quote: QuoteRecord }
  | { kind: "quoteStatus"; quoteId: string; status: QuoteRecord["status"] }
  /* loyalty module */
  | { kind: "loyaltyPoints"; memberId: string; delta: number; reason: string }
  | { kind: "loyaltyRedeem"; memberId: string; rewardId: string }
  | { kind: "loyaltyTier"; memberId: string; tierId: string }
  | { kind: "loyaltyReward"; reward: LoyaltyReward }
  | { kind: "loyaltyActivity"; item: LoyaltyActivityItem }
  /* inventory module */
  | { kind: "stock"; productId: string; delta: number }
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
  /** Instant-quote / estimate builder for this industry. */
  quote: QuoteConfig;
  /** Interactive AI receptionist conversation for this industry. */
  receptionist: ReceptionistConfig;
  /** Loyalty & referral module (only rendered when nav includes "loyalty"). */
  loyalty?: LoyaltyConfig;
  /** Inventory module (only rendered when nav includes "inventory"). */
  inventory?: InventoryConfig;
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
  /**
   * Industry-specific service list for the "request this system" form.
   * Falls back to the generic SERVICE_OPTIONS when omitted.
   */
  requestServices?: string[];
  /**
   * Extra qualification questions on the request form (e.g. retail asks for
   * business type, locations, channels). Rendered as selects; answers travel
   * with the lead as demo metadata.
   */
  requestExtras?: { id: string; label: string; options: string[]; helper?: string }[];
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
