import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { can } from "../lib/scheduling/permissions.ts";
import { ADMIN_ROLES } from "../lib/types.ts";
import { variantForSlug } from "../lib/security-center/service-controls.ts";

describe("security permissions", () => {
  it("owner and administrator can view the Security Center", () => {
    assert.equal(can("view_security", "owner"), true);
    assert.equal(can("view_security", "administrator"), true);
  });

  it("security_reviewer can review but not change security settings", () => {
    assert.equal(can("view_security", "security_reviewer"), true);
    assert.equal(can("manage_incidents", "security_reviewer"), true);
    assert.equal(can("manage_vendors", "security_reviewer"), true);
    assert.equal(can("view_audit", "security_reviewer"), true);
    // Reviewer cannot change enforcement or approve AI actions.
    assert.equal(can("manage_security_settings", "security_reviewer"), false);
    assert.equal(can("approve_ai_actions", "security_reviewer"), false);
  });

  it("low-trust roles cannot reach the Security Center", () => {
    for (const role of ["viewer", "contractor", "consultant", "sales"] as const) {
      assert.equal(can("view_security", role), false, `${role} should not view security`);
      assert.equal(can("manage_security_settings", role), false);
      assert.equal(can("approve_ai_actions", role), false);
    }
  });

  it("only owner/administrator can change security settings or approve AI (plus manager approves)", () => {
    assert.equal(can("manage_security_settings", "owner"), true);
    assert.equal(can("manage_security_settings", "administrator"), true);
    assert.equal(can("approve_ai_actions", "manager"), true);
    assert.equal(can("manage_security_settings", "manager"), false);
  });

  it("every role has an explicit permission set (no undefined role)", () => {
    for (const role of ADMIN_ROLES) {
      // can() must resolve without throwing for every declared role.
      assert.doesNotThrow(() => can("view_appointments", role));
    }
  });
});

describe("service security variant selection", () => {
  it("maps slugs to the right control set", () => {
    assert.equal(variantForSlug("crmsystems"), "crm");
    assert.equal(variantForSlug("aiautomation"), "ai_ops");
    assert.equal(
      variantForSlug("webdevelopment"),
      "website"
    );
    assert.equal(variantForSlug("operationsconsulting"), "operations");
    assert.equal(variantForSlug("services/customprivateaisystems"), "private_ai");
    assert.equal(variantForSlug("aistrategy"), "ai_ops");
    // Unknown / general consulting pages fall back to the broad set.
    assert.equal(variantForSlug("businessconsulting"), "consulting");
  });
});
