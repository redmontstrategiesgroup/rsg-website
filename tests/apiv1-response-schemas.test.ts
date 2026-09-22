import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { z } from "zod";
import * as s from "../lib/apiv1/serializers.ts";
import * as sa from "../lib/apiv1/serializers-admin.ts";
import { toDeliveryDto, toEndpointDto } from "../lib/webhooks/endpoints.ts";
import * as R from "../lib/apiv1/response-schemas.ts";

const U = "11111111-1111-4111-8111-111111111111";
const T = "2026-09-21T12:00:00.000Z";

/** The DTO parses, AND the schema names every key the serializer emits (a schema missing a field is a documentation bug). */
function conforms(name: string, schema: z.ZodObject, dto: Record<string, unknown>) {
  const r = schema.safeParse(dto);
  assert.ok(r.success, `${name}: ${r.success ? "" : JSON.stringify(r.error.issues)}`);
  for (const k of Object.keys(dto)) assert.ok(k in schema.shape, `${name}: schema is missing key "${k}"`);
  for (const k of Object.keys(schema.shape)) assert.ok(k in dto, `${name}: schema has extra key "${k}"`);
}

describe("response schemas mirror the serializers", () => {
  it("project / milestone / task / approval", () => {
    conforms("project", R.ProjectSchema, s.toProjectDto({ id: U, client_id: U, code: "P-1", name: "Site", summary: "s", status: "active", health: "on_track", current_phase: "build", progress: 40, start_date: "2026-01-01", target_launch_date: null, actual_launch_date: null, created_at: T, updated_at: T } as never));
    conforms("milestone", R.MilestoneSchema, s.toMilestoneDto({ id: U, project_id: U, name: "M", description: "d", owner_party: "rsg", sort_order: 1, status: "planned", starts_on: null, target_date: "2026-02-01", completed_on: null, deliverables: [{ title: "x" }], client_action: null, approval_required: false, approved_at: null, created_at: T, updated_at: T } as never));
    conforms("task", R.TaskSchema, s.toTaskDto({ id: U, project_id: U, milestone_id: null, title: "t", description: "d", kind: "client", assignee_party: "client", status: "todo", due_at: null, completed_at: null, created_at: T, updated_at: T } as never));
    conforms("approval", R.ApprovalSchema, s.toApprovalDto({ id: U, project_id: U, milestone_id: null, file_id: null, title: "a", description: "d", status: "pending", due_at: null, decided_at: null, decided_by_name: null, decision_note: null, created_at: T, updated_at: T } as never));
  });
  it("ticket / message / brief / file", () => {
    conforms("ticket", R.TicketSchema, s.toTicketDto({ id: U, number: 12, project_id: null, category: "bug", priority: "high", subject: "s", description: "d", status: "open", opened_by_name: "A", first_response_at: null, resolved_at: null, closed_at: null, resolution_notes: null, last_activity_at: T, created_at: T, updated_at: T } as never));
    conforms("message", R.MessageSchema, s.toMessageDto({ id: U, ticket_id: U, author_type: "client", author_name: "A", body: "b", created_at: T, edited_at: null } as never));
    conforms("brief", R.BriefSchema, s.toBriefDto({ id: U, title: "t", brief_type: "weekly", executive_summary: null, content_markdown: "#", brief_date: "2026-09-21", priority: "normal", status: "sent", received_at: T, created_at: T }));
    conforms("file", R.FileSchema, s.toFileDto({ id: U, project_id: null, milestone_id: null, ticket_id: null, name: "f.pdf", description: null, category: "deliverable", size_bytes: 10, mime_type: "application/pdf", current_version: 1, scan_status: "clean", created_at: T } as never));
  });
  it("invoice / payment / subscription", () => {
    conforms("invoice", R.InvoiceSchema, s.toInvoiceDto({ id: U, number: 7, project_id: null, kind: "deposit", status: "sent", currency: "usd", description: "d", line_items: [{ label: "x", amount_cents: 10 }], subtotal_cents: 10, tax_cents: 0, total_cents: 10, amount_paid_cents: 4, due_at: null, paid_at: null, created_at: T, updated_at: T } as never));
    conforms("payment", R.PaymentSchema, s.toPaymentDto({ id: U, invoice_id: U, provider: "stripe", status: "succeeded", amount_cents: 10, currency: "usd", method_summary: null, refunded_cents: 0, received_at: T, created_at: T } as never));
    conforms("subscription", R.SubscriptionSchema, s.toSubscriptionDto({ id: U, planKey: "growth", planName: "Growth", status: "active", billingFrequency: "monthly", monthlyPriceCents: 1000, annualPriceCents: null, currency: "usd", includedHours: 10, startedAt: T, currentPeriodStart: T, currentPeriodEnd: T, cancelAtPeriodEnd: false } as never));
  });
  it("lead / client / proposal / audit / pageview / entity", () => {
    conforms("lead", R.LeadSchema, sa.toLeadDto({ id: U, name: "n", business_name: "b", website: null, email: "e@x.com", phone: null, industry: null, biggest_problem: null, improvement_goal: null, preferred_contact: null, best_time: null, timeline: null, page_url: null, referrer: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, lead_score: 3, source: "web", status: "new", notes: null, owner: null, archived_at: null, created_at: T, deleted_at: null }));
    conforms("client", R.ClientAdminSchema, sa.toClientAdminDto({ id: U, email: "e", name: "n", company: "c", plan: null, member_since: null, strategist: null, status: "active", lead_id: null, created_at: T, updated_at: T }));
    conforms("proposal", R.ProposalSchema, sa.toProposalDto({ id: U, opportunity_id: null, lead_id: null, client_id: null, title: "t", status: "draft", version: 1, currency: "usd", total_cents: 100, deposit_cents: 50, payment_schedule: [], expires_at: null, sent_at: null, first_viewed_at: null, last_viewed_at: null, approved_at: null, approved_by_name: null, created_at: T, updated_at: T } as never));
    conforms("audit", R.AuditEventSchema, sa.toAuditEventDto({ id: U, actor_type: "admin", actor_id: null, actor_email: null, action: "x", entity_type: null, entity_id: null, metadata: {}, ip: null, user_agent: null, created_at: T }));
    conforms("pageview", R.PageViewSchema, sa.toPageViewDto({ vid: "v", path: "/", referrer: "", at: T }));
    const entity = sa.toEntityDto("risks", { id: U, created_at: T, title: "r" });
    assert.ok(R.EntitySchema.safeParse(entity).success);
  });
  it("webhook endpoint / delivery", () => {
    conforms("endpoint", R.WebhookEndpointSchema, toEndpointDto({ id: U, url: "https://x", events: ["ping"], description: null, enabled: true, disabled_at: null, failure_count: 0, created_at: T, updated_at: T } as never));
    conforms("endpoint+secret", R.WebhookEndpointWithSecretSchema, { ...toEndpointDto({ id: U, url: "https://x", events: [], description: null, enabled: true, disabled_at: null, failure_count: 0, created_at: T, updated_at: T } as never), secret: "whsec_x" });
    conforms("delivery", R.WebhookDeliverySchema, toDeliveryDto({ id: U, endpoint_id: U, event_type: "ping", event_id: null, status: "pending", attempts: 0, max_attempts: 8, response_status: null, last_error: null, next_attempt_at: null, delivered_at: null, dead_lettered_at: null, created_at: T }));
  });
  it("envelopes", () => {
    assert.ok(R.listEnvelope(R.TicketSchema).safeParse({ data: [], meta: { next_cursor: null, limit: 25 } }).success);
    assert.ok(R.envelope(R.DeletedSchema).safeParse({ data: { id: U, deleted: true } }).success);
    assert.equal(R.envelope(R.DeletedSchema).safeParse({ data: { id: U, deleted: false } }).success, false);
  });
});
