import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EVENTS, EVENT_TYPES, eventsFor, isEventType, visibleTo } from "../lib/webhooks/events.ts";

describe("event catalog", () => {
  it("has 22 types, every one described with an audience and a schema", () => {
    assert.equal(EVENT_TYPES.length, 23);
    for (const t of EVENT_TYPES) {
      const e = EVENTS[t];
      assert.ok(e.description.length > 10, t);
      assert.ok(["client", "admin", "both"].includes(e.audience), t);
      assert.ok(e.dataSchema.safeParse({}).success || t === "ping", t);
    }
  });
  it("splits audiences", () => {
    assert.equal(isEventType("ticket.created"), true);
    assert.equal(isEventType("nope"), false);
    assert.equal(visibleTo("lead.created", "client"), false);
    assert.equal(visibleTo("lead.created", "admin"), true);
    assert.equal(visibleTo("ticket.created", "client"), true);
    assert.equal(eventsFor("client").length, 15);
    assert.equal(eventsFor("admin").length, 23);
    assert.ok(!eventsFor("client").includes("booking.created"));
  });
  it("ping schema is strict", () => {
    assert.equal(EVENTS.ping.dataSchema.safeParse({}).success, false);
    assert.ok(
      EVENTS.ping.dataSchema.safeParse({
        endpoint_id: "11111111-1111-4111-8111-111111111111",
        sent_at: "2026-09-20T00:00:00.000Z",
      }).success,
    );
  });
});
