// tests/apiv1-paged.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listTicketsPage, listFilesPage } from "../lib/lifecycle/paged.ts";
import { encodeCursor } from "../lib/apiv1/pagination.ts";

function fakeSb(rows: any[]) {
  const calls: string[] = [];
  const q: any = {};
  for (const m of ["select", "eq", "or", "order", "limit"]) q[m] = (...a: unknown[]) => { calls.push(`${m}:${a.join(",")}`); return q; };
  q.then = (r: any) => r({ data: rows, error: null });
  return { calls, sb: { from: (t: string) => { calls.push(`from:${t}`); return q; } } };
}

describe("paged lists", () => {
  it("scopes by client, filters, orders, fetches limit+1", async () => {
    const rows = [1, 2, 3].map((n) => ({ id: `i${n}`, created_at: `t${n}`, client_id: "c" }));
    const f = fakeSb(rows);
    const page = await listTicketsPage(f.sb as any, "c", { limit: 2, cursor: null, status: "open" });
    assert.equal(page.data.length, 2);
    assert.ok(page.next_cursor);
    assert.ok(f.calls.includes("from:tickets"));
    assert.ok(f.calls.includes("eq:client_id,c"));
    assert.ok(f.calls.includes("eq:status,open"));
    assert.ok(f.calls.includes("limit:3"));
    assert.ok(f.calls.some((c) => c.startsWith("order:created_at")));
  });
  it("applies the cursor and the project filter", async () => {
    const f = fakeSb([]);
    const cursor = { createdAt: "T", id: "I" };
    await listFilesPage(f.sb as any, "c", { limit: 5, cursor, projectId: "p1" });
    assert.ok(f.calls.includes("eq:project_id,p1"));
    assert.ok(f.calls.includes("or:created_at.lt.T,and(created_at.eq.T,id.lt.I)"));
    assert.ok(encodeCursor(cursor));
  });
});
