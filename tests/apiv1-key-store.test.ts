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
import { KEY_PREFIX } from "../lib/apiv1/keys.ts";

function fakeSb(state: { keys: any[]; requests: any[] }) {
  const builder = (table: string) => {
    let rows = table === "api_keys" ? state.keys : state.requests;
    let pendingUpdate: any = null;
    let selectOpts: { count?: string; head?: boolean } | null = null;
    const q: any = {};
    q.select = (_cols?: string, opts?: { count?: string; head?: boolean }) => { selectOpts = opts ?? null; return q; };
    q.eq = (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; };
    q.is = (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return q; };
    q.in = (c: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[c])); return q; };
    q.gte = () => q;
    q.order = () => q;
    q.insert = (v: any) => { const row = { id: `id${state.keys.length + 1}`, created_at: "t", last_used_at: null, expires_at: null, revoked_at: null, ...v }; state.keys.push(row); rows = [row]; return q; };
    q.update = (v: any) => { pendingUpdate = v; return q; };
    q.single = async () => ({ data: rows[0], error: null });
    q.then = (res: any) => {
      if (pendingUpdate) { for (const r of rows) Object.assign(r, pendingUpdate); }
      if (selectOpts?.count === "exact" && selectOpts.head) {
        res({ data: null, count: rows.length, error: null });
      } else {
        res({ data: rows, error: null });
      }
    };
    return q;
  };
  return { from: builder } as any;
}

describe("key-store", () => {
  const owner = { type: "client" as const, id: "c1" };
  it("creates, lists with 30d counts, revokes", async () => {
    const state = { keys: [] as any[], requests: [] as any[] };
    const sb = fakeSb(state);
    const { key, plaintext } = await createApiKey(sb, { owner, name: "CI", scopes: ["projects:read"], createdBy: "ann@acme.com" });
    assert.ok(plaintext.startsWith(KEY_PREFIX));
    assert.equal(key.key_prefix.length, 8);
    assert.equal("key_hash" in key, false);
    state.requests.push({ key_id: key.id }, { key_id: key.id });
    const list = await listApiKeys(sb, owner);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.requests_30d, 2);
    assert.equal(await revokeApiKey(sb, owner, key.id), true);
    assert.equal((await listApiKeys(sb, owner)).length, 0);
    assert.equal(await revokeApiKey(sb, { type: "client", id: "other" }, key.id), false);
  });
  it("enforces the active-key cap and non-empty scopes", async () => {
    const state = { keys: Array.from({ length: MAX_ACTIVE_KEYS }, (_, i) => ({ id: `k${i}`, principal_type: "client", principal_id: "c1", revoked_at: null })), requests: [] };
    await assert.rejects(createApiKey(fakeSb(state), { owner, name: "x", scopes: ["projects:read"], createdBy: "a" }), (e: any) => e.code === "conflict");
    await assert.rejects(createApiKey(fakeSb({ keys: [], requests: [] }), { owner, name: "x", scopes: [], createdBy: "a" }), (e: any) => e.code === "validation_failed");
  });

  it("listAllAdminKeys returns every active admin key across principals", async () => {
    const state = {
      keys: [
        { id: "a1", principal_type: "admin", principal_id: "admin-1", revoked_at: null, name: "A", key_prefix: "aaaaaaaa", scopes: ["leads:read"], created_by: "x", last_used_at: null, expires_at: null, created_at: "t" },
        { id: "a2", principal_type: "admin", principal_id: "admin-2", revoked_at: null, name: "B", key_prefix: "bbbbbbbb", scopes: ["leads:read"], created_by: "x", last_used_at: null, expires_at: null, created_at: "t" },
        { id: "c1k", principal_type: "client", principal_id: "c1", revoked_at: null, name: "C", key_prefix: "cccccccc", scopes: ["projects:read"], created_by: "x", last_used_at: null, expires_at: null, created_at: "t" },
      ],
      requests: [{ key_id: "a1" }, { key_id: "a1" }],
    };
    const sb = fakeSb(state);
    const all = await listAllAdminKeys(sb);
    assert.equal(all.length, 2);
    assert.ok(all.every((k) => "principal_id" in k));
    const a1 = all.find((k) => k.id === "a1")!;
    const a2 = all.find((k) => k.id === "a2")!;
    assert.equal(a1.requests_30d, 2);
    assert.equal(a2.requests_30d, 0);
  });

  it("revokeAnyAdminKey revokes an admin key regardless of owner", async () => {
    const state = {
      keys: [{ id: "a1", principal_type: "admin", principal_id: "admin-1", revoked_at: null }],
      requests: [] as any[],
    };
    const sb = fakeSb(state);
    assert.equal(await revokeAnyAdminKey(sb, "a1"), true);
    assert.equal(await revokeAnyAdminKey(sb, "a1"), false);
    assert.equal(await revokeAnyAdminKey(sb, "missing"), false);
  });
});
