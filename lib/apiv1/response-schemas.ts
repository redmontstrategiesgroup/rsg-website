// lib/apiv1/response-schemas.ts
/**
 * Zod schemas for every DTO the v1 API returns. They exist for the OpenAPI
 * document, not for runtime validation: each one mirrors the object literal
 * in `serializers.ts` / `serializers-admin.ts` / `lib/webhooks/endpoints.ts`
 * key for key, and `tests/apiv1-response-schemas.test.ts` proves it.
 *
 * `envelope(X)` / `listEnvelope(X)` produce the full response body the
 * pipeline emits (`{ data }` / `{ data, meta }`), which is what a route's
 * `meta.response` documents.
 */
import { z, type ZodType } from "zod";

const iso = z.string().describe("ISO 8601 timestamp");
const isoNullable = iso.nullable();
const date = z.string().describe("Calendar date, YYYY-MM-DD");
const uuid = z.string().describe("UUID");
const jsonObject = z.record(z.string(), z.unknown());

export function envelope<T extends ZodType>(data: T) {
  return z.object({ data });
}

export function listEnvelope<T extends ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      next_cursor: z.string().nullable().describe("Pass as `cursor` to fetch the next page; null on the last page"),
      limit: z.number().int(),
    }),
  });
}

// ─── Client resources ───────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: uuid,
  code: z.string(),
  name: z.string(),
  summary: z.string(),
  status: z.string(),
  health: z.string(),
  current_phase: z.string(),
  progress: z.number(),
  start_date: date.nullable(),
  target_launch_date: date.nullable(),
  actual_launch_date: date.nullable(),
  created_at: iso,
  updated_at: iso,
});

export const MilestoneSchema = z.object({
  id: uuid,
  project_id: uuid,
  name: z.string(),
  description: z.string(),
  owner_party: z.string(),
  sort_order: z.number().int(),
  status: z.string(),
  starts_on: date.nullable(),
  target_date: date.nullable(),
  completed_on: date.nullable(),
  deliverables: z.array(z.object({ title: z.string(), detail: z.string().optional() })),
  client_action: z.string().nullable(),
  approval_required: z.boolean(),
  approved_at: isoNullable,
  created_at: iso,
  updated_at: iso,
});

export const TaskSchema = z.object({
  id: uuid,
  project_id: uuid,
  milestone_id: uuid.nullable(),
  title: z.string(),
  description: z.string(),
  kind: z.string(),
  assignee_party: z.string(),
  status: z.string(),
  due_at: isoNullable,
  completed_at: isoNullable,
  created_at: iso,
  updated_at: iso,
});

