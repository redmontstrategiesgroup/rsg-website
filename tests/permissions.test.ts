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

  it("defaults missing role to owner", () => {
    assert.equal(getAdminRole(), "owner");
  });
});
