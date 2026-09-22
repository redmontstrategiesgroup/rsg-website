// lib/apiv1/serializers.ts
/**
 * DTO serializers for the public API. Each `toXDto` is an explicit object
 * literal picking exactly the listed keys — never a spread of the source
 * row — so internal/sensitive columns can never leak by accident.
 */
import type {
  Project,
  Milestone,
  ProjectTask,
  Approval,
  Ticket,
  Message,
  StoredFile,
  Invoice,
  Payment,
} from "../lifecycle/types.ts";
import type { ClientSubscription } from "../managed-services/types.ts";

export const DENYLIST = [
  "password_hash",
  "passwordHash",
  "configuration_encrypted",
  "key_hash",
  "secret",
  "mfa_secret",
  "mfaSecret",
  "notes",
  "storage_path",
  "token",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "raw_payload",
  "internal",
];

export function toProjectDto(p: Project) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    summary: p.summary,
    status: p.status,
    health: p.health,
    current_phase: p.current_phase,
    progress: p.progress,
    start_date: p.start_date,
    target_launch_date: p.target_launch_date,
    actual_launch_date: p.actual_launch_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export function toMilestoneDto(m: Milestone) {
  return {
    id: m.id,
    project_id: m.project_id,
    name: m.name,
    description: m.description,
    owner_party: m.owner_party,
    sort_order: m.sort_order,
    status: m.status,
    starts_on: m.starts_on,
    target_date: m.target_date,
    completed_on: m.completed_on,
    deliverables: m.deliverables,
    client_action: m.client_action,
    approval_required: m.approval_required,
    approved_at: m.approved_at,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export function toTaskDto(t: ProjectTask) {
  return {
    id: t.id,
    project_id: t.project_id,
    milestone_id: t.milestone_id,
    title: t.title,
    description: t.description,
    kind: t.kind,
    assignee_party: t.assignee_party,
    status: t.status,
    due_at: t.due_at,
    completed_at: t.completed_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export function toApprovalDto(a: Approval) {
  return {
    id: a.id,
    project_id: a.project_id,
    milestone_id: a.milestone_id,
    file_id: a.file_id,
    title: a.title,
    description: a.description,
    status: a.status,
    due_at: a.due_at,
    decided_at: a.decided_at,
    decided_by_name: a.decided_by_name,
    decision_note: a.decision_note,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

export function toTicketDto(t: Ticket) {
  return {
    id: t.id,
    number: t.number,
    project_id: t.project_id,
    category: t.category,
    priority: t.priority,
    subject: t.subject,
    description: t.description,
    status: t.status,
    opened_by_name: t.opened_by_name,
    first_response_at: t.first_response_at,
    resolved_at: t.resolved_at,
    closed_at: t.closed_at,
    resolution_notes: t.resolution_notes,
    last_activity_at: t.last_activity_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

/** Callers must filter `internal` messages out before serializing. */
export function toMessageDto(m: Message) {
  return {
    id: m.id,
    ticket_id: m.ticket_id,
    author_type: m.author_type,
    author_name: m.author_name,
    body: m.body,
    created_at: m.created_at,
    edited_at: m.edited_at,
  };
}

export function toFileDto(f: StoredFile) {
  return {
    id: f.id,
    project_id: f.project_id,
    milestone_id: f.milestone_id,
    ticket_id: f.ticket_id,
    name: f.name,
    description: f.description,
    category: f.category,
    size_bytes: f.size_bytes,
    mime_type: f.mime_type,
    current_version: f.current_version,
    scan_status: f.scan_status,
    created_at: f.created_at,
  };
}

export function toInvoiceDto(i: Invoice) {
  return {
    id: i.id,
    number: i.number,
    project_id: i.project_id,
    kind: i.kind,
    status: i.status,
    currency: i.currency,
    description: i.description,
    line_items: i.line_items,
    subtotal_cents: i.subtotal_cents,
    tax_cents: i.tax_cents,
    total_cents: i.total_cents,
    amount_paid_cents: i.amount_paid_cents,
    balance_cents: (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0),
    due_at: i.due_at,
    paid_at: i.paid_at,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

export function toPaymentDto(p: Payment) {
  return {
    id: p.id,
    invoice_id: p.invoice_id,
    provider: p.provider,
    status: p.status,
    amount_cents: p.amount_cents,
    currency: p.currency,
    method_summary: p.method_summary,
    refunded_cents: p.refunded_cents,
    received_at: p.received_at,
    created_at: p.created_at,
  };
}

export function toSubscriptionDto(s: ClientSubscription) {
  return {
    id: s.id,
    plan_key: s.planKey ?? null,
    plan_name: s.planName ?? null,
    status: s.status,
    billing_frequency: s.billingFrequency,
    monthly_price_cents: s.monthlyPriceCents,
    annual_price_cents: s.annualPriceCents,
    currency: s.currency,
    included_hours: s.includedHours,
    started_at: s.startedAt,
    current_period_start: s.currentPeriodStart,
    current_period_end: s.currentPeriodEnd,
    cancel_at_period_end: s.cancelAtPeriodEnd,
  };
}

export type BriefRow = {
  id: string;
  title: string;
  brief_type: string;
  executive_summary: string | null;
  content_markdown: string;
  brief_date: string;
  priority: string;
  status: string;
  received_at: string;
  created_at: string;
};

export function toBriefDto(b: BriefRow) {
  return {
    id: b.id,
    title: b.title,
    brief_type: b.brief_type,
    executive_summary: b.executive_summary,
    content_markdown: b.content_markdown,
    brief_date: b.brief_date,
    priority: b.priority,
    status: b.status,
    received_at: b.received_at,
    created_at: b.created_at,
  };
}
