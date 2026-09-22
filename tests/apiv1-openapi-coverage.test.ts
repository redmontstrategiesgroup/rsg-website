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
  it("buildOpenApi() documents every handler, every $ref resolves, every example validates", async () => {
    const { buildOpenApi } = await import("../lib/apiv1/openapi.ts");
    const doc = await buildOpenApi();
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.info.version.length > 0);
    assert.ok(doc.servers[0].url.startsWith("http"));

    // (a) every handler export is in the document under its path
    let count = 0;
    for (const r of modules) {
      for (const method of METHODS) {
        if (r.module[method] === undefined) continue;
        const op = doc.paths[r.path]?.[method.toLowerCase() as "get"];
        assert.ok(op, `${method} ${r.path} missing from openapi.json`);
        assert.equal(op.operationId, operationOf(r.module[method])!.operationId);
        count++;
      }
    }
    assert.equal(count, 56, "operation count changed — update this number deliberately");

    // (b) every $ref in the document resolves
    const refs: string[] = [];
    JSON.stringify(doc, (k, v) => { if (k === "$ref" && typeof v === "string") refs.push(v); return v; });
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      assert.ok(ref.startsWith("#/"), ref);
      const target = ref.slice(2).split("/").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], doc);
      assert.ok(target, `unresolved ${ref}`);
    }

    // (c) every request example validates against the zod schema it was declared on
    let examples = 0;
    for (const r of modules) {
      for (const method of METHODS) {
        const op = operationOf(r.module[method]);
        if (!op?.body) continue;
        const example = doc.paths[r.path][method.toLowerCase() as "post"]?.requestBody?.content["application/json"].example;
        if (example === undefined) continue;
        const parsed = op.body.safeParse(example);
        assert.ok(parsed.success, `${op.operationId} example is invalid: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`);
        examples++;
      }
    }
    assert.ok(examples >= 9, `expected the seeded examples, found ${examples}`);

    // (c2) webhook examples must also pass the semantic check the handler runs
    // (catalogued event, visible to the audience) — zod alone only sees string[].
    const { validateEvents } = await import("../lib/webhooks/endpoints.ts");
    for (const id of ["createWebhook", "updateWebhook"]) {
      const op = Object.values(doc.paths).flatMap((item) => Object.values(item)).find((o) => o?.operationId === id);
      const example = op?.requestBody?.content["application/json"].example as { events?: string[] } | undefined;
      if (!example?.events) continue;
      for (const type of ["client", "admin"] as const) {
        assert.doesNotThrow(() => validateEvents(example.events!, { type, id: "x" }), `${id} example events invalid for ${type}`);
      }
    }

    // (d) list endpoints reference the shared pagination params
    const list = doc.paths["/api/v1/tickets"].get!;
    assert.ok(list.parameters.some((p) => "$ref" in p && p.$ref === "#/components/parameters/cursor"));
    assert.ok(doc.webhooks["ticket.created"]);
  });

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
