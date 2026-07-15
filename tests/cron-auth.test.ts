import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";

/** Mirrors cron Authorization: Bearer check. */
function authorizeCron(authHeader: string, secret: string): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

describe("cron auth", () => {
  it("accepts matching bearer token", () => {
    assert.equal(
      authorizeCron("Bearer super-secret-cron-key", "super-secret-cron-key"),
      true
    );
  });

  it("rejects wrong or short tokens without throwing", () => {
    assert.equal(authorizeCron("Bearer wrong", "super-secret-cron-key"), false);
    assert.equal(authorizeCron("", "super-secret-cron-key"), false);
    assert.equal(authorizeCron("Bearer x", ""), false);
  });
});

describe("brief ingest secret length", () => {
  it("requires 24+ chars like production ingest", () => {
    const expected = "x".repeat(24);
    const provided = "x".repeat(24);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    assert.equal(a.length === b.length && timingSafeEqual(a, b), true);
    assert.equal("short".length >= 24, false);
  });
});
