import "./_alias-hook.ts";
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const emitted: { type: string; data: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
mock.module("@/lib/webhooks/emit", { namedExports: {
  emitEvent: async (type: string, data: Record<string, unknown>, opts: Record<string, unknown>) => { emitted.push({ type, data, opts }); return { queued: 1 }; },
  sendTestEvent: async () => ({ queued: 1 }),
} });
mock.module("@/lib/webhooks/outbox", { namedExports: { enqueue: async () => ({ queued: 0 }), deliverBatch: async () => ({ delivered: 0, retrying: 0, dead: 0, released: 0 }), replayDeadLetters: async () => ({ replayed: 0 }), outboxHealth: async () => ({ pending: 0, sending: 0, dead: 0 }), backoffMs: () => 0, isRetryableStatus: () => true } });

let row: Record<string, unknown> = {};
let rpcResult: Record<string, unknown> = {};
function fakeSb() {
  return {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "or", "order", "limit", "insert", "update", "delete", "gt", "neq", "lt"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: row, error: null });
      q.single = async () => ({ data: row, error: null });
      q.then = (r: (v: unknown) => void) => r({ data: [row], error: null });
      return q;
    },
    rpc: async () => ({ data: rpcResult, error: null }),
    storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: { signedUrl: "u", token: "t" }, error: null }) }) },
  };
}
mock.module("@/lib/supabase", { namedExports: { getSupabase: () => fakeSb(), isSupabaseConfigured: () => true, assertSupabaseConfigured: () => {} } });
mock.module("@/lib/lifecycle/core", { namedExports: {
  requireSupabase: () => fakeSb(), nowIso: () => "2026-09-20T00:00:00.000Z", newToken: () => "tok", siteUrl: () => "http://x",
  FILES_BUCKET: "rsg-files", links: {}, firstNameOf: () => "A", periodMonth: () => "2026-09", periodLabel: () => "Sep 2026",
  LifecycleUnavailableError: class extends Error {},
} });
mock.module("@/lib/lifecycle/activity", { namedExports: { logClientActivity: async () => {}, listClientActivity: async () => [], listRecentActivity: async () => [] } });

const ingest = await import("../lib/briefs/ingest.ts");
const files = await import("../lib/lifecycle/files.ts");
const billing = await import("../lib/lifecycle/billing.ts");
const proposals = await import("../lib/lifecycle/proposals.ts");
const schedulingWebhooks = await import("../lib/scheduling/webhooks.ts");

const CLIENT = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const T = "2026-09-20T00:00:00.000Z";
const last = () => emitted.at(-1)!;

describe("domain call sites emit", () => {
  beforeEach(() => { emitted.length = 0; });

  it("ingestBrief emits brief.received for a new brief, not a duplicate", async () => {
    rpcResult = { duplicate: true, briefId: ID };
    await ingest.ingestBrief({ title: "t", brief_date: "2026-09-20", sections: [] } as never, "k-12345678", "api", CLIENT);
    assert.equal(emitted.length, 0);
    rpcResult = { duplicate: false, briefId: ID };
    row = { id: ID, title: "t", brief_type: "daily_executive", executive_summary: null, content_markdown: "", brief_date: "2026-09-20", priority: "medium", status: "published", received_at: T, created_at: T, raw_payload: { LEAK: 1 } };
    await ingest.ingestBrief({ title: "t", brief_date: "2026-09-20", sections: [] } as never, "k-12345679", "api", CLIENT);
    assert.equal(last().type, "brief.received"); assert.equal(last().opts.entityId, ID); assert.equal(last().opts.clientId, CLIENT);
    assert.equal("raw_payload" in last().data, false);
  });
  it("createFileRecord emits file.uploaded", async () => {
    row = { id: ID, client_id: CLIENT, project_id: null, milestone_id: null, request_id: null, ticket_id: null, questionnaire_id: null, assessment_id: null, uploaded_by_type: "client", uploaded_by_id: null, uploaded_by_name: "n", name: "f.pdf", description: "", category: "deliverable", storage_path: "LEAK/path", size_bytes: 10, mime_type: "application/pdf", current_version: 1, scan_status: "pending", created_at: T };
    await files.createFileRecord({ clientId: CLIENT, name: "f.pdf", sizeBytes: 10, mimeType: "application/pdf", uploadedByType: "client", uploadedByName: "n", category: "deliverable" } as never);
    assert.equal(last().type, "file.uploaded"); assert.equal(last().opts.clientId, CLIENT);
    assert.equal("storage_path" in last().data, false);
  });
  it("createInvoice emits invoice.created", async () => {
    row = { id: ID, number: 1, client_id: CLIENT, opportunity_id: null, contract_id: null, project_id: null, token: "LEAK", kind: "project", status: "draft", currency: "usd", description: "", line_items: [], subtotal_cents: 100, tax_cents: 0, total_cents: 100, amount_paid_cents: 0, due_at: null, paid_at: null, reminder_count: 0, last_reminded_at: null, stripe_checkout_session_id: null, stripe_payment_intent_id: null, created_by: null, created_at: T, updated_at: T };
    await billing.createInvoice({ clientId: CLIENT, kind: "project", description: "", lineItems: [{ description: "x", quantity: 1, unitCents: 100 }] } as never);
    assert.equal(last().type, "invoice.created"); assert.equal(last().opts.clientId, CLIENT);
    assert.equal("token" in last().data, false);
  });
  it("approveProposal → proposal.accepted; requestRevision → proposal.declined", async () => {
    row = { id: ID, opportunity_id: null, lead_id: null, client_id: CLIENT, token: "LEAK", title: "P", status: "sent", version: 1, currency: "usd", total_cents: 1, deposit_cents: 0, payment_schedule: [], sections: [], created_from_template_key: null, expires_at: null, sent_at: T, first_viewed_at: null, last_viewed_at: null, total_view_seconds: 0, approved_at: null, approved_by_name: null, approved_ip: null, created_by: null, created_at: T, updated_at: T };
    await proposals.approveProposal(ID, { name: "Ann", ip: "1.1.1.1" });
    assert.equal(last().type, "proposal.accepted"); assert.equal(last().opts.entityId, ID); assert.equal("token" in last().data, false);
    await proposals.requestRevision(ID, { name: "Ann", note: "more" });
    assert.equal(last().type, "proposal.declined");
  });
  it("scheduling enqueueWebhook routes catalogued booking events through emitEvent with snake_case data", async () => {
    await schedulingWebhooks.enqueueWebhook("booking.created", { bookingId: ID, leadId: "l1", startsAt: T }, { eventId: `booking.created:${ID}` });
    assert.equal(last().type, "booking.created"); assert.equal(last().opts.entityId, ID);
    assert.deepEqual(last().data, { booking_id: ID, lead_id: "l1", starts_at: T });
    await schedulingWebhooks.enqueueWebhook("booking.rescheduled", { bookingId: ID, startsAt: T }, { eventId: `booking.rescheduled:${ID}:${T}` });
    assert.equal(last().type, "booking.rescheduled"); assert.equal(last().opts.version, T);
    const before = emitted.length;
    await schedulingWebhooks.enqueueWebhook("legacy.event", { x: 1 });
    assert.equal(emitted.length, before);
  });
});
