/**
 * Webhook outbox tests: the pure logic behind signing, backoff and retry
 * classification. Delivery itself (claim → POST → mark) needs Supabase and a
 * live endpoint; it is exercised through the cron route once a database is
 * reachable, not unit-tested here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHmac } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// outbox.ts imports "@/lib/..." aliases; register a resolve hook for node --test.
type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown,
) => unknown;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    try {
      return nextResolve(spec, context);
    } catch (err) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(`${spec}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});

const { signPayload, verifySignature, signingMaterial } = await import("../lib/webhooks/sign.ts");
const { backoffMs, isRetryableStatus } = await import("../lib/webhooks/outbox.ts");

const SECRET = "test-secret-do-not-use";

describe("webhook signing", () => {
  it("signs `${timestamp}.${body}` — the exact scheme the receivers verify", () => {
    // Independently recomputed here. If this assertion is ever "fixed" by
    // changing the expectation, the per-app registry-sync edge functions stop
    // accepting our deliveries — they implement this same construction.
    const body = JSON.stringify({ hello: "world" });
    const ts = 1_700_000_000_000;
    const { signature } = signPayload(SECRET, body, ts);

    const expected = createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex");
    assert.equal(signature, expected);
    assert.equal(signingMaterial(ts, body), `${ts}.${body}`);
  });

  it("accepts a signature it just produced", () => {
    const body = JSON.stringify({ a: 1 });
    const now = 1_700_000_000_000;
    const { signature, timestamp } = signPayload(SECRET, body, now);

    const result = verifySignature({
      secret: SECRET,
      rawBody: body,
      signature,
      timestamp: String(timestamp),
      now,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects a stale timestamp even when the signature is valid", () => {
    // This is the replay defence. The old signWebhookPayload had no timestamp
    // at all, so a captured request stayed valid forever.
    const body = JSON.stringify({ a: 1 });
    const signedAt = 1_700_000_000_000;
    const { signature } = signPayload(SECRET, body, signedAt);

    const result = verifySignature({
      secret: SECRET,
      rawBody: body,
      signature,
      timestamp: String(signedAt),
      now: signedAt + 10 * 60 * 1000, // ten minutes later, tolerance is five
    });
    assert.deepEqual(result, { ok: false, reason: "stale" });
  });

  it("rejects a replay that rewrites the timestamp header", () => {
    // The timestamp is INSIDE the signed material, so moving it forward to beat
    // the freshness window invalidates the signature rather than refreshing it.
    const body = JSON.stringify({ a: 1 });
    const signedAt = 1_700_000_000_000;
    const { signature } = signPayload(SECRET, body, signedAt);

    const replayedAt = signedAt + 10 * 60 * 1000;
    const result = verifySignature({
      secret: SECRET,
      rawBody: body,
      signature,                        // captured, unchanged
      timestamp: String(replayedAt),    // attacker's fresh timestamp
      now: replayedAt,
    });
    assert.deepEqual(result, { ok: false, reason: "mismatch" });
  });

  it("rejects a tampered body", () => {
    const now = 1_700_000_000_000;
    const { signature, timestamp } = signPayload(SECRET, JSON.stringify({ amount: 1 }), now);
    const result = verifySignature({
      secret: SECRET,
      rawBody: JSON.stringify({ amount: 1000 }),
      signature,
      timestamp: String(timestamp),
      now,
    });
    assert.deepEqual(result, { ok: false, reason: "mismatch" });
  });

  it("rejects the wrong secret", () => {
    const now = 1_700_000_000_000;
    const body = JSON.stringify({ a: 1 });
    const { signature, timestamp } = signPayload(SECRET, body, now);
    const result = verifySignature({
      secret: "a-different-secret",
      rawBody: body,
      signature,
      timestamp: String(timestamp),
      now,
    });
    assert.deepEqual(result, { ok: false, reason: "mismatch" });
  });

  it("reports missing signature and unparseable timestamp distinctly from a mismatch", () => {
    const body = "{}";
    assert.deepEqual(
      verifySignature({ secret: SECRET, rawBody: body, signature: null, timestamp: "1" }),
      { ok: false, reason: "missing" },
    );
    assert.deepEqual(
      verifySignature({ secret: SECRET, rawBody: body, signature: "ab", timestamp: "not-a-number" }),
      { ok: false, reason: "missing" },
    );
  });

  it("does not throw on a signature of the wrong length", () => {
    // timingSafeEqual throws on length mismatch; the length check must come first.
    const now = 1_700_000_000_000;
    const result = verifySignature({
      secret: SECRET,
      rawBody: "{}",
      signature: "short",
      timestamp: String(now),
      now,
    });
    assert.deepEqual(result, { ok: false, reason: "mismatch" });
  });
});

describe("webhook retry classification", () => {
  it("does not retry 4xx — repeating a rejected request unchanged cannot succeed", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(isRetryableStatus(status), false, `${status} should not retry`);
    }
  });

  it("retries the timing-related 4xx", () => {
    assert.equal(isRetryableStatus(408), true);
    assert.equal(isRetryableStatus(429), true);
  });

  it("retries 5xx and anything unrecognised", () => {
    for (const status of [500, 502, 503, 504, 599]) {
      assert.equal(isRetryableStatus(status), true, `${status} should retry`);
    }
  });
});

describe("webhook backoff", () => {
  it("stays within the exponential ceiling for each attempt", () => {
    for (const attempt of [1, 2, 3, 4, 5]) {
      const ceiling = Math.min(2 ** attempt * 1000, 60 * 60 * 1000);
      for (let i = 0; i < 200; i++) {
        const ms = backoffMs(attempt);
        assert.ok(ms >= 0 && ms <= ceiling, `attempt ${attempt} produced ${ms}, ceiling ${ceiling}`);
      }
    }
  });

  it("spreads retries instead of firing them in lockstep", () => {
    // Full jitter is what stops every delivery that failed during one outage
    // from retrying at the same instant and re-creating the spike.
    const samples = new Set(Array.from({ length: 50 }, () => backoffMs(5)));
    assert.ok(samples.size > 40, `expected spread values, got ${samples.size} distinct`);
  });

  it("honours Retry-After over its own guess", () => {
    assert.equal(backoffMs(1, 30), 30_000);
    assert.equal(backoffMs(8, 5), 5_000);
  });

  it("caps a hostile Retry-After at one hour", () => {
    // A broken or malicious endpoint returning Retry-After: 30 days must not
    // park the event past anyone's attention span.
    assert.equal(backoffMs(1, 60 * 60 * 24 * 30), 60 * 60 * 1000);
  });

  it("caps its own growth at one hour", () => {
    for (let i = 0; i < 100; i++) {
      assert.ok(backoffMs(40) <= 60 * 60 * 1000);
    }
  });
});
