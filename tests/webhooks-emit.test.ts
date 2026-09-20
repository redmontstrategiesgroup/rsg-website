import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

const CL = "22222222-2222-4222-8222-222222222222";
const endpoints = [
  { id: "e-client-sub", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: CL, events: ["ticket.created"] },
  { id: "e-client-other", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: "other", events: ["ticket.created"] },
  { id: "e-client-unsub", kind: "client", enabled: true, disabled_at: null, owner_type: "client", owner_id: CL, events: ["invoice.paid"] },
  { id: "e-admin", kind: "client", enabled: true, disabled_at: null, owner_type: "admin", owner_id: "a1", events: ["ticket.created", "lead.created"] },
  { id: "e-disabled", kind: "client", enabled: false, disabled_at: "t", owner_type: "admin", owner_id: "a1", events: ["ticket.created"] },
  { id: "e-registry", kind: "registry", enabled: true, disabled_at: null, owner_type: null, owner_id: null, events: [] },
];

/**
 * The fake applies the same predicates the real query would, so the JS-side
 * filtering in emit.ts is exercised against realistic input rather than
 * handed a pre-filtered list.
 */
let configured = true;
const filters: string[] = [];
function fakeQuery() {
  let rows = endpoints;
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (c: string, v: unknown) => { rows = rows.filter((r) => (r as Record<string, unknown>)[c] === v); return q; };
  q.is = (c: string, v: unknown) => { rows = rows.filter((r) => (r as Record<string, unknown>)[c] === v); return q; };
  q.or = (f: string) => {
    filters.push(f);
    const m = /owner_id\.eq\.([^)]+)\)/.exec(f);
    const cid = m?.[1];
    rows = rows.filter((r) => r.owner_type === "admin" || (r.owner_type === "client" && r.owner_id === cid));
    return q;
  };
  q.then = (r: (v: unknown) => void) => r({ data: rows, error: null });
  return q;
}
mock.module("@/lib/supabase", { namedExports: { getSupabase: () => (configured ? { from: () => fakeQuery() } : null), isSupabaseConfigured: () => configured } });
const enqueued: Record<string, unknown>[] = [];
mock.module("@/lib/webhooks/outbox", { namedExports: { enqueue: async (i: Record<string, unknown>) => { enqueued.push(i); return { queued: (i.endpointIds as string[]).length }; } } });

const { emitEvent, sendTestEvent } = await import("../lib/webhooks/emit.ts");

describe("emitEvent", () => {
  it("fans out to the owning client's subscribed endpoints and every subscribed admin endpoint", async () => {
    const r = await emitEvent("ticket.created", { id: "t1" }, { entityId: "t1", version: 1, clientId: CL });
    assert.equal(r.queued, 2);
    const call = enqueued.at(-1)!;
    assert.deepEqual((call.endpointIds as string[]).sort(), ["e-admin", "e-client-sub"]);
    assert.equal(call.eventId, "ticket.created:t1:1");
    assert.equal(call.skipSubscriptionFilter, true);
    assert.equal(call.kind, "client");
    assert.deepEqual(call.payload, { id: "t1", client_id: CL });
  });
  it("admin-only events never reach client endpoints; nothing eligible → no enqueue", async () => {
    const r = await emitEvent("lead.created", { id: "l1" }, { entityId: "l1", version: "2026" });
    assert.deepEqual(enqueued.at(-1)!.endpointIds, ["e-admin"]);
    assert.ok(r.queued >= 1);
    const before = enqueued.length;
    const none = await emitEvent("invoice.created", { id: "i1" }, { entityId: "i1", version: 1, clientId: "33333333-3333-4333-8333-333333333333" });
    assert.equal(none.queued, 0);
    assert.equal(enqueued.length, before);
  });
  it("refuses a non-UUID clientId in the filter and treats it as admin-only", async () => {
    filters.length = 0;
    await emitEvent("ticket.created", { id: "t2" }, { entityId: "t2", version: 1, clientId: "x),owner_id.eq.other" });
    assert.equal(filters.length, 0);
    assert.deepEqual(enqueued.at(-1)!.endpointIds, ["e-admin"]);
    assert.equal("client_id" in (enqueued.at(-1)!.payload as object), false);
  });
  it("is a no-op when Supabase is unconfigured", async () => {
    configured = false;
    const before = enqueued.length;
    assert.deepEqual(await emitEvent("ticket.created", { id: "t3" }, { entityId: "t3", version: 1, clientId: CL }), { queued: 0 });
    assert.equal(enqueued.length, before);
    configured = true;
  });
  it("sendTestEvent targets exactly one endpoint with a ping", async () => {
    await sendTestEvent("e-client-unsub");
    const call = enqueued.at(-1)!;
    assert.equal(call.eventType, "ping");
    assert.deepEqual(call.endpointIds, ["e-client-unsub"]);
    assert.equal(call.skipSubscriptionFilter, true);
  });
});
