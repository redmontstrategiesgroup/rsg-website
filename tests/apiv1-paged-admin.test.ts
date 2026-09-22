// tests/apiv1-paged-admin.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLeadRow, listAuditPage, listClientsPage, listLeadsPage, setClientStatus, softDeleteLead } from "../lib/lifecycle/paged-admin.ts";

function fakeSb(rows: unknown[]) {
  const calls: string[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "or", "gte", "order", "limit", "update"]) {
    q[m] = (...a: unknown[]) => { calls.push(`${m}:${a.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("|")}`); return q; };
  }
  q.maybeSingle = async () => ({ data: rows[0] ?? null, error: null });
  q.then = (r: (v: unknown) => void) => r({ data: rows, error: null });
  return { calls, sb: { from: (t: string) => { calls.push(`from:${t}`); return q; } } as never };
}

describe("paged-admin", () => {
  it("leads: excludes deleted, applies q/status/since, fetches limit+1", async () => {
    const f = fakeSb([{ id: "a", created_at: "t" }]);
    await listLeadsPage(f.sb, { limit: 5, cursor: null, q: "ac\\%me", status: "new", since: "2026-01-01T00:00:00.000Z" });
    assert.ok(f.calls.includes("from:leads"));
    assert.ok(f.calls.includes("is:deleted_at|null"));
    assert.ok(f.calls.includes("or:name.ilike.%ac\\%me%,email.ilike.%ac\\%me%,business_name.ilike.%ac\\%me%"));
    assert.ok(f.calls.includes("eq:status|new"));
    assert.ok(f.calls.includes("gte:created_at|2026-01-01T00:00:00.000Z"));
    assert.ok(f.calls.includes("limit:6"));
  });
  it("getLeadRow scopes by id and not-deleted", async () => {
    const f = fakeSb([{ id: "a" }]);
    assert.deepEqual(await getLeadRow(f.sb, "a"), { id: "a" });
    assert.ok(f.calls.includes("eq:id|a") && f.calls.includes("is:deleted_at|null"));
  });
  it("softDeleteLead reports whether a row changed", async () => {
    assert.equal(await softDeleteLead(fakeSb([{ id: "a" }]).sb, "a"), true);
    assert.equal(await softDeleteLead(fakeSb([]).sb, "a"), false);
  });
  it("clients: narrow column list, no password_hash", async () => {
    const f = fakeSb([]);
    await listClientsPage(f.sb, { limit: 2, cursor: null, q: null });
    const sel = f.calls.find((c) => c.startsWith("select:"))!;
    assert.ok(sel.includes("email") && !sel.includes("password_hash") && !sel.includes("*"));
  });
  it("setClientStatus", async () => {
    const f = fakeSb([{ id: "c" }]);
    assert.equal(await setClientStatus(f.sb, "c", "paused"), true);
    assert.ok(f.calls.includes('update:{"status":"paused"}'));
  });
  it("audit: action + since filters", async () => {
    const f = fakeSb([]);
    await listAuditPage(f.sb, { limit: 1, cursor: null, action: "apikey.create", since: "2026-01-01T00:00:00.000Z" });
    assert.ok(f.calls.includes("from:audit_events") && f.calls.includes("eq:action|apikey.create"));
  });
});
