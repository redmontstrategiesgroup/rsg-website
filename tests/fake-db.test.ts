import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_PLATFORM_SCHEMA, fakeDb, type DbError } from "./_fake-db.ts";

type Res = { data: unknown; error: DbError | null; count?: number | null };

describe("fake db enforces the migration constraints", () => {
  it("unique: api_keys.key_hash", async () => {
    const db = fakeDb(API_PLATFORM_SCHEMA);
    const a = (await db.raw.from("api_keys").insert({ principal_type: "client", principal_id: "c", name: "a", key_hash: "h", key_prefix: "p", scopes: [], created_by: "x" })) as Res;
    assert.equal(a.error, null);
    const b = (await db.raw.from("api_keys").insert({ principal_type: "client", principal_id: "c", name: "b", key_hash: "h", key_prefix: "p", scopes: [], created_by: "x" })) as Res;
    assert.equal(b.error?.code, "23505");
    assert.equal(db.rows("api_keys").length, 1);
  });
  it("check: api_keys.principal_type and name length", async () => {
    const db = fakeDb(API_PLATFORM_SCHEMA);
    const bad = (await db.raw.from("api_keys").insert({ principal_type: "robot", principal_id: "c", name: "a", key_hash: "h1" })) as Res;
    assert.equal(bad.error?.code, "23514");
    const long = (await db.raw.from("api_keys").insert({ principal_type: "client", principal_id: "c", name: "x".repeat(81), key_hash: "h2" })) as Res;
    assert.equal(long.error?.code, "23514");
  });
  it("composite pk: api_idempotency (principal_id, key)", async () => {
    const db = fakeDb(API_PLATFORM_SCHEMA);
    const row = { principal_id: "p", key: "k", request_hash: "r", status: "in_flight" };
    assert.equal(((await db.raw.from("api_idempotency").insert(row)) as Res).error, null);
    assert.equal(((await db.raw.from("api_idempotency").insert(row)) as Res).error?.code, "23505");
    assert.equal(((await db.raw.from("api_idempotency").insert({ ...row, principal_id: "other" })) as Res).error, null);
    assert.equal(((await db.raw.from("api_idempotency").insert({ ...row, key: "k2", status: "weird" })) as Res).error?.code, "23514");
  });
  it("partial unique: webhook_deliveries (endpoint_id, event_id) where event_id is not null", async () => {
    const db = fakeDb(API_PLATFORM_SCHEMA);
    const d = (v: Record<string, unknown>) => db.raw.from("webhook_deliveries").insert({ endpoint_id: "e1", event_type: "ping", status: "pending", url: "u", payload: {}, ...v }) as Promise<Res>;
    assert.equal((await d({ event_id: "x" })).error, null);
    assert.equal((await d({ event_id: "x" })).error?.code, "23505", "same endpoint + event id collides");
    assert.equal((await d({ event_id: "x", endpoint_id: "e2" })).error, null, "another endpoint may hold the same event id");
    assert.equal((await d({ event_id: null })).error, null);
    assert.equal((await d({ event_id: null })).error, null, "null event ids never collide");
    // The dropped global index: identical idempotency_key on different endpoints is fine.
    assert.equal((await d({ event_id: "y", idempotency_key: "same" })).error, null);
    assert.equal((await d({ event_id: "y", endpoint_id: "e2", idempotency_key: "same" })).error, null);
    assert.equal((await d({ event_id: "z", status: "queued" })).error?.code, "23514");
  });
  it("update re-validates constraints and filters apply", async () => {
    const db = fakeDb(API_PLATFORM_SCHEMA, { webhook_endpoints: [{ id: "a", kind: "client", url: "u" }, { id: "b", kind: "client", url: "u" }] });
    const bad = (await db.raw.from("webhook_endpoints").update({ kind: "nope" }).eq("id", "a")) as Res;
    assert.equal(bad.error?.code, "23514");
    const ok = (await db.raw.from("webhook_endpoints").update({ enabled: false }).eq("id", "a")) as Res;
    assert.equal(ok.error, null);
    assert.equal(db.rows("webhook_endpoints").find((r) => r.id === "a")?.enabled, false);
    assert.equal(db.rows("webhook_endpoints").find((r) => r.id === "b")?.enabled, true);
    const count = (await db.raw.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("kind", "client")) as Res;
    assert.equal(count.count, 2);
    assert.equal(count.data, null);
    const one = (await db.raw.from("webhook_endpoints").select("*").eq("id", "zzz").maybeSingle()) as Res;
    assert.equal(one.data, null);
    const single = (await db.raw.from("webhook_endpoints").select("*").eq("id", "zzz").single()) as Res;
    assert.equal(single.error?.code, "PGRST116");
    const or = (await db.raw.from("webhook_endpoints").select("*").or("id.eq.a,id.eq.zzz")) as Res;
    assert.equal((or.data as unknown[]).length, 1);
  });
});
