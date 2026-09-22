// tests/apiv1-admin-leads.test.ts
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";
import { encodeCursor } from "../lib/apiv1/pagination.ts";

type TestLeadRow = {
  id: string;
  created_at: string;
  name: string;
  business_name: string;
  email: string;
  lead_score: number;
  status: string;
  notes: string | null;
  owner: string | null;
  archived_at: string | null;
  deleted_at: string | null;
};
const rows: TestLeadRow[] = [{ id: "11111111-1111-4111-8111-111111111111", created_at: "2026-01-02T00:00:00.000Z", name: "Ann", business_name: "Acme", email: "a@acme.com", lead_score: 5, status: "new", notes: null, owner: null, archived_at: null, deleted_at: null }];
const calls: string[] = [];

// Drivable via mutable flags so individual tests can force each mocked
// module down a different path without re-registering mock.module().
let storedInDatabaseFlag = true;
let updateLands = true;
let pagingMode: "none" | "two" | "cap" = "none";
let pageCalls = 0;

const NEXT_CURSOR_STUB = encodeCursor({ createdAt: "2026-01-02T00:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" });

mock.module("@/lib/lifecycle/paged-admin", { namedExports: {
  listLeadsPage: async (_sb: unknown, o: Record<string, unknown>) => {
    calls.push(`list:${JSON.stringify({ q: o.q, status: o.status })}`);
    if (pagingMode === "two") {
      pageCalls += 1;
      return { data: rows, next_cursor: pageCalls === 1 ? NEXT_CURSOR_STUB : null };
    }
    if (pagingMode === "cap") {
      pageCalls += 1;
      const page = Array.from({ length: 1000 }, (_, i) => ({ ...rows[0], id: `page-${pageCalls}-${i}` }));
      return { data: page, next_cursor: NEXT_CURSOR_STUB };
    }
    return { data: rows, next_cursor: null };
  },
  getLeadRow: async (_sb: unknown, id: string) => rows.find((r) => r.id === id) ?? null,
  softDeleteLead: async (_sb: unknown, id: string) => id === rows[0]!.id,
} });
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => ({}) } });
mock.module("@/lib/leads", { namedExports: {
  processLead: async (lead: { email: string }) => ({
    duplicate: lead.email === "dup@x.y",
    leadId: rows[0]!.id,
    storedInDatabase: storedInDatabaseFlag,
    storedLocally: true,
    storedRemotely: true,
    emailed: true,
  }),
} });
mock.module("@/lib/store", { namedExports: {
  updateLead: async (id: string, patch: Record<string, unknown>) => {
    calls.push(`update:${id}:${JSON.stringify(patch)}`);
    // updateLead() itself falls back to a local file store on a Supabase
    // error and still returns a truthy Lead — simulate that "wrote
    // somewhere, but not where getLeadRow reads from" case via updateLands.
    const row = rows.find((r) => r.id === id);
    if (!row) return null;
    if (updateLands) {
      if (patch.status !== undefined) row.status = patch.status as string;
      if (patch.notes !== undefined) row.notes = patch.notes as string;
      if (patch.owner !== undefined) row.owner = patch.owner as string;
      if (patch.archivedAt !== undefined) {
        // Mimic PostgREST's timestamptz rendering (`+00:00`, no
        // milliseconds) rather than echoing back the request's ISO-Z
        // string verbatim, so tests exercise the same string mismatch the
        // real client produces.
        row.archived_at =
          patch.archivedAt === null
            ? null
            : (patch.archivedAt as string).replace(/\.\d{3}Z$/, "+00:00");
      }
    }
    return row;
  },
} });
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
  it("create → 503 unavailable when the lead was not stored, and does not audit", async () => {
    storedInDatabaseFlag = false;
    try {
      const before = calls.length;
      const body = { name: "Ann", email: "notstored@x.y", company: "", phone: "", website: "", industry: "", message: "hi", source: "api" };
      await assert.rejects(
        createLead(args({ body })),
        (e: { code: string; status: number }) => e.code === "unavailable" && e.status === 503,
      );
      assert.ok(!calls.slice(before).includes("audit:lead.create"));
    } finally {
      storedInDatabaseFlag = true;
    }
  });
  it("patch maps archived_at → archivedAt, confirms the write landed, and audits; delete soft-deletes", async () => {
    await patchLead(args({ params: { id: rows[0]!.id }, body: { status: "contacted", archived_at: null } }));
    assert.ok(calls.some((c) => c.startsWith(`update:${rows[0]!.id}:`) && c.includes('"archivedAt":null')));
    assert.ok(calls.includes("audit:lead.update"));
    assert.deepEqual((await deleteLead(args({ params: { id: rows[0]!.id } }))).data, { id: rows[0]!.id, deleted: true });
    await assert.rejects(deleteLead(args({ params: { id: "22222222-2222-4222-8222-222222222222" } })), (e: { code: string }) => e.code === "not_found");
  });
  it("patch with a non-null archived_at compares by value, not by string, and still 200s + audits", async () => {
    rows[0]!.archived_at = null;
    const before = calls.length;
    const r = await patchLead(args({ params: { id: rows[0]!.id }, body: { archived_at: "2026-09-19T12:00:00.000Z" } }));
    // Stored as PostgREST would render it — a different string, same instant.
    assert.equal(rows[0]!.archived_at, "2026-09-19T12:00:00+00:00");
    assert.equal((r.data as { archived_at: string | null }).archived_at, "2026-09-19T12:00:00+00:00");
    assert.ok(calls.slice(before).includes("audit:lead.update"));
    rows[0]!.archived_at = null;
  });
  it("patch → 503 unavailable when the re-fetched row does not reflect the requested change, and does not audit", async () => {
    rows[0]!.status = "new";
    updateLands = false;
    try {
      const before = calls.length;
      await assert.rejects(
        patchLead(args({ params: { id: rows[0]!.id }, body: { status: "contacted" } })),
        (e: { code: string; status: number }) => e.code === "unavailable" && e.status === 503,
      );
      assert.equal(rows[0]!.status, "new");
      assert.ok(!calls.slice(before).includes("audit:lead.update"));
    } finally {
      updateLands = true;
    }
  });
  it("export returns CSV", async () => {
    const r = await exportLeads(args({ query: {} }));
    assert.ok(r.raw); assert.equal(r.raw!.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.ok((await r.raw!.text()).startsWith("id,created_at,name,company,email"));
  });
  it("export loops across pages and concatenates every row into the CSV", async () => {
    pagingMode = "two";
    pageCalls = 0;
    try {
      const r = await exportLeads(args({ query: {} }));
      const body = await r.raw!.text();
      const dataLines = body.trimEnd().split("\r\n").slice(1);
      assert.equal(pageCalls, 2);
      assert.equal(dataLines.length, 2);
    } finally {
      pagingMode = "none";
    }
  });
  it("export stops at 10,000 rows (10 pages of 1,000) even though next_cursor keeps coming back non-null", async () => {
    pagingMode = "cap";
    pageCalls = 0;
    try {
      const r = await exportLeads(args({ query: {} }));
      const body = await r.raw!.text();
      const dataLines = body.trimEnd().split("\r\n").slice(1);
      assert.equal(pageCalls, 10);
      assert.equal(dataLines.length, 10_000);
    } finally {
      pagingMode = "none";
    }
  });
});
