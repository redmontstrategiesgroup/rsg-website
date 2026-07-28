/**
 * Retail demo engine + config integrity (pure modules, no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  demoReducer,
  initialDemoState,
  productStatus,
} from "../components/demos/engine.ts";
import { retailConfig } from "../components/demos/data/retail.ts";
import type { Effect } from "../components/demos/types.ts";

const state = () => initialDemoState(retailConfig);
const apply = (s: ReturnType<typeof state>, effects: Effect[]) =>
  demoReducer(s, { type: "effects", effects });

describe("retail demo state", () => {
  it("seeds loyalty members, rewards, and products from the config", () => {
    const s = state();
    assert.equal(s.loyaltyMembers.length, retailConfig.loyalty!.members.length);
    assert.equal(s.loyaltyRewards.length, retailConfig.loyalty!.rewards.length);
    assert.equal(s.products.length, retailConfig.inventory!.products.length);
  });

  it("leaves loyalty/products empty for industries without those modules", () => {
    const s = initialDemoState({ ...retailConfig, loyalty: undefined, inventory: undefined });
    assert.equal(s.loyaltyMembers.length, 0);
    assert.equal(s.products.length, 0);
  });

  it("declared product statuses match the derived status", () => {
    for (const p of retailConfig.inventory!.products) {
      assert.equal(productStatus(p), p.status, `${p.sku} (${p.name})`);
    }
  });

  it("stock changes clamp at zero and recompute status", () => {
    let s = state();
    s = apply(s, [{ kind: "stock", productId: "p-1001", delta: 4 }]);
    let marlin = s.products.find((p) => p.id === "p-1001")!;
    assert.equal(marlin.stock, 7);
    assert.equal(marlin.status, "in-stock");
    s = apply(s, [{ kind: "stock", productId: "p-1001", delta: -99 }]);
    marlin = s.products.find((p) => p.id === "p-1001")!;
    assert.equal(marlin.stock, 0);
    assert.equal(marlin.status, "out-of-stock");
  });

  it("redeeming with insufficient points is a no-op", () => {
    const s = state();
    const beth = s.loyaltyMembers.find((m) => m.id === "lm-nolan")!; // 65 pts
    const next = apply(s, [
      { kind: "loyaltyRedeem", memberId: beth.id, rewardId: "rw-25" }, // 500 pts
    ]);
    assert.equal(next.loyaltyMembers.find((m) => m.id === beth.id)!.points, 65);
    assert.equal(
      next.loyaltyRewards.find((r) => r.id === "rw-25")!.redeemedThisMonth,
      s.loyaltyRewards.find((r) => r.id === "rw-25")!.redeemedThisMonth,
    );
  });

  it("redeeming deducts points and counts the redemption", () => {
    const s = state();
    const next = apply(s, [
      { kind: "loyaltyRedeem", memberId: "lm-marsh", rewardId: "rw-25" },
    ]);
    assert.equal(next.loyaltyMembers.find((m) => m.id === "lm-marsh")!.points, 1220);
    assert.equal(
      next.loyaltyRewards.find((r) => r.id === "rw-25")!.redeemedThisMonth,
      s.loyaltyRewards.find((r) => r.id === "rw-25")!.redeemedThisMonth + 1,
    );
  });

  it("member tier ids all exist in the tier list", () => {
    const tierIds = new Set(retailConfig.loyalty!.tiers.map((t) => t.id));
    for (const m of retailConfig.loyalty!.members) {
      assert.ok(tierIds.has(m.tierId), `${m.name} → ${m.tierId}`);
    }
  });
});

describe("retail config referential integrity", () => {
  const metricIds = new Set(retailConfig.metrics.map((m) => m.id));
  const stageIds = new Set(retailConfig.stages.map((s) => s.id));
  const productIds = new Set(retailConfig.inventory!.products.map((p) => p.id));
  const navIds = new Set(retailConfig.nav.map((n) => n.id));

  const allEffects: Effect[] = [
    ...retailConfig.scenario.steps.flatMap((s) => s.effects),
    ...(retailConfig.simActions ?? []).flatMap((a) => a.effects),
    ...retailConfig.receptionist.nodes.flatMap((n) => n.outcome?.effects ?? []),
  ];

  it("every effect references existing metric/stage/product ids", () => {
    for (const e of allEffects) {
      if (e.kind === "metric") assert.ok(metricIds.has(e.id), `metric ${e.id}`);
      if (e.kind === "stage") assert.ok(stageIds.has(e.stageId), `stage ${e.stageId}`);
      if (e.kind === "stock") assert.ok(productIds.has(e.productId), `product ${e.productId}`);
      if (e.kind === "lead") assert.ok(stageIds.has(e.lead.stageId), `lead stage ${e.lead.stageId}`);
    }
  });

  it("every role nav id exists in the nav list", () => {
    for (const role of retailConfig.roles) {
      for (const id of role.nav) {
        assert.ok(navIds.has(id), `${role.id} → ${id}`);
      }
    }
  });

  it("receptionist choices all point at existing nodes", () => {
    const nodeIds = new Set(retailConfig.receptionist.nodes.map((n) => n.id));
    assert.ok(nodeIds.has(retailConfig.receptionist.start));
    for (const n of retailConfig.receptionist.nodes) {
      for (const c of n.choices ?? []) {
        assert.ok(nodeIds.has(c.next), `${n.id} → ${c.next}`);
      }
    }
  });
});
