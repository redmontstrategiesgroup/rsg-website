import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyCursor, decodeCursor, encodeCursor, pageResult, parseListParams } from "../lib/apiv1/pagination.ts";

describe("cursor codec", () => {
  it("round-trips", () => {
    const c = { createdAt: "2026-09-15T00:00:00.000Z", id: "11111111-1111-1111-1111-111111111111" };
    assert.deepEqual(decodeCursor(encodeCursor(c)), c);
  });
  it("rejects garbage", () => {
    assert.equal(decodeCursor("!!!"), null);
    assert.equal(decodeCursor(Buffer.from('{"a":1}').toString("base64url")), null);
  });
});

describe("parseListParams", () => {
  it("clamps and defaults", () => {
    assert.equal(parseListParams(new URLSearchParams("")).limit, 25);
    assert.equal(parseListParams(new URLSearchParams("limit=0")).limit, 1);
    assert.equal(parseListParams(new URLSearchParams("limit=500")).limit, 100);
    assert.equal(parseListParams(new URLSearchParams("limit=abc")).limit, 25);
  });
  it("throws validation_failed on a bad cursor", () => {
    assert.throws(() => parseListParams(new URLSearchParams("cursor=nope")), (e: any) => e.code === "validation_failed" && e.status === 422);
  });
});

describe("applyCursor / pageResult", () => {
  it("applies the keyset filter", () => {
    const calls: string[] = [];
    const q = { or: (f: string) => { calls.push(f); return q; } };
    applyCursor(q, { createdAt: "T", id: "I" });
    assert.deepEqual(calls, ["created_at.lt.T,and(created_at.eq.T,id.lt.I)"]);
    applyCursor(q, null);
    assert.equal(calls.length, 1);
  });
  it("trims to limit and emits next_cursor from the last kept row", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `id${n}`, created_at: `t${n}` }));
    const r = pageResult(rows, 2);
    assert.equal(r.data.length, 2);
    assert.deepEqual(decodeCursor(r.next_cursor!), { createdAt: "t2", id: "id2" });
    assert.equal(pageResult(rows, 3).next_cursor, null);
  });
});
