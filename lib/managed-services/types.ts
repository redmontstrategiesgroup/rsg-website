/**
 * Managed-services domain types (safe to import from client & server).
 *
 * Pricing is stored in the database (admin-editable) — components must never
 * hard-code plan pricing. `lib/managed-services/content.ts` carries the seed
 * defaults used when Supabase is unavailable in local development.
 */

/** The four standard plan keys. Custom variations use their own slug. */
export type StandardPlanKey =
  | "maintain"
  | "optimize"
  | "scale"
  | "managed_infrastructure";

export const STANDARD_PLAN_KEYS: StandardPlanKey[] = [
  "maintain",
  "optimize",
  "scale",
  "managed_infrastructure",
];

export type PlanAddon = {
  key: string;
  name: string;
  description: string;
  monthlyPriceCents: number | null;
};

/** Comparison cell: true/false = included/not; string = qualified inclusion. */
export type ComparisonValue = boolean | string;

export type ManagedServicePlan = {
  id: string;
  key: string;
  name: string;
  /** Positioning line, e.g. "Keep your systems secure, updated, …". */
  tagline: string;
  bestFit: string;
  description: string;
  /** null = custom monthly pricing (quote). */
  monthlyPriceCents: number | null;
  /** Explicit annual price; when null, derived from monthly & discount. */
  annualPriceCents: number | null;
  annualDiscountPct: number;
  setupFeeCents: number;
  customPricing: boolean;
  /** Included service hours per month; null = custom / as agreed. */
  includedHours: number | null;
  additionalHourlyRateCents: number | null;
  supportLevel: string;
  responseTime: string;
  minimumCommitmentMonths: number;
  cancellationTerms: string;
  /** Headline inclusions shown on the plan card. */
  features: string[];
  /** Full expandable scope of the agreement. */
  detailedScope: string[];
  addons: PlanAddon[];
  comparison: Record<string, ComparisonValue>;
  recommended: boolean;
  /** Business-critical plans cannot be self-serve downgraded/cancelled. */
  businessCritical: boolean;
  tierRank: number;
  /** Set when this is a custom variation of a standard plan. */
  basePlanKey: string | null;
  /** Set when this custom plan belongs to a single client. */
  clientId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Fields an admin may create/edit on a plan. */
export type PlanPatch = Partial<
  Omit<ManagedServicePlan, "id" | "createdAt" | "updatedAt">
>;

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "pending"
  | "awaiting_payment"
  | "active"
  | "past_due"
  | "paused"
  | "pending_cancellation"
  | "cancelled";

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "pending",
  "awaiting_payment",
  "active",
  "past_due",
  "paused",
  "pending_cancellation",
  "cancelled",
];

export type BillingFrequency = "monthly" | "annual";

