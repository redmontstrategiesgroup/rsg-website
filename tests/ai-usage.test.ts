/**
 * ai/usage tests: the pure cost-estimate logic and cap default. DB round-trips
 * (recordAiUsage / tenantUsageThisMonth) require Supabase and are exercised via
 * the app routes once a database is reachable — not unit-tested here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// usage.ts imports "@/lib/..." aliases; register a resolve hook for node --test.
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

const { estimateCostUsd, MONTHLY_TOKEN_CAP } = await import("../lib/ai/usage.ts");

describe("ai/usage estimateCostUsd", () => {
  it("prices known models by input/output rate per MTok", () => {
    // sonnet-5: $3 in + $15 out per 1M tokens
    assert.equal(estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000), 18);
    // haiku-4.5: $1 in per 1M; 500k input only → 0.5
    assert.equal(estimateCostUsd("claude-haiku-4-5", 500_000, 0), 0.5);
    // zero tokens → zero cost
    assert.equal(estimateCostUsd("claude-opus-4-8", 0, 0), 0);
  });

  it("returns 0 for an unknown model rather than a fabricated cost", () => {
    assert.equal(estimateCostUsd("some-future-model", 1_000_000, 1_000_000), 0);
  });
});

describe("ai/usage cap", () => {
  it("has a positive default monthly token cap", () => {
    assert.ok(MONTHLY_TOKEN_CAP > 0);
  });
});
