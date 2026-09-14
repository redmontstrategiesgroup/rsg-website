/**
 * Engine paths added by the 2026-09 demo audit: boundary + recovery effects,
 * fresh-entity tracking, and session serialisation. Pure modules, no I/O.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SCHEMA_VERSION,
  demoReducer,
  deriveAnalytics,
  initialDemoState,
} from "../components/demos/engine.ts";
import { serializeSession } from "../components/demos/storage.ts";
import { realestateConfig } from "../components/demos/data/realestate.ts";
import type { Effect } from "../components/demos/types.ts";

const fresh = () => initialDemoState(realestateConfig);
const apply = (s: ReturnType<typeof fresh>, effects: Effect[], at?: number) =>
  demoReducer(s, { type: "effects", effects, at });

describe("schema", () => {
  it("is version 6", () => {
    assert.equal(DEMO_SCHEMA_VERSION, 6);
    assert.equal(fresh().schema, 6);
  });
});

describe("boundary effects", () => {
  it("prepend an event with a generated id, 'Just now', and default source", () => {
    const s = apply(fresh(), [
      { kind: "boundary", ruleId: "valuation", summary: "Declined to price 22 Cordwainer Dr", outcome: "declined" },
    ]);
    assert.equal(s.boundaryEvents.length, (realestateConfig.boundaries?.seed.length ?? 0) + 1);
    const e = s.boundaryEvents[0];
    assert.equal(e.ruleId, "valuation");
    assert.equal(e.outcome, "declined");
    assert.equal(e.at, "Just now");
    assert.equal(e.source, "receptionist");
    assert.match(e.id, /^bnd-/);
  });
});

describe("recovery effects", () => {
  it("prepend a ledger entry and feed deriveAnalytics totals", () => {
    const base = fresh();
    const before = deriveAnalytics(base).recoveredTotal;
    const s = apply(base, [
      { kind: "recovery", event: { contact: "Alicia Harmon", amount: 22470, silentFor: "after hours", trigger: "after-hours", summary: "9:12 PM IDX inquiry booked before any agent woke up" } },
    ]);
    assert.equal(s.recoveries[0].contact, "Alicia Harmon");
    assert.match(s.recoveries[0].id, /^rec-/);
    const d = deriveAnalytics(s);
    assert.equal(d.recoveredTotal, before + 22470);
    const bucket = d.recoveredByTrigger.find((p) => p.label === "After hours");
    assert.ok(bucket && bucket.value >= 22470, "after-hours bucket includes the new amount");
  });
});

describe("fresh tracking", () => {
  it("records every entity an effect touches, with kind and timestamp", () => {
    const s = apply(fresh(), [
      { kind: "lead", lead: { id: "l-x", name: "X", service: "Buying", source: "Zillow", stageId: "new-lead", lastActivity: "Just now" } },
      { kind: "task", task: { id: "t-x", title: "Call X", assignee: "Dev Okafor", due: "Today" } },
      { kind: "calendar", event: { id: "cal-x", day: "Thu", date: "Oct 16", time: "5:00 PM", title: "Showing" } },
      { kind: "metric", id: "new-leads", delta: 1 },
      { kind: "message", conversationId: "c-harmon", message: { id: "m-x", from: "system", text: "hi", time: "Just now" } },
    ], 1_000);
    assert.deepEqual(s.fresh["l-x"], { kind: "record", at: 1_000 });
    assert.deepEqual(s.fresh["t-x"], { kind: "task", at: 1_000 });
    assert.deepEqual(s.fresh["cal-x"], { kind: "calendar", at: 1_000 });
    assert.deepEqual(s.fresh["new-leads"], { kind: "metric", at: 1_000 });
    assert.deepEqual(s.fresh["m-x"], { kind: "message", at: 1_000, parent: "c-harmon" });
    assert.deepEqual(s.fresh["c-harmon"], { kind: "message", at: 1_000 });
  });

  it("tags stage moves as record and boundary/recovery events by their kinds", () => {
    const leadId = realestateConfig.leads[0].id;
    const s = apply(fresh(), [
      { kind: "stage", leadId, stageId: "contacted" },
      { kind: "boundary", ruleId: "valuation", summary: "x", outcome: "declined" },
      { kind: "recovery", event: { contact: "Y", amount: 1, silentFor: "1 day", trigger: "deadline", summary: "y" } },
    ], 5);
    assert.equal(s.fresh[leadId]?.kind, "record");
    assert.equal(s.fresh[s.boundaryEvents[0].id]?.kind, "boundary");
    assert.equal(s.fresh[s.recoveries[0].id]?.kind, "recovery");
  });

  it("prunes entries older than 60 seconds on the next effects action", () => {
    let s = apply(fresh(), [{ kind: "metric", id: "new-leads", delta: 1 }], 0);
    s = apply(s, [{ kind: "metric", id: "showings", delta: 1 }], 61_000);
    assert.equal(s.fresh["new-leads"], undefined);
    assert.ok(s.fresh["showings"]);
  });
});

describe("serializeSession", () => {
  it("strips toasts and fresh but keeps everything else", () => {
    let s = apply(fresh(), [
      { kind: "notify", notification: { id: "n-1", title: "Hello" } },
      { kind: "metric", id: "new-leads", delta: 1 },
    ]);
    assert.equal(s.toasts.length, 1);
    assert.ok(Object.keys(s.fresh).length > 0);
    const out = serializeSession(s);
    assert.deepEqual(out.toasts, []);
    assert.deepEqual(out.fresh, {});
    assert.equal(out.notifications.length, 1);
    assert.equal(out.metrics.find((m) => m.id === "new-leads")?.value, s.metrics.find((m) => m.id === "new-leads")?.value);
  });
});
