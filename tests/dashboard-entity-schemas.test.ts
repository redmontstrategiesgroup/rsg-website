import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ENTITY_CREATE, ENTITY_PATCH, isEntityName } from "../lib/dashboard/entity-schemas.ts";

describe("entity schemas", () => {
  it("create schemas accept minimal objects and reject empty ones", () => {
    assert.ok(ENTITY_CREATE.actions.schema.safeParse({ title: "t" }).success);
    assert.ok(ENTITY_CREATE.opportunities.schema.safeParse({ name: "n" }).success);
    assert.ok(ENTITY_CREATE.risks.schema.safeParse({ title: "t" }).success);
    assert.ok(ENTITY_CREATE.ideas.schema.safeParse({ title: "t" }).success);
    assert.equal(ENTITY_CREATE.risks.schema.safeParse({}).success, false);
    assert.equal(ENTITY_CREATE.risks.table, "risks");
    assert.equal(ENTITY_CREATE.actions.table, "action_items");
  });
  it("patch schemas are strict", () => {
    assert.equal(ENTITY_PATCH.actions.schema.safeParse({ bogus: 1 }).success, false);
    assert.ok(ENTITY_PATCH.risks.schema.safeParse({ status: "closed" }).success);
    assert.ok(ENTITY_PATCH.briefs.schema.safeParse({ is_read: true }).success);
  });
  it("isEntityName", () => {
    assert.equal(isEntityName("risks"), true); assert.equal(isEntityName("briefs"), false); assert.equal(isEntityName("nope"), false);
  });
});
