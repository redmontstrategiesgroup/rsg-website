// tests/apiv1-serializers.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as s from "../lib/apiv1/serializers.ts";
import { requireOwned, requireUuid, ticketOwnedBy, fileOwnedBy } from "../lib/apiv1/ownership.ts";

/** Feed every serializer an object that has every denylisted key set; none may survive. */
const poison = Object.fromEntries(s.DENYLIST.map((k) => [k, "LEAK"]));
const base = { id: "i", created_at: "t", updated_at: "t", client_id: "c", project_id: "p", currency: "usd" };

describe("serializers strip internal fields", () => {
  const cases: [string, (x: any) => Record<string, unknown>][] = [
    ["project", s.toProjectDto], ["milestone", s.toMilestoneDto], ["task", s.toTaskDto], ["approval", s.toApprovalDto],
    ["ticket", s.toTicketDto], ["message", s.toMessageDto], ["file", s.toFileDto], ["invoice", s.toInvoiceDto],
    ["payment", s.toPaymentDto], ["subscription", s.toSubscriptionDto], ["brief", s.toBriefDto],
  ];
  for (const [name, fn] of cases) {
    it(name, () => {
      const out = fn({ ...base, ...poison, total_cents: 10, amount_paid_cents: 4, line_items: [], deliverables: [] });
      for (const k of s.DENYLIST) assert.equal(k in out, false, `${name} leaked ${k}`);
      assert.equal(JSON.stringify(out).includes("LEAK"), false);
    });
  }
  it("invoice computes balance", () => {
    assert.equal(s.toInvoiceDto({ ...base, total_cents: 10, amount_paid_cents: 4, line_items: [] } as any).balance_cents, 6);
  });
});

describe("ownership", () => {
  it("guards", () => {
    assert.equal(ticketOwnedBy({ client_id: "c" }, "c"), true);
    assert.equal(ticketOwnedBy({ client_id: "c" }, "z"), false);
    assert.equal(fileOwnedBy({ client_id: null }, "c"), false);
    assert.throws(() => requireOwned(null, true), (e: any) => e.code === "not_found");
    assert.throws(() => requireOwned({ x: 1 }, false), (e: any) => e.status === 404);
    assert.deepEqual(requireOwned({ x: 1 }, true), { x: 1 });
  });

  it("requireUuid", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    assert.equal(requireUuid(uuid), uuid);
    assert.throws(() => requireUuid("abc"), (e: any) => e.code === "not_found");
    assert.throws(() => requireUuid(undefined), (e: any) => e.code === "not_found");
  });
});
