# Demo Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the gyms demo, fix every content/regulatory defect in the three remaining demo configs, add the Boundaries and Recovered differentiator tabs to the shared demo engine, and make the guided tour visibly highlight what each step does on desktop and mobile.

**Architecture:** Every demo is one `IndustryConfig` object (`components/demos/data/<slug>.ts`) rendered by one shell (`components/demos/DemoOS.tsx`) over one pure reducer (`components/demos/engine.ts`). New capabilities are added as new `Effect` kinds + `DemoState` fields in the engine, new tab views under `components/demos/ui/`, and authored content in the configs. The tour gets an engine-level "fresh entity" map that views use to spotlight rows.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind 3.4, lucide-react, zod 4. Tests run with Node 24's built-in runner: `node --test tests/*.test.ts` (native TS stripping — **relative imports inside tested modules must be `import type` or carry a `.ts` extension**; the `data/index.ts` barrel has extensionless value imports and therefore cannot be imported by tests).

**Spec:** `docs/superpowers/specs/2026-09-11-demo-audit-design.md` — read it alongside this plan; exact copy strings live there.

**Repo note:** `Website/` is its own git repo (branch `fix/mobile-responsive-pass`). The outer `RSG/` repo `.gitignore`s it. Run every command from `c:/Users/josep/Desktop/RSG/Website`. The working tree carries a large pre-existing uncommitted change set; `git add` only the files each task names. `components/demos/data/healthwellness.ts` and `realestate.ts` are currently **untracked** — the first task that touches them commits them for the first time; that is expected.

## Global Constraints

- Merge tokens in any config string must be members of `TEMPLATE_VARIABLES` (`components/demos/types.ts`): `first_name business_name staff_name appointment_date appointment_time service estimate_amount booking_link review_link location phone`.
- Campaign (marketing) `message` strings end with ` Reply STOP to opt out.`; transactional templates/automations do not.
- Automated messages never sign as a named human: use `"this is {business_name}'s assistant for {staff_name}"` or `"{staff_name} asked me to reach out"`.
- Every `assignee` string resolves to a `staff[].name`. `withWhom` must contain a staff name or start with `Crew `.
- Every `scheduleDays` list covers every `{ day, date }` pair used by `config.calendar` and by receptionist-outcome `calendar` effects.
- All effect-referenced ids (`leadId`, `stageId`, `conversationId`, `taskId`, `eventId`, `reviewId`, `automationId`, `ruleId`) must exist in the config or be created by an earlier effect in the same step list.
- Copy style: no em-dash-for-colon tics in new strings; write plain sentences.
- Gates before every commit: `npm run typecheck` and `npm test` pass. Before the final task also `npm run lint` and `npm run build`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Never edit `.env*`, `node_modules`, or anything outside `Website/`.

## File Map

| File | Responsibility | Tasks |
|---|---|---|
| `components/demos/types.ts` | Data model: new `NavId`s, `BoundaryRule/Event`, `RecoveryEvent`, `FreshEntry`, new `Effect` kinds, config fields | 1, 3 |
| `components/demos/engine.ts` | Reducer: `boundaryEvents`, `recoveries`, `fresh` tracking + pruning, `deriveAnalytics` recovered totals, schema v6 | 1, 5 |
| `components/demos/storage.ts` | `serializeSession` strips transient state | 1 |
| `tests/demo-engine.test.ts` | Engine unit tests for the new reducer paths | 1 |
| `lib/demo-request-schema.ts`, `components/demos/data/index.ts`, `app/sitemap.ts`, `next.config.mjs`, `app/(marketing)/demos/page.tsx`, `lib/connect-defaults.ts`, `tests/demo-request.test.ts` | Retire gyms; single slug source of truth | 2 |
| `components/demos/ui/QuotesView.tsx`, `components/demos/sections.tsx` | Net-sheet label/colour fix; delete dead sections | 3 |
| `components/demos/ui/BoundariesView.tsx` | Boundaries tab | 4 |
| `components/demos/ui/RecoveredView.tsx`, `components/demos/ui/views.tsx` | Recovered tab, overview widget, analytics KPI | 5 |
| `components/demos/DemoOS.tsx` | Nav icons, view switch, tour caption, flush, scroll | 1, 4, 5, 10 |
| `components/demos/RequestSystemDialog.tsx` | Guardrails service option + hint | 4 |
| `components/demos/data/healthwellness.ts` | Fidelity + boundaries + recovered content | 6 |
| `components/demos/data/contractor.ts`, `components/demos/data/shared.ts` (deleted), `components/demos/defaults.ts` | Author stubbed sections, fidelity, boundaries, recovered | 7 |
| `components/demos/data/realestate.ts`, `tests/realestate-demo.test.ts` | Fidelity + boundaries + recovered | 8 |
| `tests/demo-configs.test.ts` | Cross-config invariants | 6, 7, 8 |
| `components/demos/ui/Spotlight.tsx`, `app/globals.css`, list views | Fresh-item highlighting | 9 |
| `components/demos/ui/TourCaption.tsx`, `DemoOS.tsx` | In-window step caption, chips, controls | 10 |
| `components/demos/ui/ConversationsView.tsx` | Auto-open fresh thread on tour steps | 11 |
| `scripts/tour-walk.mjs` | Playwright tour walker for verification | 12 |

---

### Task 1: Engine foundations — new effects, fresh tracking, schema v6

**Files:**
- Modify: `components/demos/types.ts` (NavId ~line 12, WidgetId ~line 226, Effect ~line 311, QuoteConfig ~line 215, IndustryConfig ~line 370)
- Modify: `components/demos/engine.ts` (DEMO_SCHEMA_VERSION line 20, DemoState line 40, initialDemoState line 93, DemoAction line 133, applyEffect line 154, demoReducer line 292, DerivedAnalytics line 818, deriveAnalytics line 831)
- Modify: `components/demos/storage.ts`
- Modify: `components/demos/DemoOS.tsx` (`NAV_ICONS` ~line 66)
- Create: `tests/demo-engine.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type NavId = "overview" | "leads" | "pipeline" | "conversations" | "receptionist" | "quotes" | "automations" | "tasks" | "calendar" | "reviews" | "campaigns" | "analytics" | "boundaries" | "recovered" | "settings";
  export type WidgetId = "metrics" | "activity" | "schedule" | "tasks" | "pipeline" | "recovered";
  export type BoundaryKind = "never" | "always" | "route";
  export type BoundaryOutcome = "declined" | "routed" | "verified" | "disclosed";
  export type BoundarySource = "receptionist" | "automation" | "conversation" | "scenario";
  export type BoundaryRule = { id: string; label: string; kind: BoundaryKind; detail: string; routesTo?: string };
  export type BoundaryEvent = { id: string; ruleId: string; at: string; summary: string; outcome: BoundaryOutcome; source: BoundarySource };
  export type BoundariesConfig = { intro: string; rules: BoundaryRule[]; seed: BoundaryEvent[] };
  export type RecoveryTrigger = "quote-followup" | "missed-call" | "no-show" | "reactivation" | "deadline" | "after-hours" | "referral";
  export type RecoveryEvent = { id: string; at: string; contact: string; amount: number; silentFor: string; trigger: RecoveryTrigger; summary: string; automationId?: string; leadId?: string };
  export type RecoveredConfig = { intro: string; attributionRule: string; seed: RecoveryEvent[] };
  export type FreshKind = "record" | "message" | "task" | "calendar" | "metric" | "boundary" | "recovery";
  export type FreshEntry = { kind: FreshKind; at: number; parent?: string };
  // Effect gains:
  //   | { kind: "boundary"; ruleId: string; summary: string; outcome: BoundaryOutcome; source?: BoundarySource }
  //   | { kind: "recovery"; event: Omit<RecoveryEvent, "id" | "at"> }
  // QuoteConfig gains: totalLabel?: string
  // IndustryConfig gains: boundaries?: BoundariesConfig; recovered?: RecoveredConfig
  ```
- Produces (engine.ts): `DemoState.boundaryEvents: BoundaryEvent[]`, `DemoState.recoveries: RecoveryEvent[]`, `DemoState.fresh: Record<string, FreshEntry>`, action `{ type: "effects"; effects: Effect[]; at?: number }`, `FRESH_TTL_MS = 60_000`, `DerivedAnalytics.recoveredTotal: number`, `DerivedAnalytics.recoveredByTrigger: { label: string; value: number }[]`, `DEMO_SCHEMA_VERSION = 6`.
- Produces (storage.ts): `export function serializeSession(state: DemoState): DemoState` (returns a copy with `toasts: []`, `fresh: {}`).

- [ ] **Step 1: Write the failing engine tests**

Create `tests/demo-engine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/demo-engine.test.ts`
Expected: FAIL (type/shape errors: `serializeSession` not exported, `boundaryEvents` undefined, schema 5).

- [ ] **Step 3: Add the types**

In `components/demos/types.ts`:

1. Replace the `NavId` union so it reads (keep `settings` last):
```ts
export type NavId =
  | "overview"
  | "leads"
  | "pipeline"
  | "conversations"
  | "receptionist"
  | "quotes"
  | "automations"
  | "tasks"
  | "calendar"
  | "reviews"
  | "campaigns"
  | "analytics"
  | "boundaries"
  | "recovered"
  | "settings";
```
2. Replace `export type WidgetId = "metrics" | "activity" | "schedule" | "tasks" | "pipeline";` with
```ts
export type WidgetId = "metrics" | "activity" | "schedule" | "tasks" | "pipeline" | "recovered";
```
3. In `QuoteConfig`, after `disclaimer: string;` add:
```ts
  /** Label for the computed total, e.g. "Estimated net proceeds". Defaults to "Estimated total". */
  totalLabel?: string;
```
4. Immediately before `/** A single state mutation applied by the reducer. */` add:
```ts
/* ------------------------------------------------------------------ */
/* Boundaries: what the AI refuses, verifies, discloses, or routes      */
/* ------------------------------------------------------------------ */

export type BoundaryKind = "never" | "always" | "route";
export type BoundaryOutcome = "declined" | "routed" | "verified" | "disclosed";
export type BoundarySource = "receptionist" | "automation" | "conversation" | "scenario";

export type BoundaryRule = {
  id: string;
  label: string;
  kind: BoundaryKind;
  detail: string;
  /** Staff id the matter is routed to (kind "route"). */
  routesTo?: string;
};

export type BoundaryEvent = {
  id: string;
  ruleId: string;
  at: string;
  summary: string;
  outcome: BoundaryOutcome;
  source: BoundarySource;
};

export type BoundariesConfig = { intro: string; rules: BoundaryRule[]; seed: BoundaryEvent[] };

/* ------------------------------------------------------------------ */
/* Recovered: revenue that would have died in silence                  */
/* ------------------------------------------------------------------ */

export type RecoveryTrigger =
  | "quote-followup"
  | "missed-call"
  | "no-show"
  | "reactivation"
  | "deadline"
  | "after-hours"
  | "referral";

export type RecoveryEvent = {
  id: string;
  at: string;
  contact: string;
  amount: number;
  /** How long the contact had been quiet before the automated touch, e.g. "5 days". */
  silentFor: string;
  trigger: RecoveryTrigger;
  summary: string;
  automationId?: string;
  leadId?: string;
};

export type RecoveredConfig = { intro: string; attributionRule: string; seed: RecoveryEvent[] };

/* ------------------------------------------------------------------ */
/* Fresh-entity tracking for the tour spotlight                        */
/* ------------------------------------------------------------------ */

export type FreshKind = "record" | "message" | "task" | "calendar" | "metric" | "boundary" | "recovery";
export type FreshEntry = { kind: FreshKind; at: number; parent?: string };
```
5. In the `Effect` union, after the `notify` member, add:
```ts
  | { kind: "boundary"; ruleId: string; summary: string; outcome: BoundaryOutcome; source?: BoundarySource }
  | { kind: "recovery"; event: Omit<RecoveryEvent, "id" | "at"> };
```
(and remove the `;` from the former last member).
6. In `IndustryConfig`, after `breakdown: BreakdownConfig;` add:
```ts
  /** Guardrails the AI enforces, plus a few historical events so the tab isn't empty. */
  boundaries?: BoundariesConfig;
  /** Counterfactual attribution ledger seed. */
  recovered?: RecoveredConfig;
```

- [ ] **Step 4: Update the engine**

In `components/demos/engine.ts`:

1. Extend the type import list with `BoundaryEvent, FreshEntry, FreshKind, RecoveryEvent`.
2. `export const DEMO_SCHEMA_VERSION = 6;`
3. After `explored: string[];` in `DemoState` add:
```ts
  /** Guardrail events, newest first (seeded from config, grown by effects). */
  boundaryEvents: BoundaryEvent[];
  /** Recovered-revenue ledger, newest first. */
  recoveries: RecoveryEvent[];
  /** Entities touched recently, for the tour spotlight. Never persisted. */
  fresh: Record<string, FreshEntry>;
```
4. In `initialDemoState`, after `explored: [],` add:
```ts
    boundaryEvents: (config.boundaries?.seed ?? []).map((e) => ({ ...e })),
    recoveries: (config.recovered?.seed ?? []).map((r) => ({ ...r })),
    fresh: {},
```
5. Change the first `DemoAction` member to `| { type: "effects"; effects: Effect[]; at?: number }`.
6. Add above `function applyEffect`:
```ts
/** Fresh entries older than this are pruned on the next effects action. */
export const FRESH_TTL_MS = 60_000;

/** Which entities an effect touched, for the tour spotlight. */
function touched(effect: Effect, produced?: { id: string }): { id: string; kind: FreshKind; parent?: string }[] {
  switch (effect.kind) {
    case "metric":
      return [{ id: effect.id, kind: "metric" }];
    case "stage":
    case "updateLead":
      return [{ id: effect.leadId, kind: "record" }];
    case "lead":
      return [{ id: effect.lead.id, kind: "record" }];
    case "message":
      return [
        { id: effect.message.id, kind: "message", parent: effect.conversationId },
        { id: effect.conversationId, kind: "message" },
      ];
    case "conversation":
      return [
        { id: effect.conversation.id, kind: "message" },
        ...effect.conversation.messages.map((m) => ({ id: m.id, kind: "message" as const, parent: effect.conversation.id })),
      ];
    case "task":
      return [{ id: effect.task.id, kind: "task" }];
    case "completeTask":
    case "reopenTask":
      return [{ id: effect.taskId, kind: "task" }];
    case "activity":
      return [{ id: effect.item.id, kind: "record" }];
    case "calendar":
      return [{ id: effect.event.id, kind: "calendar" }];
    case "calendarUpdate":
    case "appointmentStatus":
      return [{ id: effect.eventId, kind: "calendar" }];
    case "review":
      return [{ id: effect.item.id, kind: "record" }];
    case "reviewStatus":
      return [{ id: effect.reviewId, kind: "record" }];
    case "workflowRun":
      return [{ id: effect.run.id, kind: "record" }];
    case "quote":
      return [{ id: effect.quote.id, kind: "record" }];
    case "quoteStatus":
      return [{ id: effect.quoteId, kind: "record" }];
    case "boundary":
      return produced ? [{ id: produced.id, kind: "boundary" }] : [];
    case "recovery":
      return produced ? [{ id: produced.id, kind: "recovery" }] : [];
    case "conversationMeta":
    case "notify":
      return [];
  }
}
```
7. In `applyEffect`, add two cases before the closing brace of the switch (after `notify`):
```ts
    case "boundary": {
      const event: BoundaryEvent = {
        id: uid("bnd"),
        ruleId: effect.ruleId,
        at: "Just now",
        summary: effect.summary,
        outcome: effect.outcome,
        source: effect.source ?? "receptionist",
      };
      return { ...state, boundaryEvents: [event, ...state.boundaryEvents] };
    }
    case "recovery": {
      const event: RecoveryEvent = { id: uid("rec"), at: "Just now", ...effect.event };
      return { ...state, recoveries: [event, ...state.recoveries] };
    }
```
8. Replace the `case "effects":` body in `demoReducer` with:
```ts
    case "effects": {
      const at = action.at ?? Date.now();
      const kept: Record<string, FreshEntry> = {};
      for (const [id, entry] of Object.entries(state.fresh)) {
        if (at - entry.at < FRESH_TTL_MS) kept[id] = entry;
      }
      let next: DemoState = { ...state, fresh: kept };
      for (const effect of action.effects) {
        const applied = applyEffect(next, effect);
        const produced =
          effect.kind === "boundary" ? applied.boundaryEvents[0]
          : effect.kind === "recovery" ? applied.recoveries[0]
          : undefined;
        const fresh = { ...applied.fresh };
        for (const t of touched(effect, produced)) {
          fresh[t.id] = t.parent ? { kind: t.kind, at, parent: t.parent } : { kind: t.kind, at };
        }
        next = { ...applied, fresh };
      }
      return next;
    }
```
9. Extend `DerivedAnalytics`:
```ts
  recoveredTotal: number;
  recoveredByTrigger: { label: string; value: number }[];
```
and in `deriveAnalytics`, before `return {`, add:
```ts
  const TRIGGER_LABELS: Record<RecoveryEvent["trigger"], string> = {
    "quote-followup": "Quote follow-up",
    "missed-call": "Missed call",
    "no-show": "No-show recovery",
    reactivation: "Reactivation",
    deadline: "Deadline watch",
    "after-hours": "After hours",
    referral: "Referral",
  };
  const byTrigger = new Map<string, number>();
  for (const r of state.recoveries) {
    const label = TRIGGER_LABELS[r.trigger];
    byTrigger.set(label, (byTrigger.get(label) ?? 0) + r.amount);
  }
```
and to the returned object add:
```ts
    recoveredTotal: state.recoveries.reduce((sum, r) => sum + r.amount, 0),
    recoveredByTrigger: [...byTrigger.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
```

