import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";

const views = [1, 2, 3, 4, 5].map((n) => ({ vid: `v${n}`, path: `/p${n}`, referrer: "", at: `2026-01-0${n}T00:00:00.000Z` }));
mock.module("@/lib/store", { namedExports: { getPageViews: async () => views } });
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => ({}) } });
mock.module("@/lib/lifecycle/paged-admin", { namedExports: { listAuditPage: async () => ({ data: [{ id: "a", actor_type: "admin", actor_id: "x", actor_email: "e", action: "lead.create", entity_type: "lead", entity_id: "l", metadata: {}, ip: "LEAK", user_agent: "LEAK", created_at: "t" }], next_cursor: null }) } });

const { listPageViews } = await import("../lib/apiv1/resources/admin-analytics.ts");
const { listAudit } = await import("../lib/apiv1/resources/admin-audit.ts");
const admin: Principal = { type: "admin", keyId: "k", keyName: "n", scopes: ["analytics:read", "audit:read"], adminId: "a1", email: "e", role: "owner" };
const args = (url: string, query: Record<string, unknown> = {}) => ({ principal: admin, body: undefined, query, params: {}, request: new Request(`http://x${url}`), correlationId: "c" }) as never;

describe("page views", () => {
  it("pages newest-first with an in-memory cursor", async () => {
    const p1 = await listPageViews(args("/api/v1/admin/analytics/pageviews?limit=2"));
    assert.deepEqual((p1.data as { path: string }[]).map((v) => v.path), ["/p5", "/p4"]);
    const cursor = (p1.meta as { next_cursor: string }).next_cursor; assert.ok(cursor);
    const p2 = await listPageViews(args(`/api/v1/admin/analytics/pageviews?limit=2&cursor=${cursor}`));
    assert.deepEqual((p2.data as { path: string }[]).map((v) => v.path), ["/p3", "/p2"]);
  });
  it("since inclusive, until exclusive", async () => {
    const r = await listPageViews(args("/api/v1/admin/analytics/pageviews", { since: "2026-01-02T00:00:00.000Z", until: "2026-01-04T00:00:00.000Z" }));
    assert.deepEqual((r.data as { path: string }[]).map((v) => v.path), ["/p3", "/p2"]);
  });
});
describe("audit", () => {
  it("strips ip/user_agent", async () => {
    const r = await listAudit(args("/api/v1/admin/audit"));
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
  });
});
