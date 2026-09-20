import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * `enqueue` against a fake db: proves `skipSubscriptionFilter` bypasses the
 * per-endpoint subscription check (so a `ping` reaches an endpoint that does
 * not list it) and that without the flag the check still applies.
 */
const endpoint = { id: "e1", kind: "client", enabled: true, events: ["ticket.created"] };
const inserts: Record<string, unknown>[] = [];
function fakeSb() {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.in = () => q;
      q.insert = (v: Record<string, unknown>) => { if (table === "webhook_deliveries") inserts.push(v); return { error: null }; };
      q.then = (r: (v: unknown) => void) => r({ data: table === "webhook_endpoints" ? [endpoint] : [], error: null });
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
    const r = await enqueue({ eventType: "ping", payload: {}, kind: "client", endpointIds: ["e1"] });
    assert.equal(r.queued, 0);
    assert.equal(inserts.length, 0);
  });
  it("delivers it when the caller already filtered", async () => {
    const r = await enqueue({ eventType: "ping", eventId: "ping:e1:1", payload: {}, kind: "client", endpointIds: ["e1"], skipSubscriptionFilter: true });
    assert.equal(r.queued, 1);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]!.event_type, "ping");
    assert.equal(inserts[0]!.event_id, "ping:e1:1");
    assert.equal(inserts[0]!.sequence, 7);
  });
  it("still delivers a subscribed event without the flag", async () => {
    const r = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t:1", payload: {}, kind: "client", endpointIds: ["e1"] });
    assert.equal(r.queued, 1);
  });
});