- [ ] **Step 5: Update storage**

In `components/demos/storage.ts` add after `key()`:
```ts
/** Session as persisted: no toasts, no spotlight state. */
export function serializeSession(state: DemoState): DemoState {
  return { ...state, toasts: [], fresh: {} };
}
```
In `loadSession` change the return to `return { ...stored.state, toasts: [], fresh: {} };` and in `saveSession` change `state: { ...state, toasts: [] },` to `state: serializeSession(state),`.

- [ ] **Step 6: Give the new tabs icons so `NAV_ICONS` still satisfies `Record<NavId, …>`**

In `components/demos/DemoOS.tsx` add `LifeBuoy` to the lucide import list and in `NAV_ICONS` add, before `settings`:
```ts
  boundaries: ShieldCheck,
  recovered: LifeBuoy,
```
(`ShieldCheck` is already imported.) The `view` switch has no default, so unknown tabs render nothing until Tasks 4 and 5.

- [ ] **Step 7: Run the tests and typecheck**

Run: `node --test tests/demo-engine.test.ts && npm run typecheck`
Expected: all engine tests PASS; typecheck clean. (`tests/realestate-demo.test.ts` asserts the config's nav covers exactly the old 13 ids — it still passes because realestate.ts hasn't changed yet.)

- [ ] **Step 8: Commit**

```bash
git add components/demos/types.ts components/demos/engine.ts components/demos/storage.ts components/demos/DemoOS.tsx tests/demo-engine.test.ts
git commit -m "Demo engine: boundary and recovery effects, fresh-entity tracking, schema v6

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Retire the gyms demo and make the slug list the single source of truth

**Files:**
- Delete: `components/demos/data/gym.ts`
- Modify: `lib/demo-request-schema.ts`, `components/demos/data/index.ts`, `app/sitemap.ts`, `next.config.mjs` (~line 58), `app/(marketing)/demos/page.tsx` (lines 12, 73), `lib/connect-defaults.ts` (line 82), `tests/demo-request.test.ts` (~line 94)

**Interfaces:**
- Produces: `export type DemoSlug = (typeof DEMO_REQUEST_SLUGS)[number]` in `lib/demo-request-schema.ts`; `DEMO_REQUEST_SLUGS = ["healthwellness", "contractors", "realestate"] as const`.

- [ ] **Step 1: Update the slug test first**

In `tests/demo-request.test.ts` change the `covers every live demo slug` assertion to:
```ts
    assert.deepEqual([...DEMO_REQUEST_SLUGS].sort(), [
      "contractors",
      "healthwellness",
      "realestate",
    ]);
```
Run: `node --test tests/demo-request.test.ts` → Expected: FAIL (still 4 slugs).

- [ ] **Step 2: Schema is the source of truth**

In `lib/demo-request-schema.ts` replace the `DEMO_REQUEST_SLUGS` block with:
```ts
/**
 * Slugs of live demos. This is the single source of truth: the demo registry
 * (components/demos/data/index.ts) is type-checked against it and the sitemap
 * derives from it, so adding or retiring a demo happens here first.
 */
export const DEMO_REQUEST_SLUGS = ["healthwellness", "contractors", "realestate"] as const;
export type DemoSlug = (typeof DEMO_REQUEST_SLUGS)[number];
```

- [ ] **Step 3: Registry checked against the slug list; delete gym**

```bash
git rm -q components/demos/data/gym.ts
```
Replace `components/demos/data/index.ts` entirely with:
```ts
import { healthwellnessConfig } from "./healthwellness";
import { contractorConfig } from "./contractor";
import { realestateConfig } from "./realestate";
import type { IndustryConfig } from "../types";
import { DEMO_REQUEST_SLUGS, type DemoSlug } from "@/lib/demo-request-schema";

/**
 * `satisfies` fails the build if a slug in DEMO_REQUEST_SLUGS has no config
 * or a config is registered under a slug the request API doesn't accept.
 */
const registry = {
  healthwellness: healthwellnessConfig,
  contractors: contractorConfig,
  realestate: realestateConfig,
} satisfies Record<DemoSlug, IndustryConfig>;

export const DEMO_CONFIGS: IndustryConfig[] = DEMO_REQUEST_SLUGS.map((slug) => registry[slug]);

export { healthwellnessConfig, contractorConfig, realestateConfig };

export function demoBySlug(slug: string): IndustryConfig | undefined {
  return DEMO_CONFIGS.find((c) => c.slug === slug);
}
```

- [ ] **Step 4: Sitemap derives from the slug list**

In `app/sitemap.ts` add `import { DEMO_REQUEST_SLUGS } from "@/lib/demo-request-schema";` and replace the four `/demos/<slug>` lines with:
```ts
    ...DEMO_REQUEST_SLUGS.map((slug) => ({ path: `/demos/${slug}`, priority: 0.7 })),
```

- [ ] **Step 5: Redirect and copy**

In `next.config.mjs`, directly after the `/demos/retail` redirect line add:
```js
      { source: "/demos/gyms", destination: "/demos", permanent: true },
```
In `app/(marketing)/demos/page.tsx`: line 12 description → `"Explore interactive operating system demos for health and wellness practices, contractors, and real estate teams: real workflows, pipelines, follow-up, and dashboards."`; line 73 → `Three industries. Three operating systems.`
In `lib/connect-defaults.ts` line 82 → `description: "Interactive operating systems for health & wellness practices, contractors, and real estate teams.",`

- [ ] **Step 6: Check nothing else references gym**

Run: `grep -rn "gymConfig\|/demos/gyms\|\"gyms\"" --include=*.ts --include=*.tsx --include=*.mjs app components lib tests next.config.mjs`
Expected: only the new redirect line in `next.config.mjs`.

- [ ] **Step 7: Gates**

Run: `node --test tests/demo-request.test.ts && npm run typecheck && npm test`
Expected: PASS. (`components/demos/data/shared.ts` still exists — contractor imports it until Task 7.)

- [ ] **Step 8: Commit**

```bash
git add lib/demo-request-schema.ts components/demos/data/index.ts app/sitemap.ts next.config.mjs "app/(marketing)/demos/page.tsx" lib/connect-defaults.ts tests/demo-request.test.ts
git commit -m "Retire the gyms demo; DEMO_REQUEST_SLUGS is the single slug source

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Quote view label/colour fix; delete dead sections

**Files:**
- Modify: `components/demos/ui/QuotesView.tsx` (lines ~102-118)
- Modify: `components/demos/sections.tsx` (delete `BuilderSection` lines 87-111 and `SystemBreakdown` lines 113-216; remove now-unused imports)

- [ ] **Step 1: Total label from config, deductions not green**

In `QuotesView.tsx` replace the line-item amount span:
```tsx
                    <span className={`tabular-nums ${l.amount < 0 ? "text-white/60" : "text-white/75"}`}>
```
and the total label:
```tsx
                  {q.totalLabel ?? "Estimated total"}
```

- [ ] **Step 2: Delete the dead exports**

Remove `export function BuilderSection…` and `export function SystemBreakdown…` from `components/demos/sections.tsx` in full. Run `npm run lint`; remove any import (`Check`, `ShieldCheck`, `Workflow`, `Inbox`, `Users`, `AutomationFlow`-only helpers) the linter now reports unused. Confirm with `grep -rn "BuilderSection\|SystemBreakdown" app components` → no matches.

- [ ] **Step 3: Gates and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add components/demos/ui/QuotesView.tsx components/demos/sections.tsx
git commit -m "Quotes: config-driven total label, neutral deductions; drop unrendered sections

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Boundaries tab view

**Files:**
- Create: `components/demos/ui/BoundariesView.tsx`
- Modify: `components/demos/DemoOS.tsx` (import + `case "boundaries"` in the `view` switch)
- Modify: `components/demos/RequestSystemDialog.tsx` (`SERVICE_OPTIONS` line 14, `FEATURE_HINTS` line 30)

**Interfaces:**
- Consumes: `ViewProps` from `./shared`; `state.boundaryEvents`, `config.boundaries`, `config.breakdown.teamControls`, `state.settings.staff`.
- Produces: `export function BoundariesView(props: ViewProps)`; `export function boundaryStats(events: BoundaryEvent[])` → `{ declined: number; routed: number; verified: number; disclosed: number }` (pure, exported for tests).

- [ ] **Step 1: Create the view**