export const ApprovalSchema = z.object({
  id: uuid,
  project_id: uuid,
  milestone_id: uuid.nullable(),
  file_id: uuid.nullable(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  due_at: isoNullable,
  decided_at: isoNullable,
  decided_by_name: z.string().nullable(),
  decision_note: z.string().nullable(),
  created_at: iso,
  updated_at: iso,
});

export const ProjectDetailSchema = ProjectSchema.extend({
  milestones: z.array(MilestoneSchema),
  tasks: z.array(TaskSchema),
  open_approvals: z.array(ApprovalSchema),
});

export const TicketSchema = z.object({
  id: uuid,
  number: z.number().int(),
  project_id: uuid.nullable(),
  category: z.string(),
  priority: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.string(),
  opened_by_name: z.string(),
  first_response_at: isoNullable,
  resolved_at: isoNullable,
  closed_at: isoNullable,
  resolution_notes: z.string().nullable(),
  last_activity_at: iso,
  created_at: iso,
  updated_at: iso,
});

export const MessageSchema = z.object({
  id: uuid,
  ticket_id: uuid,
  author_type: z.string(),
  author_name: z.string(),
  body: z.string(),
  created_at: iso,
  edited_at: isoNullable,
});

export const TicketDetailSchema = TicketSchema.extend({ messages: z.array(MessageSchema) });

export const BriefSchema = z.object({
  id: uuid,
  title: z.string(),
  brief_type: z.string(),
  executive_summary: z.string().nullable(),
  content_markdown: z.string(),
  brief_date: date,
  priority: z.string(),
  status: z.string(),
  received_at: iso,
  created_at: iso,
});

export const FileSchema = z.object({
  id: uuid,
  project_id: uuid.nullable(),
  milestone_id: uuid.nullable(),
  ticket_id: uuid.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  size_bytes: z.number().int(),
  mime_type: z.string(),
  current_version: z.number().int(),
  scan_status: z.string(),
  created_at: iso,
});

export const DownloadSchema = z.object({
  url: z.string().describe("Short-lived signed download URL"),
  name: z.string(),
  size_bytes: z.number().int(),
  expires_in_seconds: z.number().int(),
});

export const InvoiceSchema = z.object({
  id: uuid,
  number: z.number().int(),
  project_id: uuid.nullable(),
  kind: z.string(),
  status: z.string(),
  currency: z.string(),
  description: z.string(),
  line_items: z.array(jsonObject),
  subtotal_cents: z.number().int(),
  tax_cents: z.number().int(),
  total_cents: z.number().int(),
  amount_paid_cents: z.number().int(),
  balance_cents: z.number().int(),
  due_at: isoNullable,
  paid_at: isoNullable,
  created_at: iso,
  updated_at: iso,
});

export const PaymentSchema = z.object({
  id: uuid,
  invoice_id: uuid.nullable(),
  provider: z.string(),
  status: z.string(),
  amount_cents: z.number().int(),
  currency: z.string(),
  method_summary: z.string().nullable(),
  refunded_cents: z.number().int(),
  received_at: isoNullable,
  created_at: iso,
});

export const SubscriptionSchema = z.object({
  id: uuid,
  plan_key: z.string().nullable(),
  plan_name: z.string().nullable(),
  status: z.string(),
  billing_frequency: z.string(),
  monthly_price_cents: z.number().int(),
  annual_price_cents: z.number().int().nullable(),
  currency: z.string(),
  included_hours: z.number().nullable(),
  started_at: isoNullable,
  current_period_start: isoNullable,
  current_period_end: isoNullable,
  cancel_at_period_end: z.boolean(),
});

export const MeSchema = z.object({
  principal: z.enum(["client", "admin"]),
  key: z.object({ id: uuid, name: z.string(), scopes: z.array(z.string()) }),
  client: z.object({ id: uuid, company: z.string(), name: z.string(), email: z.string(), status: z.string() }).optional(),
  admin: z.object({ id: uuid, email: z.string(), role: z.string() }).optional(),
});

// ─── Admin resources ────────────────────────────────────────────────────────

export const LeadSchema = z.object({
  id: uuid,
  name: z.string(),
  company: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  problem: z.string().nullable(),
  improve: z.string().nullable(),
  preferred_contact: z.string().nullable(),
  best_time: z.string().nullable(),
  timeline: z.string().nullable(),
  source: z.string().nullable(),
  status: z.string().nullable(),
  score: z.number().nullable(),
  owner: z.string().nullable(),
  notes: z.string().nullable(),
  recommended_plan: z.string().nullable(),
  page_url: z.string().nullable(),
  referrer: z.string().nullable(),
  utm_source: z.string().nullable(),
  utm_medium: z.string().nullable(),
  utm_campaign: z.string().nullable(),
  utm_content: z.string().nullable(),
  utm_term: z.string().nullable(),
  archived_at: isoNullable,
  created_at: iso,
});

export const ClientAdminSchema = z.object({
  id: uuid,
  name: z.string(),
  email: z.string(),
  company: z.string(),
  plan: z.string().nullable(),
  status: z.string(),
  member_since: date.nullable(),
  strategist: z.string().nullable(),
  lead_id: uuid.nullable(),
  created_at: iso,
  updated_at: iso,
});

export const ProposalSchema = z.object({
  id: uuid,
  opportunity_id: uuid.nullable(),
  lead_id: uuid.nullable(),
  client_id: uuid.nullable(),
  title: z.string(),
  status: z.string(),
  version: z.number().int(),
  currency: z.string(),
  total_cents: z.number().int(),
  deposit_cents: z.number().int(),
  payment_schedule: z.array(jsonObject),
  expires_at: isoNullable,
  sent_at: isoNullable,
  first_viewed_at: isoNullable,
  last_viewed_at: isoNullable,
  approved_at: isoNullable,
  approved_by_name: z.string().nullable(),
  created_at: iso,
  updated_at: iso,
});

/** Dashboard entities (actions / opportunities / risks / ideas) share only `id` and timestamps; the rest varies per entity. */
export const EntitySchema = z.looseObject({ id: uuid, created_at: iso, updated_at: isoNullable });

export const AuditEventSchema = z.object({
  id: uuid,
  actor_type: z.string(),
  actor_id: z.string().nullable(),
  actor_email: z.string().nullable(),
  action: z.string(),
  entity_type: z.string().nullable(),
  entity_id: z.string().nullable(),
  metadata: jsonObject,
  created_at: iso,
});

export const PageViewSchema = z.object({
  at: iso,
  path: z.string(),
  referrer: z.string(),
  visitor: z.string(),
});

// ─── Public resources ───────────────────────────────────────────────────────

export const ServiceSchema = z.object({ id: uuid, name: z.string(), slug: z.string(), description: z.string().nullable().optional() });
export const AppointmentTypeSchema = z.object({
  id: uuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  service_id: uuid,
  duration_minutes: z.number().int(),
  meeting_formats: z.array(z.string()),
  price_cents: z.number().int().nullable().optional(),
});
export const ServicesSchema = z.object({ services: z.array(ServiceSchema), appointment_types: z.array(AppointmentTypeSchema) });

export const IndustrySchema = z.object({ slug: z.string(), name: z.string(), short_name: z.string(), status: z.string() });

export const PlanSchema = z.object({
  id: uuid,
  key: z.string(),
  name: z.string(),
  tagline: z.string(),
  monthly_price_cents: z.number().int().nullable().describe("null = custom pricing"),
  annual_price_cents: z.number().int().nullable(),
  setup_fee_cents: z.number().int(),
  custom_pricing: z.boolean(),
  included_hours: z.number().nullable(),
  support_level: z.string(),
  response_time: z.string(),
  minimum_commitment_months: z.number().int(),
  features: z.array(z.string()),
  recommended: z.boolean(),
});

export const StatusSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  checks: z.object({ database: z.enum(["ok", "unconfigured", "unreachable"]) }),
});

