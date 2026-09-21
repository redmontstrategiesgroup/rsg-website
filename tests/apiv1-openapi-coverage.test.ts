import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ZodType } from "zod";

// Route modules pull in the real runtime (Supabase, rate limiting…); none of it runs at import
// time, but the client must resolve. Nothing here executes a handler.
mock.module("@/lib/supabase", {
  namedExports: { getSupabase: () => null, isSupabaseConfigured: () => false, requireSupabase: () => { throw new Error("no db"); } },
});

const { V1_ROUTES } = await import("../lib/apiv1/openapi-routes.ts");
const { operationOf } = await import("../lib/apiv1/registry.ts");

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const modules = await Promise.all(V1_ROUTES.map(async (r) => ({ ...r, module: await r.load() })));

function defType(schema: ZodType): string {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type;
}

describe("every v1 route is registered with a real response schema", () => {
  for (const r of modules) {
    for (const method of METHODS) {
      const fn = r.module[method];
      if (fn === undefined) continue;
      it(`${method} ${r.path}`, () => {
        const op = operationOf(fn);
        assert.ok(op, `${method} ${r.path} is not built with withApi()`);
        assert.equal(op.method, method);
        assert.ok(op.operationId && op.summary && op.tag, "operationId/summary/tag required");
        assert.notEqual(defType(op.response), "any", `meta.response is z.any() — document the real shape`);
      });
    }
  }
  it("has at least one operation per route and unique operationIds", () => {
    const ids = new Set<string>();
    for (const r of modules) {
      const ops = METHODS.map((m) => operationOf(r.module[m])).filter((o) => o !== null);
      assert.ok(ops.length > 0, r.path);
      for (const op of ops) {
        assert.ok(!ids.has(op.operationId), `duplicate operationId ${op.operationId}`);
        ids.add(op.operationId);
      }
    }
  });
});
