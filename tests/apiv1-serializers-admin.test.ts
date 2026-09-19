import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as s from "../lib/apiv1/serializers-admin.ts";

const poison = Object.fromEntries(s.ADMIN_DENYLIST.map((k) => [k, "LEAK"]));
const base = { id: "i", created_at: "t", updated_at: "t" };

describe("admin serializers strip internal fields", () => {
  const cases: [string, (x: never) => Record<string, unknown>][] = [
    ["lead", s.toLeadDto as never], ["client", s.toClientAdminDto as never], ["proposal", s.toProposalDto as never],
    ["audit", s.toAuditEventDto as never],
    ["actions", ((r: never) => s.toEntityDto("actions", r)) as never],
    ["opportunities", ((r: never) => s.toEntityDto("opportunities", r)) as never],
    ["risks", ((r: never) => s.toEntityDto("risks", r)) as never],
    ["ideas", ((r: never) => s.toEntityDto("ideas", r)) as never],
  ];
  for (const [name, fn] of cases) {
    it(name, () => {
      const out = fn({ ...base, ...poison, payment_schedule: [], metadata: {} } as never);
      for (const k of s.ADMIN_DENYLIST) assert.equal(k in out, false, `${name} leaked ${k}`);
      assert.equal(JSON.stringify(out).includes("LEAK"), false);
    });
  }
  it("lead maps DB column names to API names", () => {
    const dto = s.toLeadDto({ ...base, business_name: "Acme", biggest_problem: "p", improvement_goal: "g", lead_score: 7 } as never);
    assert.equal(dto.company, "Acme"); assert.equal(dto.problem, "p"); assert.equal(dto.improve, "g"); assert.equal(dto.score, 7);
  });
  it("entity dto nulls missing keys and ignores unknown ones", () => {
    const dto = s.toEntityDto("risks", { id: "r", created_at: "t", severity: "high", bogus: 1 });
    assert.equal(dto.severity, "high"); assert.equal(dto.mitigation, null); assert.equal("bogus" in dto, false);
  });
  it("page view", () => {
    assert.deepEqual(s.toPageViewDto({ vid: "v", path: "/", referrer: "", at: "t" }), { at: "t", path: "/", referrer: "", visitor: "v" });
  });
});
