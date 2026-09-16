import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateApiKey, hashApiKey, parseBearer, resolveApiKey, KEY_PREFIX, type ApiKeyRow } from "../lib/apiv1/keys.ts";

const row = (over: Partial<ApiKeyRow> = {}): ApiKeyRow => ({
  id: "k1", principal_type: "client", principal_id: "c1", name: "n", key_prefix: "abcdefgh",
  scopes: ["projects:read"], created_by: "a@b.c", last_used_at: null, expires_at: null, revoked_at: null,
  created_at: "2026-01-01T00:00:00Z", ...over,
});

describe("generateApiKey", () => {
  it("has the documented shape", () => {
    const k = generateApiKey();
    assert.ok(k.plaintext.startsWith(KEY_PREFIX));
    assert.equal(k.plaintext.length, KEY_PREFIX.length + 32);
    assert.match(k.plaintext.slice(KEY_PREFIX.length), /^[0-9A-Za-z]{32}$/);
    assert.equal(k.prefix, k.plaintext.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8));
    assert.equal(k.hash, hashApiKey(k.plaintext));
    assert.match(k.hash, /^[0-9a-f]{64}$/);
    assert.notEqual(generateApiKey().plaintext, k.plaintext);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    assert.equal(parseBearer("Bearer abc"), "abc");
    assert.equal(parseBearer("bearer  abc "), "abc");
    assert.equal(parseBearer("Basic abc"), null);
    assert.equal(parseBearer(null), null);
  });
});

describe("resolveApiKey", () => {
  const k = generateApiKey();
  const mk = (r: ApiKeyRow | null) => {
    const touched: string[] = [];
    let t = Date.parse("2026-09-15T00:00:00.000Z");
    return {
      touched,
      deps: { findByHash: async (h: string) => (r && h === k.hash ? r : null), touch: async (id: string) => { touched.push(id); }, now: () => t },
      advance: (ms: number) => { t += ms; },
    };
  };
  it("resolves a live key and touches it once per minute", async () => {
    const f = mk(row({ id: "live-" + Math.random() }));
    const r1 = await resolveApiKey(k.plaintext, f.deps);
    assert.ok(r1);
    await resolveApiKey(k.plaintext, f.deps);
    assert.equal(f.touched.length, 1);
    f.advance(61_000);
    await resolveApiKey(k.plaintext, f.deps);
    assert.equal(f.touched.length, 2);
  });
  it("rejects malformed, unknown, revoked, expired", async () => {
    assert.equal(await resolveApiKey("nope", mk(row()).deps), null);
    assert.equal(await resolveApiKey(KEY_PREFIX + "x".repeat(32), mk(row()).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(null).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(row({ revoked_at: "2026-01-02T00:00:00Z" })).deps), null);
    assert.equal(await resolveApiKey(k.plaintext, mk(row({ expires_at: "2000-01-01T00:00:00Z" })).deps), null);
  });
  it("accepts a key with future expiry", async () => {
    const r = await resolveApiKey(k.plaintext, mk(row({ expires_at: "2099-01-01T00:00:00Z" })).deps);
    assert.ok(r);
  });
});
