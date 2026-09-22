import "./_alias-hook.ts";
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const emitted: { type: string; data: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
mock.module("@/lib/webhooks/emit", { namedExports: {
  emitEvent: async (type: string, data: Record<string, unknown>, opts: Record<string, unknown>) => { emitted.push({ type, data, opts }); return { queued: 1 }; },
  sendTestEvent: async () => ({ queued: 1 }),
} });

/**
 * Generic fake: every chain method returns the builder; terminal calls resolve
 * the current `row`. Functions that load related rows (projects, milestones)
 * get them from `related`.
 */
let row: Record<string, unknown> = {};
let related: Record<string, Record<string, unknown> | Record<string, unknown>[]> = {};
function fakeSb() {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "or", "order", "limit", "insert", "update", "delete", "gt", "neq"]) q[m] = () => q;
      const pick = () => (related[table] as Record<string, unknown> | undefined) ?? row;
      q.maybeSingle = async () => ({ data: pick(), error: null });
      q.single = async () => ({ data: pick(), error: null });
      q.then = (r: (v: unknown) => void) => {
        const list = related[`${table}[]`] as Record<string, unknown>[] | undefined;
        r({ data: list ?? [pick()], error: null });
      };
      return q;
    },
    rpc: async () => ({ data: 1, error: null }),
  };
}
mock.module("@/lib/lifecycle/core", { namedExports: {
  requireSupabase: () => fakeSb(), nowIso: () => "2026-09-20T00:00:00.000Z", newToken: () => "tok", siteUrl: () => "http://x",
  FILES_BUCKET: "rsg-files", links: {}, firstNameOf: () => "A", periodMonth: () => "2026-09", periodLabel: () => "Sep 2026",
  LifecycleUnavailableError: class extends Error {},
} });
mock.module("@/lib/lifecycle/activity", { namedExports: { logClientActivity: async () => {}, listClientActivity: async () => [], listRecentActivity: async () => [] } });

const projects = await import("../lib/lifecycle/projects.ts");
const workspace = await import("../lib/lifecycle/workspace.ts");
const support = await import("../lib/lifecycle/support.ts");

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const T = "2026-09-20T00:00:00.000Z";
const projectRow = { id: PROJECT, client_id: CLIENT, code: "P1", name: "P", summary: "", status: "active", health: "on_track", current_phase: "build", progress: 0, start_date: null, target_launch_date: null, actual_launch_date: null, manager_admin_id: null, opportunity_id: null, contract_id: null, created_at: T, updated_at: T };
const milestoneRow = (status: string) => ({ id: ID, project_id: PROJECT, name: "M", description: "", owner_party: "rsg", owner_admin_id: null, sort_order: 1, status, starts_on: null, target_date: null, completed_on: null, depends_on: null, deliverables: [], client_action: null, approval_required: true, approved_at: null, approved_by: null, notes: "", created_at: T, updated_at: T });

function last() { return emitted.at(-1)!; }

