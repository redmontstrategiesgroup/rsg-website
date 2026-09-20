import "./_alias-hook.ts";
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";

const EP = "11111111-1111-4111-8111-111111111111";
const DID = "44444444-4444-4444-8444-444444444444";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const dto = { id: EP, url: "https://hooks.example.com/x", events: ["ticket.created"], description: null, enabled: true, disabled_at: null, failure_count: 0, created_at: "t", updated_at: "t" };
const calls: string[] = [];
const audits: string[] = [];
mock.module("@/lib/webhooks/endpoints", { namedExports: {
  createEndpoint: async (_sb: unknown, owner: { type: string; id: string }, input: Record<string, unknown>) => { calls.push(`create:${owner.type}:${owner.id}:${input.apiKeyId}`); return { endpoint: dto, secret: "whsec_new" }; },
  listEndpoints: async (_sb: unknown, owner: { type: string; id: string }) => { calls.push(`list:${owner.type}:${owner.id}`); return [dto]; },
  getOwnedEndpoint: async (_sb: unknown, owner: { type: string; id: string }, id: string) => { calls.push(`get:${owner.id}:${id}`); return { ...dto, secret: "whsec_LEAK", kind: "client", owner_type: owner.type, owner_id: owner.id, api_key_id: null, seq: 0 }; },
  updateEndpoint: async () => dto,
  deleteEndpoint: async () => {},
  rotateSecret: async () => ({ secret: "whsec_rotated" }),
  listDeliveriesPage: async () => ({ data: [], next_cursor: null }),
  replayDelivery: async (_sb: unknown, _o: unknown, id: string, did: string) => { calls.push(`replay:${id}:${did}`); return { id: did, status: "pending" }; },
  toEndpointDto: (r: Record<string, unknown>) => ({ id: r.id, url: r.url, events: r.events, description: r.description ?? null, enabled: r.enabled, disabled_at: r.disabled_at ?? null, failure_count: r.failure_count ?? 0, created_at: r.created_at, updated_at: r.updated_at }),
} });
mock.module("@/lib/webhooks/emit", { namedExports: { sendTestEvent: async (id: string) => { calls.push(`test:${id}`); return { queued: 1 }; }, emitEvent: async () => ({ queued: 0 }) } });
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => ({}) } });
mock.module("@/lib/audit", { namedExports: { writeAuditEvent: async (e: { action: string; actorType: string }) => { audits.push(`${e.actorType}:${e.action}`); } } });
mock.module("@/lib/lifecycle/activity", { namedExports: { logClientActivity: async (e: { action: string }) => { audits.push(`client:${e.action}`); } } });

const h = await import("../lib/apiv1/resources/webhooks.ts");

const client: Principal = { type: "client", keyId: "k1", keyName: "CI", scopes: ["webhooks:manage"], portal: { client: { id: CLIENT, name: "A", company: "Acme", email: "a@acme.com", status: "active" }, user: { id: "k1", name: "CI", email: "a@acme.com", role: "owner", isLegacyOwner: false } } };
const admin: Principal = { type: "admin", keyId: "k2", keyName: "ops", scopes: ["webhooks:manage"], adminId: "55555555-5555-4555-8555-555555555555", email: "ops@rsg.com", role: "owner" };
const args = (principal: Principal | null, over: Record<string, unknown> = {}) => ({ principal, body: undefined, query: {}, params: {}, request: new Request("http://x/api/v1/webhooks"), correlationId: "c", ...over }) as never;

describe("webhook management handlers", () => {
  beforeEach(() => { calls.length = 0; audits.length = 0; });

  it("ownerOf maps principals; null → 401", () => {
    assert.deepEqual(h.ownerOf(client), { type: "client", id: CLIENT });
    assert.deepEqual(h.ownerOf(admin), { type: "admin", id: admin.adminId });
    assert.throws(() => h.ownerOf(null), (e: { status: number }) => e.status === 401);
  });
  it("urlOpts ignores the private escape hatch in production", () => {
    // NODE_ENV is typed read-only; go through a mutable view for the test.
    const env = process.env as Record<string, string | undefined>;
    const prev = { env: env.NODE_ENV, flag: env.WEBHOOK_URL_ALLOW_PRIVATE };
    env.WEBHOOK_URL_ALLOW_PRIVATE = "1";
    env.NODE_ENV = "production";
    assert.deepEqual(h.urlOpts(), { allowHttp: false, allowPrivate: false });
    env.NODE_ENV = "test";
    assert.deepEqual(h.urlOpts(), { allowHttp: true, allowPrivate: true });
    delete env.WEBHOOK_URL_ALLOW_PRIVATE;
    assert.equal(h.urlOpts().allowPrivate, false);
    env.NODE_ENV = prev.env; if (prev.flag !== undefined) env.WEBHOOK_URL_ALLOW_PRIVATE = prev.flag;
  });
  it("create returns 201 with the secret and audits per principal type", async () => {
    const r = await h.createWebhook(args(client, { body: { url: "https://hooks.example.com/x", events: ["ticket.created"] } }));
    assert.equal(r.status, 201);
    assert.equal((r.data as { secret: string }).secret, "whsec_new");
    assert.ok(calls.includes(`create:client:${CLIENT}:k1`));
    assert.deepEqual(audits, ["client:webhook.create"]);
    await h.createWebhook(args(admin, { body: { url: "https://hooks.example.com/x", events: ["lead.created"] } }));
    assert.equal(audits.at(-1), "admin:webhook.create");
  });
  it("get never returns the secret; list scopes by owner", async () => {
    const r = await h.getWebhook(args(client, { params: { id: EP } }));
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
    await h.listWebhooks(args(admin));
    assert.ok(calls.includes(`list:admin:${admin.adminId}`));
  });
  it("test checks ownership then pings; replay audits", async () => {
    const t = await h.testWebhook(args(client, { params: { id: EP } }));
    assert.equal(t.status, 202);
    assert.ok(calls.indexOf(`get:${CLIENT}:${EP}`) < calls.indexOf(`test:${EP}`));
    await h.replayWebhookDelivery(args(client, { params: { id: EP, did: DID } }));
    assert.ok(calls.includes(`replay:${EP}:${DID}`));
    assert.equal(audits.at(-1), "client:webhook.replay");
    await assert.rejects(h.testWebhook(args(client, { params: { id: "nope" } })), (e: { code: string }) => e.code === "not_found");
  });
  it("events list is audience-scoped", async () => {
    const c = (await h.listWebhookEvents(args(client))).data as { type: string }[];
    const a = (await h.listWebhookEvents(args(admin))).data as { type: string }[];
    assert.ok(!c.some((e) => e.type === "lead.created"));
    assert.ok(a.some((e) => e.type === "lead.created"));
    assert.ok(c.some((e) => e.type === "ping"));
  });
  it("rotate returns a fresh secret and audits", async () => {
    const r = await h.rotateWebhookSecret(args(admin, { params: { id: EP } }));
    assert.deepEqual(r.data, { id: EP, secret: "whsec_rotated" });
    assert.equal(audits.at(-1), "admin:webhook.rotate_secret");
  });
});
