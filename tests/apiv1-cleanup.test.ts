/**
 * cleanupApiTables: verifies the exact cutoffs (24h for api_idempotency,
 * 30d for api_requests) and the count-returning delete idiom, against a
 * minimal fake Supabase client.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanupApiTables } from "../lib/apiv1/cleanup.ts";

describe("cleanupApiTables", () => {
  it("uses the documented cutoffs", async () => {
    const calls: string[] = [];
    const sb = { from: (t: string) => { const q: any = {}; q.delete = () => q; q.lt = (c: string, v: string) => { calls.push(`${t}:${c}:${v}`); return q; }; q.select = () => q; q.then = (r: any) => r({ count: 2, error: null }); return q; } } as any;
    const now = Date.parse("2026-09-15T00:00:00.000Z");
    const r = await cleanupApiTables(sb, now);
    assert.deepEqual(r, { idempotency: 2, requests: 2 });
    assert.ok(calls.includes("api_idempotency:created_at:2026-09-14T00:00:00.000Z"));
    assert.ok(calls.includes("api_requests:created_at:2026-08-16T00:00:00.000Z"));
  });

  it("treats a null count as zero", async () => {
    const sb = { from: () => { const q: any = {}; q.delete = () => q; q.lt = () => q; q.select = () => q; q.then = (r: any) => r({ count: null, error: null }); return q; } } as any;
    const r = await cleanupApiTables(sb, Date.now());
    assert.deepEqual(r, { idempotency: 0, requests: 0 });
  });
});
