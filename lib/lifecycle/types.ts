/**
 * Client Lifecycle Platform — domain types.
 *
 * Row types mirror supabase/migrations/20260717090000_client_lifecycle.sql
 * exactly (snake_case, matching the lib/scheduling convention). Status unions
 * are the single source of truth for both the DB CHECK constraints and the UI.
 */

// ---------------------------------------------------------------------------
// Journey / opportunity
// ---------------------------------------------------------------------------

export type OpportunityStage =
  | "qualification"
  | "assessment"
  | "consultation_scheduled"
  | "preparation"
  | "consultation_held"
  | "internal_review"
  | "proposal"
  | "contract"
  | "deposit"
  | "won"
  | "lost"
  | "dormant";

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "qualification",
  "assessment",
  "consultation_scheduled",
  "preparation",
  "consultation_held",
  "internal_review",
  "proposal",
  "contract",
  "deposit",
  "won",
  "lost",
  "dormant",
];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  qualification: "Qualification",
  assessment: "Assessment",
  consultation_scheduled: "Consultation scheduled",
  preparation: "Preparation",
  consultation_held: "Consultation held",
  internal_review: "Internal review",
  proposal: "Proposal",
  contract: "Contract",
  deposit: "Deposit",
  won: "Won",
  lost: "Lost",
  dormant: "Dormant",
};

export type ResponsibleParty = "rsg" | "client" | "joint";

export type SalesOpportunity = {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  assessment_id: string | null;
  name: string;
  service_category: string;
  stage: OpportunityStage;
  value_cents: number | null;
  currency: string;
  owner_admin_id: string | null;
  next_action: string | null;
  next_action_due: string | null;
  next_action_party: ResponsibleParty;
  consultation_notes: string;
  internal_review: Record<string, unknown>;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** Service categories used for routing, templates, and recommendations. */
export type ServiceCategory =
  | "growth_systems"
  | "operations_systems"
  | "business_systems"
  | "private_ai"
  | "website_platform"
  | "not_sure";

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  growth_systems: "Growth Systems",
  operations_systems: "Operations Systems",
  business_systems: "Business Systems",
  private_ai: "Private AI",
  website_platform: "Website & Platform",
  not_sure: "Exploring options",
};

/** Maps a service category to the recommended appointment-type slug. */
export const CATEGORY_APPOINTMENT_SLUGS: Record<ServiceCategory, string> = {
  growth_systems: "growth-systems-consultation",
  operations_systems: "operations-systems-consultation",
  business_systems: "business-systems-consultation",
  private_ai: "private-ai-consultation",
  website_platform: "business-systems-consultation",
  not_sure: "business-systems-consultation",
};

// ---------------------------------------------------------------------------
// Client accounts & team
// ---------------------------------------------------------------------------

export type ClientStatus =
  | "prospect"
  | "onboarding"
  | "active"
  | "paused"
  | "support"
  | "former";

export type ClientUserRole = "owner" | "admin" | "member";

