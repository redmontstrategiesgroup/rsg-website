import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordUsage, templatePath } from "../lib/apiv1/usage.ts";

describe("templatePath", () => {
  it("replaces param segments and drops /api", () => {
    assert.equal(templatePath("/api/v1/tickets/abc/messages", { id: "abc" }), "/v1/tickets/{id}/messages");
    assert.equal(templatePath("/api/v1/projects/p1/tasks/t1/complete", { id: "p1", tid: "t1" }), "/v1/projects/{id}/tasks/{tid}/complete");
    assert.equal(templatePath("/api/v1/me", {}), "/v1/me");
  });
});

describe("recordUsage", () => {
  it("inserts without awaiting and never throws", async () => {
    const inserted: unknown[] = [];
    const db = { from: () => ({ insert: async (r: unknown) => { inserted.push(r); return { error: null }; } }) };
    recordUsage(db, { key_id: "k", principal_type: "client", principal_id: "c", method: "GET", path: "/v1/me", status: 200, duration_ms: 3, ip: "1.1.1.1", correlation_id: "x" });
    await new Promise((r) => setImmediate(r));
    assert.equal(inserted.length, 1);
    const bad = { from: () => ({ insert: async () => { throw new Error("down"); } }) };
    assert.doesNotThrow(() => recordUsage(bad, { key_id: null, principal_type: null, principal_id: null, method: "GET", path: "/v1/x", status: 500, duration_ms: 1, ip: null, correlation_id: null }));
    await new Promise((r) => setImmediate(r));
  });
});
