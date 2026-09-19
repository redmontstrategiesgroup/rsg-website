import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withApi, optionsHandler, type PipelineDeps } from "../lib/apiv1/pipeline.ts";
import { generateApiKey, type ApiKeyRow } from "../lib/apiv1/keys.ts";
import type { Principal } from "../lib/apiv1/principal.ts";
import { ApiError } from "../lib/apiv1/errors.ts";
import { requestHash } from "../lib/apiv1/idempotency.ts";
import { resetOperations, listOperations } from "../lib/apiv1/registry.ts";

const key = generateApiKey();
const keyRow: ApiKeyRow = { id: "k1", principal_type: "client", principal_id: "c1", name: "n", key_prefix: key.prefix, scopes: ["tickets:read", "tickets:write"], created_by: "x", last_used_at: null, expires_at: null, revoked_at: null, created_at: "t" };
const clientPrincipal: Principal = { type: "client", keyId: "k1", keyName: "n", scopes: keyRow.scopes, portal: { client: { id: "c1", name: "A", company: "Acme", email: "a@acme.com", status: "active" }, user: { id: "k1", name: "n", email: "a@acme.com", role: "owner", isLegacyOwner: false } } };

function idemDb() {
  const rows = new Map<string, any>();
  return {
    rows,
    from: () => ({
      insert: async (v: any) => { const id = `${v.principal_id}:${v.key}`; if (rows.has(id)) return { error: { code: "23505", message: "dup" } }; rows.set(id, { ...v, response_status: null, response_body: null }); return { error: null }; },
      select: () => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, v: string) => { s._f.push(v); return s; }; s.maybeSingle = async () => ({ data: rows.get(s._f.join(":")) ?? null, error: null }); return s; },
      update: (v: any) => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, val: string) => { s._f.push(val); return s; }; s.then = (r: any) => { const id = s._f.join(":"); rows.set(id, { ...rows.get(id), ...v }); r({ error: null }); }; return s; },
      delete: () => { const s: any = { _f: [] as string[] }; s.eq = (_c: string, val: string) => { s._f.push(val); return s; }; s.then = (r: any) => { rows.delete(s._f.join(":")); r({ error: null }); }; return s; },
    }),
  };
}

function mkDeps(over: Partial<PipelineDeps> = {}) {
  const usage: unknown[] = [];
  const limited = { allow: true };
  const rateCalls: { key: string; limit: number; windowMs: number }[] = [];
  const idem = idemDb();
  const deps: PipelineDeps = {
    enabled: () => true,
    resolveKey: async (b) => (b === key.plaintext ? keyRow : null),
    resolvePrincipal: async () => clientPrincipal,
    rateLimit: async (k, limit, windowMs) => { rateCalls.push({ key: k, limit, windowMs }); return limited.allow; },
    clientIp: () => "9.9.9.9",
    idempotency: idem,
    usage: { from: () => ({ insert: async (r: unknown) => { usage.push(r); return { error: null }; } }) },
    ...over,
  };
  return { deps, usage, limited, rateCalls, idem };
}

