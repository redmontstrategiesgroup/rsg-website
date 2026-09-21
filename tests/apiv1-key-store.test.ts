import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  listAllAdminKeys,
  revokeAnyAdminKey,
  MAX_ACTIVE_KEYS,
} from "../lib/apiv1/key-store.ts";
import { KEY_PREFIX, hashApiKey } from "../lib/apiv1/keys.ts";
import { API_PLATFORM_SCHEMA, fakeDb, type Row } from "./_fake-db.ts";

/** The store runs against the constraint-enforcing fake — see tests/_fake-db.ts. */
function db(keys: Row[] = [], requests: Row[] = []) {
  return fakeDb(API_PLATFORM_SCHEMA, { api_keys: keys, api_requests: requests });
}
const adminKey = (id: string, principal: string): Row => ({
  id, principal_type: "admin", principal_id: principal, revoked_at: null, name: "A", key_prefix: "aaaaaaaa", key_hash: `hash-${id}`,
  scopes: ["leads:read"], created_by: "x", created_at: "t",
});

describe("key-store", () => {
  const owner = { type: "client" as const, id: "c1" };
  it("creates (hash at rest, never in the DTO), lists with 30d counts, revokes", async () => {
    const f = db();
    const { key, plaintext } = await createApiKey(f.sb, { owner, name: "CI", scopes: ["projects:read"], createdBy: "ann@acme.com" });
    assert.ok(plaintext.startsWith(KEY_PREFIX));
    assert.equal(key.key_prefix.length, 8);
    assert.equal("key_hash" in key, false);
    const stored = f.rows("api_keys")[0]!;
    assert.equal(stored.key_hash, hashApiKey(plaintext), "the stored hash is of the plaintext we handed out");
    assert.equal(JSON.stringify(stored).includes(plaintext), false, "plaintext is never persisted");
    f.rows("api_requests").push({ id: 1, key_id: key.id, created_at: new Date().toISOString() }, { id: 2, key_id: key.id, created_at: new Date().toISOString() });
    f.rows("api_requests").push({ id: 3, key_id: key.id, created_at: "2020-01-01T00:00:00.000Z" }); // outside 30d
    const list = await listApiKeys(f.sb, owner);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.requests_30d, 2);
    assert.equal(await revokeApiKey(f.sb, owner, key.id), true);
    assert.ok(stored.revoked_at, "revocation is persisted");
    assert.equal((await listApiKeys(f.sb, owner)).length, 0);
    assert.equal(await revokeApiKey(f.sb, owner, key.id), false, "already revoked");
    assert.equal(await revokeApiKey(f.sb, { type: "client", id: "other" }, key.id), false);
  });
  it("enforces the active-key cap (revoked keys do not count) and non-empty scopes", async () => {
    const active = (i: number): Row => ({ id: `k${i}`, principal_type: "client", principal_id: "c1", revoked_at: null, key_hash: `h${i}`, name: "n" });
    const full = db(Array.from({ length: MAX_ACTIVE_KEYS }, (_, i) => active(i)));
    await assert.rejects(createApiKey(full.sb, { owner, name: "x", scopes: ["projects:read"], createdBy: "a" }), (e: { code: string }) => e.code === "conflict");
    assert.equal(full.rows("api_keys").length, MAX_ACTIVE_KEYS);
    const withRevoked = db([...Array.from({ length: MAX_ACTIVE_KEYS - 1 }, (_, i) => active(i)), { ...active(99), revoked_at: "t" }]);
    const r = await createApiKey(withRevoked.sb, { owner, name: "x", scopes: ["projects:read"], createdBy: "a" });
    assert.ok(r.key.id);
    await assert.rejects(createApiKey(db().sb, { owner, name: "x", scopes: [], createdBy: "a" }), (e: { code: string }) => e.code === "validation_failed");
  });
  it("the DB rejects a name outside 1–80 chars and an unknown principal type", async () => {
    await assert.rejects(createApiKey(db().sb, { owner, name: "x".repeat(81), scopes: ["projects:read"], createdBy: "a" }), /check constraint/);
    await assert.rejects(
      createApiKey(db().sb, { owner: { type: "robot" as never, id: "r" }, name: "x", scopes: ["projects:read"], createdBy: "a" }),
      /check constraint/,
    );
  });

  it("listAllAdminKeys returns every active admin key across principals", async () => {
    const f = db(
      [adminKey("a1", "admin-1"), adminKey("a2", "admin-2"), { ...adminKey("c1k", "c1"), principal_type: "client", scopes: ["projects:read"] }, { ...adminKey("a3", "admin-1"), revoked_at: "t" }],
      [{ id: 1, key_id: "a1", created_at: new Date().toISOString() }, { id: 2, key_id: "a1", created_at: new Date().toISOString() }],
    );
    const all = await listAllAdminKeys(f.sb);
    assert.deepEqual(all.map((k) => k.id).sort(), ["a1", "a2"]);
    assert.ok(all.every((k) => "principal_id" in k));
    assert.equal(all.find((k) => k.id === "a1")!.requests_30d, 2);
    assert.equal(all.find((k) => k.id === "a2")!.requests_30d, 0);
  });

  it("revokeAnyAdminKey revokes an admin key regardless of owner, never a client key", async () => {
    const f = db([adminKey("a1", "admin-1"), { ...adminKey("c1k", "c1"), principal_type: "client" }]);
    assert.equal(await revokeAnyAdminKey(f.sb, "a1"), true);
    assert.equal(await revokeAnyAdminKey(f.sb, "a1"), false);
    assert.equal(await revokeAnyAdminKey(f.sb, "missing"), false);
    assert.equal(await revokeAnyAdminKey(f.sb, "c1k"), false);
    assert.equal(f.rows("api_keys").find((r) => r.id === "c1k")!.revoked_at, null);
  });
});
