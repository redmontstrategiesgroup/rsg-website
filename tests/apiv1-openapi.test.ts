import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

mock.module("@/lib/supabase", { namedExports: { getSupabase: () => null, isSupabaseConfigured: () => false, requireSupabase: () => { throw new Error("no db"); } } });

const { withApi } = await import("../lib/apiv1/pipeline.ts");
const { openApiForRoutes, TAG_ORDER } = await import("../lib/apiv1/openapi.ts");
const { EVENT_TYPES } = await import("../lib/webhooks/events.ts");

const deps = { enabled: () => true, resolveKey: async () => null, resolvePrincipal: async () => null, rateLimit: async () => true, clientIp: () => "1.1.1.1", idempotency: null, usage: null };
const body = z.object({ subject: z.string() }).meta({ example: { subject: "x" } });
const GET = withApi("GET", { auth: "client", scopes: ["tickets:read"], query: z.object({ status: z.string().optional(), limit: z.string().optional() }), rateLimit: { limit: 10, windowMs: 60_000 }, meta: { operationId: "listX", summary: "List", tag: "Tickets", response: z.object({ data: z.array(z.object({ id: z.string() })) }) } }, async () => ({ data: [] }), deps);
const POST = withApi("POST", { auth: "client", scopes: ["tickets:write"], idempotent: true, body, meta: { operationId: "createX", summary: "Create", tag: "Tickets", response: z.object({ data: z.object({ id: z.string() }) }) } }, async () => ({ data: {} }), deps);
const PUB = withApi("GET", { auth: "none", meta: { operationId: "getStatus", summary: "Status", tag: "Public", response: z.object({ data: z.object({ status: z.string() }) }) } }, async () => ({ data: {} }), deps);
const CSV = withApi("GET", { auth: "admin", scopes: ["leads:read"], meta: { operationId: "exportX", summary: "Export", tag: "Admin Leads", response: z.string(), contentType: "text/csv" } }, async () => ({ data: "" }), deps);

type Op = Record<string, any>;

describe("openApiForRoutes", () => {
  const doc = openApiForRoutes(
    [
      { path: "/api/v1/x", module: { GET, POST, OPTIONS: () => {} } },
      { path: "/api/v1/x/{id}", module: { GET } },
      { path: "/api/v1/public/status", module: { GET: PUB } },
      { path: "/api/v1/admin/x/export", module: { GET: CSV } },
    ],
    { version: "1.2.3", serverUrl: "https://example.com" },
  );

  it("has the required top-level shape", () => {
    assert.equal(doc.openapi, "3.1.0");
    assert.equal(doc.info.version, "1.2.3");
    assert.ok(doc.info.description.includes("tickets:read"));
    assert.deepEqual(doc.servers, [{ url: "https://example.com" }]);
    assert.ok(doc.components.securitySchemes.bearerAuth);
    assert.ok(doc.components.schemas.Error);
    assert.ok(doc.components.parameters.limit);
    assert.ok(doc.components.parameters.cursor);
    assert.deepEqual(doc.tags.map((t) => t.name), ["Tickets", "Admin Leads", "Public"]);
    assert.equal(TAG_ORDER[0], "Account");
  });

  it("emits operations with security, scopes, params, body example and error refs", () => {
    const get = doc.paths["/api/v1/x"].get as Op;
    const post = doc.paths["/api/v1/x"].post as Op;
    assert.equal(doc.paths["/api/v1/x"].put, undefined);
    assert.equal(get.operationId, "listX");
    assert.deepEqual(get.security, [{ bearerAuth: [] }]);
    assert.deepEqual(get["x-scopes"], ["tickets:read"]);
    assert.equal(get["x-audience"], "client");
    assert.deepEqual(get["x-rate-limit"], { limit: 10, window_seconds: 60 });
    assert.ok(get.parameters.some((p: Op) => p.$ref === "#/components/parameters/limit"));
    assert.ok(get.parameters.some((p: Op) => p.name === "status" && p.in === "query"));
    assert.ok(get.responses["200"].content["application/json"].schema.properties.data);
    assert.equal(post["x-idempotent"], true);
    assert.ok(post.parameters.some((p: Op) => p.name === "Idempotency-Key" && p.in === "header" && p.required));
    assert.deepEqual(post.requestBody.content["application/json"].example, { subject: "x" });
    assert.deepEqual(post.requestBody.content["application/json"].schema.required, ["subject"]);
    assert.ok(post.responses["201"]);
    assert.equal(post.responses["4XX"].content["application/json"].schema.$ref, "#/components/schemas/Error");
    assert.equal(post.responses["5XX"].content["application/json"].schema.$ref, "#/components/schemas/Error");
    const byId = doc.paths["/api/v1/x/{id}"].get as Op;
    assert.equal(byId.parameters[0].name, "id");
    assert.equal(byId.parameters[0].in, "path");
    const pub = doc.paths["/api/v1/public/status"].get as Op;
    assert.equal(pub["x-audience"], "public");
    assert.equal(pub.security, undefined);
    const csv = doc.paths["/api/v1/admin/x/export"].get as Op;
    assert.ok(csv.responses["200"].content["text/csv"]);
    assert.equal(csv["x-audience"], "admin");
  });

  it("documents every catalogued webhook event with the signing headers", () => {
    assert.deepEqual(Object.keys(doc.webhooks).sort(), [...EVENT_TYPES].sort());
    const t = doc.webhooks["ticket.created"].post as Op;
    assert.ok(t.parameters.some((p: Op) => p.name === "x-rsg-signature"));
    assert.ok(t.parameters.some((p: Op) => p.name === "x-rsg-timestamp"));
    const schema = t.requestBody.content["application/json"].schema;
    assert.deepEqual(schema.properties.type, { type: "string", const: "ticket.created" });
    assert.ok(schema.properties.data);
    assert.deepEqual(schema.required, ["id", "type", "sequence", "created_at", "data"]);
    assert.equal((doc.webhooks.ping.post as Op)["x-audience"], "any");
    assert.equal((doc.webhooks["lead.created"].post as Op)["x-audience"], "admin");
  });
});
