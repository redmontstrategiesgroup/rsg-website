import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEndpoint,
  deleteEndpoint,
  getOwnedEndpoint,
  listDeliveriesPage,
  replayDelivery,
  rotateSecret,
  toEndpointDto,
  updateEndpoint,
  validateEvents,
  MAX_ENDPOINTS,
} from "../lib/webhooks/endpoints.ts";

const EP = "11111111-1111-4111-8111-111111111111";
const owner = { type: "client" as const, id: "22222222-2222-4222-8222-222222222222" };
const row = {
  id: EP, url: "https://hooks.example.com/a", secret: "whsec_LEAK", events: ["ticket.created"], enabled: true,
  kind: "client", description: null, owner_type: "client", owner_id: owner.id, api_key_id: null, disabled_at: null,
  failure_count: 3, seq: 0, created_at: "2026-09-20T00:00:00.000Z", updated_at: "2026-09-20T00:00:00.000Z",
};

type Row = Record<string, unknown>;

function fakeSb(state: { endpoints: Row[]; deliveries: Row[] }) {
  const calls: string[] = [];
  const build = (table: string) => {
    const key = table === "webhook_endpoints" ? "endpoints" : "deliveries";
    let rows: Row[] = state[key];
    let pending: Row | null = null;
    let deleting = false;
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "or"]) {
      q[m] = (...a: unknown[]) => { calls.push(`${table}.${m}:${a.map(String).join("|")}`); return q; };
    }
    q.eq = (c: string, v: unknown) => { calls.push(`${table}.eq:${c}|${v}`); rows = rows.filter((r) => r[c] === v); return q; };
    q.is = (c: string, v: unknown) => { calls.push(`${table}.is:${c}|${v}`); rows = rows.filter((r) => r[c] === v); return q; };
    q.insert = (v: Row) => {
      const inserted = { id: "33333333-3333-4333-8333-333333333333", created_at: "t", updated_at: "t", disabled_at: null, failure_count: 0, seq: 0, ...v };
      state.endpoints.push(inserted); rows = [inserted]; calls.push(`${table}.insert`); return q;
    };
    q.update = (v: Row) => { pending = v; calls.push(`${table}.update:${JSON.stringify(v)}`); return q; };
    q.delete = () => { deleting = true; calls.push(`${table}.delete`); return q; };
    const apply = () => {
      if (pending) for (const r of rows) Object.assign(r, pending);
      if (deleting) for (const r of rows) { const i = state[key].indexOf(r); if (i >= 0) state[key].splice(i, 1); }
    };
    q.maybeSingle = async () => { apply(); return { data: rows[0] ?? null, error: null }; };
    q.single = async () => { apply(); return { data: rows[0] ?? null, error: rows[0] ? null : { message: "0 rows" } }; };
    q.then = (r: (v: unknown) => void) => { apply(); r({ data: rows, error: null, count: rows.length }); };
    return q;
  };
  return { calls, sb: { from: build } as never };
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
  it("creates with a whsec_ secret, enforces the cap and the url check", async () => {
    const f = fakeSb({ endpoints: [], deliveries: [] });
    const r = await createEndpoint(f.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, { allowHttp: false });
    assert.ok(r.secret.startsWith("whsec_"));
    assert.equal("secret" in r.endpoint, false);
    assert.ok(f.calls.includes("webhook_endpoints.insert"));
    await assert.rejects(
      createEndpoint(f.sb, owner, { url: "https://10.0.0.1/x", events: ["ticket.created"] }, { allowHttp: false }),
      (e: { code: string }) => e.code === "validation_failed",
    );
    const full = fakeSb({ endpoints: Array.from({ length: MAX_ENDPOINTS }, (_, i) => ({ ...row, id: `e${i}` })), deliveries: [] });
    await assert.rejects(
      createEndpoint(full.sb, owner, { url: "https://hooks.example.com/x", events: ["ticket.created"] }, { allowHttp: false }),
      (e: { code: string }) => e.code === "conflict",
    );
  });
  it("ownership: other owner → 404", async () => {
    const f = fakeSb({ endpoints: [{ ...row }], deliveries: [] });
    await assert.rejects(getOwnedEndpoint(f.sb, { type: "client", id: "other" }, EP), (e: { code: string }) => e.code === "not_found");
    assert.equal((await getOwnedEndpoint(f.sb, owner, EP)).id, EP);
  });
  it("re-enabling clears disabled_at and failure_count; rotate returns a new secret", async () => {
    const f = fakeSb({ endpoints: [{ ...row, disabled_at: "t", failure_count: 20 }], deliveries: [] });
    const dto = await updateEndpoint(f.sb, owner, EP, { enabled: true }, { allowHttp: false });
    assert.equal(dto.disabled_at, null);
    assert.equal(dto.failure_count, 0);
    const { secret } = await rotateSecret(f.sb, owner, EP);
    assert.ok(secret.startsWith("whsec_") && secret !== "whsec_LEAK");
    await deleteEndpoint(f.sb, owner, EP);
    assert.equal(f.calls.filter((c) => c.endsWith(".delete")).length, 1);
  });
  it("deliveries: scoped by endpoint, no payload, replay only dead/failed", async () => {
    const d = {
      id: "44444444-4444-4444-8444-444444444444", endpoint_id: EP, event_type: "ticket.created", event_id: "ticket.created:x:1",
      status: "dead", attempts: 8, max_attempts: 8, response_status: 500, last_error: "HTTP 500", next_attempt_at: "t",
      delivered_at: null, dead_lettered_at: "t", created_at: "2026-09-20T00:00:00.000Z", payload: { LEAK: 1 },
    };
    const f = fakeSb({ endpoints: [{ ...row }], deliveries: [d, { ...d, id: "55555555-5555-4555-8555-555555555555", status: "delivered" }] });
    const page = await listDeliveriesPage(f.sb, owner, EP, { limit: 10, cursor: null });
    assert.ok(f.calls.includes(`webhook_deliveries.eq:endpoint_id|${EP}`));
    assert.equal(JSON.stringify(page.data).includes("LEAK"), false);
    const replayed = await replayDelivery(f.sb, owner, EP, d.id);
    assert.equal(replayed.status, "pending");
    await assert.rejects(
      replayDelivery(f.sb, owner, EP, "55555555-5555-4555-8555-555555555555"),
      (e: { code: string }) => e.code === "conflict",
    );
  });
});
