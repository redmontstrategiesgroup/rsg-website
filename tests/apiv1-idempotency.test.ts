import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { abandonIdempotent, beginIdempotent, completeIdempotent, keylessPrincipalId, requestHash } from "../lib/apiv1/idempotency.ts";

type Row = { request_hash: string; status: "in_flight" | "done"; response_status: number | null; response_body: unknown };

/** Minimal fake of the four builder shapes idempotency.ts uses. */
function fakeDb(existing: Row | null) {
  const log: string[] = [];
  let row = existing;
  const chain = (kind: string) => {
    const self: any = {};
    self.eq = () => self;
    self.maybeSingle = async () => ({ data: row, error: null });
    self.then = (res: (v: any) => void) => {
      log.push(kind);
      if (kind === "delete") row = null;
      res({ data: null, error: null });
    };
    return self;
  };
  const db = {
    from: () => ({
      insert: async (v: any) => {
        log.push("insert");
        if (row) return { error: { code: "23505", message: "dup" } };
        row = { request_hash: v.request_hash, status: v.status, response_status: null, response_body: null };
        return { error: null };
      },
      select: () => chain("select"),
      update: (v: any) => { row = row ? { ...row, ...v } : row; return chain("update"); },
      delete: () => chain("delete"),
    }),
  };
  return { db, log, get row() { return row; } };
}

describe("idempotency", () => {
  const base = { principalId: "p", key: "k-12345678", requestHash: requestHash("POST", "/v1/tickets", '{"a":1}') };

  it("hashes method+path+body", () => {
    assert.notEqual(requestHash("POST", "/x", "a"), requestHash("POST", "/x", "b"));
    assert.equal(requestHash("post", "/x", "a"), requestHash("POST", "/x", "a"));
  });
  it("new → in_flight row; complete → done", async () => {
    const f = fakeDb(null);
    assert.deepEqual(await beginIdempotent(f.db, base), { kind: "new" });
    assert.equal(f.row?.status, "in_flight");
    await completeIdempotent(f.db, { principalId: "p", key: base.key, status: 201, body: { id: 1 } });
    assert.equal(f.row?.status, "done");
    assert.equal(f.row?.response_status, 201);
  });
  it("replays a done row with the same hash", async () => {
    const f = fakeDb({ request_hash: base.requestHash, status: "done", response_status: 201, response_body: { id: 1 } });
    assert.deepEqual(await beginIdempotent(f.db, base), { kind: "replay", status: 201, body: { id: 1 } });
  });
  it("mismatch and in_flight", async () => {
    assert.deepEqual(await beginIdempotent(fakeDb({ request_hash: "other", status: "done", response_status: 200, response_body: {} }).db, base), { kind: "mismatch" });
    assert.deepEqual(await beginIdempotent(fakeDb({ request_hash: base.requestHash, status: "in_flight", response_status: null, response_body: null }).db, base), { kind: "in_flight" });
  });
  it("abandon deletes the row", async () => {
    const f = fakeDb({ request_hash: base.requestHash, status: "in_flight", response_status: null, response_body: null });
    await abandonIdempotent(f.db, { principalId: "p", key: base.key });
    assert.equal(f.row, null);
  });
  it("keyless principal ids are stable uuids", () => {
    assert.equal(keylessPrincipalId("1.2.3.4"), keylessPrincipalId("1.2.3.4"));
    assert.match(keylessPrincipalId("1.2.3.4"), /^00000000-0000-4000-8000-[0-9a-f]{12}$/);
  });
});