export type ClientSubscription = {
  id: string;
  clientId: string;
  planId: string;
  /** Denormalized for display (resolved on read). */
  planKey?: string;
  planName?: string;
  planBusinessCritical?: boolean;
  status: SubscriptionStatus;
  billingFrequency: BillingFrequency;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  setupFeeCents: number;
  currency: string;
  includedHours: number | null;
  additionalHourlyRateCents: number | null;
  minimumCommitmentMonths: number;
  commitmentEndsAt: string | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationRequestedAt: string | null;
  cancellationReason: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paymentMethodSummary: string;
  lastPaymentStatus: string;
  lastPaymentAt: string | null;
  failedPaymentCount: number;
  accountManager: string;
  technicalOwner: string;
  slaNotes: string;
  adminNotes: string;
  source: string;
  proposalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionEvent = {
  id: string;
  subscriptionId: string | null;
  clientId: string | null;
  type: string;
  description: string;
  actor: string;
  data: Record<string, unknown>;
  stripeEventId: string | null;
  createdAt: string;
};

export type SubscriptionInvoice = {
  id: string;
  subscriptionId: string | null;
  clientId: string | null;
  stripeInvoiceId: string | null;
  invoiceNumber: string;
  description: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string;
  invoicePdfUrl: string;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Service requests
// ---------------------------------------------------------------------------

export type ServiceRequestType =
  | "technical_issue"
  | "website_change"
  | "crm_change"
  | "automation_request"
  | "ai_knowledge_update"
  | "new_integration"
  | "reporting_request"
  | "security_concern"
  | "infrastructure_issue"
  | "strategy_request"
  | "plan_change"
  | "cancellation_request"
  | "additional_work"
  | "review_request"
  | "general";

export const SERVICE_REQUEST_TYPES: ServiceRequestType[] = [
  "technical_issue",
  "website_change",
  "crm_change",
  "automation_request",
  "ai_knowledge_update",
  "new_integration",
  "reporting_request",
  "security_concern",
  "infrastructure_issue",
  "strategy_request",
  "plan_change",
  "cancellation_request",
  "additional_work",
  "review_request",
  "general",
];

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, string> = {
  technical_issue: "Technical issue",
  website_change: "Website change",
  crm_change: "CRM change",
  automation_request: "Automation request",
  ai_knowledge_update: "AI knowledge update",
  new_integration: "New integration",
  reporting_request: "Reporting request",
  security_concern: "Security concern",
  infrastructure_issue: "Infrastructure issue",
  strategy_request: "Strategy request",
  plan_change: "Plan change",
  cancellation_request: "Cancellation request",
  additional_work: "Additional work",
  review_request: "Systems review",
  general: "General request",
};

export type ServiceRequestStatus =
  | "new"
  | "in_review"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "waiting_on_client"
  | "completed"
  | "declined";

export const SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "new",
  "in_review",
  "approved",
  "scheduled",
  "in_progress",
  "waiting_on_client",
  "completed",
  "declined",
];

export type ServiceRequestInclusion =
  | "included"
  | "needs_approval"
  | "extra_charge"
  | "pending_assessment";

export type ServiceRequestActivity = { at: string; text: string; by?: string };

export type ServiceRequest = {
  id: string;
  clientId: string;
  subscriptionId: string | null;
  type: ServiceRequestType;
  title: string;
  details: string;
  status: ServiceRequestStatus;
  priority: "standard" | "priority" | "urgent";
  inclusion: ServiceRequestInclusion;
  acknowledgedConsequences: boolean;
  estimatedHours: number | null;
  actualHours: number | null;
  extraChargeCents: number | null;
  responseDueAt: string | null;
  resolvedAt: string | null;
  adminNotes: string;
  activity: ServiceRequestActivity[];
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Maintenance & reporting
// ---------------------------------------------------------------------------

export type MaintenanceCategory =
  | "maintenance"
  | "update"
  | "backup"
  | "security"
  | "monitoring"
  | "fix"
  | "improvement"
  | "development"
  | "automation"
  | "ai"
  | "infrastructure"
  | "other";

export const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  "maintenance",
  "update",
  "backup",
  "security",
  "monitoring",
  "fix",
  "improvement",
  "development",
  "automation",
  "ai",
  "infrastructure",
  "other",
];

export type MaintenanceLog = {
  id: string;
  clientId: string;
  subscriptionId: string | null;
  title: string;
  category: MaintenanceCategory;
  description: string;
  hoursSpent: number;
  performedBy: string;
  performedAt: string;
  visibleToClient: boolean;
  createdAt: string;
};

export type ReportKind = "monthly" | "health" | "baseline" | "quarterly";

/** Structured report body. All sections optional — render what exists. */
export type ServiceReportData = {
  systemsMonitored?: string[];
  uptimePct?: number;
  backupsCompleted?: number;
  updatesInstalled?: number;
  securityEvents?: string;
  issuesResolved?: number;
  performanceNotes?: string;
  leadMetrics?: { label: string; value: string }[];
  automationActivity?: string;
  aiActivity?: string;
  changesCompleted?: string[];
  recommendations?: string[];
  upcomingPriorities?: string[];
  additionalOpportunities?: string[];
};

export type ServiceReport = {
  id: string;
  clientId: string;
  subscriptionId: string | null;
  kind: ReportKind;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: "draft" | "published";
  summary: string;
  data: ServiceReportData;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Roadmaps
// ---------------------------------------------------------------------------

export type RoadmapItemKind =
  | "current_system"
  | "problem"
  | "completed"
  | "planned"
  | "automation"
  | "ai_opportunity"
  | "security"
  | "integration";

export const ROADMAP_ITEM_KINDS: RoadmapItemKind[] = [
  "current_system",
  "problem",
  "completed",
  "planned",
  "automation",
  "ai_opportunity",
  "security",
  "integration",
];

export type RoadmapItemStatus =
  | "proposed"
  | "approved"
  | "in_progress"
  | "done"
  | "deferred";

export type RoadmapItem = {
  id: string;
  kind: RoadmapItemKind;
  title: string;
  detail: string;
  /** Estimated business impact, in plain language. */
  impact: string;
  timeline: string;
  status: RoadmapItemStatus;
};

export type RoadmapStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "in_progress"
  | "completed";

export type ClientRoadmap = {
  id: string;
  clientId: string;
  subscriptionId: string | null;
  title: string;
  periodLabel: string;
  status: RoadmapStatus;
  summary: string;
  items: RoadmapItem[];
  estimatedImpact: string;
  proposedTimeline: string;
  reviewScheduledFor: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined"
  | "expired";

export type ProposalKind =
  | "implementation"
  | "monthly_service"
  | "implementation_plus_monthly"
  | "project_completion";

export type ProposalImplementation = {
  summary?: string;
  items?: { title: string; detail: string }[];
  costCents?: number;
  depositCents?: number;
  timeline?: string;
  /** Project-completion proposals: what was delivered. */
  delivered?: { title: string; detail: string }[];
  /** Project-completion proposals: ownership & responsibility notes. */
  ownershipNotes?: string;
};

export type ProposalAcceptedScope = {
  implementation: boolean;
  plan: boolean;
  planId?: string;
  billingFrequency?: BillingFrequency;
};

export type Proposal = {
  id: string;
  token: string;
  clientId: string | null;
  leadId: string | null;
  title: string;
  status: ProposalStatus;
  kind: ProposalKind;
  summary: string;
  preparedFor: string;
  implementation: ProposalImplementation;
  planId: string | null;
  alternativePlanIds: string[];
  billingFrequency: BillingFrequency;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  setupFeeCents: number;
  includedSupport: string;
  serviceLevel: string;
  minimumCommitmentMonths: number;
  addons: PlanAddon[];
  contractTerms: string;
  validUntil: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  acceptedScope: ProposalAcceptedScope | null;
  acceptanceName: string;
  acceptanceEmail: string;
  subscriptionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Booking-flow plan recommendation
// ---------------------------------------------------------------------------

/** Answers collected in the booking funnel's ongoing-support questions. */
export type ServicePlanAnswers = {
  /** Do you currently have someone maintaining your website and systems? */
  hasMaintainer?: "yes" | "no" | "partially";
  /** Ongoing changes, or only technical maintenance? */
  ongoingNeeds?: "maintenance_only" | "occasional_changes" | "ongoing_improvements";
  /** Interested in ongoing automation development? */
  automationInterest?: "yes" | "maybe" | "no";
  /** Use AI systems that require management? */
  aiManagement?: "yes" | "planning_to" | "no";
  /** Handle confidential or sensitive business data? */
  sensitiveData?: "yes" | "no" | "unsure";
  /** How quickly do you require support? */
  supportSpeed?: "same_day" | "next_day" | "within_days";
  /** Monthly or annual billing preference? */
  billingPreference?: "monthly" | "annual" | "undecided";
};

export type PlanRecommendation = {
  planKey: StandardPlanKey;
  /** Secondary option worth presenting. */
  alternativeKey: StandardPlanKey | null;
  /** Short consultative explanation of why. */
  reason: string;
};

// ---------------------------------------------------------------------------
// Aggregates (admin dashboard)
// ---------------------------------------------------------------------------

export type RecurringRevenueSummary = {
  activeSubscriptions: number;
  /** Normalized monthly recurring revenue (annual contracts ÷ 12), cents. */
  mrrCents: number;
  arrCents: number;
  byPlan: {
    planId: string;
    planKey: string;
    planName: string;
    count: number;
    mrrCents: number;
  }[];
  pastDue: number;
  pendingCancellation: number;
  cancelledLast90Days: number;
  failedPaymentsLast30Days: number;
};

/** Hours usage for the current service period. */
export type HoursUsage = {
  includedHours: number | null;
  usedHours: number;
  periodStart: string;
  periodEnd: string;
  /** True when usage ≥ 80% of included hours. */
  approachingLimit: boolean;
  overLimit: boolean;
};

export type UpgradeRecommendation = {
  targetPlanKey: StandardPlanKey;
  headline: string;
  reason: string;
};
