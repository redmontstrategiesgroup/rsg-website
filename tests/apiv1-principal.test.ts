import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePrincipal } from "../lib/apiv1/principal.ts";
import type { ApiKeyRow } from "../lib/apiv1/keys.ts";

const key = (over: Partial<ApiKeyRow>): ApiKeyRow => ({
  id: "k1", principal_type: "client", principal_id: "c1", name: "CI bot", key_prefix: "x", scopes: ["projects:read"],
  created_by: "a@b.c", last_used_at: null, expires_at: null, revoked_at: null, created_at: "t", ...over,
});
const deps = (client: any, admin: any) => ({ getClient: async () => client, getAdmin: async () => admin });

describe("resolvePrincipal", () => {
  it("builds a client principal with a synthetic portal context", async () => {
    const p = await resolvePrincipal(key({}), deps({ id: "c1", name: "Ann", company: "Acme", email: "ann@acme.com", status: "active" }, null));
    assert.equal(p?.type, "client");
    if (p?.type !== "client") return;
    assert.equal(p.portal.client.id, "c1");
    assert.equal(p.portal.user.name, "CI bot");
    assert.equal(p.portal.user.role, "owner");
    assert.deepEqual(p.scopes, ["projects:read"]);
  });
  it("rejects a missing or inactive client", async () => {
    assert.equal(await resolvePrincipal(key({}), deps(null, null)), null);
    assert.equal(await resolvePrincipal(key({}), deps({ id: "c1", name: "", company: "", email: "", status: "inactive" }, null)), null);
  });
  it("caps admin scopes by the admin's current role", async () => {
    const p = await resolvePrincipal(
      key({ principal_type: "admin", principal_id: "a1", scopes: ["leads:read", "audit:read", "webhooks:manage"] }),
      deps(null, { id: "a1", email: "ops@rsg.com", role: "contractor" }),
    );
    assert.equal(p?.type, "admin");
    assert.deepEqual(p?.scopes, ["webhooks:manage"]);
    assert.equal(await resolvePrincipal(key({ principal_type: "admin", principal_id: "a1" }), deps(null, null)), null);
  });
});
