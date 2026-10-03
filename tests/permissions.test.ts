import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  SCHEDULING_ACTION_PERMISSION,
  getAdminRole,
} from "../lib/scheduling/permissions.ts";

describe("scheduling permissions", () => {
  it("owner can manage team and audit", () => {
    assert.equal(can("manage_team", "owner"), true);
    assert.equal(can("view_audit", "owner"), true);
  });

  it("viewer cannot edit appointments", () => {
    assert.equal(can("edit_appointments", "viewer"), false);
    assert.equal(can("view_appointments", "viewer"), true);
  });

  it("sales can override qualification but not edit rules", () => {
    assert.equal(can("override_qualification", "sales"), true);
    assert.equal(can("edit_qualification_rules", "sales"), false);
  });

  it("maps cancel action to cancel_appointments", () => {
    assert.equal(
      SCHEDULING_ACTION_PERMISSION.admin_cancel,
      "cancel_appointments"
    );
  });

  it("founder and cofounder have full access, including team management", () => {
    for (const role of ["founder", "cofounder"] as const) {
      assert.equal(can("manage_team", role), true);
      assert.equal(can("manage_billing", role), true);
      assert.equal(can("manage_security_settings", role), true);
    }
  });

  it("head programmer runs platform + security but not team, billing or leads", () => {
    assert.equal(can("manage_automations", "head_programmer"), true);
    assert.equal(can("manage_security_settings", "head_programmer"), true);
    assert.equal(can("view_audit", "head_programmer"), true);
    assert.equal(can("edit_qualification_rules", "head_programmer"), true);
    assert.equal(can("manage_team", "head_programmer"), false);
    assert.equal(can("manage_billing", "head_programmer"), false);
    assert.equal(can("manage_leads", "head_programmer"), false);
    assert.equal(can("view_private_notes", "head_programmer"), false);
  });

  it("wholesale real estate works leads and proposals but not team or billing", () => {
    assert.equal(can("manage_leads", "wholesale_real_estate"), true);
    assert.equal(can("manage_proposals", "wholesale_real_estate"), true);
    assert.equal(can("edit_appointments", "wholesale_real_estate"), true);
    assert.equal(can("manage_team", "wholesale_real_estate"), false);
    assert.equal(can("manage_billing", "wholesale_real_estate"), false);
    assert.equal(can("edit_qualification_rules", "wholesale_real_estate"), false);
  });

  it("defaults missing role to owner", () => {
    assert.equal(getAdminRole(), "owner");
  });
});
