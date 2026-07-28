/**
 * integration-log tests: the two pieces with real logic behind them —
 * error classification and redaction.
 *
 * Both are load-bearing in ways that fail quietly if wrong. A misclassified
 * error puts a credential problem in the "provider outage" bucket and nobody
 * rotates the key. A redaction miss writes a live API key into a log
 * aggregator that outlives the incident.
 *
 * Persistence (integration_runs / integration_connections) needs Supabase and
 * is exercised through the routes, not here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// Same tsconfig-path-alias resolve hook as tests/ai-proxy.test.ts.
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
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    }
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

const {
  classifyError,
  redact,
  providerRequestIdOf,
  statusCodeOf,
  isRetryable,
  needsReauth,
  ensureCorrelationId,
  withCorrelation,
  currentCorrelationId,
  IntegrationError,
} = await import("../lib/integration-log.ts");

describe("classifyError — status codes", () => {
  it("separates the two 401 cases, which need different responses", () => {
    assert.equal(classifyError({ status: 401 }), "auth_expired");
    assert.equal(
      classifyError({ status: 401, message: "This key has been revoked" }),
      "auth_revoked",
    );
  });

  it("maps the rest of the status space", () => {
    assert.equal(classifyError({ status: 403 }), "permission_denied");
    assert.equal(classifyError({ status: 404 }), "not_found");
    assert.equal(classifyError({ status: 408 }), "timeout");
    assert.equal(classifyError({ status: 429 }), "rate_limited");
    assert.equal(classifyError({ status: 422 }), "validation");
    assert.equal(classifyError({ status: 500 }), "provider_unavailable");
    assert.equal(classifyError({ status: 503 }), "provider_unavailable");
  });

  it("reads statusCode as well as status, since SDKs differ", () => {
    assert.equal(classifyError({ statusCode: 429 }), "rate_limited");
  });
});

describe("classifyError — network failures", () => {
  it("classifies errors that never carry a status", () => {
    assert.equal(
      classifyError({ name: "APIConnectionTimeoutError" }),
      "timeout",
    );
    assert.equal(classifyError({ code: "ECONNREFUSED" }), "provider_unavailable");
    assert.equal(classifyError({ code: "ENOTFOUND" }), "provider_unavailable");
    assert.equal(classifyError(new Error("request timed out")), "timeout");
  });
});

describe("classifyError — Stripe error types", () => {
  it("uses Stripe's type when no status is present", () => {
    assert.equal(
      classifyError({ type: "StripeAuthenticationError" }),
      "auth_expired",
    );
    assert.equal(classifyError({ type: "StripeRateLimitError" }), "rate_limited");
    assert.equal(classifyError({ type: "StripeCardError" }), "validation");
    assert.equal(
      classifyError({ type: "StripeConnectionError" }),
      "provider_unavailable",
    );
  });
});

describe("classifyError — the unknown case", () => {
  it("falls back to our_bug rather than blaming the provider", () => {
    // Filing an unrecognized failure under "provider problem" is how a real
    // regression sits unowned for a week.
    assert.equal(classifyError(new Error("cannot read property of undefined")), "our_bug");
    assert.equal(classifyError(null), "our_bug");
    assert.equal(classifyError("a bare string"), "our_bug");
  });
});

describe("retry and reauth predicates", () => {
  it("only transient classes are retryable", () => {
    assert.equal(isRetryable("rate_limited"), true);
    assert.equal(isRetryable("timeout"), true);
    assert.equal(isRetryable("provider_unavailable"), true);
    // Retrying these burns attempts on a failure that is identical every time.
    assert.equal(isRetryable("validation"), false);
    assert.equal(isRetryable("auth_expired"), false);
    assert.equal(isRetryable("not_found"), false);
  });

  it("only auth classes need a human to re-authorize", () => {
    assert.equal(needsReauth("auth_expired"), true);
    assert.equal(needsReauth("auth_revoked"), true);
    assert.equal(needsReauth("rate_limited"), false);
  });
});

describe("redact", () => {
  it("strips provider credentials", () => {
    const cases = [
      "Invalid key sk_live_51HxyzABCDEFghijkl",
      "auth failed for re_AbCdEf123456789",
      "bad token sk-ant-api03-abcdefghijklmnop",
      "signature mismatch whsec_ABCdef123456",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9abc",
    ];
    for (const input of cases) {
      const out = redact(input);
      assert.ok(out.includes("[redacted]"), `no redaction in: ${out}`);
      assert.ok(!/sk_live_51Hxyz|re_AbCdEf|sk-ant-api03|whsec_ABCdef/.test(out), out);
    }
  });

  it("masks the local part of email addresses", () => {
    const out = redact("could not deliver to jane.doe@example.com");
    assert.ok(!out.includes("jane.doe"), out);
    // The domain survives — "the whole domain is bouncing" is a real diagnosis.
    assert.ok(out.includes("@example.com"), out);
  });

  it("leaves an ordinary message intact", () => {
    const message = "Domain is not verified. Verify it in the dashboard.";
    assert.equal(redact(message), message);
  });
});

describe("providerRequestIdOf", () => {
  it("reads every spelling our SDKs use", () => {
    assert.equal(providerRequestIdOf({ requestID: "req_anthropic" }), "req_anthropic");
    assert.equal(providerRequestIdOf({ requestId: "req_stripe" }), "req_stripe");
    assert.equal(providerRequestIdOf({ request_id: "req_rest" }), "req_rest");
    assert.equal(providerRequestIdOf({}), null);
    assert.equal(providerRequestIdOf(null), null);
  });

  it("reads Anthropic's non-enumerable _request_id off a success response", () => {
    // The SDK defines this non-enumerably on successful JSON responses, so it
    // survives direct property access but not a spread or JSON round-trip.
    // Reading it is the difference between a Anthropic support ticket that gets
    // answered and one that gets a request for more information.
    const response = { content: [], usage: {} };
    Object.defineProperty(response, "_request_id", {
      value: "req_011CQ",
      enumerable: false,
    });
    assert.equal(JSON.stringify(response).includes("_request_id"), false);
    assert.equal(providerRequestIdOf(response), "req_011CQ");
  });
});

describe("statusCodeOf", () => {
  it("returns null rather than guessing when there is no status", () => {
    assert.equal(statusCodeOf({ status: 429 }), 429);
    assert.equal(statusCodeOf({ statusCode: 500 }), 500);
    assert.equal(statusCodeOf(new Error("boom")), null);
  });
});

describe("correlation id", () => {
  it("rejects a malformed inbound header rather than logging it", () => {
    // The value arrives from a request header, so it is attacker-controllable
    // and ends up in log lines.
    const injected = ensureCorrelationId("abc\ndef ghi");
    assert.ok(!injected.includes("\n"), injected);
    assert.notEqual(injected, "abc\ndef ghi");
  });

  it("preserves a well-formed inbound id", () => {
    assert.equal(ensureCorrelationId("evt_1PabcDEF"), "evt_1PabcDEF");
  });

  it("mints one when absent", () => {
    const id = ensureCorrelationId(null);
    assert.ok(id.length > 0);
    assert.notEqual(ensureCorrelationId(null), id);
  });

  it("propagates through the ambient context", () => {
    assert.equal(currentCorrelationId(), undefined);
    withCorrelation("evt_outer", () => {
      assert.equal(currentCorrelationId(), "evt_outer");
      // Nested work inherits it without threading a parameter.
      assert.equal(ensureCorrelationId(), "evt_outer");
    });
    assert.equal(currentCorrelationId(), undefined);
  });
});

describe("IntegrationError", () => {
  it("never exposes the provider's raw error in userMessage", () => {
    const err = new IntegrationError({
      provider: "stripe",
      operation: "customer.create",
      errorClass: "auth_expired",
      statusCode: 401,
      providerRequestId: "req_123",
      message: "Invalid API Key provided: sk_live_[redacted]",
    });
    assert.ok(!err.userMessage.includes("sk_live"));
    assert.ok(!err.userMessage.includes("Invalid API Key"));
    assert.match(err.userMessage, /re-authorized/);
    // The detail is still on the error for the log.
    assert.equal(err.providerRequestId, "req_123");
    assert.equal(err.retryable, false);
  });

  it("marks transient classes retryable", () => {
    const err = new IntegrationError({
      provider: "resend",
      operation: "email.send",
      errorClass: "rate_limited",
      statusCode: 429,
      providerRequestId: null,
      message: "Too many requests",
    });
    assert.equal(err.retryable, true);
  });
});