describe("lifecycle call sites emit", () => {
  beforeEach(() => { emitted.length = 0; related = {}; });

  it("createTicket → ticket.created with the client id", async () => {
    row = { id: ID, client_id: CLIENT, number: 7, status: "open", subject: "s", description: "d", category: "bug", priority: "normal", project_id: null, opened_by_name: "n", created_at: T, updated_at: T, last_activity_at: T, opened_by_client_user_id: null, assigned_admin_id: null, target_response_minutes: null, first_response_at: null, resolved_at: null, closed_at: null, resolution_notes: null };
    await support.createTicket({ clientId: CLIENT, category: "bug", subject: "s", description: "d", openedByName: "n" });
    assert.equal(emitted.length, 1);
    assert.equal(last().type, "ticket.created"); assert.equal(last().opts.entityId, ID); assert.equal(last().opts.clientId, CLIENT);
    assert.equal("resolution_notes" in last().data, true);
  });
  it("resolveTicket → ticket.resolved", async () => {
    row = { ...row, status: "resolved", resolved_at: T };
    await support.resolveTicket(ID, { resolutionNotes: "done" } as never);
    assert.equal(last().type, "ticket.resolved"); assert.equal(last().opts.clientId, CLIENT);
  });
  it("addMessage on a ticket emits ticket.replied only for non-internal messages", async () => {
    row = { id: ID, client_id: CLIENT, ticket_id: ID, author_type: "admin", author_name: "n", body: "b", internal: true, mentions: [], created_at: T, edited_at: null, project_id: null, request_id: null, author_client_user_id: null, author_admin_id: null };
    await workspace.addMessage({ clientId: CLIENT, ticketId: ID, authorType: "admin", authorName: "n", body: "b", internal: true });
    assert.equal(emitted.length, 0);
    row = { ...row, internal: false, author_type: "client" };
    await workspace.addMessage({ clientId: CLIENT, ticketId: ID, authorType: "client", authorName: "n", body: "b" });
    assert.equal(last().type, "ticket.replied"); assert.equal(last().data.ticket_id, ID); assert.equal(last().opts.clientId, CLIENT);
    assert.equal("internal" in last().data, false);
  });
  it("createApproval → approval.requested; decideApproval → approval.decided", async () => {
    row = { id: ID, client_id: CLIENT, project_id: PROJECT, milestone_id: null, file_id: null, title: "t", description: "", status: "pending", requested_by: null, due_at: null, decided_at: null, decided_by_client_user_id: null, decided_by_name: null, decision_note: null, created_at: T, updated_at: T };
    await workspace.createApproval({ clientId: CLIENT, title: "t" } as never);
    assert.equal(last().type, "approval.requested"); assert.equal(last().opts.entityId, ID); assert.equal(last().opts.clientId, CLIENT);
    row = { ...row, status: "approved", decided_at: T };
    await workspace.decideApproval(ID, { decision: "approved", decidedByName: "n" });
    assert.equal(last().type, "approval.decided"); assert.equal(last().opts.clientId, CLIENT);
  });
  it("updateTask emits task.completed only when status becomes done", async () => {
    related = { projects: projectRow };
    row = { id: ID, project_id: PROJECT, status: "open", title: "t", description: "", kind: "general", assignee_party: "client", milestone_id: null, due_at: null, completed_at: null, sort_order: 0, created_at: T, updated_at: T, assignee_admin_id: null, assignee_client_user_id: null };
    await projects.updateTask(ID, { title: "renamed" });
    assert.equal(emitted.length, 0);
    await projects.updateTask(ID, { status: "done" });
    assert.equal(last().type, "task.completed"); assert.equal(last().opts.entityId, ID); assert.equal(last().opts.clientId, CLIENT);
  });
  it("updateProject → project.updated", async () => {
    row = projectRow;
    await projects.updateProject(PROJECT, { name: "Renamed" } as never);
    assert.equal(last().type, "project.updated"); assert.equal(last().opts.entityId, PROJECT); assert.equal(last().opts.clientId, CLIENT);
  });
  it("approveMilestone → milestone.approved; requestMilestoneChanges → milestone.changes_requested", async () => {
    related = { projects: projectRow, "milestones[]": [milestoneRow("approved")] };
    row = milestoneRow("under_review");
    await projects.approveMilestone(ID, { approvedBy: "n" });
    assert.equal(last().type, "milestone.approved"); assert.equal(last().opts.entityId, ID); assert.equal(last().opts.clientId, CLIENT);
    await projects.requestMilestoneChanges(ID, { note: "fix" });
    assert.equal(last().type, "milestone.changes_requested"); assert.equal(last().opts.clientId, CLIENT);
  });
  it("updateMilestone emits milestone.completed only on the transition to done", async () => {
    related = { projects: projectRow, "milestones[]": [milestoneRow("completed")] };
    row = milestoneRow("in_progress");
    await projects.updateMilestone(ID, { name: "renamed" });
    assert.equal(emitted.length, 0);
    await projects.updateMilestone(ID, { status: "completed" });
    assert.equal(last().type, "milestone.completed"); assert.equal(last().opts.clientId, CLIENT);
  });
});