```tsx
"use client";

import { ArrowRight, Ban, CheckCircle2, Route, ShieldCheck, UserCheck } from "lucide-react";
import type { BoundaryEvent, BoundaryOutcome, BoundaryRule } from "../types";
import { EmptyState, PanelHeading, SampleDataTag, StatusPill } from "./primitives";
import type { ViewProps } from "./shared";
import { trackEvent } from "@/lib/events";

export function boundaryStats(events: BoundaryEvent[]) {
  const stats = { declined: 0, routed: 0, verified: 0, disclosed: 0 };
  for (const e of events) stats[e.outcome] += 1;
  return stats;
}

const OUTCOME_META: Record<BoundaryOutcome, { label: string; tone: "red" | "amber" | "green" | "gray" }> = {
  declined: { label: "Declined", tone: "red" },
  routed: { label: "Routed to a person", tone: "amber" },
  verified: { label: "Identity verified", tone: "green" },
  disclosed: { label: "Disclosed up front", tone: "gray" },
};

function KindPill({ rule, staffName }: { rule: BoundaryRule; staffName?: string }) {
  if (rule.kind === "route") return <StatusPill tone="amber">Routes to {staffName ?? "staff"}</StatusPill>;
  if (rule.kind === "never") return <StatusPill tone="red">Never</StatusPill>;
  return <StatusPill tone="green">Always</StatusPill>;
}

export function BoundariesView({ state, config, track, openRequest }: ViewProps) {
  const boundaries = config.boundaries;
  const events = state.boundaryEvents;
  const stats = boundaryStats(events);
  const staffName = (id?: string) => state.settings.staff.find((s) => s.id === id)?.name;
  const countFor = (ruleId: string) => events.filter((e) => e.ruleId === ruleId).length;

  if (!boundaries) return <EmptyState text="No guardrails are configured for this demo." />;

  const cards = [
    { label: "Declined", value: stats.declined, Icon: Ban },
    { label: "Routed to a person", value: stats.routed, Icon: Route },
    { label: "Identity checks", value: stats.verified, Icon: UserCheck },
    { label: "Fees & terms disclosed", value: stats.disclosed, Icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-white/55">{boundaries.intro}</p>
        <SampleDataTag />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/40">
              <Icon size={11} className="text-rose-300/80" aria-hidden /> {label}
            </p>
            <p className="mt-2 text-xl font-medium tabular-nums text-white sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {boundaries.rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/85">{rule.label}</p>
                <div className="flex items-center gap-2">
                  <KindPill rule={rule} staffName={staffName(rule.routesTo)} />
                  <span className="text-[0.62rem] tabular-nums text-white/35">{countFor(rule.id)} this month</span>
                </div>
              </div>
              <p className="mt-1.5 text-[0.7rem] leading-relaxed text-white/50">{rule.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-2">
          <PanelHeading title="What stays human" />
          <ul className="space-y-2 px-4 py-3">
            {config.breakdown.teamControls.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.7rem] leading-relaxed text-white/60">
                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-400/70" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={`Guardrail log · ${events.length}`} />
        {events.length === 0 ? (
          <EmptyState text="Nothing yet. Take a call as the AI receptionist and ask it something it shouldn't answer." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {events.map((e) => {
              const rule = boundaries.rules.find((r) => r.id === e.ruleId);
              const meta = OUTCOME_META[e.outcome];
              return (
                <li key={e.id} data-spot-id={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/80">{e.summary}</p>
                    <p className="mt-0.5 text-[0.62rem] text-white/35">
                      {rule?.label ?? e.ruleId} · {e.source} · {e.at}
                    </p>
                  </div>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            trackEvent("demo_cta_click", { demo: config.slug, cta: "boundaries" });
            track("reviewed guardrails");
            openRequest({ source: "boundaries_view", feature: "Guardrails & compliance boundaries" });
          }}
          className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        >
          Add these guardrails to my system <ArrowRight size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}
```
(`data-spot-id` is a hook for Task 9's spotlight; harmless now.)

- [ ] **Step 2: Wire the tab in DemoOS**

Add `import { BoundariesView } from "./ui/BoundariesView";` and in the `view` switch, before `case "settings":`:
```tsx
      case "boundaries":
        return <BoundariesView {...viewProps} />;
```

- [ ] **Step 3: Request dialog knows about guardrails**

In `RequestSystemDialog.tsx` add `"Guardrails & compliance boundaries",` to `SERVICE_OPTIONS` after `"AI receptionist & missed-call recovery",` and add to `FEATURE_HINTS`:
```ts
  [/boundar|guardrail/i, /guardrail|compliance/i],
```

- [ ] **Step 4: Gates and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add components/demos/ui/BoundariesView.tsx components/demos/DemoOS.tsx components/demos/RequestSystemDialog.tsx
git commit -m "Demo OS: Boundaries tab (guardrail rules, log, what stays human)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Recovered tab view, overview widget, analytics KPI

**Files:**
- Create: `components/demos/ui/RecoveredView.tsx`
- Modify: `components/demos/ui/views.tsx` (`WIDGET_LABELS` line 111, Overview widget switch ~line 153, `AnalyticsView` `liveKpis` ~line 940)
- Modify: `components/demos/engine.ts` (`DEFAULT_WIDGETS` line 67)
- Modify: `components/demos/DemoOS.tsx` (import + `case "recovered"`)

**Interfaces:**
- Consumes: `deriveAnalytics(state).recoveredTotal / recoveredByTrigger`, `BarChart({ points, unit, accentLast })` from `./charts`, `formatMetric`.
- Produces: `export function RecoveredView(props: ViewProps)`; `export const TRIGGER_LABEL: Record<RecoveryTrigger, string>`.

- [ ] **Step 1: Create the view**

```tsx
"use client";

import { ArrowRight, LifeBuoy } from "lucide-react";
import { deriveAnalytics, formatMetric } from "../engine";
import type { RecoveryTrigger } from "../types";
import { BarChart } from "./charts";
import { EmptyState, PanelHeading, SampleDataTag } from "./primitives";
import type { ViewProps } from "./shared";
import { trackEvent } from "@/lib/events";

export const TRIGGER_LABEL: Record<RecoveryTrigger, string> = {
  "quote-followup": "Quote follow-up",
  "missed-call": "Missed call",
  "no-show": "No-show recovery",
  reactivation: "Reactivation",
  deadline: "Deadline watch",
  "after-hours": "After hours",
  referral: "Referral",
};

export function RecoveredView({ state, config, track, openRequest }: ViewProps) {
  const recovered = config.recovered;
  const derived = deriveAnalytics(state);
  const ledger = state.recoveries;
  const automationName = (id?: string) => state.automations.find((a) => a.id === id)?.name;

  if (!recovered) return <EmptyState text="No recovery ledger is configured for this demo." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs leading-relaxed text-white/55">{recovered.intro}</p>
        <SampleDataTag />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-5 lg:col-span-2">
          <p className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-emerald-300/80">
            <LifeBuoy size={11} aria-hidden /> Recovered this month
          </p>
          <p className="mt-2 text-3xl font-medium tabular-nums text-white">
            ${derived.recoveredTotal.toLocaleString()}
          </p>
          <p className="mt-1 text-[0.66rem] text-white/45">
            {ledger.length} {ledger.length === 1 ? "contact" : "contacts"} that had gone quiet
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 lg:col-span-3">
          <p className="mb-4 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">By trigger</p>
          {derived.recoveredByTrigger.length === 0 ? (
            <EmptyState text="Run a scenario to see where the recovered dollars come from." />
          ) : (
            <BarChart points={derived.recoveredByTrigger} unit="$" accentLast={false} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={`Ledger · ${ledger.length}`} />
        {ledger.length === 0 ? (
          <EmptyState text="Nothing recovered yet this session." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {ledger.map((r) => (
              <li key={r.id} data-spot-id={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/85">
                    {r.contact}
                    <span className="ml-2 text-[0.62rem] text-white/35">{TRIGGER_LABEL[r.trigger]}</span>
                  </p>
                  <p className="mt-0.5 text-[0.7rem] leading-relaxed text-white/55">{r.summary}</p>
                  <p className="mt-0.5 text-[0.62rem] text-white/35">
                    {r.silentFor}
                    {automationName(r.automationId) ? ` · ${automationName(r.automationId)}` : ""}
                    {` · ${r.at}`}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-emerald-300/90">
                  {formatMetric(r.amount, "currency")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[0.62rem] leading-relaxed text-white/35">
          How it is counted: {recovered.attributionRule}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            trackEvent("demo_cta_click", { demo: config.slug, cta: "recovered" });
            track("reviewed recovered revenue");
            openRequest({ source: "recovered_view", feature: "Automated follow-up sequences" });
          }}
          className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-crimson-light transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
        >
          See what this would recover for my business <ArrowRight size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Overview widget + default widget list**

In `engine.ts` `DEFAULT_WIDGETS` append `{ id: "recovered", visible: true },` after `pipeline`. In `views.tsx`:
- `WIDGET_LABELS` add `recovered: "Recovered revenue",`.
- In the Overview widget switch add, before `default:`:
```tsx
            case "recovered": {
              const recent = state.recoveries.slice(0, 3);
              return (
                <div key={w.id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04]">
                  <PanelHeading
                    title={`Recovered this month · $${derived.recoveredTotal.toLocaleString()}`}
                    right={<SampleDataTag />}
                  />
                  {recent.length === 0 ? (
                    <EmptyState text="Nothing recovered yet. Run the guided tour." />
                  ) : (
                    <ul className="divide-y divide-white/[0.05]">
                      {recent.map((r) => (
                        <li key={r.id} data-spot-id={r.id} className="flex items-center gap-3 px-4 py-2.5">
                          <p className="min-w-0 flex-1 truncate text-xs text-white/70">
                            {r.contact} <span className="text-white/35">· {r.silentFor}</span>
                          </p>
                          <span className="text-xs tabular-nums text-emerald-300/90">${r.amount.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            }
```
- In `AnalyticsView` `liveKpis` add a fifth entry `{ id: "lk-5", label: "Recovered this month", value: derived.recoveredTotal, format: "currency" }` and change that KPI grid class to `grid grid-cols-2 gap-3 lg:grid-cols-5`.

- [ ] **Step 3: Wire the tab in DemoOS**

`import { RecoveredView } from "./ui/RecoveredView";` and add `case "recovered": return <RecoveredView {...viewProps} />;` before `case "settings":`.

- [ ] **Step 4: Gates and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add components/demos/ui/RecoveredView.tsx components/demos/ui/views.tsx components/demos/engine.ts components/demos/DemoOS.tsx
git commit -m "Demo OS: Recovered tab, overview widget, and analytics KPI

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `healthwellness.ts` fidelity, boundaries, recovered + the config invariants test

**Files:**
- Create: `tests/demo-configs.test.ts`
- Modify: `components/demos/data/healthwellness.ts` (currently untracked; this task commits it)

**Interfaces:**
- Produces: `tests/demo-configs.test.ts` exports nothing; it holds a `CONFIGS` array that Tasks 7 and 8 append to.
- Consumes: `unknownVariables`, `TEMPLATE_VARIABLES`, `IndustryConfig`, `Effect`.

- [ ] **Step 1: Write the invariants test (fails on the current file)**

Create `tests/demo-configs.test.ts`:

```ts
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

const CONFIGS: IndustryConfig[] = [healthwellnessConfig];

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
```

Run: `node --test tests/demo-configs.test.ts` → Expected: FAIL on forbidden strings, tokens, opt-out, nav, boundaries, recovered, assignees.

- [ ] **Step 2: Fidelity edits (string replacements)**

Apply in `components/demos/data/healthwellness.ts`. Use `grep -n` to locate each; every "old" is verbatim from the current file.

| Where | Old | New |
|---|---|---|
| `c-dana-3` text | `Quick tip before your visit: avoid alcohol and blood thinners for 24 hours. Your intake form is here if you haven't finished it: aura.demo/intake` | `Carly will go over pre-visit prep with you at check-in. Your pre-visit form is here if you haven't finished it: aura.demo/intake` |
| everywhere | `intake form` (client-facing copy in messages, scenario details, tasks) | `pre-visit form` |
| metric label | `Lead response time` | `Inquiry response time` |
| metric + analytics kpi label | `Lead → consult rate` | `Inquiry → consult rate` |
| builderFlow | `Create Contact` | `Create Client Record` |
| scenario s-2 detail | `Maya becomes a contact with a source` | `Maya becomes a client record with a source` |
| activity | `New contact created from Instagram DM` | `New client record created from Instagram DM` |
| campaign camp-1 name/audience/filter | `Lapsed clients: 6 months` / `no visit in 180+ days` / `Last contact > 180 days` | `Lapsed clients: 90+ days` / `no visit in 90+ days` / `Last contact > 90 days` |
| activity | `sent to 38 contacts` | `sent to 112 contacts` |
| activity | `after microneedling session 2` | `after microneedling session 3` |
| calendar cal-5 title | `Wellness consult: walk-in inquiry follow-up` | `Wellness consult: Kelly Brandt (lab panel review)` |
| lead values | Dana `value: 480` → `660`; Stephanie `value: 750` → `650`; Amara `value: 620` → `575` | |
| quote Service option | `{ label: "Botox / Dysport (per area pricing below)", amount: 480 }` (match on the Botox label) | `amount: 360` |
| quote Areas | `Two areas` `+320` → `300`; `Three areas / full protocol` `+620` → `580` | |
| quote Service list | append `{ label: "Wellness consult & lab panel", amount: 350 }` | |
| quote membership option label | `Member pricing` | `Member pricing (−$90 this visit)` |
| quote | after `acceptedStageId: "treatment",` add `sentStageId: "completed",` | |
| campaigns `{first name}` | all three | `{first_name}` |
| campaigns messages | append ` Reply STOP to opt out.` to all three `message` strings | |
| breakdown.integrations | append `"HIPAA-compliant messaging (BAA on file)"` | |
| breakdown.teamControls | append `"Pre-visit and clinical instructions"` | |
| cta headline | unchanged | |

Staff-name normalisation (assignees, `withWhom`, task text may keep short forms but the `assignee`/`withWhom` fields must be full names):

| Old | New |
|---|---|
| `"Amanda (front desk)"` | `"Amanda Cruz"` |
| `"Carly, RN"` (as an assignee / withWhom value) | `"Carly Jensen, RN"` |
| `"Noelle, LE"` | `"Noelle Baptiste, LE"` |
| `"Devon, LMT"` | `"Devon Marsh, LMT"` |
| `"Dr. Reyes"` (as an assignee / withWhom value) | `"Dr. Lena Reyes"` |

Run `grep -n 'assignee: "\|withWhom: "' components/demos/data/healthwellness.ts` afterwards and confirm every value is one of the five staff names.

- [ ] **Step 3: Receptionist**

Replace `callerRole: "a first-time caller curious about IV therapy"` with `callerRole: "a caller reaching the practice at lunch"`. Rename choice ids `c-botox` → `c-iv`, `c-botox2` → `c-iv2`.

Replace the `resched` node with two nodes:
```ts
      {
        id: "resched",
        say: "I can help with that. I see an appointment under this number. Before I move anything, can you confirm the first name on the booking?",
        meta: "Verifies identity before discussing a booking",
        choices: [{ id: "c-verify", label: "It's Rachel.", next: "resched-verified" }],
      },
      {
        id: "resched-verified",
        say: "Thanks, Rachel. Your Thursday 1:00 PM Hydrafacial can move to Friday 11:00 AM or Saturday 10:00 AM. Which do you prefer?",
        meta: "Looks up the live schedule",
        choices: [
          { id: "c-fri", label: "Friday at 11, please.", next: "done-resched" },
          { id: "c-sat", label: "Saturday morning works.", next: "done-resched" },
        ],
      },
```
In `done-resched.outcome.effects` prepend:
```ts
            { kind: "boundary", ruleId: "identity", summary: "Caller asked to move a booking; the assistant confirmed the name on file before saying what the appointment was.", outcome: "verified" },
```
Change `reassure`'s choice to `next: "times-r"` and add after `times`:
```ts
      {
        id: "times-r",
        say: "Carly has Thursday 4:00 PM or Saturday 10:30 AM open for a free consultation. Which works better?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-thu-r", label: "Thursday at 4.", next: "done-booked-r" },
          { id: "c-sat-r", label: "Saturday at 10:30.", next: "done-booked-r" },
        ],
      },
```
Add `done-booked-r`: a copy of `done-booked` (same `say`, `summary`, and effects — the ids are idempotent) with two extra effects at the front:
```ts
            { kind: "boundary", ruleId: "clinical", summary: "Caller asked whether IV therapy is uncomfortable. The assistant kept to scheduling and left the medical answer to Carly, RN.", outcome: "routed" },
            { kind: "boundary", ruleId: "automated", summary: "Introduced itself as the practice's automated assistant before anything else.", outcome: "disclosed" },
```
In the original `done-booked.outcome.effects` prepend:
```ts
            { kind: "boundary", ruleId: "automated", summary: "Introduced itself as the practice's automated assistant before anything else.", outcome: "disclosed" },
            { kind: "recovery", event: { contact: "Maya Torres", amount: 175, silentFor: "Answered during a missed call, nobody free", trigger: "missed-call", summary: "First-time IV inquiry booked a free consult while the front desk was with a client.", automationId: "auto-1" } },
```
(`auto-1` is `Missed-call text-back`; confirm the id with `grep -n 'id: "auto-1"'`.)

- [ ] **Step 4: Nav, roles, boundaries, recovered**

`nav`: insert after `{ id: "analytics", label: "Analytics" },`:
```ts
    { id: "recovered", label: "Recovered" },
    { id: "boundaries", label: "Boundaries" },
```
Every `roles[].nav`: append `"recovered", "boundaries"`.

Add to the config object (after `breakdown`):
```ts
  boundaries: {
    intro: "The assistant books, reminds, and answers logistics. It refuses clinical questions, verifies who it's talking to, and says what it is. Every refusal is logged here so you can see the line being held.",
    rules: [
      { id: "clinical", label: "Never answers a clinical question", kind: "route", detail: "Dosing, contraindications, 'is it safe for me': routed to the nurse or medical director with the question attached.", routesTo: "staff-carly" },
      { id: "identity", label: "Always verifies the name on a booking before discussing it", kind: "always", detail: "No appointment details leave the practice until the caller confirms who they are." },
      { id: "automated", label: "Always identifies itself as automated", kind: "always", detail: "Opens every call and text as the practice's assistant, never as a staff member." },
      { id: "pricing", label: "Never quotes a treatment price as final", kind: "never", detail: "Starting prices only; the plan and the number come from the consult." },
      { id: "consent", label: "Never texts without consent on file", kind: "never", detail: "Marketing and reactivation go only to clients who ticked the box, and every campaign carries STOP." },
    ],
    seed: [
      { id: "bnd-seed-1", ruleId: "clinical", at: "Yesterday 4:10 PM", summary: "DM asked whether Botox is safe while breastfeeding. Routed to Carly, RN with the thread attached.", outcome: "routed", source: "conversation" },
      { id: "bnd-seed-2", ruleId: "pricing", at: "Yesterday 11:02 AM", summary: "Instagram DM pushed for a firm filler price. Gave the starting price and booked a consult instead.", outcome: "declined", source: "automation" },
      { id: "bnd-seed-3", ruleId: "consent", at: "Monday 9:00 AM", summary: "Reactivation batch skipped 14 lapsed clients with no consent on file.", outcome: "declined", source: "automation" },
    ],
  },
  recovered: {
    intro: "Every inquiry that had gone quiet, or arrived when nobody could answer, and became a booking because the system acted. Pipelines show what's alive; this shows what would have died.",
    attributionRule: "counted when a contact who had gone quiet for 48 hours or more re-engaged within 24 hours of an automated touch and advanced a stage, or when an inquiry that arrived with nobody free to answer was booked by the assistant.",
    seed: [
      { id: "rec-seed-1", at: "Yesterday", contact: "Rachel Nguyen", amount: 540, silentFor: "Missed call, answered in 42 s", trigger: "missed-call", summary: "Hydrafacial series consult booked from a missed-call text-back.", automationId: "auto-1" },
      { id: "rec-seed-2", at: "2 days ago", contact: "Kelly Brandt", amount: 350, silentFor: "Quiet 4 months", trigger: "reactivation", summary: "Replied to the lapsed-client campaign and re-entered the pipeline.", automationId: "auto-4" },
      { id: "rec-seed-3", at: "Friday", contact: "Grace Kim", amount: 540, silentFor: "Quiet 6 days after consult", trigger: "quote-followup", summary: "Consult no-book recovery text landed; Hydrafacial series scheduled." },
      { id: "rec-seed-4", at: "Thursday", contact: "Lauren Petti", amount: 115, silentFor: "No-show, recovered same day", trigger: "no-show", summary: "Missed a massage; friendly recovery text rebooked her for Saturday.", automationId: "auto-3" },
      { id: "rec-seed-5", at: "Wednesday", contact: "Tomas Reyes", amount: 1200, silentFor: "Arrived 9:40 PM", trigger: "after-hours", summary: "IV package inquiry came in after close; consult booked before morning.", automationId: "auto-2" },
      { id: "rec-seed-6", at: "Last week", contact: "Jade Coleman", amount: 650, silentFor: "Quiet 3 days", trigger: "quote-followup", summary: "Filler pricing question went cold; day-3 follow-up brought her back to book.", automationId: "auto-2" },
      { id: "rec-seed-7", at: "Last week", contact: "Monica Álvarez", amount: 900, silentFor: "Quiet 5 months", trigger: "reactivation", summary: "Microneedling series client reactivated for a maintenance round.", automationId: "auto-4" },
    ],
  },
```
(`staff-carly` must be Carly's actual `staff[].id`; check with `grep -n 'name: "Carly'` and use whatever id the file has. Same for `auto-2` = DM capture, `auto-3` = no-show, `auto-4` = reactivation; confirm ids.)

- [ ] **Step 5: Tour step + recovery in the tour**

Insert a new step after `s-8` (renumber nothing; ids are strings):
```ts
      {
        id: "s-8b",
        title: "What the assistant refused to do",
        detail: "Maya asked in the DM whether IV therapy is safe with her medication. The system didn't guess; it routed the question to Carly and kept booking. That refusal is a feature, and it's logged.",
        tab: "boundaries",
        effects: [
          { kind: "message", conversationId: "c-maya", message: { id: "m-8b", from: "contact", text: "Also, is it ok with the iron supplement I'm on?", time: "Just now" } },
          { kind: "message", conversationId: "c-maya", message: { id: "m-8c", from: "system", meta: "Automated · Clinical question routed", text: "Good question, and one for Carly rather than me. I've passed it to her with your consult notes; she'll answer before Tuesday.", time: "Just now" } },
          { kind: "boundary", ruleId: "clinical", summary: "Maya asked about a supplement interaction. Routed to Carly, RN; no answer given by the assistant.", outcome: "routed", source: "scenario" },
          { kind: "task", task: { id: "t-maya-clinical", title: "Answer Maya Torres: iron supplement and IV therapy (clinical question from DM)", assignee: "Carly Jensen, RN", due: "Mon", priority: "high", auto: true } },
        ],
      },
```
In `s-6` effects append:
```ts
          { kind: "recovery", event: { contact: "Maya Torres", amount: 175, silentFor: "DM answered in 40 s while staff were busy", trigger: "missed-call", summary: "Instagram inquiry converted to a booked consult with zero staff time.", automationId: "auto-2" } },
```
`sim-missed-call` effects append:
```ts
        { kind: "boundary", ruleId: "clinical", summary: "Sarah Bennett asked which drip is right for her. Routed to Carly, RN as a task; the text-back only offered booking.", outcome: "routed", source: "automation" },
        { kind: "recovery", event: { contact: "Sarah Bennett", amount: 175, silentFor: "Missed call, answered in 38 s", trigger: "missed-call", summary: "Unanswered call recovered by text; clinical question routed, booking offered.", automationId: "auto-1" } },
```

- [ ] **Step 6: Run the invariants, then all gates**

Run: `node --test tests/demo-configs.test.ts`
Expected: PASS for healthwellness. Fix whatever it still reports (it prints the exact offending string) before moving on.
Run: `npm run typecheck && npm test`

- [ ] **Step 7: Commit**

```bash
git add tests/demo-configs.test.ts components/demos/data/healthwellness.ts
git commit -m "Health & wellness demo: clinical boundary, identity check, rate-card fidelity, recovered ledger

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `contractor.ts` — author the stubbed sections, fidelity, boundaries, recovered; delete `shared.ts`

**Files:**
- Modify: `components/demos/data/contractor.ts`
- Delete: `components/demos/data/shared.ts`
- Modify: `components/demos/defaults.ts` (header comment)
- Modify: `tests/demo-configs.test.ts` (add contractor to `CONFIGS`)

- [ ] **Step 1: Add contractor to the invariants test**

```ts
import { contractorConfig } from "../components/demos/data/contractor.ts";
const CONFIGS: IndustryConfig[] = [healthwellnessConfig, contractorConfig];
```
Run: `node --test tests/demo-configs.test.ts` → Expected: FAIL (it will actually fail at import time: `./shared` has no extension). That's the first thing Step 2 fixes.

- [ ] **Step 2: Remove the stub imports and author the sections**

Delete the `import { DEMO_APPOINTMENT_TYPES, … } from "./shared";` block at the top of `contractor.ts`. Then:

`terminology` (line ~35) → `terminology: { record: "lead", records: "Leads", appointment: "Estimate", appointments: "Estimates" },`

`staff` (lines 43-46) →
```ts
    { id: "staff-mike", name: "Mike Hartwell", role: "Owner & sales" },
    { id: "staff-dave", name: "Dave Kessler", role: "Estimator" },
    { id: "staff-sam", name: "Sam Ortiz", role: "Crew lead" },
    { id: "staff-jenna", name: "Jenna Price", role: "Office manager" },
```
Then replace across the file: `"Mike (sales)"` → `"Mike Hartwell"`, `"Dave (estimator)"` → `"Dave Kessler"`, `"Sam (crew lead)"` → `"Sam Ortiz"`, `assignee: "Office"` → `assignee: "Jenna Price"`, `withWhom: "Mike + Sam"` → `withWhom: "Mike Hartwell + Sam Ortiz"`, `withWhom: "Crew A · Sam Ortiz"` stays.

`templates: DEMO_TEMPLATES,` →
```ts
  templates: [
    { id: "tpl-confirm", name: "Estimate confirmation", channel: "sms", tone: "professional", text: "Hi {first_name}, you're confirmed for a {service} estimate on {appointment_date} at {appointment_time}. {staff_name} will text when on the way. Hartwell is licensed and insured." },
    { id: "tpl-otw", name: "On-the-way", channel: "sms", tone: "friendly", text: "Good morning {first_name}: {staff_name} is on the way to {location} and should arrive around {appointment_time}. Look for the gray Hartwell truck." },
    { id: "tpl-quote", name: "Quote delivery", channel: "sms", tone: "professional", text: "Hi {first_name}, your {service} quote from {business_name} is ready: {booking_link}. {staff_name} is happy to walk through it; just reply here with any questions." },
    { id: "tpl-day2", name: "Day-2 follow-up", channel: "sms", tone: "conversational", text: "Hi {first_name}, checking in on the {service} quote we sent. Happy to adjust scope or phase the work if that helps. Want {staff_name} to give you a call?" },
    { id: "tpl-scheduled", name: "Job scheduled", channel: "email", tone: "professional", text: "Hi {first_name}, your {service} is scheduled to start {appointment_date}. Materials arrive the day before. Your crew lead is {staff_name}; they'll introduce themselves on day one." },
    { id: "tpl-invoice", name: "Completion & invoice", channel: "sms", tone: "premium", text: "Hi {first_name}, your {service} is complete and the crew walked the punch list. Final invoice ({estimate_amount}): {booking_link}. Card or ACH both work. Thank you for choosing {business_name}." },
  ],
```
`intakeFields: DEMO_INTAKE_FIELDS,` →
```ts
  intakeFields: [
    { id: "name", label: "Full name", type: "text", required: true },
    { id: "phone", label: "Mobile number", type: "phone", required: true, helper: "For estimate confirmations and on-the-way texts (simulated)" },
    { id: "email", label: "Email", type: "email" },
    { id: "project", label: "Project type", type: "select", required: true, options: ["Kitchen remodel", "Bathroom renovation", "Deck or porch", "Roof replacement", "Siding or gutters", "Windows", "Basement finish", "Repair / other"] },
    { id: "address", label: "Property address", type: "text", required: true, helper: "So we can route the estimator who covers your area" },
    { id: "budget", label: "Budget range", type: "select", options: ["Under $5,000", "$5,000–$15,000", "$15,000–$40,000", "$40,000+", "Not sure yet"] },
    { id: "timeline", label: "Timeline", type: "select", options: ["ASAP / emergency", "2–4 weeks", "1–3 months", "Just planning"] },
    { id: "details", label: "Project details & photos", type: "textarea", helper: "Photos help us price faster; you can text them after you submit." },
    { id: "consent", label: "OK to text me about my estimate", type: "checkbox" },
  ],
```
`appointmentTypes: DEMO_APPOINTMENT_TYPES,` →
```ts
  appointmentTypes: [
    { id: "apt-estimate", label: "Free estimate", duration: 60 },
    { id: "apt-measure", label: "On-site measure", duration: 45 },
    { id: "apt-storm", label: "Storm-damage inspection", duration: 45 },
    { id: "apt-precon", label: "Pre-construction walkthrough", duration: 60 },
    { id: "apt-punch", label: "Punch-list walkthrough", duration: 30 },
  ],
```
`scheduleDays: DEMO_SCHEDULE_DAYS,` →
```ts
  scheduleDays: [
    { day: "Thu", date: "Jul 16" },
    { day: "Fri", date: "Jul 17" },
    { day: "Sat", date: "Jul 18" },
    { day: "Mon", date: "Jul 20" },
    { day: "Tue", date: "Jul 21" },
  ],
```
`sampleCustomer: DEMO_SAMPLE_CUSTOMER,` →
```ts
  sampleCustomer: {
    first_name: "Brian",
    service: "Deck renovation",
    location: "42 Colonial Dr",
    appointment_date: "Saturday, Jul 18",
    appointment_time: "10:00 AM",
    estimate_amount: "$19,500",
  },
```
Add after `builderFlow`:
```ts
  requestServices: [
    "Missed-call & after-hours capture",
    "Estimate scheduling & on-the-way texts",
    "Quote follow-up sequences",
    "Crew scheduling & customer job updates",
    "Invoice & payment follow-up",
    "Post-job reviews",
    "Past-customer reactivation routes",
    "Lead source reporting",
    "Guardrails & compliance boundaries",
  ],
  requestExtras: [
    { id: "trade", label: "Primary trade", options: ["General remodeling", "Roofing & siding", "Decks & outdoor", "Plumbing / HVAC / electrical", "Multi-trade"] },
    { id: "crew", label: "Crew size", options: ["Just me", "2–5", "6–15", "16+"] },
    { id: "volume", label: "Estimate requests per month", options: ["Under 20", "20–60", "60–150", "150+"] },
    { id: "software", label: "What do you run today?", options: ["ServiceTitan", "Jobber", "Housecall Pro", "JobNimbus", "Buildertrend", "Spreadsheets & texts", "Something else"], helper: "We connect to what you already run rather than replacing it." },
  ],
```

- [ ] **Step 3: Fidelity string edits**

| Where | Old | New |
|---|---|---|
| lead Mark Sullivan | `value: 6500` | `value: 1400` |
| quote Service option | `"Siding repair"` `amount: 4200` | `amount: 1900` |
| quote base label | `Site visit, permits & project management` | `Site visit, permits (where required) & project management` |
| metric label | `Jobs won this month` | `Jobs sold this month` |
| scenario `sc-mc-6` effects | `{ kind: "metric", id: "jobs-won", delta: 1 }` | `{ kind: "metric", id: "estimates", delta: 1 }` (confirm the metric id for "Estimates scheduled" with `grep -n '"estimates"'`) |
| camp-3 message | `to keep the warranty happy` | `to keep it looking new` |
| camp-2 filter | `Service: roofing / siding / gutters` | `Service: any exterior work` |
| sc-re-2 detail | `completed last quarter` | `windows done 14 months ago` |
| sim-followup message | the day-10 `Final check-in` text | meta `Automated · Day-5 follow-up`, text `Hi Doug, quick check-in on the bathroom quote. If budget's the sticking point, Mike has a couple of ideas to trim it. Want him to call?` |
| campaigns tokens | `{first name}` → `{first_name}`, `{project}` → `{service}`, `{date}` → `{appointment_date}` | |
| campaigns messages | append ` Reply STOP to opt out.` | |
| breakdown.integrations | replace `"Field service management software"` and `"CRM platforms"` with `"Field service software (ServiceTitan, Jobber, Housecall Pro, JobNimbus, Buildertrend)"`, `"Photo documentation (CompanyCam)"`, `"QuickBooks"` | |
| `done-roof` and `done-deck` `say` | append ` Hartwell is licensed and insured.` before the closing sentence | |

- [ ] **Step 4: Receptionist branches that respect the answer**

In `triage`, change `c-drip` to `next: "address-minor"`. In `deck-size`, change `c-deck-wood` to `next: "deck-book-small"`. In `book`, replace the `say` and the tonight choice:
```ts
        say: "Thanks: Dave covers Marshfield. I can have him out tomorrow at 8:00 AM to tarp and inspect, or I can page the emergency line tonight for a $250 after-hours dispatch fee, credited toward the repair if you go ahead with us. Which works better?",
        …
          { id: "c-tonight", label: "Please send someone tonight. The $250 is fine.", next: "done-roof-tonight" },
```
Add nodes:
```ts
      {
        id: "address-minor",
        say: "Got it: a slow drip is worth catching early but it isn't an emergency. What's the property address so I can route the right estimator?",
        meta: "Collects job details",
        choices: [{ id: "c-addr-minor", label: "42 Colonial Drive, Marshfield.", next: "book-minor" }],
      },
      {
        id: "book-minor",
        say: "Thanks: Dave covers Marshfield. He can inspect and tarp tomorrow at 8:00 AM, and there's no after-hours fee for a next-morning visit. Shall I book it?",
        meta: "Checks the live schedule",
        choices: [{ id: "c-morning-minor", label: "Tomorrow at 8 AM works.", next: "done-roof-minor" }],
      },
      {
        id: "done-roof-minor",
        say: "You're booked: roof leak inspection, tomorrow 8:00 AM at 42 Colonial Drive with Dave. I've texted your confirmation and sent Dave the notes. Hartwell is licensed and insured. If it gets worse overnight, reply here and I'll page the on-call line.",
        outcome: {
          summary: [
            "A lead was created with the address and the minor-leak notes attached.",
            "Tomorrow's 8:00 AM inspection was booked onto Dave's schedule with no after-hours fee.",
            "The call transcript landed in Conversations.",
          ],
          effects: [
            { kind: "boundary", ruleId: "safety", summary: "Water intrusion reported. Triaged as minor, booked for the on-call estimator's first slot; escalation path offered if it worsens.", outcome: "routed" },
            { kind: "boundary", ruleId: "fees", summary: "Told the caller a next-morning visit carries no after-hours fee before booking it.", outcome: "disclosed" },
            { kind: "lead", lead: { id: "l-ai-roof-minor", name: "Pat Delaney", service: "Roof leak: slow drip near window", source: "After-hours call", stageId: "est-scheduled", value: 3200, lastActivity: "Just now", temp: "warm", note: "Slow drip near bedroom window · 42 Colonial Dr, Marshfield · AI receptionist booked 8 AM inspection", assignee: "Dave Kessler" } },
            { kind: "calendar", event: { id: "cal-ai-roof-minor", day: "Fri", date: "Jul 17", time: "8:00 AM", title: "Roof leak inspection: Pat Delaney", withWhom: "Dave Kessler", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-roof-minor", contact: "Pat Delaney", channel: "phone", topic: "After-hours call: roof leak (minor)", unread: true, messages: [
              { id: "ai-rm-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call handled: slow roof drip near a bedroom window at 42 Colonial Dr, Marshfield. Inspection booked Fri 8:00 AM with Dave, no after-hours fee. Caller told to reply if it worsens.", time: "Just now" },
            ] } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "metric", id: "estimates", delta: 1 },
            { kind: "recovery", event: { contact: "Pat Delaney", amount: 3200, silentFor: "Called 9:40 PM, office closed", trigger: "after-hours", summary: "Roof drip caught after hours and booked for first thing tomorrow." } },
            { kind: "notify", notification: { id: "n-ai-roof-minor", title: "After-hours call converted", body: "Pat Delaney: slow roof drip booked for 8 AM. No fee, no human touched it.", tone: "success" } },
          ],
        },
      },
      {
        id: "deck-book-small",
        say: "Nice, a 180 square foot pressure-treated deck is a quick measure. Dave has Saturday 10:00 AM or Tuesday 1:30 PM open. Which suits you?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-deck-small-sat", label: "Saturday at 10 works.", next: "done-deck-small" },
          { id: "c-deck-small-tue", label: "Tuesday afternoon, please.", next: "done-deck-small" },
        ],
      },
      {
        id: "done-deck-small",
        say: "You're all set: estimate visit booked with Dave. I've texted the confirmation, and you can reply with photos any time to speed up the quote. Hartwell is licensed and insured. Thanks for calling!",
        outcome: {
          summary: [
            "A deck-estimate lead was created with the size and material you gave.",
            "The estimate visit was booked on Dave's schedule with confirmation and reminders queued.",
            "The transcript is in Conversations, so the visit starts with the right numbers.",
          ],
          effects: [
            { kind: "boundary", ruleId: "site-visit", summary: "Caller wanted a deck price on the phone. The assistant captured size and material and booked a measure instead of guessing.", outcome: "declined" },
            { kind: "lead", lead: { id: "l-ai-deck-small", name: "Chris Nolan", service: "Deck rebuild: 180 sq ft pressure-treated", source: "After-hours call", stageId: "est-scheduled", value: 7400, lastActivity: "Just now", temp: "warm", note: "~180 sq ft pressure-treated · booked via AI receptionist after hours", assignee: "Dave Kessler" } },
            { kind: "calendar", event: { id: "cal-ai-deck-small", day: "Sat", date: "Jul 18", time: "10:00 AM", title: "Deck estimate: Chris Nolan", withWhom: "Dave Kessler", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-deck-small", contact: "Chris Nolan", channel: "phone", topic: "After-hours call: deck estimate", messages: [
              { id: "ai-ds-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call handled: ~180 sq ft pressure-treated deck rebuild. Estimate visit booked Sat 10:00 AM with Dave. Photo request sent by text. No price given before the site visit.", time: "Just now" },
            ] } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "metric", id: "estimates", delta: 1 },
            { kind: "recovery", event: { contact: "Chris Nolan", amount: 7400, silentFor: "Called 9:40 PM, office closed", trigger: "after-hours", summary: "Deck estimate captured after hours instead of going to voicemail." } },
            { kind: "notify", notification: { id: "n-ai-deck-small", title: "After-hours estimate booked", body: "Chris Nolan: 180 sq ft deck, Saturday 10 AM. Captured while everyone slept.", tone: "success" } },
          ],
        },
      },
```
Prepend to the existing `done-roof.outcome.effects`:
```ts
            { kind: "boundary", ruleId: "safety", summary: "Steady water intrusion reported. Flagged for the on-call estimator and booked into the first available slot.", outcome: "routed" },
            { kind: "recovery", event: { contact: "Pat Delaney", amount: 8500, silentFor: "Called 9:40 PM, office closed", trigger: "after-hours", summary: "Storm-damage inspection booked overnight; the caller never reached a competitor's voicemail." } },
```
Prepend to `done-roof-tonight.outcome.effects`:
```ts
            { kind: "boundary", ruleId: "fees", summary: "Quoted the $250 after-hours dispatch fee and got a yes before paging the on-call line.", outcome: "disclosed" },
            { kind: "boundary", ruleId: "safety", summary: "Steady leak into a bedroom: escalated to emergency dispatch rather than a next-day slot.", outcome: "routed" },
```
Prepend to `done-deck.outcome.effects`:
```ts
            { kind: "boundary", ruleId: "site-visit", summary: "Caller wanted a deck price on the phone. The assistant captured size and material and booked a measure instead of guessing.", outcome: "declined" },
            { kind: "recovery", event: { contact: "Chris Nolan", amount: 16800, silentFor: "Called 9:40 PM, office closed", trigger: "after-hours", summary: "Composite deck estimate captured after hours instead of going to voicemail." } },
```
Also fix `done-roof-tonight`'s `say`: remove `Your details and photos link are already in the job record.` and replace with `I've texted you a link to send photos if you can.`

- [ ] **Step 5: Nav, roles, boundaries, recovered, tour step**

`nav`: insert `{ id: "recovered", label: "Recovered" }, { id: "boundaries", label: "Boundaries" },` after the analytics entry. Append `"recovered", "boundaries"` to every `roles[].nav`.

Add after `breakdown`:
```ts
  boundaries: {
    intro: "The assistant captures, schedules, and follows up. It never prices a job it hasn't seen, it says what a call-out costs before booking it, and it routes anything unsafe to a person. Every one of those moments is logged here.",
    rules: [
      { id: "site-visit", label: "Never commits to a final price before a site visit", kind: "never", detail: "Ballparks come from the calculator with a disclaimer; the number that counts comes from Dave standing on the property." },
      { id: "fees", label: "Always discloses after-hours or dispatch fees before booking", kind: "always", detail: "The $250 emergency dispatch fee is stated, and accepted, before anyone is paged." },
      { id: "safety", label: "Routes anything unsafe to the on-call estimator", kind: "route", detail: "Active leaks, electrical, structural, gas: flagged and escalated, never scheduled like a routine estimate.", routesTo: "staff-dave" },
      { id: "automated", label: "Always identifies itself as automated", kind: "always", detail: "Opens every call and text as Hartwell's assistant, never as Mike or Dave." },
      { id: "consent", label: "Never texts a cold list without consent on file", kind: "never", detail: "Reactivation and seasonal routes go only to past customers who opted in, and every campaign carries STOP." },
    ],
    seed: [
      { id: "bnd-seed-1", ruleId: "site-visit", at: "Yesterday 6:20 PM", summary: "Website chat asked for a firm kitchen price from photos. Gave the calculator range and booked a walkthrough.", outcome: "declined", source: "conversation" },
      { id: "bnd-seed-2", ruleId: "safety", at: "Yesterday 11:35 AM", summary: "Storm-damage text mentioned a sagging ceiling. Escalated to Dave as urgent instead of the estimate queue.", outcome: "routed", source: "automation" },
      { id: "bnd-seed-3", ruleId: "consent", at: "Friday 8:00 AM", summary: "Seasonal gutter route skipped 31 past customers with no text consent on file.", outcome: "declined", source: "automation" },
    ],
  },
  recovered: {
    intro: "Every quote that went quiet and came back, every call that rang out and still became a job. Pipelines show what's alive; this shows what would have died.",
    attributionRule: "counted when a homeowner who had gone quiet for 48 hours or more re-engaged within 24 hours of an automated touch and advanced a stage, or when a call that rang out was booked by the text-back or the assistant.",
    seed: [
      { id: "rec-seed-1", at: "Yesterday", contact: "Carrie Webb", amount: 54000, silentFor: "Quiet 5 days", trigger: "quote-followup", summary: "Basement finish quote approved after the day-5 check-in.", automationId: "auto-2" },
      { id: "rec-seed-2", at: "2 days ago", contact: "Mark Sullivan", amount: 1400, silentFor: "Missed call, answered in 45 s", trigger: "missed-call", summary: "Storm siding repair captured by text-back while the crews were on a roof.", automationId: "auto-3" },
      { id: "rec-seed-3", at: "Friday", contact: "Lisa Chen", amount: 950, silentFor: "Quiet 14 months", trigger: "reactivation", summary: "Past window customer booked a gutter and roof check from the seasonal route.", automationId: "auto-6" },
      { id: "rec-seed-4", at: "Thursday", contact: "Greg Thornton", amount: 2100, silentFor: "Quiet 11 months", trigger: "reactivation", summary: "Deck customer took the wash-and-reseal offer.", automationId: "auto-6" },
      { id: "rec-seed-5", at: "Wednesday", contact: "Alan Reyes", amount: 9200, silentFor: "Quiet 6 weeks", trigger: "quote-followup", summary: "May fence quote revived by the unclosed-estimates campaign.", automationId: "auto-2" },
      { id: "rec-seed-6", at: "Last week", contact: "Dana Whitcomb", amount: 12400, silentFor: "Called 8:15 PM, office closed", trigger: "after-hours", summary: "Window replacement estimate booked by the assistant after hours." },
      { id: "rec-seed-7", at: "Last week", contact: "Paul Carter", amount: 18500, silentFor: "Quiet 3 days", trigger: "quote-followup", summary: "Roof quote approved after the day-2 nudge offered to phase the work.", automationId: "auto-2" },
    ],
  },
```
(`staff-dave` is Dave's id from Step 2. `auto-2` = Quote follow-up, `auto-3` = Missed-call, `auto-6` = Maintenance reactivation; confirm with `grep -n 'id: "auto-'`.)

Tour: insert after `s-8`:
```ts
      {
        id: "s-8b",
        title: "What the assistant refused to do",
        detail: "Brian asked in the thread whether the quote could 'just be $17k if we skip the permit'. The system didn't negotiate and didn't skip anything: it routed the question to Mike and logged the refusal. That's the guardrail, and you can see every one it holds.",
        tab: "boundaries",
        effects: [
          { kind: "message", conversationId: "c-brian", message: { id: "bk-3b", from: "contact", text: "Could you do $17k if we skip the permit part?", time: "Just now" } },
          { kind: "message", conversationId: "c-brian", message: { id: "bk-3c", from: "system", meta: "Automated · Pricing question routed", text: "That's one for Mike, not me. I've passed it along with your quote; he'll call you today. The permit line stays on every deck we build.", time: "Just now" } },
          { kind: "boundary", ruleId: "site-visit", summary: "Homeowner asked to cut the price by dropping permits. Routed to Mike; no discount and no scope change offered by the assistant.", outcome: "routed", source: "scenario" },
          { kind: "task", task: { id: "t-brian-price", title: "Call Brian Kowalski: pricing question on the deck quote (asked to skip permits)", assignee: "Mike Hartwell", due: "Today", priority: "high", auto: true } },
        ],
      },
```
Check the tour's conversation id for Brian with `grep -n 'contact: "Brian'` and use that id instead of `c-brian` if it differs.

Recovery effects: in `s-9` append
```ts
          { kind: "recovery", event: { contact: "Brian Kowalski", amount: 19500, silentFor: "Quiet 2 days", trigger: "quote-followup", summary: "Deck quote approved after the day-2 follow-up nobody had to remember to send.", automationId: "auto-2" } },
```
`sc-q-4` append `{ kind: "recovery", event: { contact: "Anita Patel", amount: 19800, silentFor: "Quiet 2 days", trigger: "quote-followup", summary: "320 sq ft deck quote approved after the automated nudge.", automationId: "auto-2" } },`
`sc-mc-6` append `{ kind: "recovery", event: { contact: "Rosa Alvarez", amount: 2400, silentFor: "Missed call, answered in 60 s", trigger: "missed-call", summary: "Cracked-stairs repair booked from a call that rang out while the crew was on a roof.", automationId: "auto-3" } },`
`sc-re-3` append `{ kind: "recovery", event: { contact: "Lisa Chen", amount: 950, silentFor: "Quiet 14 months", trigger: "reactivation", summary: "Past customer booked onto the neighborhood route from one automated text.", automationId: "auto-6" } },`
`sim-missed-call` append `{ kind: "recovery", event: { contact: "Janet Kowar", amount: 3800, silentFor: "Missed call, answered in 41 s", trigger: "missed-call", summary: "Gutter replacement inquiry recovered by text-back.", automationId: "auto-3" } },`
`sim-followup` append `{ kind: "recovery", event: { contact: "Doug Freeman", amount: 23000, silentFor: "Quiet 5 days", trigger: "quote-followup", summary: "Bathroom quote revived; Doug asked Mike to call about trimming scope.", automationId: "auto-2" } },`
`sim-reactivation` append `{ kind: "recovery", event: { contact: "Fence quote from May", amount: 9200, silentFor: "Quiet 8 weeks", trigger: "reactivation", summary: "Unclosed-estimates campaign brought back a $9,200 fence quote.", automationId: "auto-6" } },`

- [ ] **Step 6: Delete `shared.ts`, fix the defaults comment**

```bash
git rm -q components/demos/data/shared.ts
grep -rn "data/shared\|\./shared" components/demos   # expected: no matches
```
In `components/demos/defaults.ts` change the header to `/** Safe defaults for optional IndustryConfig fields so a partial config still runs without runtime crashes. */`.

- [ ] **Step 7: Gates**

Run: `node --test tests/demo-configs.test.ts && npm run typecheck && npm test`
Expected: PASS for both configs. Fix whatever the invariants report.

- [ ] **Step 8: Commit**

```bash
git add components/demos/data/contractor.ts components/demos/defaults.ts tests/demo-configs.test.ts
git commit -m "Contractor demo: author templates/intake/appointments, branch-true receptionist, fee disclosure, guardrails, recovered ledger

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `realestate.ts` fidelity, boundaries, recovered

**Files:**
- Modify: `components/demos/data/realestate.ts` (currently untracked; this task commits it)
- Modify: `tests/demo-configs.test.ts` (add realestate to `CONFIGS`)
- Modify: `tests/realestate-demo.test.ts` (`ALL_NAV_IDS` gains `"boundaries", "recovered"`; any assertion on dates/names changed below)

- [ ] **Step 1: Add realestate to the invariants; update the nav list in the existing test**

```ts
import { realestateConfig } from "../components/demos/data/realestate.ts";
const CONFIGS: IndustryConfig[] = [healthwellnessConfig, contractorConfig, realestateConfig];
```
In `tests/realestate-demo.test.ts` add `"boundaries", "recovered"` to `ALL_NAV_IDS`.
Run: `node --test tests/demo-configs.test.ts tests/realestate-demo.test.ts` → Expected: FAIL.

- [ ] **Step 2: Automated messages stop impersonating licensees**

| Where | Old (verbatim fragment) | New |
|---|---|---|
| `tpl-1` text, `auto-0.message` | `Hi {first_name}, this is {staff_name} at {business_name} — you just asked about {location}.` | `Hi {first_name}, this is {business_name}'s assistant for {staff_name}. You just asked about {location}.` |
| `auto-2.message` | `Hi {first_name}, this is {business_name} — sorry we missed your call about {location}.` | `Hi {first_name}, this is {business_name}'s automated assistant. Sorry we missed your call about {location}.` |
| `auto-6.message`, `camp-2.message` | `Hi {first_name}, it's {staff_name} at {business_name}. Nothing urgent` | `Hi {first_name}, {staff_name} at {business_name} asked me to check in. Nothing urgent` |
| `c-boyd-1` text | `Hi Trevor, this is Dev with Harborline Realty Group — you just asked about` | `Hi Trevor, this is Harborline Realty Group's assistant for Dev. You just asked about` |
| `sim-portal-lead` message | `Hi Kara, this is Dev at Harborline Realty Group — you just asked about 41 Bayberry Rd.` | `Hi Kara, this is Harborline Realty Group's assistant for Dev. You just asked about 41 Bayberry Rd.` |
| all three campaigns | append ` Reply STOP to opt out.` | |

- [ ] **Step 3: Date and record contradictions**

| Where | Old | New |
|---|---|---|
| `cal-3` | `day: "Fri", date: "Oct 17", time: "11:00 AM"` | `day: "Thu", date: "Oct 16", time: "11:00 AM"` (keep note `Contingency expires today at 5:00 PM`) |
| activity | `flagged: 72 hours remaining` | `flagged: expires tomorrow at 5:00 PM` |
| `l-mcgrath` fields | `closed: "Closed Jul 9"` | `closed: "Closed Oct 10"` |
| `cal-5` | `title: "Closing: 8 Rockland Way"` | `title: "Closing: 120 Tremont St"` |
| task | `Order appraisal — 8 Rockland Way, lender needs access code` | `Coordinate appraisal access — 120 Tremont St, lender needs the lockbox code` |
| `l-frazier` | `timeline: "This spring"` | `timeline: "Within 90 days"` |
| `l-abrams` | `service: "Past client: closed 2 years ago"` / `closed: "Closed Jul 2024"` / `intent: "Past client"` | `service: "Past client: bought 2 years ago"` / `closed: "Closed Oct 2023"` / `intent: "Past client (buyer)"` |
| `rf-2` notify body | `Routed to Marisol Vega, the agent who closed his purchase in 2024.` | `Routed to Dev Okafor, the agent who closed his purchase in 2023.` |
| `rf-3` lead `l-dana` (or whatever id) | `assignee: "Marisol Vega"` / note `Referred by Peter Abrams (closed Jul 2024)` | `assignee: "Dev Okafor"` / note `Referred by Peter Abrams (bought Oct 2023) · opted in by text` |
| `rf-3` detail | append ` Dana opted in by text before anything else was sent.` | |
| `uc-5` calendar | `day: "Mon", date: "Oct 20", time: "11:00 AM"` for `Closing: 14 Sea Breeze Ln` | `day: "Fri", date: "Nov 14", time: "11:00 AM"` |
| `uc-5` effects | the `{ kind: "stage", leadId: "l-santos", stageId: "closed" }` effect | delete it (file stays under contract until it closes) |
| `uc-5` notify body | `14 Sea Breeze Ln: closing Monday 11:00 AM. Every contingency met on time.` | `14 Sea Breeze Ln: clear to close, closing Nov 14 at 11:00 AM. Every contingency met on time.` |
| `uc-5` detail | `The closing goes on the calendar, all four parties get the details, and the file moves to closed.` | `The closing goes on the calendar four weeks out and all four parties get the details.` |
| `sim-deadline-risk` | every `41 Bayberry Rd` | `3 Harbor View Ter` |
| analytics `volume.points` values | `24, 27, 23, 31, 34, 30, 36, 38` | `33, 36, 35, 41, 42, 38, 43, 44` |
| `auto-1` | `runsThisMonth: 142` | `runsThisMonth: 131` |
| metric Sphere touchpoints | `delta: "+214"` | `delta: "+38"` |

`sim-routing-escalation`: replace the `updateLead l-whitaker` effect with
```ts
        { kind: "lead", lead: { id: "l-sim-escalated", name: "Hannah Ostrowski", service: "Buying: 4BR, Hingham", source: "Realtor.com", stageId: "new-lead", value: 18000, lastActivity: "Just now", temp: "warm", note: "Unclaimed for 5 minutes, escalated from the on-duty agent to the team lead", assignee: "Chris Meade", fields: { intent: "Buying", priceRange: "$550k–$650k" } } },
        { kind: "recovery", event: { contact: "Hannah Ostrowski", amount: 18000, silentFor: "Unclaimed 5 minutes", trigger: "deadline", summary: "Portal lead sat unclaimed; the claim window expired and it moved to the team lead instead of dying in a queue.", automationId: "auto-1" } },
```
and change the activity/notify strings that name Gordon Whitaker to `Hannah Ostrowski`.

- [ ] **Step 4: Net sheet**

Replace the `commission` field with two fields:
```ts
      {
        id: "listing-fee",
        label: "Listing-side fee",
        options: [
          { label: "2.5%", amount: -16250 },
          { label: "2%", amount: -13000 },
          { label: "1.5%", amount: -9750 },
        ],
        helper: "Commission is always negotiable and is set between the seller and the broker.",
      },
      {
        id: "buyer-comp",
        label: "Buyer-agent compensation offered (optional)",
        options: [
          { label: "2.5%", amount: -16250 },
          { label: "2%", amount: -13000 },
          { label: "None", amount: 0 },
        ],
        helper: "Any offer to a buyer's broker is the seller's choice and is negotiable.",
      },
```
`closing` first option → `{ label: "Standard: about $7,900", amount: -7900 }` and add to that field `helper: "MA deed excise ($4.56 per $1,000 ≈ $2,964) plus attorney, recording, and smoke/CO certificate."`.
`description` → `"The same estimate an agent walks a seller through at the listing appointment. Pick the terms on a $650,000 list price; generated net sheets become records with automated follow-up."`
Delete `sentStageId: "appointment-set",`. Add `totalLabel: "Estimated net proceeds",` after `disclaimer`.

- [ ] **Step 5: Receptionist**

`availability`: change `c-noagent` to `next: "buyer-times"`. Add nodes:
```ts
      {
        id: "buyer-times",
        say: "Let's get you in. Dev handles buyers on that side of town; he can show it tomorrow at 5:30 PM or Saturday at 11:30 AM. Which works?",
        meta: "Checks the live showing calendar",
        choices: [
          { id: "c-show-thu", label: "Tomorrow at 5:30.", next: "done-showing" },
          { id: "c-show-sat", label: "Saturday at 11:30.", next: "done-showing" },
        ],
      },
      {
        id: "done-showing",
        say: "You're booked with Dev. I'm texting your confirmation and the listing sheet now, and the seller's been notified. Thanks for calling Harborline!",
        outcome: {
          summary: [
            "A sign call at 7:40 PM became a booked showing instead of a voicemail.",
            "The buyer's record, the calendar, and the call summary all updated at once.",
            "The assistant introduced itself as automated and never spoke for an agent.",
          ],
          effects: [
            { kind: "boundary", ruleId: "licensee", summary: "Booked a showing as the team's assistant; never presented itself as Dev or any licensee.", outcome: "disclosed" },
            { kind: "lead", lead: { id: "l-ai-buyer", name: "Nathan Ruiz", service: "Buying: 22 Cordwainer Dr", source: "Sign call", stageId: "appointment-set", value: 22470, lastActivity: "Just now", temp: "hot", note: "After-hours sign call outside 22 Cordwainer Dr · showing booked by AI receptionist", assignee: "Dev Okafor", fields: { intent: "Buying", timeline: "Within 30 days" } } },
            { kind: "calendar", event: { id: "cal-ai-showing", day: "Thu", date: "Oct 16", time: "5:30 PM", title: "Showing: 22 Cordwainer Dr, Nathan Ruiz", withWhom: "Dev Okafor", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-buyer", contact: "Nathan Ruiz", channel: "phone", topic: "After-hours sign call: showing booked", unread: true, messages: [
              { id: "ai-buyer-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours sign call handled. Unrepresented buyer outside 22 Cordwainer Dr. Showing booked Thu 5:30 PM with Dev; seller notified; listing sheet texted. No valuation discussed.", time: "Just now" },
            ] } },
            { kind: "metric", id: "new-leads", delta: 1 },
            { kind: "metric", id: "showings", delta: 1 },
            { kind: "recovery", event: { contact: "Nathan Ruiz", amount: 22470, silentFor: "Called 7:40 PM, every agent busy", trigger: "after-hours", summary: "Buyer parked outside a listing got a showing instead of a voicemail.", automationId: "auto-2" } },
            { kind: "notify", notification: { id: "n-ai-buyer", title: "Sign call converted", body: "Nathan Ruiz: showing at 22 Cordwainer Dr, Thu 5:30 PM with Dev.", tone: "success" } },
          ],
        },
      },
      {
        id: "done-resched-sat",
        say: "Done — your showing is moved to Saturday at 11:30 AM, and I've notified both the listing agent and the seller so nobody's waiting at an empty house. A new confirmation is on its way by text.",
        outcome: {
          summary: [
            "The showing was rescheduled without a single round of phone tag.",
            "The listing agent and the seller were both notified automatically.",
            "The change was logged on the client's record and the shared calendar.",
          ],
          effects: [
            { kind: "calendarUpdate", eventId: "cal-2", patch: { day: "Sat", date: "Oct 18", time: "11:30 AM", status: "confirmed", note: "Rescheduled by the assistant during an after-hours call" } },
            { kind: "activity", item: { id: "a-ai-resched-sat", icon: "calendar", text: "AI receptionist moved the 41 Bayberry Rd showing to Saturday 11:30 AM; both agents and the seller notified.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-ai-resched-sat", title: "Showing rescheduled by assistant", body: "No phone tag between three parties — handled during the after-hours call.", tone: "success" } },
          ],
        },
      },
```
(`showings` must be the id of the "Showings booked" metric; confirm with grep.) In `resched`, change `c-sat` to `next: "done-resched-sat"`.

Prepend to `done-sheet.outcome.effects`:
```ts
            { kind: "boundary", ruleId: "representation", summary: "Caller already has an agent. Sent the listing sheet, created no lead, made no pitch.", outcome: "declined" },
```
Prepend to `done-booked.outcome.effects`:
```ts
            { kind: "boundary", ruleId: "valuation", summary: "Caller asked what their home is worth, then pushed for a ballpark. Declined both and booked Marisol for a CMA.", outcome: "declined" },
            { kind: "recovery", event: { contact: "Nathan Ruiz", amount: 19500, silentFor: "Called 7:40 PM, every agent busy", trigger: "after-hours", summary: "Seller sign call became a listing appointment; no number given over the phone.", automationId: "auto-2" } },
```

- [ ] **Step 6: Pre-listing packet stays on the right side of the line**

`s-7` detail → `"The pre-listing checklist and a net-sheet worksheet go out now. The comparable sales come from Marisol in person Thursday; the system never sends an opinion of price."`
`sa-6` text → `"Sent — a prep checklist and a net-sheet worksheet at the payoff you mentioned, so Thursday is a numbers conversation. Marisol will bring the comparable sales herself."`
`workflowRun` detail in `s-7` → `"Pre-listing checklist and net-sheet worksheet sent to Alicia Harmon; comps held for the agent."`
Append to `s-7` effects:
```ts
          { kind: "boundary", ruleId: "comps", summary: "Automation sent the checklist and worksheet but held the comparable sales for Marisol to present in person.", outcome: "declined", source: "automation" },
```

- [ ] **Step 7: Nav, roles, boundaries, recovered, tour step**

`nav`: insert `{ id: "recovered", label: "Recovered" }, { id: "boundaries", label: "Boundaries & Disclosures" },` after the analytics entry. Append `"recovered", "boundaries"` to every `roles[].nav`.

Add after `breakdown` (use the file's real staff ids for `routesTo`; `grep -n 'id: "staff-'`):
```ts
  boundaries: {
    intro: "The assistant answers, routes, books, and reminds. It never prices a home, never solicits a buyer who has an agent, never signs as a licensee, and never sends a CMA conclusion on its own. Every time it holds that line, it's logged here.",
    rules: [
      { id: "valuation", label: "Never gives a value or an opinion of price", kind: "route", detail: "Any 'what's it worth' goes to a licensed agent with a CMA appointment, even under pressure for a ballpark.", routesTo: "staff-marisol" },
      { id: "representation", label: "Never solicits a represented buyer", kind: "never", detail: "If the caller has an agent, they get the listing sheet and no pitch. No lead is created." },
      { id: "licensee", label: "Never signs as a licensed agent", kind: "always", detail: "Every automated call and text identifies itself as the team's assistant for the named agent, never as the agent." },
      { id: "comps", label: "Never sends comparable sales or CMA conclusions without agent review", kind: "never", detail: "Checklists and worksheets go out automatically; the comps and the price conversation stay with the agent." },
      { id: "consent", label: "Never texts without consent on file", kind: "never", detail: "Anniversary, nurture, and just-listed touches go only to contacts with consent, and every campaign carries STOP." },
    ],
    seed: [
      { id: "bnd-seed-1", ruleId: "valuation", at: "Yesterday 7:41 PM", summary: "Sign call asked what 22 Cordwainer Dr would sell for. Declined; booked a CMA with Marisol.", outcome: "declined", source: "receptionist" },
      { id: "bnd-seed-2", ruleId: "representation", at: "Yesterday 12:15 PM", summary: "Open-house follow-up text: buyer replied 'we have an agent'. Sequence stopped, no further contact.", outcome: "declined", source: "automation" },
      { id: "bnd-seed-3", ruleId: "consent", at: "Monday 9:00 AM", summary: "Just-listed sphere batch skipped 22 contacts with no consent on file.", outcome: "declined", source: "automation" },
      { id: "bnd-seed-4", ruleId: "comps", at: "Sunday 8:30 PM", summary: "IDX seller inquiry received a prep checklist; comparable sales held for Marisol's Tuesday appointment.", outcome: "declined", source: "automation" },
    ],
  },
  recovered: {
    intro: "Every lead that arrived after hours, sat unclaimed, or went quiet, and still became an appointment because the system acted. Pipelines show what's alive; this shows what would have died.",
    attributionRule: "counted when a contact who had gone quiet for 48 hours or more re-engaged within 24 hours of an automated touch and advanced a stage, when an unclaimed lead was escalated inside the claim window and booked, or when an after-hours inquiry was booked before an agent saw it.",
    seed: [
      { id: "rec-seed-1", at: "Yesterday", contact: "Trevor Boyd", amount: 14100, silentFor: "Zillow lead, answered in 94 s", trigger: "after-hours", summary: "Claimed by Dev inside the window; tour block booked the same morning.", automationId: "auto-1" },
      { id: "rec-seed-2", at: "2 days ago", contact: "Peter Abrams", amount: 16500, silentFor: "Quiet 2 years", trigger: "referral", summary: "Closing-anniversary touch produced a referral for his sister.", automationId: "auto-7" },
      { id: "rec-seed-3", at: "Friday", contact: "Gordon Whitaker", amount: 26000, silentFor: "Quiet 21 days", trigger: "reactivation", summary: "Long-timeline buyer nurture got a reply and a call with Dev.", automationId: "auto-6" },
      { id: "rec-seed-4", at: "Thursday", contact: "Renata Santos", amount: 15870, silentFor: "Deadline inside 72 h", trigger: "deadline", summary: "Inspection contingency flagged; repair response filed before it lapsed.", automationId: "auto-4" },
      { id: "rec-seed-5", at: "Wednesday", contact: "Owen Hartley", amount: 17400, silentFor: "Sign call 8:05 PM, no agent free", trigger: "after-hours", summary: "Listing appointment booked by the assistant after hours.", automationId: "auto-2" },
      { id: "rec-seed-6", at: "Last week", contact: "Marcus Bell", amount: 13200, silentFor: "Unclaimed 5 minutes", trigger: "deadline", summary: "Realtor.com lead escalated to the team lead when the on-duty agent didn't claim it; under contract in a week.", automationId: "auto-1" },
      { id: "rec-seed-7", at: "Last week", contact: "The Ferreiras", amount: 19800, silentFor: "Quiet 4 months", trigger: "reactivation", summary: "Long-timeline buyers came back on a saved-search market note.", automationId: "auto-6" },
    ],
  },
```
(`auto-1` round-robin, `auto-2` sign-call text-back, `auto-4` contingency watch, `auto-6` buyer nurture, `auto-7` anniversary; confirm ids.)

Tour: insert after `s-7`:
```ts
      {
        id: "s-7b",
        title: "What the assistant refused to do",
        detail: "Alicia asked, in the same thread, what the system thought the house was worth. It didn't guess: the question went to Marisol with the file, and the refusal was logged. That's not a gap in the product; it's the product.",
        tab: "boundaries",
        effects: [
          { kind: "message", conversationId: "c-harmon", message: { id: "sa-6b", from: "contact", text: "Rough idea what it'd list for? Just so we can plan.", time: "Just now" } },
          { kind: "message", conversationId: "c-harmon", message: { id: "sa-6c", from: "system", meta: "Automated · Valuation routed", text: "That has to come from Marisol after she's seen the house; anything I guessed would be worth nothing to you. She'll bring the comparable sales Thursday.", time: "Just now" } },
          { kind: "boundary", ruleId: "valuation", summary: "Alicia asked for a rough list price by text. Routed to Marisol; no number given.", outcome: "routed", source: "scenario" },
        ],
      },
```
Append to `s-6` effects:
```ts
          { kind: "recovery", event: { contact: "Alicia Harmon", amount: 22470, silentFor: "Arrived 9:12 PM, nobody awake", trigger: "after-hours", summary: "IDX seller inquiry booked a listing appointment eight minutes after it landed.", automationId: "auto-0" } },
```
Append to `sim-portal-lead` effects: `{ kind: "recovery", event: { contact: "Kara Lindqvist", amount: 17800, silentFor: "Zillow lead, answered in 41 s", trigger: "after-hours", summary: "Portal lead answered before any agent opened the app.", automationId: "auto-0" } },`
Append to `rf-3` effects: `{ kind: "recovery", event: { contact: "Dana Abrams", amount: 16500, silentFor: "Sphere, 2 years since closing", trigger: "referral", summary: "Anniversary touch turned a past client into a referral at the top of the pipeline.", automationId: "auto-7" } },`

- [ ] **Step 8: Gates**

Run: `node --test tests/demo-configs.test.ts tests/realestate-demo.test.ts && npm run typecheck && npm test`
Expected: PASS. If `realestate-demo.test.ts` asserts on a renamed date or lead, update the assertion to the new value from this task.

- [ ] **Step 9: Commit**

```bash
git add components/demos/data/realestate.ts tests/demo-configs.test.ts tests/realestate-demo.test.ts
git commit -m "Real estate demo: assistant never signs as a licensee, contingency dates reconciled, post-settlement net sheet, guardrails, recovered ledger

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Spotlight primitive and fresh-item highlighting in every list view

**Files:**
- Create: `components/demos/ui/Spotlight.tsx`
- Modify: `app/globals.css` (append after the dialog block)
- Modify: `components/demos/ui/views.tsx` (MetricCard, ActivityFeed, Overview schedule/tasks/recovered lists, TasksView, CalendarView, ReviewsView)
- Modify: `components/demos/ui/LeadsViews.tsx` (table row ~line 410, pipeline card ~line 613)
- Modify: `components/demos/ui/ConversationsView.tsx` (list `<li>` ~line 123, bubble wrapper ~line 204)
- Modify: `components/demos/ui/QuotesView.tsx` (record list item), `components/demos/ui/AutomationsView.tsx` (execution-history rows), `components/demos/ui/BoundariesView.tsx`, `components/demos/ui/RecoveredView.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const SPOT_WINDOW_MS = 10_000;
  export function isFresh(entry: FreshEntry | undefined, now?: number): boolean;
  export function FreshPill(): JSX.Element;               // "Just now" text pill
  export function Spotlight(props: {
    id: string; fresh: Record<string, FreshEntry>; kind?: FreshKind;
    as?: "div" | "li" | "tr"; pill?: boolean; className?: string; children: ReactNode;
  } & HTMLAttributes<HTMLElement>): JSX.Element;
  ```

- [ ] **Step 1: Create the primitive**

```tsx
"use client";

import { createElement, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import type { FreshEntry, FreshKind } from "../types";

/** How long after an effect an entity stays spotlighted. Matches the CSS animation. */
export const SPOT_WINDOW_MS = 10_000;

export function isFresh(entry: FreshEntry | undefined, now: number = Date.now()): boolean {
  return !!entry && now - entry.at < SPOT_WINDOW_MS;
}

/** Text marker so a spotlighted item isn't colour-only. */
export function FreshPill() {
  return <span className="demo-spotlight__pill">Just now</span>;
}

type Props = Omit<HTMLAttributes<HTMLElement>, "id"> & {
  id: string;
  fresh: Record<string, FreshEntry>;
  /** Override the colour family; defaults to the entry's kind. */
  kind?: FreshKind;
  as?: "div" | "li" | "tr";
  /** Table rows can't hold a span; pass false and render <FreshPill /> in a cell instead. */
  pill?: boolean;
  children: ReactNode;
};

/**
 * Wraps a list item and, while the entity is fresh (touched by a tour step,
 * scenario, sim, or receptionist outcome in the last 10 s), rings it in the
 * kind colour, appends a "Just now" pill, and scrolls it into view once.
 */
export function Spotlight({ id, fresh, kind, as = "div", pill = true, className = "", children, ...rest }: Props) {
  const entry = fresh[id];
  const active = isFresh(entry);
  const family = kind ?? entry?.kind ?? "record";
  const ref = useRef<HTMLElement>(null);
  const scrolledAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !entry || scrolledAt.current === entry.at) return;
    scrolledAt.current = entry.at;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, entry]);

  return createElement(
    as,
    {
      ref,
      className: `${className} ${active ? `demo-spotlight demo-spotlight--${family}` : ""}`.trim(),
      "data-spot-id": id,
      "data-fresh": active ? "true" : undefined,
      ...rest,
    },
    children,
    active && pill ? <FreshPill key="pill" /> : null,
  );
}
```

- [ ] **Step 2: CSS**

Append to `app/globals.css` after the dialog reduced-motion block:
```css
/* Tour spotlight (components/demos/ui/Spotlight.tsx). One palette shared by
   rings, caption chips, and nav pulses: record = accent, message = sky,
   task = amber, calendar/metric/recovery = emerald, boundary = rose. */
.demo-spotlight {
  --spot: var(--demo-accent, #b3243a);
  position: relative;
  animation: demo-spotlight 6s ease-out forwards;
}
.demo-spotlight--message { --spot: #38bdf8; }
.demo-spotlight--task { --spot: #fbbf24; }
.demo-spotlight--calendar,
.demo-spotlight--metric,
.demo-spotlight--recovery { --spot: #34d399; }
.demo-spotlight--boundary { --spot: #fb7185; }
@keyframes demo-spotlight {
  0% {
    box-shadow: 0 0 0 2px var(--spot), 0 0 22px color-mix(in srgb, var(--spot) 45%, transparent);
    background-color: color-mix(in srgb, var(--spot) 14%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    background-color: transparent;
  }
}
.demo-spotlight__pill {
  position: absolute;
  right: 0.5rem;
  top: 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid color-mix(in srgb, var(--spot) 55%, transparent);
  background: color-mix(in srgb, var(--spot) 18%, #0b0b0f);
  color: #fff;
  font-size: 0.56rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  line-height: 1;
  padding: 0.2rem 0.4rem;
  text-transform: uppercase;
  pointer-events: none;
  animation: demo-spotlight-pill 6s ease-out forwards;
}
@keyframes demo-spotlight-pill {
  0%, 70% { opacity: 1; }
  100% { opacity: 0; }
}
.demo-nav-pulse {
  animation: demo-nav-pulse 0.9s ease-out 1;
}
@keyframes demo-nav-pulse {
  0% { background-color: color-mix(in srgb, var(--spot, var(--demo-accent)) 28%, transparent); }
  100% { background-color: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .demo-spotlight { animation: none; box-shadow: inset 3px 0 0 var(--spot); }
  .demo-spotlight__pill { animation: none; }
  .demo-nav-pulse { animation: none; }
}
```

- [ ] **Step 3: Wrap the views**

Every call site gets `fresh={state.fresh}`; `state` is already in scope in each view.

`views.tsx`:
- `MetricCard` gains `spot?: boolean` and renders `className={`… ${spot ? "demo-spotlight demo-spotlight--metric" : ""}`}` plus `{spot && <FreshPill />}` inside (add `relative` to its class). Overview metrics: `<MetricCard key={m.id} metric={m} spot={isFresh(state.fresh[m.id])} />`. Analytics KPIs unchanged.
- `ActivityFeed`: `<li key={item.id}` → `<Spotlight as="li" id={item.id} fresh={state.fresh} kind="record" key={item.id} className="flex items-start gap-3 px-4 py-3">`.
- Overview `schedule` `<li key={e.id}` → `<Spotlight as="li" id={e.id} fresh={state.fresh} kind="calendar" …>`; `tasks` `<li key={t.id}` → `kind="task"`; `recovered` `<li key={r.id} data-spot-id={r.id}` → `<Spotlight as="li" id={r.id} fresh={state.fresh} kind="recovery" …>` (drop the manual `data-spot-id`).
- `TasksView` open + done `<li key={t.id}` → `Spotlight as="li" kind="task"`.
- `CalendarView` event `<li key={e.id} className={…}>` → `<Spotlight as="li" id={e.id} fresh={state.fresh} kind="calendar" key={e.id} className={…}>`.
- `ReviewsView` `<li key={r.id}` → `Spotlight as="li" kind="record"`.

`LeadsViews.tsx`:
- Table row: `<tr key={lead.id} className="transition-colors hover:bg-white/[0.02]">` → `<Spotlight as="tr" pill={false} id={lead.id} fresh={state.fresh} kind="record" key={lead.id} className="transition-colors hover:bg-white/[0.02]">` and in the name cell after `{lead.temp && <TempBadge …/>}` add `{isFresh(state.fresh[lead.id]) && <FreshPill />}` (the pill is absolutely positioned; give that cell's inner `div` `relative pr-14`).
- Pipeline card `<div key={lead.id} draggable …>` → `<Spotlight as="div" id={lead.id} fresh={state.fresh} kind="record" key={lead.id} draggable …>` keeping every handler and the className.

`ConversationsView.tsx`:
- Inbox `<li key={c.id}>` → `<Spotlight as="li" pill={false} id={c.id} fresh={state.fresh} kind="message" key={c.id}>`.
- Bubble wrapper `<div key={m.id} className={`max-w-[85%] …`}>` → `<Spotlight as="div" id={m.id} fresh={state.fresh} kind="message" key={m.id} className={…}>`.

`QuotesView.tsx`: the saved-quote `<li key={quote.id}` → `Spotlight as="li" kind="record"`. `AutomationsView.tsx`: each execution-history row keyed by `run.id` → `Spotlight as="li" kind="record"`.
`BoundariesView.tsx` log `<li key={e.id} data-spot-id={e.id}` → `<Spotlight as="li" id={e.id} fresh={state.fresh} kind="boundary" …>`; `RecoveredView.tsx` ledger `<li>` → `kind="recovery"`.

- [ ] **Step 4: Gates and commit**

Run: `npm run typecheck && npm run lint && npm test`
```bash
git add components/demos/ui/Spotlight.tsx app/globals.css components/demos/ui/views.tsx components/demos/ui/LeadsViews.tsx components/demos/ui/ConversationsView.tsx components/demos/ui/QuotesView.tsx components/demos/ui/AutomationsView.tsx components/demos/ui/BoundariesView.tsx components/demos/ui/RecoveredView.tsx
git commit -m "Demo OS: spotlight freshly touched records, messages, tasks, and events

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: In-window tour caption, effect chips, controls, deterministic stepping

**Files:**
- Create: `components/demos/ui/TourCaption.tsx`
- Modify: `components/demos/DemoOS.tsx` (schedule/flush ~line 128, runStep ~line 164, runScenario ~line 210, OS window div ~line 585, nav button ~line 675, main content ~line 692)

**Interfaces:**
- Produces:
  ```ts
  export type Chip = { label: string; tab: NavId; kind: FreshKind };
  export function chipsForEffects(effects: Effect[], config: IndustryConfig, stages: Stage[]): Chip[];
  export function TourCaption(props: {
    eyebrow: string; title: string; detail: string; chips: Chip[]; accent: string;
    onChip: (tab: NavId) => void;
    controls?: { playing: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; onToggle: () => void };
  }): JSX.Element;
  ```
- Consumes: `prevStep`, `nextStep`, `setPlaying`, `setTab` from DemoOS.

- [ ] **Step 1: Create the caption**

```tsx
"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Effect, FreshKind, IndustryConfig, NavId, Stage } from "../types";

export type Chip = { label: string; tab: NavId; kind: FreshKind };

export const KIND_COLOR: Record<FreshKind, string> = {
  record: "var(--demo-accent)",
  message: "#38bdf8",
  task: "#fbbf24",
  calendar: "#34d399",
  metric: "#34d399",
  recovery: "#34d399",
  boundary: "#fb7185",
};

/** One chip per kind of change a step makes, in effect order, de-duplicated. */
export function chipsForEffects(effects: Effect[], config: IndustryConfig, stages: Stage[]): Chip[] {
  const chips: Chip[] = [];
  const push = (c: Chip) => { if (!chips.some((x) => x.label === c.label)) chips.push(c); };
  for (const e of effects) {
    switch (e.kind) {
      case "lead": push({ label: `+1 ${config.terminology.record}`, tab: "leads", kind: "record" }); break;
      case "updateLead": push({ label: `${config.terminology.record} updated`, tab: "leads", kind: "record" }); break;
      case "stage": push({ label: `stage → ${stages.find((s) => s.id === e.stageId)?.label ?? e.stageId}`, tab: "pipeline", kind: "record" }); break;
      case "message": case "conversation": push({ label: "message", tab: "conversations", kind: "message" }); break;
      case "task": push({ label: "task", tab: "tasks", kind: "task" }); break;
      case "completeTask": push({ label: "task done", tab: "tasks", kind: "task" }); break;
      case "calendar": case "calendarUpdate": case "appointmentStatus": push({ label: "calendar", tab: "calendar", kind: "calendar" }); break;
      case "metric": push({ label: "metric", tab: "overview", kind: "metric" }); break;
      case "review": case "reviewStatus": push({ label: "review", tab: "reviews", kind: "record" }); break;
      case "quote": case "quoteStatus": push({ label: "quote", tab: "quotes", kind: "record" }); break;
      case "workflowRun": push({ label: "automation", tab: "automations", kind: "record" }); break;
      case "boundary": push({ label: "guardrail", tab: "boundaries", kind: "boundary" }); break;
      case "recovery": push({ label: `recovered $${e.event.amount.toLocaleString()}`, tab: "recovered", kind: "recovery" }); break;
      case "activity": case "notify": case "conversationMeta": case "reopenTask": break;
    }
  }
  return chips;
}

export function TourCaption({ eyebrow, title, detail, chips, accent, onChip, controls }: {
  eyebrow: string;
  title: string;
  detail: string;
  chips: Chip[];
  accent: string;
  onChip: (tab: NavId) => void;
  controls?: { playing: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; onToggle: () => void };
}) {
  const accentText = accent === "#b3243a" ? "#d94b5e" : accent;
  return (
    <div
      data-tour-caption
      className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 border-b px-4 py-3 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5"
      style={{ borderColor: `${accent}66`, backgroundColor: `color-mix(in srgb, ${accent} 10%, #0b0b0f)` }}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.2em]" style={{ color: accentText }}>{eyebrow}</p>
          <p className="mt-0.5 text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/60">{detail}</p>
          {chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="What this step changed">
              {chips.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => onChip(c.tab)}
                    className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[0.62rem] text-white/80 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    style={{ borderColor: `color-mix(in srgb, ${KIND_COLOR[c.kind]} 55%, transparent)`, backgroundColor: `color-mix(in srgb, ${KIND_COLOR[c.kind]} 14%, transparent)` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KIND_COLOR[c.kind] }} aria-hidden />
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {controls && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton onClick={controls.onPrev} disabled={!controls.canPrev || controls.playing} aria-label="Previous tour step" className="rounded border border-white/10 text-white/60 hover:text-white">
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton onClick={controls.onToggle} disabled={!controls.canNext} aria-label={controls.playing ? "Pause tour" : "Resume tour"} className="rounded border border-white/10 text-white/60 hover:text-white">
              {controls.playing ? <Pause size={14} /> : <Play size={14} />}
            </IconButton>
            <IconButton onClick={controls.onNext} disabled={!controls.canNext || controls.playing} aria-label="Next tour step" className="rounded border border-white/10 text-white/60 hover:text-white">
              <ChevronRight size={14} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}
```
(`IconButton` lives in `components/ui/IconButton.tsx`; check its props with `sed -n 1,40p components/ui/IconButton.tsx` and adapt `disabled`/`className` if it names them differently.)

- [ ] **Step 2: Deterministic stepping in DemoOS**

Replace the `timeouts` ref, `schedule`, and `clearTimers` with:
```ts
  const pending = useRef<{ t: ReturnType<typeof setTimeout>; fn: () => void }[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const entry = { t: setTimeout(() => { pending.current = pending.current.filter((p) => p !== entry); fn(); }, ms), fn };
    pending.current.push(entry);
    return entry.t;
  }, []);

  /** Run everything still queued, in order, right now. Keeps manual Next deterministic. */
  const flushPending = useCallback(() => {
    const queued = pending.current;
    pending.current = [];
    for (const p of queued) { clearTimeout(p.t); p.fn(); }
  }, []);

  const clearTimers = useCallback(() => {
    pending.current.forEach((p) => clearTimeout(p.t));
    pending.current = [];
  }, []);
```
In `runStep`, call `flushPending();` as the first statement inside the callback (add `flushPending` to its deps). In `runScenario`, replace the leading `clearTimers();` with `flushPending();`.

- [ ] **Step 3: Track tour-driven tab changes and pulse the nav**

Add state `const [pulse, setPulse] = useState<{ tab: NavId; kind: FreshKind; key: number } | null>(null);` and a helper:
```ts
  const goToTab = useCallback((id: NavId, kind: FreshKind = "record") => {
    setTab(id);
    setPulse({ tab: id, kind, key: Date.now() });
  }, []);
```
Use `goToTab(step.tab, chipsForEffects(step.effects, config, state.stages)[0]?.kind)` in `runStep`, `prevStep`, `runScenario`, and `runSimAction` wherever they currently call `setTab(step.tab)`/`setTab(action.tab)`. On the nav `<button>` add `className={… ${pulse?.tab === item.id ? "demo-nav-pulse" : ""}}` and `key={pulse?.tab === item.id ? pulse.key : item.id}` so the animation restarts, and `style={{ ...(active ? { borderColor: accent } : {}), ["--spot" as string]: pulse?.tab === item.id ? KIND_COLOR[pulse.kind] : undefined }}` (`KIND_COLOR` is exported from `TourCaption.tsx`).

- [ ] **Step 4: Render the caption inside the window; keep the window in view**

Change the OS window container class from `relative overflow-hidden rounded-xl …` to `relative overflow-clip rounded-xl … scroll-mt-24` and give it `ref={windowRef}` (`const windowRef = useRef<HTMLDivElement>(null);`).

Compute the caption model before `return`:
```ts
  const scenarioDef = runningScenario ? config.scenarios.find((s) => s.id === runningScenario.id) : undefined;
  const scenarioStep = scenarioDef && runningScenario && runningScenario.step > 0 ? scenarioDef.steps[runningScenario.step - 1] : undefined;
  const caption = scenarioStep
    ? { eyebrow: `Scenario · step ${runningScenario!.step} of ${runningScenario!.total}`, title: scenarioStep.title, detail: scenarioStep.detail, chips: chipsForEffects(scenarioStep.effects, config, state.stages), controls: undefined }
    : currentStep && !tourDone
      ? { eyebrow: `Guided tour · step ${stepIndex + 1} of ${steps.length}`, title: currentStep.title, detail: currentStep.detail, chips: chipsForEffects(currentStep.effects, config, state.stages), controls: { playing, canPrev: stepIndex > 0, canNext: !tourDone, onPrev: prevStep, onNext: nextStep, onToggle: () => setPlaying((p) => !p) } }
      : null;
```
In the main content column replace `<div className="min-w-0 flex-1 p-4 sm:p-5">{view}</div>` with:
```tsx
          <div className="min-w-0 flex-1 p-4 sm:p-5">
            {caption && !mobilePreview && (
              <TourCaption {...caption} accent={accent} onChip={(t) => goToTab(t)} />
            )}
            {view}
          </div>
```
Add the scroll-into-view effect:
```ts
  useEffect(() => {
    const el = windowRef.current;
    if (!el || (stepIndex < 0 && !runningScenario)) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [stepIndex, runningScenario?.step]);
```

- [ ] **Step 5: Gates and commit**

Run: `npm run typecheck && npm run lint && npm test`. Then `npm run dev` and open `/demos/contractors`: start the tour, confirm the caption sits at the top of the window, chips appear and jump tabs, the nav item pulses, Prev/Next in the caption work, and pressing Next repeatedly never leaves a later step's records missing.
```bash
git add components/demos/ui/TourCaption.tsx components/demos/DemoOS.tsx
git commit -m "Demo OS: in-window tour caption with effect chips, nav pulse, deterministic stepping

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Conversations follow the tour; mobile pass on tour-visited views

**Files:**
- Modify: `components/demos/ui/ConversationsView.tsx`

- [ ] **Step 1: Auto-open the conversation a step just touched**

After `const [selectedId, setSelectedId] = useState<string | null>(null);` add:
```ts
  /* A tour step, scenario, or sim that adds a message opens that thread so the
     visitor sees it land, on desktop and on phones (where the list hides). */
  const latestFreshConversation = useMemo(() => {
    let best: { id: string; at: number } | null = null;
    for (const [id, entry] of Object.entries(state.fresh)) {
      if (entry.kind !== "message") continue;
      const convId = entry.parent ?? id;
      if (!state.conversations.some((c) => c.id === convId)) continue;
      if (!best || entry.at > best.at) best = { id: convId, at: entry.at };
    }
    return best;
  }, [state.fresh, state.conversations]);

  useEffect(() => {
    if (!latestFreshConversation || !isFresh({ kind: "message", at: latestFreshConversation.at })) return;
    setSelectedId((cur) => (cur === latestFreshConversation.id ? cur : latestFreshConversation.id));
    setAiOutput(null);
  }, [latestFreshConversation]);
```
Import `useEffect, useMemo` from react and `isFresh` from `./Spotlight`.

- [ ] **Step 2: Mobile check on the tour path**

Run `npm run dev`, then in another terminal: `node scripts/audit-responsive.mjs --routes=/demos/healthwellness,/demos/contractors,/demos/realestate`
Expected: zero findings. Fix any the detector reports in the views it names (it walks every tab, including Boundaries and Recovered).

- [ ] **Step 3: Gates and commit**

```bash
npm run typecheck && npm run lint && npm test
git add components/demos/ui/ConversationsView.tsx
git commit -m "Demo conversations: open the thread a tour step just wrote to

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Browser verification of all three tours; final gates

**Files:**
- Create: `scripts/tour-walk.mjs`
- Modify: `.gitignore` (add `/.tour-shots/`)
- Modify: `scripts/audit-responsive.mjs` (remove the `/demos/gyms` route, line ~70)

- [ ] **Step 1: Write the walker**

```js
/**
 * Drives each demo's guided tour step by step and checks that every step is
 * legible: the in-window caption is visible, it lists at least one chip, and
 * at least one spotlighted element is on the visible tab. Screenshots land in
 * .tour-shots/<slug>-<width>-<step>.png.
 *
 * Usage: node scripts/tour-walk.mjs [--url=http://localhost:3000] [--slugs=contractors]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const SLUGS = arg("slugs", "healthwellness,contractors,realestate").split(",");
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];
const STEP_SETTLE_MS = 1600; // > effects × 500 ms stagger for the longest step

mkdirSync(".tour-shots", { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const vp of VIEWPORTS) {
  for (const slug of SLUGS) {
    const page = await browser.newPage({ viewport: vp, reducedMotion: "no-preference" });
    await page.goto(`${BASE}/demos/${slug}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Explore on my own" }).click();
    await page.getByRole("button", { name: "Start guided tour" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Pause tour" }).first().click();

    const total = await page.locator('[aria-label="Guided tour progress"] li').count();
    for (let step = 1; step <= total; step += 1) {
      await page.waitForTimeout(STEP_SETTLE_MS);
      const caption = page.locator("[data-tour-caption]");
      const problems = [];
      if (!(await caption.isVisible())) problems.push("caption not visible");
      if ((await caption.locator("li").count()) === 0) problems.push("no chips");
      const freshVisible = await page.locator('[data-fresh="true"]:visible').count();
      if (freshVisible === 0) problems.push("no spotlighted element on the visible tab");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) problems.push("horizontal page overflow");
      await page.screenshot({ path: `.tour-shots/${slug}-${vp.width}-${String(step).padStart(2, "0")}.png`, fullPage: false });
      const title = await caption.locator("p").nth(1).textContent().catch(() => "?");
      if (problems.length) { failures += 1; console.log(`FAIL ${slug} @${vp.width} step ${step} "${title}": ${problems.join("; ")}`); }
      else console.log(`ok   ${slug} @${vp.width} step ${step} "${title}"`);
      if (step < total) {
        const next = page.locator('[data-tour-caption] button[aria-label="Next tour step"]');
        await next.click();
      }
    }
    await page.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} step(s) failed` : "\nAll tour steps legible on both viewports");
process.exit(failures ? 1 : 0);
```
Add `/.tour-shots/` to `.gitignore`. Remove the `"/demos/gyms",` line from `scripts/audit-responsive.mjs`.

- [ ] **Step 2: Run it**

Terminal 1: `npm run dev`. Terminal 2: `node scripts/tour-walk.mjs`.
Expected: every line `ok`, final line `All tour steps legible on both viewports`. For any `FAIL`, open the screenshot, fix the view or the step's `tab`, and re-run. A step whose effects touch only tabs other than its `tab` (e.g. a metric-only step shown on `overview`) is a config bug: set the step's `tab` to where its first effect lands.

Also open three screenshots by eye (`contractors-390-08.png`, `realestate-1280-07.png`, `healthwellness-390-09.png`): the caption should read cleanly, chips should be colour-matched to the ring on the spotlighted element, and nothing should be clipped.

- [ ] **Step 3: Reduced motion**

In Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", reload `/demos/realestate`, run two tour steps: spotlighted items show a static coloured left border and no glow animation.

- [ ] **Step 4: Full gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean. `npm test` should report the new `demo-engine` and `demo-configs` suites plus the updated `demo-request` and `realestate-demo` suites passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/tour-walk.mjs scripts/audit-responsive.mjs .gitignore
git commit -m "Tour walker: verify every guided-tour step is legible at 390 and 1280

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec §1 → Task 2 (plus `scripts/audit-responsive.mjs` route removal in Task 12). §2.1 cross-file rules → enforced by `tests/demo-configs.test.ts` (Task 6). §2.2 → Task 6. §2.3 → Task 7. §2.4 → Task 8. §2.5 → Task 3. §3 → Tasks 1, 4, 6–8. §4 → Tasks 1, 5, 6–8. §5.1 → Task 1. §5.2 → Task 9. §5.3 → Task 10. §5.4 → Task 10 (the horizontal nav already scrolls the active item into view via `ScrollRail activeKey`, added by commit `4a25cc8`). §5.5 → Task 10 Step 2. §5.6 → Task 11. Testing section → Tasks 1, 6–8, 12.
- `boundaries` / `recovered` are optional on `IndustryConfig` so Tasks 1–5 stay green before content lands; the invariants test makes them effectively required for every registered config.
- The `Spotlight` component uses `createElement` so `as="tr"` works inside `<tbody>`; the pill is opt-out for rows.