export const SlotSchema = z.object({ start: iso, end: iso, label: z.string() });
export const SlotsSchema = z.object({
  slots: z.array(SlotSchema),
  from: date.optional(),
  to: date.optional(),
  timezone: z.string().optional(),
  paused: z.boolean().optional().describe("Present and true when bookings are paused"),
});

export const BookingCreatedSchema = z.object({
  booking_id: uuid,
  manage_token: z.string(),
  confirmed_url: z.string(),
  recommended_plan_key: z.string().nullable(),
  recommended_plan_name: z.string().nullable(),
});

export const LeadAcceptedSchema = z.object({ accepted: z.literal(true), duplicate: z.boolean().optional() });

// ─── Webhooks ───────────────────────────────────────────────────────────────

export const WebhookEndpointSchema = z.object({
  id: uuid,
  url: z.string(),
  events: z.array(z.string()),
  description: z.string().nullable(),
  enabled: z.boolean(),
  disabled_at: isoNullable,
  failure_count: z.number().int(),
  created_at: iso,
  updated_at: iso,
});

export const WebhookEndpointWithSecretSchema = WebhookEndpointSchema.extend({
  secret: z.string().describe("Shown once, at creation. Starts with `whsec_`."),
});

export const WebhookSecretSchema = z.object({ id: uuid, secret: z.string() });

export const WebhookDeliverySchema = z.object({
  id: uuid,
  event_type: z.string(),
  event_id: uuid.nullable(),
  status: z.string(),
  attempts: z.number().int(),
  max_attempts: z.number().int(),
  response_status: z.number().int().nullable(),
  last_error: z.string().nullable(),
  next_attempt_at: isoNullable,
  delivered_at: isoNullable,
  dead_lettered_at: isoNullable,
  created_at: iso,
});

export const WebhookEventSchema = z.object({ type: z.string(), description: z.string() });

// ─── Shared ─────────────────────────────────────────────────────────────────

export const DeletedSchema = z.object({ id: uuid, deleted: z.literal(true) });
export const QueuedSchema = z.object({ queued: z.number().int() });
/** Raw CSV body (`text/csv`), not the JSON envelope. Pair with `meta.contentType: "text/csv"`. */
export const CsvSchema = z.string().describe("CSV document");
