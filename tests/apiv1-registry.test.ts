import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withApi, type PipelineDeps } from "../lib/apiv1/pipeline.ts";
import { listOperations, operationOf, resetOperations } from "../lib/apiv1/registry.ts";

const deps: PipelineDeps = {
  enabled: () => true,
  resolveKey: async () => null,
  resolvePrincipal: async () => null,
  rateLimit: async () => true,
  clientIp: () => "1.1.1.1",
  idempotency: null,
  usage: null,
};

describe("operation registration", () => {
  it("attaches the operation (with body/query/rateLimit) to the handler", () => {
    resetOperations();
    const body = z.object({ a: z.string() });
    const query = z.object({ q: z.string().optional() });
    const h = withApi(
      "POST",
      {
        auth: "client",
        scopes: ["tickets:write"],
        idempotent: true,
        body,
        query,
        rateLimit: { limit: 5, windowMs: 1000 },
        meta: { operationId: "opA", summary: "A", tag: "T", response: z.any() },
      },
      async () => ({ data: 1 }),
      deps,
    );
    const op = operationOf(h);
    assert.ok(op);
    assert.equal(op.operationId, "opA");
    assert.equal(op.method, "POST");
    assert.equal(op.body, body);
    assert.equal(op.query, query);
    assert.deepEqual(op.rateLimit, { limit: 5, windowMs: 1000 });
    assert.deepEqual(op.scopes, ["tickets:write"]);
    assert.equal(op.idempotent, true);
    assert.equal(listOperations().length, 1);
    assert.equal(listOperations()[0], op);
  });

  it("returns null for anything that is not a registered handler", () => {
    assert.equal(operationOf(() => {}), null);
    assert.equal(operationOf(undefined), null);
    assert.equal(operationOf({}), null);
  });

  it("omits body/query/rateLimit when the route has none", () => {
    resetOperations();
    const h = withApi("GET", { auth: "none", meta: { operationId: "opB", summary: "B", tag: "T", response: z.any() } }, async () => ({ data: 1 }), deps);
    const op = operationOf(h);
    assert.ok(op);
    assert.equal(op.body, undefined);
    assert.equal(op.query, undefined);
    assert.equal(op.rateLimit, undefined);
    assert.equal(op.idempotent, false);
  });
});
