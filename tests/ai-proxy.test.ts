/**
 * ai/proxy tests: failure-code → HTTP status mapping, aiErrorResponse, and the
 * preflight "not_configured" guard (which must throw BEFORE any network call).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

// lib/ai/proxy imports "@/lib/security" (tsconfig path alias), which plain
// `node --test` cannot resolve. Register a resolve hook mapping "@/x" → repo
// path, retrying the extensions Node's type-stripping loader accepts.
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

const { AiError, aiErrorResponse, generateStructured } = await import("../lib/ai/proxy.ts");

describe("ai/proxy AiError", () => {
  it("maps failure codes to HTTP status", () => {
    assert.equal(new AiError("not_configured", "x").status, 503);
    assert.equal(new AiError("paused", "x").status, 503);
    assert.equal(new AiError("rate_limited", "x").status, 429);
    assert.equal(new AiError("refused", "x").status, 422);
    assert.equal(new AiError("upstream", "x").status, 502);
  });
});

describe("ai/proxy aiErrorResponse", () => {
  it("maps an AiError to its status and code", async () => {
    const res = aiErrorResponse(new AiError("rate_limited", "slow down"));
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: "slow down", code: "rate_limited" });
  });

  it("maps an unknown error to 500", async () => {
    const res = aiErrorResponse(new Error("boom"));
    assert.equal(res.status, 500);
  });
});

describe("ai/proxy preflight", () => {
  it("throws not_configured when ANTHROPIC_API_KEY is unset (no network call)", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await assert.rejects(
        generateStructured({
          tenantId: "t1",
          app: "test",
          system: "s",
          input: "hi",
          schema: {
            name: "x",
            description: "d",
            input_schema: { type: "object", properties: {} },
          },
        }),
        (err: unknown) => err instanceof AiError && err.code === "not_configured",
      );
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
