import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * `enqueue` against a fake db: proves `skipSubscriptionFilter` bypasses the
 * per-endpoint subscription check (so a `ping` reaches an endpoint that does
 * not list it), that without the flag the check still applies, and that one
 * event id fans out to every eligible endpoint.
 *
 * The fake enforces the ONE uniqueness constraint the live table has after
 * 20260921140000_webhook_deliveries_fanout.sql: (endpoint_id, event_id).
 * The old global UNIQUE on idempotency_key made the second endpoint's insert
 * fail with 23505 — the fan-out case below is the regression guard.
 */
const endpoints = [
  { id: "e1", kind: "client", enabled: true, events: ["ticket.created"] },
  { id: "e2", kind: "client", enabled: true, events: ["ticket.created"] },
];
const inserts: Record<string, unknown>[] = [];
function fakeSb() {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      let wanted: string[] | null = null;
      q.select = () => q;
      q.eq = () => q;
      q.in = (_col: string, ids: string[]) => { wanted = ids; return q; };
      q.insert = (v: Record<string, unknown>) => {
        if (table !== "webhook_deliveries") return { error: null };
        const dup = inserts.some((r) => r.endpoint_id === v.endpoint_id && r.event_id != null && r.event_id === v.event_id);
        if (dup) return { error: { code: "23505", message: "duplicate" } };
        inserts.push(v);
        return { error: null };
      };
      q.then = (r: (v: unknown) => void) =>
        r({ data: table === "webhook_endpoints" ? endpoints.filter((e) => !wanted || wanted.includes(e.id)) : [], error: null });
      return q;
    },
    rpc: async () => ({ data: 7, error: null }),
  };
}
mock.module("@/lib/scheduling/db", { namedExports: { requireSupabase: () => fakeSb() } });
mock.module("@/lib/integration-log", { namedExports: {
  CORRELATION_HEADER: "x-correlation-id",
  currentCorrelationId: () => "c",
  ensureCorrelationId: (id: string) => id,
  recordDeadLettered: async () => {},
  withCorrelation: async (_id: string, fn: () => unknown) => fn(),
} });

const { enqueue } = await import("../lib/webhooks/outbox.ts");

describe("enqueue subscription filter", () => {
  it("skips an unsubscribed event by default", async () => {
    inserts.length = 0;
    const r = await enqueue({ eventType: "ping", payload: {}, kind: "client", endpointIds: ["e1"] });
    assert.equal(r.queued, 0);
    assert.equal(inserts.length, 0);
  });
  it("delivers it when the caller already filtered", async () => {
    inserts.length = 0;
    const r = await enqueue({ eventType: "ping", eventId: "ping:e1:1", payload: {}, kind: "client", endpointIds: ["e1"], skipSubscriptionFilter: true });
    assert.equal(r.queued, 1);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]!.event_type, "ping");
    assert.equal(inserts[0]!.event_id, "ping:e1:1");
    assert.equal(inserts[0]!.sequence, 7);
  });
  it("still delivers a subscribed event without the flag", async () => {
    inserts.length = 0;
    const r = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t:1", payload: {}, kind: "client", endpointIds: ["e1"] });
    assert.equal(r.queued, 1);
  });
});

describe("enqueue fan-out", () => {
  it("one event id reaches every eligible endpoint; a re-fire dedupes per endpoint", async () => {
    inserts.length = 0;
    const first = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t9:v1", payload: { id: "t9" }, kind: "client", endpointIds: ["e1", "e2"] });
    assert.equal(first.queued, 2, "both endpoints must get a delivery for the same event id");
    assert.deepEqual(inserts.map((r) => r.endpoint_id).sort(), ["e1", "e2"]);
    assert.ok(inserts.every((r) => r.event_id === "ticket.created:t9:v1" && r.idempotency_key === "ticket.created:t9:v1"));
    const again = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t9:v1", payload: { id: "t9" }, kind: "client", endpointIds: ["e1", "e2"] });
    assert.equal(again.queued, 0);
    assert.equal(inserts.length, 2);
  });
});
