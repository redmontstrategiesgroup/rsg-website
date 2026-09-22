import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { exampleFor, pathParameters, queryToParameters, zodToSchema } from "../lib/apiv1/json-schema.ts";

describe("json-schema helpers", () => {
  it("converts zod, strips $schema/example, honours io", () => {
    const s = z.object({ a: z.string().max(3), b: z.number().optional(), d: z.enum(["x"]).default("x") }).meta({ example: { a: "q" } });
    const input = zodToSchema(s, "input");
    assert.equal("$schema" in input, false);
    assert.equal("example" in input, false);
    assert.deepEqual(input.required, ["a"]);
    const output = zodToSchema(s, "output");
    assert.deepEqual(output.required, ["a", "d"]);
  });
  it("query → parameters with shared refs, descriptions and required flags", () => {
    const p = queryToParameters(z.object({ status: z.enum(["open"]).optional().describe("Filter"), q: z.string(), limit: z.string().optional(), cursor: z.string().optional() }));
    assert.deepEqual(p.map((x) => ("name" in x ? x.name : x.$ref)), ["status", "q", "#/components/parameters/limit", "#/components/parameters/cursor"]);
    const status = p[0] as unknown as { required: boolean; description?: string; schema: { enum: string[]; description?: string } };
    assert.equal(status.required, false);
    assert.equal(status.description, "Filter");
    assert.equal(status.schema.description, undefined);
    assert.deepEqual(status.schema.enum, ["open"]);
    assert.equal((p[1] as { required: boolean }).required, true);
    assert.deepEqual(queryToParameters(undefined), []);
    assert.deepEqual(queryToParameters(z.string()), []);
  });
  it("path params: uuid by default, enum for {entity}", () => {
    const p = pathParameters("/api/v1/admin/{entity}/{id}") as { name: string; in: string; required: boolean; schema: { enum?: string[]; format?: string } }[];
    assert.equal(p.length, 2);
    assert.deepEqual(p[0].schema.enum, ["actions", "opportunities", "risks", "ideas"]);
    assert.equal(p[1].name, "id");
    assert.equal(p[1].in, "path");
    assert.equal(p[1].required, true);
    assert.equal(p[1].schema.format, "uuid");
    assert.deepEqual(pathParameters("/api/v1/tickets"), []);
  });
  it("examples", () => {
    assert.deepEqual(exampleFor(z.object({ a: z.string() }).meta({ example: { a: "x" } })), { a: "x" });
    assert.equal(exampleFor(z.object({})), undefined);
    assert.equal(exampleFor(undefined), undefined);
  });
});
