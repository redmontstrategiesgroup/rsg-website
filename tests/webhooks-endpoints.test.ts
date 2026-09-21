import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEndpoint,
  deleteEndpoint,
  getOwnedEndpoint,
  listDeliveriesPage,
  listEndpoints,
  replayDelivery,
  rotateSecret,
  toEndpointDto,
  updateEndpoint,
  validateEvents,
  MAX_ENDPOINTS,
} from "../lib/webhooks/endpoints.ts";
import { API_PLATFORM_SCHEMA, fakeDb, type Row } from "./_fake-db.ts";

const EP = "11111111-1111-4111-8111-111111111111";
const owner = { type: "client" as const, id: "22222222-2222-4222-8222-222222222222" };
const other = { type: "client" as const, id: "99999999-9999-4999-8999-999999999999" };
const row = {
  id: EP, url: "https://hooks.example.com/a", secret: "whsec_LEAK", events: ["ticket.created"], enabled: true,
  kind: "client", description: null, owner_type: "client", owner_id: owner.id, api_key_id: null, disabled_at: null,
  failure_count: 3, seq: 0, created_at: "2026-09-20T00:00:00.000Z", updated_at: "2026-09-20T00:00:00.000Z",
};
const opts = { allowHttp: false };

/** The store runs against the constraint-enforcing fake — see tests/_fake-db.ts. */
function db(seed: { endpoints?: Row[]; deliveries?: Row[] } = {}) {
  return fakeDb(API_PLATFORM_SCHEMA, { webhook_endpoints: seed.endpoints ?? [], webhook_deliveries: seed.deliveries ?? [] });
}

