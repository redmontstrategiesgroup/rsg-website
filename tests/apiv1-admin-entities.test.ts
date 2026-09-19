import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";

const RID = "33333333-3333-4333-8333-333333333333";
const row = { id: RID, title: "Smoke", severity: "high", status: "monitoring", created_at: "t", updated_at: "t", internal_LEAK: "LEAK" };
const log: string[] = [];
function fakeSb() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "update", "insert"]) q[m] = (...a: unknown[]) => { log.push(`${m}:${JSON.stringify(a)}`); return q; };
  q.maybeSingle = async () => ({ data: log.some((l) => l.includes(RID)) ? row : null, error: null });
  q.single = async () => ({ data: row, error: null });
  q.then = (r: (v: unknown) => void) => r({ data: [row], error: null });
  return { from: (t: string) => { log.push(`from:${t}`); return q; } };
}
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => fakeSb() } });
mock.module("@/lib/lifecycle/paged-admin", { namedExports: { listEntitiesPage: async (_sb: unknown, table: string) => { log.push(`list:${table}`); return { data: [row], next_cursor: null }; } } });
mock.module("@/lib/audit", { namedExports: { writeAuditEvent: async (e: { action: string }) => { log.push(`audit:${e.action}`); } } });

const { listEntities, getEntity, createEntity, patchEntity } = await import("../lib/apiv1/resources/admin-entities.ts");
const admin: Principal = { type: "admin", keyId: "k", keyName: "n", scopes: ["dashboard:read", "dashboard:write"], adminId: "a1", email: "ops@rsg.com", role: "owner" };
const args = (over: Record<string, unknown> = {}) => ({ principal: admin, body: undefined, query: {}, params: { entity: "risks" }, request: new Request("http://x/api/v1/admin/risks"), correlationId: "c", ...over }) as never;

describe("admin entities", () => {
  it("unknown entity → 404; list maps DTO", async () => {
    await assert.rejects(listEntities(args({ params: { entity: "nope" } })), (e: { code: string }) => e.code === "not_found");
    const r = await listEntities(args());
    assert.ok(log.includes("list:risks"));
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
  });
  it("create validates with the shared schema (422) then inserts (201) and audits", async () => {
    await assert.rejects(createEntity(args({ body: { title: "" } })), (e: { code: string }) => e.code === "validation_failed");
    const r = await createEntity(args({ body: { title: "Smoke" } }));
    assert.equal(r.status, 201);
    assert.ok(log.some((l) => l.startsWith("insert:")) && log.includes("audit:dashboard.create"));
  });
  it("get + patch by id; strict patch → 422", async () => {
    assert.equal(((await getEntity(args({ params: { entity: "risks", id: RID } }))).data as { title: string }).title, "Smoke");
    const r = await patchEntity(args({ params: { entity: "risks", id: RID }, body: { status: "closed" } }));
    assert.ok(log.some((l) => l.startsWith('update:[{"status":"closed"}')));
    assert.ok(r.data);
    await assert.rejects(patchEntity(args({ params: { entity: "risks", id: RID }, body: { bogus: 1 } })), (e: { code: string }) => e.code === "validation_failed");
  });
});
