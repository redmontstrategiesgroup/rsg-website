/**
 * Cross-config invariants for the interactive demos (pure modules, no I/O).
 * Every config listed in CONFIGS must satisfy every rule here. Configs are
 * imported directly (not via data/index.ts) because Node's test runner needs
 * file extensions on relative value imports.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unknownVariables } from "../components/demos/engine.ts";
import { TEMPLATE_VARIABLES } from "../components/demos/types.ts";
import type { Effect, IndustryConfig } from "../components/demos/types.ts";
import { healthwellnessConfig } from "../components/demos/data/healthwellness.ts";
import { contractorConfig } from "../components/demos/data/contractor.ts";
import { realestateConfig } from "../components/demos/data/realestate.ts";

const CONFIGS: IndustryConfig[] = [healthwellnessConfig, contractorConfig, realestateConfig];

/** Strings that must never appear anywhere in a config (regulatory or stub leftovers). */
const FORBIDDEN = [
  "blood thinner",
  "{first name}",
  "{project}",
  "{date}",
  "Service appointment",
  "this is Dev",
  "Mike (sales)",
  "Dave (estimator)",
  "Sam (crew lead)",
  "Longterm",
  "Amanda (front desk)",
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

type EffectList = { label: string; effects: Effect[] };

function effectLists(config: IndustryConfig): EffectList[] {
  const lists: EffectList[] = [];
  lists.push({ label: "guided tour", effects: config.scenario.steps.flatMap((s) => s.effects) });
  for (const sc of config.scenarios) lists.push({ label: `scenario ${sc.id}`, effects: sc.steps.flatMap((s) => s.effects) });
  for (const sim of config.simActions ?? []) lists.push({ label: `sim ${sim.id}`, effects: sim.effects });
  for (const node of config.receptionist.nodes) {
    if (node.outcome) lists.push({ label: `receptionist ${node.id}`, effects: node.outcome.effects });
  }
  return lists;
}

for (const config of CONFIGS) {
  describe(`demo config: ${config.slug}`, () => {
    const staffNames = new Set(config.staff.map((s) => s.name));
    const staffIds = new Set(config.staff.map((s) => s.id));
    const stageIds = new Set(config.stages.map((s) => s.id));
    const ruleIds = new Set(config.boundaries?.rules.map((r) => r.id) ?? []);

    it("contains no forbidden strings", () => {
      const all = collectStrings(config).join("\n");
      for (const bad of FORBIDDEN) assert.ok(!all.includes(bad), `found forbidden string ${JSON.stringify(bad)}`);
    });

    it("uses only known merge tokens", () => {
      for (const s of collectStrings(config)) {
        if (!s.includes("{")) continue;
        assert.deepEqual(unknownVariables(s, TEMPLATE_VARIABLES), [], `unknown token in: ${s}`);
      }
    });

    it("campaign messages carry opt-out language", () => {
      for (const c of config.campaigns) assert.ok(c.message.endsWith("Reply STOP to opt out."), `${c.id}: ${c.message}`);
    });

    it("has the boundaries and recovered tabs in every role", () => {
      const ids = config.nav.map((n) => n.id);
      assert.ok(ids.includes("boundaries") && ids.includes("recovered"), "nav missing new tabs");
      assert.equal(new Set(ids).size, ids.length, "duplicate nav ids");
      for (const role of config.roles) {
        for (const id of role.nav) assert.ok(ids.includes(id), `role ${role.id} references missing nav ${id}`);
        assert.ok(role.nav.includes("boundaries") && role.nav.includes("recovered"), `role ${role.id} lacks new tabs`);
      }
    });

    it("authors boundaries with at least five rules routed to real staff", () => {
      assert.ok(config.boundaries, "boundaries missing");
      assert.ok(config.boundaries.rules.length >= 5);
      for (const r of config.boundaries.rules) {
        if (r.kind === "route") assert.ok(r.routesTo && staffIds.has(r.routesTo), `${r.id} routes to unknown staff`);
      }
      for (const e of config.boundaries.seed) assert.ok(ruleIds.has(e.ruleId), `seed event ${e.id} references ${e.ruleId}`);
    });

    it("authors a recovered ledger with at least six seed entries", () => {
      assert.ok(config.recovered, "recovered missing");
      assert.ok(config.recovered.seed.length >= 6);
      const automationIds = new Set(config.automations.map((a) => a.id));
      for (const r of config.recovered.seed) {
        assert.ok(r.amount > 0, `${r.id} amount`);
        if (r.automationId) assert.ok(automationIds.has(r.automationId), `${r.id} automation`);
      }
    });

    it("assigns records, tasks, and conversations to real staff", () => {
      for (const l of config.leads) if (l.assignee) assert.ok(staffNames.has(l.assignee), `lead ${l.id}: ${l.assignee}`);
      for (const t of config.tasks) assert.ok(staffNames.has(t.assignee), `task ${t.id}: ${t.assignee}`);
      for (const c of config.conversations) if (c.assignee) assert.ok(staffNames.has(c.assignee), `conversation ${c.id}: ${c.assignee}`);
      for (const list of effectLists(config)) {
        for (const e of list.effects) {
          if (e.kind === "lead" && e.lead.assignee) assert.ok(staffNames.has(e.lead.assignee), `${list.label}: ${e.lead.assignee}`);
          if (e.kind === "task") assert.ok(staffNames.has(e.task.assignee), `${list.label}: ${e.task.assignee}`);
        }
      }
    });

    it("calendar 'with' names a staff member or a crew", () => {
      const ok = (w?: string) => !w || w.startsWith("Crew ") || [...staffNames].some((n) => w.includes(n));
      for (const e of config.calendar) assert.ok(ok(e.withWhom), `calendar ${e.id}: ${e.withWhom}`);
      for (const list of effectLists(config)) {
        for (const e of list.effects) if (e.kind === "calendar") assert.ok(ok(e.event.withWhom), `${list.label}: ${e.event.withWhom}`);
      }
    });

    it("schedule days cover every calendar day/date pair", () => {
      const days = new Set(config.scheduleDays.map((d) => `${d.day} ${d.date}`));
      for (const e of config.calendar) assert.ok(days.has(`${e.day} ${e.date}`), `calendar ${e.id}: ${e.day} ${e.date}`);
      for (const node of config.receptionist.nodes) {
        for (const e of node.outcome?.effects ?? []) {
          if (e.kind === "calendar") assert.ok(days.has(`${e.event.day} ${e.event.date}`), `receptionist ${node.id}: ${e.event.day} ${e.event.date}`);
        }
      }
    });

    it("every effect references ids that exist or were created earlier in its list", () => {
      for (const list of effectLists(config)) {
        const leads = new Set(config.leads.map((l) => l.id));
        const convs = new Set(config.conversations.map((c) => c.id));
        const tasks = new Set(config.tasks.map((t) => t.id));
        const events = new Set(config.calendar.map((e) => e.id));
        const reviews = new Set(config.reviews.map((r) => r.id));
        const automations = new Set(config.automations.map((a) => a.id));
        const metrics = new Set(config.metrics.map((m) => m.id));
        const where = (msg: string) => `${list.label}: ${msg}`;
        for (const e of list.effects) {
          switch (e.kind) {
            case "lead": leads.add(e.lead.id); assert.ok(stageIds.has(e.lead.stageId), where(`lead ${e.lead.id} stage ${e.lead.stageId}`)); break;
            case "stage": assert.ok(leads.has(e.leadId), where(`stage: lead ${e.leadId}`)); assert.ok(stageIds.has(e.stageId), where(`stage ${e.stageId}`)); break;
            case "updateLead": assert.ok(leads.has(e.leadId), where(`updateLead ${e.leadId}`)); break;
            case "conversation": convs.add(e.conversation.id); break;
            case "message": assert.ok(convs.has(e.conversationId), where(`message → ${e.conversationId}`)); break;
            case "conversationMeta": assert.ok(convs.has(e.conversationId), where(`meta → ${e.conversationId}`)); break;
            case "task": tasks.add(e.task.id); break;
            case "completeTask": case "reopenTask": assert.ok(tasks.has(e.taskId), where(`task ${e.taskId}`)); break;
            case "calendar": events.add(e.event.id); break;
            case "calendarUpdate": case "appointmentStatus": assert.ok(events.has(e.eventId), where(`event ${e.eventId}`)); break;
            case "review": reviews.add(e.item.id); break;
            case "reviewStatus": assert.ok(reviews.has(e.reviewId), where(`review ${e.reviewId}`)); break;
            case "workflowRun": assert.ok(automations.has(e.run.automationId), where(`automation ${e.run.automationId}`)); break;
            case "metric": assert.ok(metrics.has(e.id), where(`metric ${e.id}`)); break;
            case "boundary": assert.ok(ruleIds.has(e.ruleId), where(`rule ${e.ruleId}`)); break;
            case "recovery": if (e.event.automationId) assert.ok(automations.has(e.event.automationId), where(`recovery automation ${e.event.automationId}`)); break;
            case "quote": case "quoteStatus": case "activity": case "notify": break;
          }
        }
      }
    });

    it("quote stages exist and the receptionist graph is complete", () => {
      const q = config.quote;
      if (q.sentStageId) assert.ok(stageIds.has(q.sentStageId), `sentStageId ${q.sentStageId}`);
      if (q.acceptedStageId) assert.ok(stageIds.has(q.acceptedStageId), `acceptedStageId ${q.acceptedStageId}`);
      const nodes = new Map(config.receptionist.nodes.map((n) => [n.id, n]));
      assert.ok(nodes.has(config.receptionist.start), "start node missing");
      const seen = new Set<string>();
      const queue = [config.receptionist.start];
      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const node = nodes.get(id)!;
        if (node.choices?.length) {
          for (const c of node.choices) { assert.ok(nodes.has(c.next), `${id} → missing ${c.next}`); queue.push(c.next); }
        } else {
          assert.ok(node.outcome, `terminal node ${id} has no outcome`);
        }
      }
      for (const id of nodes.keys()) assert.ok(seen.has(id), `node ${id} unreachable`);
    });

    it("guided tour has a boundaries step and at least one recovery effect", () => {
      assert.ok(config.scenario.steps.some((s) => s.tab === "boundaries"), "no boundaries tour step");
      assert.ok(config.scenario.steps.some((s) => s.effects.some((e) => e.kind === "recovery")), "no recovery effect in tour");
    });
  });
}