describe("endpoint store", () => {
  it("DTO never carries the secret", () => {
    assert.equal("secret" in toEndpointDto(row), false);
  });
  it("validates events per audience and dedupes", () => {
    assert.deepEqual(validateEvents(["ticket.created", "ticket.created"], owner), ["ticket.created"]);
    assert.throws(() => validateEvents(["lead.created"], owner), (e: { code: string }) => e.code === "validation_failed");
    assert.throws(() => validateEvents([], owner), (e: { status: number }) => e.status === 422);
    assert.deepEqual(validateEvents(["lead.created"], { type: "admin", id: "a" }), ["lead.created"]);
  });
  it("creates with a whsec_ secret, persists a client-kind row, enforces the cap and the url check", async () => {
    const f = db();
    const r = await createEndpoint(f.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, opts);
    assert.ok(r.secret.startsWith("whsec_"));
    assert.equal("secret" in r.endpoint, false);
    const stored = f.rows("webhook_endpoints")[0]!;
    assert.equal(stored.kind, "client");
    assert.equal(stored.owner_type, "client");
    assert.equal(stored.owner_id, owner.id);
    assert.equal(stored.secret, r.secret);
    assert.deepEqual(stored.events, ["ticket.created"]);
    await assert.rejects(
      createEndpoint(f.sb, owner, { url: "https://10.0.0.1/x", events: ["ticket.created"] }, opts),
      (e: { code: string }) => e.code === "validation_failed",
    );
    assert.equal(f.rows("webhook_endpoints").length, 1, "a rejected URL must not insert");
    const full = db({ endpoints: Array.from({ length: MAX_ENDPOINTS }, (_, i) => ({ ...row, id: `e${i}` })) });
    await assert.rejects(
      createEndpoint(full.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, opts),
      (e: { code: string }) => e.code === "conflict",
    );
    assert.equal(full.rows("webhook_endpoints").length, MAX_ENDPOINTS);
  });
  it("the cap is per owner; another owner's endpoints do not count", async () => {
    const f = db({ endpoints: Array.from({ length: MAX_ENDPOINTS }, (_, i) => ({ ...row, id: `e${i}`, owner_id: other.id })) });
    const r = await createEndpoint(f.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, opts);
    assert.ok(r.endpoint.id);
    assert.equal((await listEndpoints(f.sb, owner)).length, 1);
    assert.equal((await listEndpoints(f.sb, other)).length, MAX_ENDPOINTS);
  });
  it("ownership: other owner → 404 on read, update, rotate and delete; the row survives", async () => {
    const f = db({ endpoints: [{ ...row }] });
    await assert.rejects(getOwnedEndpoint(f.sb, other, EP), (e: { code: string }) => e.code === "not_found");
    await assert.rejects(updateEndpoint(f.sb, other, EP, { enabled: false }, opts), (e: { code: string }) => e.code === "not_found");
    await assert.rejects(rotateSecret(f.sb, other, EP), (e: { code: string }) => e.code === "not_found");
    await assert.rejects(deleteEndpoint(f.sb, other, EP), (e: { code: string }) => e.code === "not_found");
    const stored = f.rows("webhook_endpoints")[0]!;
    assert.equal(stored.enabled, true);
    assert.equal(stored.secret, "whsec_LEAK");
    assert.equal((await getOwnedEndpoint(f.sb, owner, EP)).id, EP);
  });
  it("re-enabling clears disabled_at and failure_count; rotate replaces the stored secret; delete removes the row", async () => {
    const f = db({ endpoints: [{ ...row, disabled_at: "t", failure_count: 20 }] });
    const dto = await updateEndpoint(f.sb, owner, EP, { enabled: true }, opts);
    assert.equal(dto.disabled_at, null);
    assert.equal(dto.failure_count, 0);
    assert.equal(f.rows("webhook_endpoints")[0]!.failure_count, 0);
    const { secret } = await rotateSecret(f.sb, owner, EP);
    assert.ok(secret.startsWith("whsec_") && secret !== "whsec_LEAK");
    assert.equal(f.rows("webhook_endpoints")[0]!.secret, secret);
    await deleteEndpoint(f.sb, owner, EP);
    assert.equal(f.rows("webhook_endpoints").length, 0);
  });
  it("deliveries: scoped by endpoint, no payload, cursor-paged newest first, replay only dead/failed", async () => {
    const d = {
      id: "44444444-4444-4444-8444-444444444444", endpoint_id: EP, event_type: "ticket.created", event_id: "ticket.created:x:1",
      status: "dead", attempts: 8, max_attempts: 8, response_status: 500, last_error: "HTTP 500", next_attempt_at: "t",
      delivered_at: null, dead_lettered_at: "t", created_at: "2026-09-20T00:00:00.000Z", payload: { LEAK: 1 }, url: "u",
    };
    const delivered = { ...d, id: "55555555-5555-4555-8555-555555555555", event_id: "ticket.created:x:2", status: "delivered", created_at: "2026-09-21T00:00:00.000Z" };
    const foreign = { ...d, id: "66666666-6666-4666-8666-666666666666", endpoint_id: "other-ep", event_id: "ticket.created:x:3" };
    const f = db({ endpoints: [{ ...row }], deliveries: [d, delivered, foreign] });

    const page = await listDeliveriesPage(f.sb, owner, EP, { limit: 1, cursor: null });
    assert.equal(page.data.length, 1);
    assert.equal(page.data[0]!.id, delivered.id, "newest first");
    assert.ok(page.next_cursor);
    assert.equal(JSON.stringify(page.data).includes("LEAK"), false);
    const cursor = { createdAt: delivered.created_at, id: delivered.id };
    const page2 = await listDeliveriesPage(f.sb, owner, EP, { limit: 10, cursor });
    assert.deepEqual(page2.data.map((x) => x.id), [d.id], "cursor page excludes the first row and the other endpoint's row");
    assert.equal(page2.next_cursor, null);
    const onlyDead = await listDeliveriesPage(f.sb, owner, EP, { limit: 10, cursor: null, status: "dead" });
    assert.deepEqual(onlyDead.data.map((x) => x.id), [d.id]);

    const replayed = await replayDelivery(f.sb, owner, EP, d.id);
    assert.equal(replayed.status, "pending");
    assert.equal(f.rows("webhook_deliveries").find((r) => r.id === d.id)!.status, "pending");
    await assert.rejects(replayDelivery(f.sb, owner, EP, delivered.id), (e: { code: string }) => e.code === "conflict");
    await assert.rejects(replayDelivery(f.sb, owner, EP, foreign.id), (e: { code: string }) => e.code === "not_found");
    await assert.rejects(replayDelivery(f.sb, other, EP, d.id), (e: { code: string }) => e.code === "not_found");
  });
});