export type ClientUser = {
  id: string;
  client_id: string;
  email: string;
  name: string;
  title: string | null;
  password_hash: string | null;
  role: ClientUserRole;
  invite_token: string | null;
  invite_expires_at: string | null;
  invited_by: string | null;
  last_login_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export type AssessmentStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "reviewed"
  | "expired";

export type Assessment = {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  email: string;
  token: string;
  status: AssessmentStatus;
  current_section: string | null;
  invited_emails: string[];
  score: number | null;
  recommended_service_category: string | null;
  summary: AssessmentSummary | Record<string, never>;
  started_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentResponse = {
  id: string;
  assessment_id: string;
  section_key: string;
  question_key: string;
  answer: unknown;
  answered_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Generated after submission; insight without giving away the full plan. */
export type AssessmentSummary = {
  overview: string;
  priority_problems: string[];
  revenue_opportunities: string[];
  operational_risks: string[];
  recommended_category: ServiceCategory;
  recommended_category_label: string;
  next_steps: string[];
  section_scores: { section_key: string; label: string; score: number; max: number }[];
};

// ---------------------------------------------------------------------------
// Preparation questionnaire
// ---------------------------------------------------------------------------

export type QuestionnaireStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "waived"
  | "expired";

export type Questionnaire = {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  token: string;
  template_key: string;
  status: QuestionnaireStatus;
  invited_emails: string[];
  due_at: string | null;
  submitted_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  brief: PrepBrief | Record<string, never>;
  created_at: string;
  updated_at: string;
};

export type QuestionnaireResponse = {
  id: string;
  questionnaire_id: string;
  question_key: string;
  answer: unknown;
  updated_at: string;
};

/** Internal consultation-preparation brief assembled from answers. */
export type PrepBrief = {
  headline: string;
  goals: string[];
  current_state: string[];
  stack: string[];
  decision_makers: string[];
  constraints: string[];
  success_metrics: string[];
  flags: string[];
  generated_at: string;
};

// ---------------------------------------------------------------------------
// Shared form model (assessment + questionnaire + qualification follow-ups)
// ---------------------------------------------------------------------------

export type FormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "chips"
  | "scale"
  | "boolean"
  | "email"
  | "phone"
  | "url"
  | "file";

export type FormQuestion = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  /** Plain-language explanation of a technical term, shown as a tooltip. */
  tooltip?: string;
  options?: { value: string; label: string; hint?: string }[];
  /** 1–5 scale labels for `scale` questions. */
  scaleLabels?: [string, string];
  /** Show only when a prior answer matches. */
  showIf?: { key: string; anyOf: string[] };
  /** Contribution to section scoring (assessment only). */
  points?: Record<string, number>;
};

export type FormSection = {
  key: string;
  label: string;
  description?: string;
  estimatedMinutes?: number;
  questions: FormQuestion[];
  /** Show entire section only when a prior answer matches. */
  showIf?: { key: string; anyOf: string[] };
};

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "revision_requested"
  | "approved"
  | "expired"
  | "withdrawn";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  revision_requested: "Revision requested",
  approved: "Approved",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

/** Ordered, typed proposal content blocks. */
export type ProposalSectionKey =
  | "executive_summary"
  | "current_challenges"
  | "desired_outcomes"
  | "recommended_system"
  | "scope"
  | "deliverables"
  | "exclusions"
  | "phases"
  | "timeline"
  | "responsibilities"
  | "integrations"
  | "security"
  | "investment"
  | "payment_schedule"
  | "support_options"
  | "assumptions"
  | "next_steps";

export type ProposalSection = {
  key: ProposalSectionKey | string;
  title: string;
  /** Markdown-ish paragraphs (rendered with line breaks, bullets). */
  body: string;
  /** Optional structured items (phases, deliverables, responsibilities…). */
  items?: { title: string; detail?: string; meta?: string }[];
  hidden?: boolean;
};

export type PaymentScheduleEntry = {
  label: string;
  amount_cents: number;
  due: string; // human description ("On approval", "At launch", "Monthly")
};

export type Proposal = {
  id: string;
  opportunity_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  token: string;
  title: string;
  status: ProposalStatus;
  version: number;
  currency: string;
  total_cents: number;
  deposit_cents: number;
  payment_schedule: PaymentScheduleEntry[];
  sections: ProposalSection[];
  created_from_template_key: string | null;
  expires_at: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  total_view_seconds: number;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_ip: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalOptionBilling = "one_time" | "monthly" | "quarterly" | "annual";

export type ProposalOption = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  price_cents: number;
  billing: ProposalOptionBilling;
  selected: boolean;
  sort_order: number;
  created_at: string;
};

export type ProposalEventName =
  | "sent"
  | "opened"
  | "section_viewed"
  | "view_heartbeat"
  | "option_selected"
  | "option_deselected"
  | "comment_added"
  | "revision_requested"
  | "approved"
  | "expired"
  | "withdrawn"
  | "reminder_sent";

export type ProposalEvent = {
  id: string;
  proposal_id: string;
  event: ProposalEventName;
  section_key: string | null;
  actor: "client" | "admin" | "system";
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
};

export type ProposalComment = {
  id: string;
  proposal_id: string;
  author_type: "client" | "admin";
  author_name: string;
  section_key: string | null;
  body: string;
  resolved_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Contracts & signatures
// ---------------------------------------------------------------------------

export type ContractKind =
  | "msa"
  | "project"
  | "sow"
  | "maintenance"
  | "subscription"
  | "nda"
  | "dpa"
  | "change_order";

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  msa: "Master Service Agreement",
  project: "Project Agreement",
  sow: "Statement of Work",
  maintenance: "Maintenance Agreement",
  subscription: "Subscription Agreement",
  nda: "Confidentiality Agreement",
  dpa: "Data Processing Terms",
  change_order: "Change Order Agreement",
};

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_signed"
  | "signed"
  | "countersigned"
  | "active"
  | "declined"
  | "voided"
  | "expired";

export type ContractSection = {
  key: string;
  title: string;
  body: string;
};

export type Contract = {
  id: string;
  opportunity_id: string | null;
  proposal_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  token: string;
  kind: ContractKind;
  title: string;
  status: ContractStatus;
  version: number;
  content: ContractSection[];
  content_hash: string;
  requires_countersign: boolean;
  effective_date: string | null;
  renewal_date: string | null;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractSignature = {
  id: string;
  contract_id: string;
  signer_type: "client" | "admin";
  role: "signer" | "countersigner";
  signer_name: string;
  signer_email: string;
  signer_title: string | null;
  signed_name: string | null;
  initials: string | null;
  acknowledgments: { key: string; label: string; accepted_at: string }[];
  content_hash: string | null;
  ip: string | null;
  user_agent: string | null;
  sort_order: number;
  required: boolean;
  signed_at: string | null;
  created_at: string;
};

export type ContractEvent = {
  id: string;
  contract_id: string;
  event: string;
  actor_type: "client" | "admin" | "system";
  actor_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

export type InvoiceKind =
  | "deposit"
  | "milestone"
  | "subscription"
  | "final"
  | "support"
  | "other";

export type InvoiceStatus =
  | "draft"
  | "open"
  | "processing"
  | "paid"
  | "void"
  | "uncollectible"
  | "refunded";

export type InvoiceLineItem = {
  label: string;
  detail?: string;
  quantity: number;
  unit_cents: number;
};

export type Invoice = {
  id: string;
  number: number;
  client_id: string | null;
  opportunity_id: string | null;
  contract_id: string | null;
  project_id: string | null;
  token: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  currency: string;
  description: string;
  line_items: InvoiceLineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  due_at: string | null;
  paid_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentProvider = "stripe" | "manual" | "ach" | "check" | "other";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type Payment = {
  id: string;
  invoice_id: string | null;
  client_id: string | null;
  provider: PaymentProvider;
  provider_ref: string | null;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  method_summary: string | null;
  failure_reason: string | null;
  refunded_cents: number;
  received_at: string | null;
  recorded_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Projects, milestones, tasks
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "onboarding"
  | "active"
  | "paused"
  | "client_review"
  | "launched"
  | "support"
  | "completed"
  | "archived";

export type ProjectHealth = "on_track" | "at_risk" | "delayed";

export type Project = {
  id: string;
  client_id: string;
  opportunity_id: string | null;
  contract_id: string | null;
  code: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  health: ProjectHealth;
  current_phase: string;
  progress: number;
  start_date: string | null;
  target_launch_date: string | null;
  actual_launch_date: string | null;
  manager_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRole =
  | "manager"
  | "developer"
  | "support"
  | "finance"
  | "viewer"
  | "client_owner"
  | "client_admin"
  | "client_member";

export type ProjectMember = {
  id: string;
  project_id: string;
  member_type: "admin" | "client_user";
  admin_id: string | null;
  client_user_id: string | null;
  project_role: ProjectRole;
  created_at: string;
};

export type MilestoneStatus =
  | "not_started"
  | "upcoming"
  | "in_progress"
  | "waiting_on_client"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "completed"
  | "delayed"
  | "blocked";

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  upcoming: "Upcoming",
  in_progress: "In progress",
  waiting_on_client: "Waiting on you",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  completed: "Completed",
  delayed: "Delayed",
  blocked: "Blocked",
};

/** Milestone statuses that count toward project completion. */
export const MILESTONE_DONE_STATUSES: MilestoneStatus[] = ["approved", "completed"];

export type Milestone = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  owner_party: ResponsibleParty;
  owner_admin_id: string | null;
  sort_order: number;
  status: MilestoneStatus;
  starts_on: string | null;
  target_date: string | null;
  completed_on: string | null;
  depends_on: string | null;
  deliverables: { title: string; detail?: string }[];
  client_action: string | null;
  approval_required: boolean;
  approved_at: string | null;
  approved_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ProjectTaskKind =
  | "general"
  | "onboarding"
  | "file_request"
  | "approval"
  | "training"
  | "access";

export type ProjectTaskStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "done"
  | "cancelled";

export type ProjectTask = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string;
  kind: ProjectTaskKind;
  assignee_party: "rsg" | "client";
  assignee_admin_id: string | null;
  assignee_client_user_id: string | null;
  status: ProjectTaskStatus;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Requests, tickets, messages, files, approvals
// ---------------------------------------------------------------------------

export type RequestCategory =
  | "question"
  | "content"
  | "design_revision"
  | "technical_change"
  | "new_feature"
  | "access_credentials"
  | "billing"
  | "support"
  | "scope_change";

export const REQUEST_CATEGORY_LABELS: Record<RequestCategory, string> = {
  question: "General question",
  content: "Content request",
  design_revision: "Design revision",
  technical_change: "Technical change",
  new_feature: "New feature",
  access_credentials: "Access or credentials",
  billing: "Billing question",
  support: "Support request",
  scope_change: "Change in project scope",
};

/** Categories that typically require a formal change order. */
export const CHANGE_ORDER_CATEGORIES: RequestCategory[] = [
  "new_feature",
  "scope_change",
];

export type RequestPriority = "low" | "normal" | "high" | "urgent";

export type RequestStatus =
  | "open"
  | "in_review"
  | "in_progress"
  | "waiting_on_client"
  | "needs_change_order"
  | "resolved"
  | "closed";

export type ClientRequest = {
  id: string;
  number: number;
  client_id: string;
  project_id: string | null;
  milestone_id: string | null;
  requester_type: "client" | "admin";
  requester_client_user_id: string | null;
  requester_name: string;
  category: RequestCategory;
  priority: RequestPriority;
  title: string;
  description: string;
  status: RequestStatus;
  assigned_admin_id: string | null;
  due_at: string | null;
  resolution: string | null;
  resolved_at: string | null;
  change_order_required: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketCategory =
  | "outage"
  | "bug"
  | "access"
  | "integration"
  | "automation"
  | "data_reporting"
  | "website_update"
  | "training"
  | "feature"
  | "billing"
  | "security";

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  outage: "System unavailable",
  bug: "Bug or error",
  access: "Account access",
  integration: "Integration problem",
  automation: "Automation issue",
  data_reporting: "Data or reporting question",
  website_update: "Website update",
  training: "Training request",
  feature: "Feature request",
  billing: "Billing question",
  security: "Security concern",
};

export type TicketPriority = "low" | "normal" | "high" | "urgent" | "critical";

export type TicketStatus =
  | "submitted"
  | "acknowledged"
  | "in_review"
  | "waiting_on_client"
  | "in_progress"
  | "escalated"
  | "resolved"
  | "closed";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  in_review: "In review",
  waiting_on_client: "Waiting on you",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export type Ticket = {
  id: string;
  number: number;
  client_id: string;
  project_id: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  opened_by_client_user_id: string | null;
  opened_by_name: string;
  assigned_admin_id: string | null;
  target_response_minutes: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_notes: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

export type SlaPolicy = {
  id: string;
  priority: TicketPriority;
  target_response_minutes: number;
  target_resolution_minutes: number;
  enabled: boolean;
  updated_at: string;
};

export type Message = {
  id: string;
  client_id: string;
  project_id: string | null;
  request_id: string | null;
  ticket_id: string | null;
  author_type: "client" | "admin" | "system";
  author_client_user_id: string | null;
  author_admin_id: string | null;
  author_name: string;
  body: string;
  internal: boolean;
  mentions: string[];
  created_at: string;
  edited_at: string | null;
};

export type FileCategory =
  | "brand"
  | "content"
  | "document"
  | "contract"
  | "report"
  | "deliverable"
  | "training"
  | "other";

export type FileScanStatus = "pending" | "clean" | "flagged" | "skipped";

export type StoredFile = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  request_id: string | null;
  ticket_id: string | null;
  questionnaire_id: string | null;
  assessment_id: string | null;
  uploaded_by_type: "client" | "admin" | "system" | "prospect";
  uploaded_by_id: string | null;
  uploaded_by_name: string;
  name: string;
  description: string;
  category: FileCategory;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  current_version: number;
  scan_status: FileScanStatus;
  created_at: string;
  updated_at: string;
};

export type FileVersion = {
  id: string;
  file_id: string;
  version: number;
  storage_path: string;
  size_bytes: number;
  uploaded_by_type: string;
  uploaded_by_name: string;
  note: string;
  created_at: string;
};

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "cancelled";

export type Approval = {
  id: string;
  client_id: string;
  project_id: string | null;
  milestone_id: string | null;
  file_id: string | null;
  title: string;
  description: string;
  status: ApprovalStatus;
  requested_by: string | null;
  due_at: string | null;
  decided_at: string | null;
  decided_by_client_user_id: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainingKind =
  | "video"
  | "guide"
  | "walkthrough"
  | "faq"
  | "download"
  | "recording"
  | "doc";

export type TrainingDifficulty = "beginner" | "intermediate" | "advanced";

export type TrainingItem = {
  id: string;
  title: string;
  description: string;
  kind: TrainingKind;
  system_tag: string;
  topic: string;
  difficulty: TrainingDifficulty;
  audience_role: "all" | ClientUserRole;
  url: string | null;
  storage_path: string | null;
  body: string;
  duration_minutes: number | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingAssignment = {
  id: string;
  training_item_id: string;
  client_id: string;
  client_user_id: string | null;
  project_id: string | null;
  required: boolean;
  due_at: string | null;
  assigned_by: string | null;
  created_at: string;
};

export type TrainingCompletion = {
  id: string;
  training_item_id: string;
  client_id: string;
  client_user_id: string | null;
  completed_at: string;
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export type MetricSource = "measured" | "estimated" | "manual";

export type Metric = {
  id: string;
  client_id: string;
  project_id: string | null;
  period_month: string; // YYYY-MM-01
  key: string;
  label: string;
  value: number;
  unit: string;
  goal: number | null;
  baseline: number | null;
  source: MetricSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportStatus = "draft" | "published";

export type ScorecardEntry = {
  key: string;
  label: string;
  value: number;
  unit: string;
  previous: number | null;
  goal: number | null;
  baseline: number | null;
  source: MetricSource;
};

export type MonthlyReport = {
  id: string;
  client_id: string;
  project_id: string | null;
  token: string;
  period_month: string;
  title: string;
  status: ReportStatus;
  executive_summary: string;
  key_wins: string[];
  scorecard: ScorecardEntry[];
  goal_progress: { goal: string; progress: string; on_track: boolean }[];
  risks: string[];
  recommendations: string[];
  next_priorities: string[];
  expansion_notes: string;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Renewals & expansion
// ---------------------------------------------------------------------------

export type RenewalKind =
  | "contract"
  | "subscription"
  | "support_plan"
  | "review_meeting";

export type RenewalStatus =
  | "upcoming"
  | "notice_sent"
  | "in_discussion"
  | "renewed"
  | "lapsed"
  | "cancelled";

export type Renewal = {
  id: string;
  client_id: string;
  contract_id: string | null;
  kind: RenewalKind;
  name: string;
  renews_on: string;
  term: string;
  value_cents: number | null;
  status: RenewalStatus;
  reminder_days: number[];
  last_reminded_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type ExpansionStatus =
  | "identified"
  | "recommended"
  | "discussing"
  | "planned"
  | "proposed"
  | "approved"
  | "in_progress"
  | "completed"
  | "not_needed";

export const EXPANSION_STATUS_LABELS: Record<ExpansionStatus, string> = {
  identified: "Identified",
  recommended: "Recommended",
  discussing: "Discussing",
  planned: "Planned",
  proposed: "Proposed",
  approved: "Approved",
  in_progress: "In progress",
  completed: "Completed",
  not_needed: "Not currently needed",
};

export type ExpansionItem = {
  id: string;
  client_id: string;
  title: string;
  problem: string;
  solution: string;
  expected_outcome: string;
  priority: "low" | "medium" | "high";
  timing: string;
  dependencies: string;
  investment_range: string;
  status: ExpansionStatus;
  source: "manual" | "report" | "support" | "assessment" | "project";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Notifications, automations, activity
// ---------------------------------------------------------------------------

export type LifecycleNotification = {
  id: string;
  audience: "client" | "admin";
  client_id: string | null;
  client_user_id: string | null;
  admin_id: string | null;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  email_sent: boolean;
  created_at: string;
};

export type AutomationChannel = "email" | "in_app" | "both" | "none";

export type AutomationSetting = {
  id: string;
  enabled: boolean;
  delay_minutes: number;
  channel: AutomationChannel;
  conditions: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
};

export type AutomationRunStatus = "pending" | "completed" | "failed" | "skipped";

export type AutomationRun = {
  id: string;
  automation_key: string;
  dedupe_key: string;
  entity_type: string;
  entity_id: string;
  status: AutomationRunStatus;
  scheduled_for: string;
  executed_at: string | null;
  attempts: number;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ClientActivity = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  actor_type: "client" | "admin" | "system" | "prospect";
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  visible_to_client: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Journey stage model (computed; drives "what happens next" everywhere)
// ---------------------------------------------------------------------------

export type JourneyStep = {
  key: string;
  label: string;
  status: "complete" | "current" | "upcoming" | "skipped";
  /** What has to happen to advance. */
  next_action?: string;
  responsible?: ResponsibleParty;
  due?: string | null;
  href?: string | null;
};

// ---------------------------------------------------------------------------
// Money helpers (shared formatting)
// ---------------------------------------------------------------------------

export function formatCents(cents: number | null | undefined, currency = "usd"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
