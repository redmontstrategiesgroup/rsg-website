/** Shared scheduling domain types (client + server safe). */

export type MeetingFormat =
  | "phone"
  | "google_meet"
  | "zoom"
  | "microsoft_teams"
  | "in_person"
  | "custom_link"
  | "custom_location";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "yes_no"
  | "number"
  | "currency"
  | "date"
  | "rating"
  | "conditional";

export type QualificationOutcome =
  | "qualified"
  | "manual_review"
  | "not_eligible";

export type BookingStatus =
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export type SchedulingLeadStatus =
  | "intake_started"
  | "intake_abandoned"
  | "submitted"
  | "qualified"
  | "qualified_not_booked"
  | "appointment_booked"
  | "manual_review"
  | "not_eligible"
  | "rescheduled"
  | "cancelled"
  | "no_show"
  | "completed"
  | "follow_up_required"
  | "converted"
  | "closed"
  // Legacy (still accepted)
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "won"
  | "lost"
  | "spam"
  | "archived";

export const SCHEDULING_LEAD_STATUSES: SchedulingLeadStatus[] = [
  "intake_started",
  "intake_abandoned",
  "submitted",
  "qualified",
  "qualified_not_booked",
  "appointment_booked",
  "manual_review",
  "not_eligible",
  "rescheduled",
  "cancelled",
  "no_show",
  "completed",
  "follow_up_required",
  "converted",
  "closed",
  "new",
  "contacted",
  "spam",
  "archived",
];

export type Service = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  active: boolean;
};

export type AppointmentType = {
  id: string;
  name: string;
  internal_name?: string | null;
  public_description?: string | null;
  service_id?: string | null;
  slug: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  team_member_id?: string | null;
  meeting_formats: MeetingFormat[];
  location?: string | null;
  color: string;
  max_bookings_per_day?: number | null;
  max_bookings_per_week?: number | null;
  price_cents?: number | null;
  confirmation_message?: string | null;
  reminder_offsets_minutes: number[];
  active: boolean;
  is_public: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  role: string;
  color: string;
  active: boolean;
};

export type QualificationQuestion = {
  id: string;
  form_id: string;
  key: string;
  label: string;
  help_text?: string | null;
  question_type: QuestionType;
  options: string[];
  required: boolean;
  sort_order: number;
  point_map: Record<string, number>;
  max_points: number;
  parent_question_id?: string | null;
  show_when?: { parent_key?: string; equals?: string | string[] } | null;
  service_ids?: string[] | null;
  active: boolean;
};

export type HardRule = {
  id: string;
  field: string;
  op: "eq" | "neq" | "in" | "not_in" | "lt" | "gt" | "contains";
  value: string | number | string[];
  outcome: QualificationOutcome;
  label: string;
};

export type QualificationRuleSet = {
  id: string;
  form_id: string;
  name: string;
  status: "draft" | "published" | "archived";
  min_qualifying_score: number;
  manual_review_min_score?: number | null;
  manual_review_max_score?: number | null;
  allow_calendar_on_manual_review: boolean;
  outcome_messages: Partial<Record<QualificationOutcome, string>>;
  hard_rules: HardRule[];
  service_rules: unknown[];
  priority_thresholds: { high: number; medium: number; low: number };
};

export type ContactInfo = {
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  website?: string;
  industry?: string;
  businessLocation?: string;
  employeeCount?: string;
  monthlyRevenueRange?: string;
  heardAbout?: string;
};

export type Attribution = {
  pageUrl?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPage?: string;
  deviceType?: string;
};

export type BookingSession = {
  id: string;
  token: string;
  step: string;
  service_id?: string | null;
  appointment_type_id?: string | null;
  lead_id?: string | null;
  contact: Partial<ContactInfo>;
  answers: Record<string, unknown>;
  qualification_outcome?: QualificationOutcome | null;
  qualification_score?: number | null;
  timezone?: string | null;
  meeting_format?: string | null;
  attribution: Attribution;
  is_test: boolean;
  expires_at: string;
  completed_at?: string | null;
};

export type TimeSlot = {
  start: string; // ISO UTC
  end: string;
  label: string; // visitor-local display
};

export type Booking = {
  id: string;
  lead_id?: string | null;
  session_id?: string | null;
  appointment_type_id?: string | null;
  team_member_id?: string | null;
  service_id?: string | null;
  starts_at: string;
  ends_at: string;
  visitor_timezone: string;
  admin_timezone: string;
  meeting_format: string;
  meeting_location?: string | null;
  meeting_link?: string | null;
  status: BookingStatus;
  manage_token: string;
  ical_uid: string;
  ical_sequence: number;
  visitor_notes?: string | null;
  internal_notes?: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
};

export type SchedulingSettings = {
  id: string;
  admin_timezone: string;
  internal_notification_emails: string[];
  sender_name: string;
  reply_to: string;
  bookings_paused: boolean;
  abandon_hours: number;
  max_follow_ups: number;
  cancel_cutoff_minutes: number;
  reschedule_cutoff_minutes: number;
};

export type QualificationComputeResult = {
  totalScore: number;
  maxScore: number;
  outcome: QualificationOutcome;
  priority: "high" | "medium" | "low";
  ruleHits: { id: string; label: string; outcome: string }[];
  scoreBreakdown: Record<string, number>;
  message: string;
  allowCalendar: boolean;
};

export const MEETING_FORMAT_LABELS: Record<MeetingFormat, string> = {
  phone: "Phone call",
  google_meet: "Google Meet",
  zoom: "Zoom",
  microsoft_teams: "Microsoft Teams",
  in_person: "In-person meeting",
  custom_link: "Custom meeting link",
  custom_location: "Custom location",
};

export const EMPLOYEE_COUNT_OPTIONS = [
  "1 – 5",
  "6 – 20",
  "21 – 50",
  "51 – 200",
  "200+",
];

export const MONTHLY_REVENUE_OPTIONS = [
  "Under $10k",
  "$10k – $50k",
  "$50k – $150k",
  "$150k – $500k",
  "$500k+",
  "Prefer not to say",
];

export const HEARD_ABOUT_OPTIONS = [
  "Google search",
  "Referral",
  "LinkedIn",
  "Existing client",
  "Connect page",
  "Chat",
  "Other",
];
