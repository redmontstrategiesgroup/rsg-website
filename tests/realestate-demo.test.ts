/**
 * Real estate demo config + engine integrity (pure modules, no I/O).
 *
 * Imports the config directly rather than through components/demos/data/index.ts:
 * Node's ESM resolver needs file extensions on relative value imports, and the
 * barrel file has none. Keep realestate.ts's only relative import type-only.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  demoReducer,
  initialDemoState,
  unknownVariables,
} from "../components/demos/engine.ts";
import { realestateConfig } from "../components/demos/data/realestate.ts";
import { TEMPLATE_VARIABLES } from "../components/demos/types.ts";
import type { Effect, NavId } from "../components/demos/types.ts";

const config = realestateConfig;
const state = () => initialDemoState(config);
const apply = (s: ReturnType<typeof state>, effects: Effect[]) =>
  demoReducer(s, { type: "effects", effects });

const ALL_NAV_IDS: NavId[] = [
  "overview", "leads", "pipeline", "conversations", "receptionist", "quotes",
  "automations", "tasks", "calendar", "reviews", "campaigns", "analytics",
  "recovered", "boundaries", "settings",
];

describe("real estate demo config", () => {
  it("is registered under the expected slug", () => {
    assert.equal(config.slug, "realestate");
  });

  it("covers every nav id exactly once", () => {
    const ids = config.nav.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate nav ids");
    assert.deepEqual([...ids].sort(), [...ALL_NAV_IDS].sort());
  });

  it("every role's nav is a subset of the config nav", () => {
    const ids = new Set<string>(config.nav.map((n) => n.id));
    for (const role of config.roles) {
      for (const id of role.nav) {
        assert.ok(ids.has(id), `role ${role.id} references missing nav "${id}"`);
      }
    }
  });

  it("every lead resolves to a real stage and a real staff member", () => {
    const stageIds = new Set(config.stages.map((s) => s.id));
    const staffNames = new Set(config.staff.map((s) => s.name));
    for (const lead of config.leads) {
      assert.ok(stageIds.has(lead.stageId), `${lead.name}: unknown stage "${lead.stageId}"`);
      if (lead.assignee) {
        assert.ok(staffNames.has(lead.assignee), `${lead.name}: unknown assignee "${lead.assignee}"`);
      }
    }
  });

  it("every automation declares a kind for the workflow simulator", () => {
    for (const a of config.automations) {
      assert.ok(a.kind, `automation "${a.name}" is missing kind`);
    }
  });

  it("every template variable is in the allowed list", () => {
    // There is no {address} variable: property addresses must use {location}.
    for (const t of config.templates) {
      assert.deepEqual(
        unknownVariables(t.text, TEMPLATE_VARIABLES),
        [],
        `template "${t.name}" uses unknown variables`,
      );
    }
    for (const c of config.campaigns) {
      assert.deepEqual(
        unknownVariables(c.message, TEMPLATE_VARIABLES),
        [],
        `campaign "${c.name}" uses unknown variables`,
      );
    }
  });

  it("the net sheet never nets negative at its worst case", () => {
    const worst = config.quote.fields.reduce(
      (total, f) => total + Math.min(...f.options.map((o) => o.amount)),
      config.quote.base.amount,
    );
    assert.ok(worst > 0, `worst-case net sheet is ${worst}, which would render as a negative total`);
  });

  it("the net sheet's linked stages exist", () => {
    const stageIds = new Set(config.stages.map((s) => s.id));
    for (const id of [config.quote.sentStageId, config.quote.acceptedStageId]) {
      if (id) assert.ok(stageIds.has(id), `quote references unknown stage "${id}"`);
    }
  });
});

describe("real estate receptionist", () => {
  const nodes = new Map(config.receptionist.nodes.map((n) => [n.id, n]));

  it("starts at a real node and every choice resolves", () => {
    assert.ok(nodes.has(config.receptionist.start), "start node does not exist");
    for (const node of config.receptionist.nodes) {
      for (const choice of node.choices ?? []) {
        assert.ok(nodes.has(choice.next), `${node.id} → unknown node "${choice.next}"`);
      }
    }
  });

  it("has terminal nodes that produce outcomes", () => {
    const terminal = config.receptionist.nodes.filter((n) => !n.choices);
    assert.ok(terminal.length > 0, "no terminal nodes");
    for (const node of terminal) {
      assert.ok(node.outcome, `terminal node "${node.id}" has no outcome`);
    }
  });

  it("never quotes a home value in the valuation branch", () => {
    // The whole point of that branch: the assistant declines to give a number
    // and hands off to a licensed agent. A dollar figure here breaks the promise
    // the vertical page's compliance section makes.
    for (const id of ["valuation", "no-ballpark"]) {
      const node = nodes.get(id);
      assert.ok(node, `expected a "${id}" node in the valuation branch`);
      assert.doesNotMatch(
        node.say,
        /\$[\d,]/,
        `receptionist node "${id}" quotes a figure; it must decline to estimate`,
      );
    }
  });

  it("applies every terminal outcome through the reducer", () => {
    for (const node of config.receptionist.nodes) {
      if (!node.outcome) continue;
      assert.doesNotThrow(
        () => apply(state(), node.outcome!.effects),
        `outcome effects for "${node.id}" threw`,
      );
    }
  });
});

describe("real estate scenarios", () => {
  it("runs the featured tour end to end and moves the metrics", () => {
    let s = state();
    for (const step of config.scenario.steps) {
      s = apply(s, step.effects);
    }
    const before = new Map(config.metrics.map((m) => [m.id, m.value]));
    const leads = s.metrics.find((m) => m.id === "new-leads")!;
    const appts = s.metrics.find((m) => m.id === "appointments-set")!;
    assert.ok(leads.value > before.get("new-leads")!, "new-leads did not move");
    assert.ok(appts.value > before.get("appointments-set")!, "appointments-set did not move");
  });

  it("creates the lead it later advances", () => {
    // Walking the steps in order catches a stage/updateLead effect that targets
    // an id no earlier step created.
    let s = state();
    for (const step of config.scenario.steps) {
      for (const effect of step.effects) {
        if (effect.kind === "stage" || effect.kind === "updateLead") {
          assert.ok(
            s.leads.some((l) => l.id === effect.leadId),
            `step "${step.id}" targets lead "${effect.leadId}" before it exists`,
          );
        }
        if (effect.kind === "message") {
          assert.ok(
            s.conversations.some((c) => c.id === effect.conversationId),
            `step "${step.id}" messages conversation "${effect.conversationId}" before it exists`,
          );
        }
      }
      s = apply(s, step.effects);
    }
  });

  it("runs every replayable scenario without throwing", () => {
    for (const scenario of config.scenarios) {
      let s = state();
      assert.doesNotThrow(() => {
        for (const step of scenario.steps) s = apply(s, step.effects);
      }, `scenario "${scenario.id}" threw`);
    }
  });

  it("applies every sim action cleanly", () => {
    for (const action of config.simActions ?? []) {
      assert.doesNotThrow(
        () => apply(state(), action.effects),
        `sim action "${action.id}" threw`,
      );
    }
  });

  it("sim actions that target seed records reference real ids", () => {
    const s = state();
    for (const action of config.simActions ?? []) {
      for (const effect of action.effects) {
        if (effect.kind === "updateLead") {
          assert.ok(
            s.leads.some((l) => l.id === effect.leadId),
            `sim action "${action.id}" updates unknown lead "${effect.leadId}"`,
          );
        }
        if (effect.kind === "message") {
          assert.ok(
            s.conversations.some((c) => c.id === effect.conversationId),
            `sim action "${action.id}" messages unknown conversation "${effect.conversationId}"`,
          );
        }
      }
    }
  });
});
