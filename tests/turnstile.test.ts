// tests/turnstile.test.ts
/**
 * Direct unit tests for lib/scheduling/turnstile.ts — deferred from an
 * earlier phase. Covers the gate-configuration contract itself (not just
 * how a caller reacts to it):
 *  - isTurnstileConfigured() requires BOTH env vars; one set is reported
 *    as inactive, not silently active.
 *  - verifyTurnstileStrict() (used by the public v1 API, which always
 *    checks isTurnstileConfigured() first) never short-circuits to true
 *    on a missing site key.
 *  - verifyTurnstile() (used by the cookie booking-session route) keeps
 *    its historical short-circuit: missing site key -> true, regardless
 *    of the secret.
 */
import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isTurnstileConfigured,
  verifyTurnstile,
  verifyTurnstileStrict,
} from "../lib/scheduling/turnstile.ts";

const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET_KEY;
const ORIGINAL_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function setEnv(secret: string | undefined, siteKey: string | undefined) {
  if (secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = secret;
  if (siteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
}

afterEach(() => {
  setEnv(ORIGINAL_SECRET, ORIGINAL_SITE_KEY);
  mock.restoreAll();
});

describe("turnstile gate configuration", () => {
  it("both set -> configured true", () => {
    setEnv("s3cret", "sitekey");
    assert.equal(isTurnstileConfigured(), true);
  });

  it("secret set, site key unset -> configured FALSE (reported inactive, not silently active)", () => {
    setEnv("s3cret", undefined);
    assert.equal(isTurnstileConfigured(), false);
  });

  it("site key set, secret unset -> configured false", () => {
    setEnv(undefined, "sitekey");
    assert.equal(isTurnstileConfigured(), false);
  });

  it("both unset -> configured false", () => {
    setEnv(undefined, undefined);
    assert.equal(isTurnstileConfigured(), false);
  });
});

describe("verifyTurnstileStrict (public v1 API path — no site-key short-circuit)", () => {
  it("secret+site set & token invalid -> false", async () => {
    setEnv("s3cret", "sitekey");
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    assert.equal(await verifyTurnstileStrict("bad-token", "1.2.3.4"), false);
  });

  it("secret+site set & token valid -> true", async () => {
    setEnv("s3cret", "sitekey");
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    assert.equal(await verifyTurnstileStrict("good-token", "1.2.3.4"), true);
  });

  it("secret set, site key unset -> false (does NOT short-circuit to true)", async () => {
    setEnv("s3cret", undefined);
    assert.equal(await verifyTurnstileStrict("any-token", "1.2.3.4"), false);
  });

  it("both unset -> false", async () => {
    setEnv(undefined, undefined);
    assert.equal(await verifyTurnstileStrict("any-token", "1.2.3.4"), false);
  });

  it("no token -> false without calling fetch", async () => {
    setEnv("s3cret", "sitekey");
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    assert.equal(await verifyTurnstileStrict(undefined, "1.2.3.4"), false);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});

describe("verifyTurnstile (cookie session-route path — legacy short-circuit preserved)", () => {
  it("site key unset -> true regardless of secret (session route's load-bearing dev exemption)", async () => {
    setEnv("s3cret", undefined);
    assert.equal(await verifyTurnstile("whatever", "1.2.3.4"), true);
    setEnv(undefined, undefined);
    assert.equal(await verifyTurnstile("whatever", "1.2.3.4"), true);
  });

  it("site key set, secret unset -> false", async () => {
    setEnv(undefined, "sitekey");
    assert.equal(await verifyTurnstile("whatever", "1.2.3.4"), false);
  });

  it("both set & token invalid -> false", async () => {
    setEnv("s3cret", "sitekey");
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );
    assert.equal(await verifyTurnstile("bad-token", "1.2.3.4"), false);
  });

  it("both set & token valid -> true", async () => {
    setEnv("s3cret", "sitekey");
    mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    assert.equal(await verifyTurnstile("good-token", "1.2.3.4"), true);
  });
});
