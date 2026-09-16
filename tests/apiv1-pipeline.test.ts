import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { withApi, optionsHandler, type PipelineDeps } from "../lib/apiv1/pipeline.ts";
import { generateApiKey, type ApiKeyRow } from "../lib/apiv1/keys.ts";
import type { Principal } from "../lib/apiv1/principal.ts";
import { ApiError } from "../lib/apiv1/errors.ts";
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
  const deps: PipelineDeps = {
    enabled: () => true,
    resolveKey: async (b) => (b === key.plaintext ? keyRow : null),
    resolvePrincipal: async () => clientPrincipal,
    rateLimit: async () => limited.allow,
    clientIp: () => "9.9.9.9",
    idempotency: idemDb(),
    usage: { from: () => ({ insert: async (r: unknown) => { usage.push(r); return { error: null }; } }) },
    ...over,
  };
  return { deps, usage, limited };
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
    assert.equal((await h(req("GET", "/api/v1/x", { auth: null }), ctx())).status, 401);
    assert.equal((await h(req("GET", "/api/v1/x", { auth: "rsg_live_bad" }), ctx())).status, 401);
    const admin = withApi("GET", { auth: "admin", meta: meta("c") }, async () => ({ data: 1 }), deps);
    assert.equal((await admin(req("GET", "/api/v1/x"), ctx())).status, 403);
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

  it("maps unknown errors to opaque 500 and still logs usage", async () => {
    const { deps, usage } = mkDeps();
    const h = withApi("GET", { auth: "none", meta: meta("i") }, async () => { throw new Error("pg down"); }, deps);
    const res = await h(req("GET", "/api/v1/x", { auth: null }), ctx());
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error.message, "Something went wrong.");
    await new Promise((r) => setImmediate(r));
    assert.equal((usage[0] as any).status, 500);
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
});
