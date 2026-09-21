import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { API_PLATFORM_SCHEMA, fakeDb } from "./_fake-db.ts";

/**
 * `enqueue` against the constraint-enforcing fake: proves `skipSubscriptionFilter`
 * bypasses the per-endpoint subscription check (so a `ping` reaches an endpoint
 * that does not list it), that without the flag the check still applies, and that
 * one event id fans out to every eligible endpoint under the real uniqueness
 * rules (per-endpoint `(endpoint_id, event_id)` only — the old global UNIQUE on
 * idempotency_key made the second endpoint's insert fail; the fan-out case below
 * is the regression guard).
 */
const db = fakeDb(
  API_PLATFORM_SCHEMA,
  {
    webhook_endpoints: [
      { id: "e1", kind: "client", url: "https://a.example", secret: "s", enabled: true, events: ["ticket.created"] },
      { id: "e2", kind: "client", url: "https://b.example", secret: "s", enabled: true, events: ["ticket.created"] },
    ],
  },
  { rpc: () => 7 },
);
const deliveries = () => db.rows("webhook_deliveries");

mock.module("@/lib/scheduling/db", { namedExports: { requireSupabase: () => db.sb } });
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
    assert.equal(deliveries().length, 0);
  });
  it("delivers it when the caller already filtered", async () => {
    const r = await enqueue({ eventType: "ping", eventId: "ping:e1:1", payload: {}, kind: "client", endpointIds: ["e1"], skipSubscriptionFilter: true });
    assert.equal(r.queued, 1);
    const row = deliveries().at(-1)!;
    assert.equal(row.event_type, "ping");
    assert.equal(row.event_id, "ping:e1:1");
    assert.equal(row.sequence, 7);
    assert.equal(row.status, "pending");
  });
  it("still delivers a subscribed event without the flag", async () => {
    const r = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t:1", payload: {}, kind: "client", endpointIds: ["e1"] });
    assert.equal(r.queued, 1);
  });
});

describe("enqueue fan-out", () => {
  it("one event id reaches every eligible endpoint; a re-fire dedupes per endpoint", async () => {
    const before = deliveries().length;
    const first = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t9:v1", payload: { id: "t9" }, kind: "client", endpointIds: ["e1", "e2"] });
    assert.equal(first.queued, 2, "both endpoints must get a delivery for the same event id");
    const rows = deliveries().filter((r) => r.event_id === "ticket.created:t9:v1");
    assert.deepEqual(rows.map((r) => r.endpoint_id).sort(), ["e1", "e2"]);
    assert.ok(rows.every((r) => r.idempotency_key === "ticket.created:t9:v1"));
    const again = await enqueue({ eventType: "ticket.created", eventId: "ticket.created:t9:v1", payload: { id: "t9" }, kind: "client", endpointIds: ["e1", "e2"] });
    assert.equal(again.queued, 0);
    assert.equal(deliveries().length, before + 2);
  });
});
