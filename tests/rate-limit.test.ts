import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../lib/security.ts";

describe("rateLimit (memory fallback)", () => {
  beforeEach(() => {
    // Unique keys per test avoid cross-talk in the shared Map.
  });

  it("allows up to the limit then blocks", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    assert.equal(await rateLimit(key, 3, 60_000), true);
    assert.equal(await rateLimit(key, 3, 60_000), true);
    assert.equal(await rateLimit(key, 3, 60_000), true);
    assert.equal(await rateLimit(key, 3, 60_000), false);
  });

  it("isolates keys", async () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;
    assert.equal(await rateLimit(a, 1, 60_000), true);
    assert.equal(await rateLimit(b, 1, 60_000), true);
    assert.equal(await rateLimit(a, 1, 60_000), false);
  });
});
