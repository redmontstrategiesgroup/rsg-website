// tests/apiv1-admin-clients.test.ts
import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Principal } from "../lib/apiv1/principal.ts";

const CID = "11111111-1111-4111-8111-111111111111";
const PID = "22222222-2222-4222-8222-222222222222";
const client = { id: CID, email: "a@acme.com", name: "Ann", company: "Acme", plan: "growth", member_since: null, strategist: null, status: "active", lead_id: null, created_at: "t", updated_at: "t", password_hash: "LEAK" };
const proposal = { id: PID, opportunity_id: null, lead_id: null, client_id: CID, token: "LEAK", title: "P", status: "sent", version: 1, currency: "usd", total_cents: 100, deposit_cents: 0, payment_schedule: [], sections: [{ LEAK: 1 }], created_from_template_key: null, expires_at: null, sent_at: null, first_viewed_at: null, last_viewed_at: null, total_view_seconds: 0, approved_at: null, approved_by_name: null, approved_ip: "LEAK", created_by: null, created_at: "t", updated_at: "t" };
const calls: string[] = [];
mock.module("@/lib/lifecycle/paged-admin", { namedExports: {
  listClientsPage: async (_sb: unknown, o: Record<string, unknown>) => { calls.push(`clients:${o.q}:${o.status}`); return { data: [client], next_cursor: null }; },
  getClientRow: async (_sb: unknown, id: string) => (id === CID ? client : null),
  listProposalsPage: async () => ({ data: [proposal], next_cursor: null }),
} });
mock.module("@/lib/lifecycle/proposals", { namedExports: { getProposal: async (id: string) => (id === PID ? { proposal, options: [], comments: [] } : null) } });
mock.module("@/lib/lifecycle/core", { namedExports: { requireSupabase: () => ({}) } });

const { listClients, getClient } = await import("../lib/apiv1/resources/admin-clients.ts");
const { listProposals, getProposalHandler } = await import("../lib/apiv1/resources/admin-proposals.ts");

const admin: Principal = { type: "admin", keyId: "k", keyName: "n", scopes: ["clients:read", "proposals:read"], adminId: "a1", email: "ops@rsg.com", role: "owner" };
const args = (over: Record<string, unknown> = {}) => ({ principal: admin, body: undefined, query: {}, params: {}, request: new Request("http://x/api/v1/admin/clients"), correlationId: "c", ...over }) as never;

describe("admin clients/proposals", () => {
  it("lists clients with sanitised q + status; no password_hash in DTO", async () => {
    const r = await listClients(args({ query: { q: "ac(me", status: "active" } }));
    assert.ok(calls.includes("clients:acme:active"));
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
  });
  it("get client 404", async () => {
    await assert.rejects(getClient(args({ params: { id: PID } })), (e: { code: string }) => e.code === "not_found");
  });
  it("proposal DTO has no token/sections/approved_ip; unknown 404", async () => {
    const r = await getProposalHandler(args({ params: { id: PID } }));
    assert.equal(JSON.stringify(r.data).includes("LEAK"), false);
    assert.equal((r.data as { title: string }).title, "P");
    assert.equal(((await listProposals(args())).data as unknown[]).length, 1);
    await assert.rejects(getProposalHandler(args({ params: { id: CID } })), (e: { code: string }) => e.code === "not_found");
  });
});
