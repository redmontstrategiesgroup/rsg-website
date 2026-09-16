import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capAdminScopes, isAdminScope, isClientScope, scopesAllowedFor, ADMIN_SCOPES, CLIENT_SCOPES } from "../lib/apiv1/scopes.ts";

describe("scopes", () => {
  it("classifies", () => {
    assert.equal(isClientScope("projects:read"), true);
    assert.equal(isClientScope("leads:read"), false);
    assert.equal(isAdminScope("leads:read"), true);
    assert.equal(isAdminScope("webhooks:manage"), true);
    assert.equal(isClientScope("webhooks:manage"), true);
    assert.equal(CLIENT_SCOPES.length, 9);
    assert.equal(ADMIN_SCOPES.length, 9);
  });
  it("owner gets every admin scope", () => {
    assert.deepEqual([...scopesAllowedFor("owner")].sort(), [...ADMIN_SCOPES].sort());
  });
  it("caps by role permissions", () => {
    // 'contractor' has no manage_leads / view_audit in ROLE_PERMISSIONS.
    const r = capAdminScopes(["leads:read", "webhooks:manage", "bogus"], "contractor");
    assert.deepEqual(r.allowed, ["webhooks:manage"]);
    assert.deepEqual(r.rejected, ["leads:read", "bogus"]);
  });
});
