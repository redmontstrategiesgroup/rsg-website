// tests/apiv1-admin-leads.test.ts
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";

const rows = [{ id: "11111111-1111-4111-8111-111111111111", created_at: "2026-01-02T00:00:00.000Z", name: "Ann", business_name: "Acme", email: "a@acme.com", lead_score: 5, status: "new", deleted_at: null }];
const calls: string[] = [];
mock.module("@/lib/lifecycle/paged-admin", { namedExports: {
  listLeadsPage: async (_sb: unknown, o: Record<string, unknown>) => { calls.push(`list:${JSON.stringify({ q: o.q, status: o.status })}`); return { data: rows, next_cursor: null }; },
  getLeadRow: async (_sb: unknown, id: string) => rows.find((r) => r.id === id) ?? null,
  softDeleteLead: async (_sb: unknown, id: string) => id === rows[0]!.id,
} });
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => ({}) } });
mock.module("@/lib/leads", { namedExports: { processLead: async (lead: { email: string }) => ({ duplicate: lead.email === "dup@x.y", leadId: rows[0]!.id, storedInDatabase: true, storedLocally: true, storedRemotely: true, emailed: true }) } });
mock.module("@/lib/store", { namedExports: { updateLead: async (id: string, patch: unknown) => { calls.push(`update:${id}:${JSON.stringify(patch)}`); return {}; } } });
mock.module("@/lib/audit", { namedExports: { writeAuditEvent: async (e: { action: string }) => { calls.push(`audit:${e.action}`); } } });

const { listLeads, getLead, createLead, patchLead, deleteLead, exportLeads } = await import("../lib/apiv1/resources/admin-leads.ts");

const admin: Principal = { type: "admin", keyId: "k", keyName: "n", scopes: ["leads:read", "leads:write"], adminId: "a1", email: "ops@rsg.com", role: "owner" };
const args = (over: Record<string, unknown> = {}) => ({ principal: admin, body: undefined, query: {}, params: {}, request: new Request("http://x/api/v1/admin/leads?q=acme"), correlationId: "c", ...over }) as never;

describe("admin leads handlers", () => {
  it("lists with sanitised q and maps DTOs", async () => {
    const r = await listLeads(args({ query: { q: "ac,me" } }));
    assert.equal((r.data as { company: string }[])[0]!.company, "Acme");
    assert.ok(calls.some((c) => c.startsWith('list:{"q":"acme"')));
  });
  it("get → dto; unknown → 404", async () => {
    assert.equal(((await getLead(args({ params: { id: rows[0]!.id } }))).data as { email: string }).email, "a@acme.com");
    await assert.rejects(getLead(args({ params: { id: "22222222-2222-4222-8222-222222222222" } })), (e: { code: string }) => e.code === "not_found");
  });
  it("create → 201, duplicate → 200, audited", async () => {
    const body = { name: "Ann", email: "new@x.y", company: "", phone: "", website: "", industry: "", message: "hi", source: "api" };
    assert.equal((await createLead(args({ body }))).status, 201);
    assert.equal((await createLead(args({ body: { ...body, email: "dup@x.y" } }))).status, 200);
    assert.ok(calls.includes("audit:lead.create"));
  });
  it("patch maps archived_at → archivedAt and audits; delete soft-deletes", async () => {
    await patchLead(args({ params: { id: rows[0]!.id }, body: { status: "contacted", archived_at: null } }));
    assert.ok(calls.some((c) => c.startsWith(`update:${rows[0]!.id}:`) && c.includes('"archivedAt":null')));
    assert.deepEqual((await deleteLead(args({ params: { id: rows[0]!.id } }))).data, { id: rows[0]!.id, deleted: true });
    await assert.rejects(deleteLead(args({ params: { id: "22222222-2222-4222-8222-222222222222" } })), (e: { code: string }) => e.code === "not_found");
  });
  it("export returns CSV", async () => {
    const r = await exportLeads(args({ query: {} }));
    assert.ok(r.raw); assert.equal(r.raw!.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.ok((await r.raw!.text()).startsWith("id,created_at,name,company,email"));
  });
});