const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const req = (method: string, path: string, init: { auth?: string | null; body?: unknown; headers?: Record<string, string> } = {}) =>
  new Request(`http://x${path}`, {
    method,
    headers: { ...(init.auth === null ? {} : { authorization: `Bearer ${init.auth ?? key.plaintext}` }), ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
const meta = (id: string) => ({ operationId: id, summary: id, tag: "Test", response: z.any() });

describe("withApi", () => {
  beforeEach(() => resetOperations());

  it("503 when disabled", async () => {
    const { deps } = mkDeps({ enabled: () => false });
    const h = withApi("GET", { auth: "none", meta: meta("a") }, async () => ({ data: 1 }), deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "unavailable");
  });

  it("401 missing / invalid key; 403 wrong principal type; 403 missing scope", async () => {
    const { deps } = mkDeps();
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("b") }, async () => ({ data: 1 }), deps);

    const missing = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(missing.status, 401);
    const missingBody = await missing.json();
    assert.equal(missingBody.error.code, "unauthenticated");
    assert.equal(missingBody.error.message, "Missing API key.");

    const invalid = await h(req("GET", "/api/v1/x", { auth: "rsg_live_bad" }), ctx());
    assert.equal(invalid.status, 401);
    const invalidBody = await invalid.json();
    assert.equal(invalidBody.error.code, "unauthenticated");
    assert.equal(invalidBody.error.message, "Invalid API key.");

    const admin = withApi("GET", { auth: "admin", meta: meta("c") }, async () => ({ data: 1 }), deps);
    const adminRes = await admin(req("GET", "/api/v1/x"), ctx());
    assert.equal(adminRes.status, 403);
    assert.equal((await adminRes.json()).error.code, "insufficient_scope");

    const scoped = withApi("GET", { auth: "client", scopes: ["billing:read"], meta: meta("d") }, async () => ({ data: 1 }), deps);
    const res = await scoped(req("GET", "/api/v1/x"), ctx());
    assert.equal(res.status, 403);
    assert.deepEqual((await res.json()).error.details, { required: ["billing:read"] });
  });

  it("happy path: envelope, headers, params, usage row", async () => {
    const { deps, usage } = mkDeps();
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("e") }, async ({ params, principal }) => ({ data: { id: params.id, who: principal?.type } }), deps);
    const res = await h(req("GET", "/api/v1/tickets/t1"), ctx({ id: "t1" }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: { id: "t1", who: "client" } });
    assert.ok(res.headers.get("x-correlation-id"));
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    await new Promise((r) => setImmediate(r));
    assert.equal(usage.length, 1);
    assert.equal((usage[0] as any).path, "/v1/tickets/{id}");
    assert.equal((usage[0] as any).key_id, "k1");
  });

  it("429 with Retry-After", async () => {
    const { deps, limited } = mkDeps();
    limited.allow = false;
    const h = withApi("GET", { auth: "none", meta: meta("f") }, async () => ({ data: 1 }), deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "60");
  });

  it("rate limit uses the correct bucket key/limit/window per route", async () => {
    const { deps: keyedDeps, rateCalls: keyedCalls } = mkDeps();
    const keyed = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("k1") }, async () => ({ data: 1 }), keyedDeps);
    await keyed(req("GET", "/api/v1/x"), ctx());
    assert.deepEqual(keyedCalls.at(-1), { key: "api:key:k1", limit: 600, windowMs: 600_000 });

    const { deps: keylessDeps, rateCalls: keylessCalls } = mkDeps();
    const keyless = withApi("GET", { auth: "none", meta: meta("k2") }, async () => ({ data: 1 }), keylessDeps);
    await keyless(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.deepEqual(keylessCalls.at(-1), { key: "api:ip:9.9.9.9", limit: 60, windowMs: 600_000 });

    const { deps: customDeps, rateCalls: customCalls } = mkDeps();
    const custom = withApi("GET", { auth: "client", scopes: ["tickets:read"], rateLimit: { limit: 5, windowMs: 1000 }, meta: meta("k3") }, async () => ({ data: 1 }), customDeps);
    await custom(req("GET", "/api/v1/x"), ctx());
    assert.deepEqual(customCalls.at(-1), { key: "api:key:k1", limit: 5, windowMs: 1000 });
  });

  it("a bad bearer consults the keyless IP bucket and 429s (not 401) when it's exhausted", async () => {
    const { deps, rateCalls, limited } = mkDeps();
    limited.allow = false;
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("k4") }, async () => ({ data: 1 }), deps);
    const res = await h(req("GET", "/api/v1/x", { auth: "rsg_live_bad" }), ctx());
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "60");
    assert.equal(rateCalls.length, 1);
    assert.deepEqual(rateCalls[0], { key: "api:ip:9.9.9.9", limit: 60, windowMs: 600_000 });
  });

  it("422 on invalid JSON and on schema failure; query validated", async () => {
    const { deps } = mkDeps();
    const h = withApi("POST", { auth: "client", body: z.object({ subject: z.string().min(1) }), query: z.object({ status: z.enum(["open"]).optional() }), meta: meta("g") }, async ({ body }) => ({ data: body }), deps);
    const bad = new Request("http://x/api/v1/t", { method: "POST", headers: { authorization: `Bearer ${key.plaintext}` }, body: "{nope" });
    assert.equal((await h(bad, ctx())).status, 422);
    const res = await h(req("POST", "/api/v1/t", { body: { subject: "" } }), ctx());
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error.code, "validation_failed");
    assert.equal((await h(req("POST", "/api/v1/t?status=closed", { body: { subject: "x" } }), ctx())).status, 422);
    assert.equal((await h(req("POST", "/api/v1/t?status=open", { body: { subject: "x" } }), ctx())).status, 200);
  });

  it("idempotency: required, replay, mismatch, in-flight, abandon on error", async () => {
    const { deps } = mkDeps();
    let calls = 0;
    const h = withApi("POST", { auth: "client", idempotent: true, body: z.object({ n: z.number() }), meta: meta("h") }, async ({ body }) => { calls++; if (body.n < 0) throw new ApiError(409, "conflict", "neg"); return { data: { n: body.n, calls }, status: 201 }; }, deps);
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: 1 } }), ctx())).status, 400);
    const hdr = { "idempotency-key": "abc-12345" };
    const r1 = await h(req("POST", "/api/v1/t", { body: { n: 1 }, headers: hdr }), ctx());
    assert.equal(r1.status, 201);
    const r2 = await h(req("POST", "/api/v1/t", { body: { n: 1 }, headers: hdr }), ctx());
    assert.equal(r2.status, 201);
    assert.equal(r2.headers.get("idempotent-replayed"), "true");
    assert.deepEqual(await r2.json(), { data: { n: 1, calls: 1 } });
    assert.equal(calls, 1);
    const r3 = await h(req("POST", "/api/v1/t", { body: { n: 2 }, headers: hdr }), ctx());
    assert.equal(r3.status, 422);
    assert.equal((await r3.json()).error.code, "idempotency_mismatch");
    // error path abandons the row so a retry re-executes
    const hdr2 = { "idempotency-key": "err-12345" };
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: -1 }, headers: hdr2 }), ctx())).status, 409);
    assert.equal((await h(req("POST", "/api/v1/t", { body: { n: -1 }, headers: hdr2 }), ctx())).status, 409);
    assert.equal(calls, 3);
  });

  it("a genuinely in-flight idempotency row returns 409 conflict", async () => {
    const { deps, idem } = mkDeps();
    const body = { n: 1 };
    const rawBody = JSON.stringify(body);
    const hash = requestHash("POST", "/api/v1/t", rawBody);
    idem.rows.set("c1:live-12345", { principal_id: "c1", key: "live-12345", request_hash: hash, status: "in_flight", response_status: null, response_body: null });
    const h = withApi("POST", { auth: "client", idempotent: true, body: z.object({ n: z.number() }), meta: meta("o") }, async () => ({ data: {}, status: 201 }), deps);
    const res = await h(req("POST", "/api/v1/t", { body, headers: { "idempotency-key": "live-12345" } }), ctx());
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, "conflict");
  });

  it("idempotent route with no idempotency store returns 503 unavailable", async () => {
    const { deps } = mkDeps({ idempotency: null });
    const h = withApi("POST", { auth: "client", idempotent: true, body: z.object({ n: z.number() }), meta: meta("p") }, async () => ({ data: {} }), deps);
    const res = await h(req("POST", "/api/v1/t", { body: { n: 1 }, headers: { "idempotency-key": "abc-12345" } }), ctx());
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "unavailable");
  });

  it("merges HandlerResult.headers (e.g. Location), includes meta, and sets content-type", async () => {
    const { deps } = mkDeps();
    const h = withApi("GET", { auth: "client", scopes: ["tickets:read"], meta: meta("q") }, async () => ({ data: {}, meta: { total: 1 }, status: 302, headers: { Location: "https://x/y" } }), deps);
    const res = await h(req("GET", "/api/v1/x"), ctx());
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://x/y");
    assert.equal(res.headers.get("content-type"), "application/json");
    assert.deepEqual(await res.json(), { data: {}, meta: { total: 1 } });
  });

  it("maps unknown errors to opaque 500 and still logs usage", async () => {
    const { deps, usage } = mkDeps();
    const errorStub = mock.method(console, "error", () => {});
    try {
      const h = withApi("GET", { auth: "none", meta: meta("i") }, async () => { throw new Error("pg down"); }, deps);
      const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
      assert.equal(res.status, 500);
      assert.equal((await res.json()).error.message, "Something went wrong.");
      await new Promise((r) => setImmediate(r));
      assert.equal((usage[0] as any).status, 500);
    } finally {
      errorStub.mock.restore();
    }
  });

  it("registers operations and answers OPTIONS", async () => {
    const { deps } = mkDeps();
    withApi("GET", { auth: "none", meta: meta("j") }, async () => ({ data: 1 }), deps);
    assert.equal(listOperations().length, 1);
    assert.equal(listOperations()[0]!.operationId, "j");
    const res = await optionsHandler()(new Request("http://x/api/v1/x", { method: "OPTIONS" }), ctx());
    assert.equal(res.status, 204);
    assert.ok(res.headers.get("access-control-allow-headers")?.includes("Idempotency-Key"));
  });

  it("passes a raw Response through with pipeline headers and usage", async () => {
    const { deps, usage } = mkDeps();
    const h = withApi("GET", { auth: "none", meta: meta("raw") }, async () => ({
      data: null,
      raw: new Response("a,b\r\n1,2\r\n", { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="x.csv"' } }),
    }), deps);
    const res = await h(req("GET", "/api/v1/x.csv", { auth: null }), ctx());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/csv");
    assert.equal(res.headers.get("content-disposition"), 'attachment; filename="x.csv"');
    assert.ok(res.headers.get("x-correlation-id"));
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.equal(await res.text(), "a,b\r\n1,2\r\n");
    await new Promise((r) => setImmediate(r));
    assert.equal((usage.at(-1) as { status: number }).status, 200);
  });
});
