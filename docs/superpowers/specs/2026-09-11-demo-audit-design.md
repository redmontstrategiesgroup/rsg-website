# Demo audit: fidelity, differentiation, and tour clarity

**Date:** 2026-09-11 · **Status:** approved design · **Scope:** `Website/components/demos/**`, `Website/app/(marketing)/demos/**`, related lib/tests

## Why

The four interactive demos (`/demos/[slug]`) are the primary sales asset. An audit on 2026-09-11 found:

1. **Content fidelity is uneven.** `contractors` and `gyms` fall back to generic stubs (`"Consultation"`, `"Service appointment"`, `$1,200`, "Leads/Appointments") for templates, intake, appointment types, schedule days and sample customer. All four files carry internal contradictions (dates, names, prices) and several strings that are regulatory liabilities: an automated SMS instructing a patient to stop blood thinners, a receptionist disclosing a named client's appointment to an unknown caller, automated texts signed as a named real-estate licensee, a net sheet that claims a price picker it doesn't have.
2. **Eleven of thirteen tabs are table stakes.** Dashboards, leads, kanban, inbox, automations, tasks, calendar, reviews, campaigns, analytics and settings exist in every mainstream CRM. The only genuinely rare content is real estate's contingency watch, claim-window routing, and the receptionist *declining* to give a valuation or solicit a represented buyer.
3. **The guided tour doesn't make its point visible.** Narration lives only in the control deck above the OS window, nothing marks the row/message/task a step just created, tab switches are silent, and on a phone the deck scrolls out of view as soon as content updates.

Decisions taken with the owner: fix fidelity everywhere; **retire the gyms demo** (orphaned from the funnel, least finished); add two cross-cutting differentiator tabs — **Boundaries** and **Recovered** — to the shared engine; and rebuild the tour's visual layer for desktop and mobile.

## Architecture (unchanged)

Every demo is one `IndustryConfig` (`components/demos/data/<slug>.ts`) rendered by one shell (`DemoOS.tsx`) over one pure reducer (`engine.ts`). All work below is config edits plus additive engine/view changes. Nothing touches production data or the request API contract except the slug list.

---

## 1. Retire `gyms`

- Delete `components/demos/data/gym.ts`. Remove `gymConfig` from `data/index.ts`.
- `lib/demo-request-schema.ts`: `DEMO_REQUEST_SLUGS` becomes `DEMO_CONFIGS.map(c => c.slug)` (typed as a tuple via `as const` helper) so the zod enum can't drift. `app/sitemap.ts` maps over `DEMO_CONFIGS` instead of a hardcoded list.
- `next.config.mjs`: add `/demos/gyms → /demos` (308, alongside the existing `/demos/retail` rule).
- `app/(marketing)/demos/page.tsx`: "Four industries. Four operating systems." → "Three industries. Three operating systems."; drop "gyms" from the meta description. Same in `lib/connect-defaults.ts:82`. Leave the prose mentions in `businessconsulting` and `servicearea` (they describe who RSG serves, not which demos exist).
- `tests/demo-request.test.ts:94`: remove `"gyms"` from the expected slug list.
- `components/demos/data/shared.ts` and the `defaults.ts` comment about "incomplete demo datasets (contractor/gym)": once contractor is fully authored (§2), `shared.ts` has no importers → delete it; update the `defaults.ts` comment.

## 2. Fidelity

### 2.1 Cross-file rules

- Merge tokens: only `TEMPLATE_VARIABLES` (`types.ts`) may appear in any `text`/`message` string. `{first name}` → `{first_name}`; contractor `{project}` → `{service}`, `{date}` → `{appointment_date}`.
- Campaign (marketing) messages end with `Reply STOP to opt out.` Transactional templates/automations do not.
- Automated messages never sign as a named human. Pattern: `"this is {business_name}'s assistant for {staff_name}"` or `"Hi {first_name}, {staff_name} asked me to reach out…"`.
- Every assignee string resolves to a `staff[].name`. Every `scheduleDays` entry matches the day/date pairs used by that config's `calendar`, receptionist outcomes, and scenarios.
- Every `stageId`, `automationId`, `leadId`, `conversationId`, `eventId`, `taskId` referenced by an effect exists in the config (or is created by an earlier effect in the same step list).

### 2.2 `healthwellness.ts`

- `c-dana-3`: replace the blood-thinner sentence with `"Carly will go over pre-visit prep with you at check-in."` Keep the pre-visit form link.
- Receptionist: `callerRole` → `"a caller reaching the practice at lunch"`. The `resched` node verifies identity before disclosing: `"I see an appointment under this number. Before I move anything, can you confirm the first name on the booking?"` → choice `"It's Rachel."` → existing reschedule flow. The `done-resched` outcome adds a `boundary` effect (`verified`). Rename choice ids `c-botox*` → `c-iv*`.
- Quote builder: Botox base `$360` (single area), two areas `+$300`, three areas `+$580`. Membership option label `"Member pricing (−$90 this visit)"`. Add `sentStageId: "completed"` (the "Consult Completed" stage).
- Lead values aligned to the rate card: Dana `$660`, Stephanie `$650`, Amara `$575`; Kelly's "Wellness consult & lab panel" stays `$350` and `"Wellness consult"` gets a `$350` entry in the quote service list.
- One lapse definition: campaign `camp-1` → `"Lapsed clients: 90+ days"`, audience/filter `"90+ days"`. Activity `"sent to 38 contacts"` → `"sent to 112 contacts"`.
- Microneedling: calendar says session 3, activity says review after session 2 → activity becomes `"after microneedling session 3"`.
- Calendar `cal-5` `"Wellness consult: walk-in inquiry follow-up"` → `"Wellness consult: Kelly Brandt (lab panel review)"`.
- "Lead" leaks → `"Inquiry response time"`, `"Inquiry → consult rate"` (metric + analytics KPI). `builderFlow` `"Create Contact"` → `"Create Client Record"`; scenario `s-2` `"becomes a contact"` → `"becomes a client record"`.
- `"intake form"` → `"pre-visit form"` in all client-facing copy.
- `breakdown.integrations` add `"HIPAA-compliant messaging (BAA on file)"`; `teamControls` add `"Pre-visit and clinical instructions"`.

### 2.3 `contractor.ts`

- **Staff** (full names, roles separated): `Mike Hartwell — Owner & sales`, `Dave Kessler — Estimator`, `Sam Ortiz — Crew lead`, `Jenna Price — Office manager`. Update every `assignee`, `withWhom`, and message string that used `"Mike (sales)"`, `"Dave (estimator)"`, `"Sam (crew lead)"`, `"Office"`.
- **Author the stubbed sections** (replacing `shared.ts` imports):
  - `terminology`: `{ record: "lead", records: "Leads", appointment: "Estimate", appointments: "Estimates" }` (no spread).
  - `templates` (6): Estimate confirmation · On-the-way · Quote delivery · Day-2 follow-up · Job scheduled · Completion & invoice — lifted from the existing conversation copy, tokenized.
  - `intakeFields` (9): Full name · Mobile number · Email · Project type (select: Kitchen remodel, Bathroom renovation, Deck or porch, Roof replacement, Siding or gutters, Windows, Basement finish, Repair / other) · Property address · Budget range (select) · Timeline (select: ASAP / emergency, 2–4 weeks, 1–3 months, Just planning) · Project details & photos (textarea, helper `"Photos help us price faster — you can text them after you submit."`) · `consent` checkbox `"OK to text me about my estimate"`.
  - `appointmentTypes` (5): Free estimate 60 · On-site measure 45 · Storm-damage inspection 45 · Pre-construction walkthrough 60 · Punch-list walkthrough 30.
  - `scheduleDays`: `Thu Jul 16 · Fri Jul 17 · Sat Jul 18 · Mon Jul 20 · Tue Jul 21`.
  - `sampleCustomer`: `{ first_name: "Brian", service: "Deck renovation", location: "42 Colonial Dr", appointment_date: "Saturday, Jul 18", appointment_time: "10:00 AM", estimate_amount: "$19,500" }`.
  - `requestServices` (8): Missed-call & after-hours capture · Estimate scheduling & on-the-way texts · Quote follow-up sequences · Crew scheduling & customer job updates · Invoice & payment follow-up · Post-job reviews · Past-customer reactivation routes · Lead source reporting.
  - `requestExtras` (4): Primary trade (select) · Crew size (select) · Estimate requests per month (select) · What do you run today? (ServiceTitan, Jobber, Housecall Pro, JobNimbus, Buildertrend, Spreadsheets & texts, Something else).
- **Receptionist**: split terminal nodes so outcomes match choices — `triage` "slow drip" → `done-roof-minor` (lead `"Roof leak: slow drip near window"`, `$3,200`, warm, note `"Slow drip near bedroom window"`); "steady stream" → existing `done-roof` (`$8,500`, hot). `deck-size` 300 composite → `done-deck` (`$16,800`); 180 wood → `done-deck-small` (`"Deck rebuild: 180 sq ft pressure-treated"`, `$7,400`). `book` states the fee: `"…or I can page the emergency line tonight for a $250 after-hours dispatch fee, credited toward the repair if you go ahead with us."`; the tonight choice reads `"Please send someone tonight — the $250 is fine."`; `done-roof-tonight` outcome adds a `boundary` effect (`disclosed`). Add `"Hartwell is licensed and insured"` to the `done-roof`/`done-deck` confirmations.
- Lead `Mark Sullivan` siding repair `$6,500` → `$1,400`. Quote builder `"Siding repair"` `+$4,200` → `+$1,900` and base label `"Site visit, permits (where required) & project management"`.
- Metric `"Jobs won this month"` → `"Jobs sold this month"` (id unchanged). Scenario `s-9` keeps `jobs-won +1` (approval = sold). `sc-mc-6` fires `estimates-scheduled +1` instead of `jobs-won`.
- `camp-3` message: `"Your deck is due for a wash and reseal to keep it looking new."`
- `camp-2` filter `"Service: roofing / siding / gutters"` → `"Service: any exterior work"`; `sc-re-2` Lisa Chen `"completed last quarter"` → `"windows done 14 months ago"`.
- Sim `"Send quote follow-up"` uses day-5 copy: `"Hi Doug, quick check-in on the bathroom quote — if budget's the sticking point, Mike has a couple of ideas to trim it. Want him to call?"`.
- `breakdown.integrations`: `"Field service software (ServiceTitan, Jobber, Housecall Pro, JobNimbus, Buildertrend)"`, `"Photo documentation (CompanyCam)"`, `"QuickBooks"`, keep Google/Outlook Calendar, Twilio SMS, Facebook lead ads, Stripe, review platforms.

### 2.4 `realestate.ts`

- Automated identity: `tpl-1`, `auto-0.message`, `auto-2.message`, `auto-6.message`, `camp-2.message`, `c-boyd-1`, `sim-portal-lead` message → assistant-for-agent phrasing (§2.1).
- Contingency dates: `cal-3` → `Thu Oct 16 11:00 AM`, note `"Contingency expires today at 5:00 PM"`. Activity `"flagged: 72 hours remaining"` → `"flagged: expires tomorrow at 5:00 PM"`. Scenario `uc-*` and template copy already say Thursday.
- `8 Rockland Way`: lead stays `closed`, `closed: "Closed Oct 10"`. Calendar `cal-5` → `"Closing: 120 Tremont St"` (Chris Meade). Task `"Order appraisal — 8 Rockland Way…"` → `"Coordinate appraisal access — 120 Tremont St, lender needs the lockbox code"`.
- Receptionist: `availability → c-noagent` → new `buyer-times` (`"Dev can get you in tomorrow at 5:30 PM or Saturday at 11:30 AM. Which works?"`) → `done-showing` (lead `Nathan Ruiz / "Buying: 22 Cordwainer Dr" / Sign call / appointment-set / $22,470 / hot / assignee Dev Okafor`; calendar `"Showing: 22 Cordwainer Dr — Nathan Ruiz"`; call summary says showing booked, no valuation discussed). `valuation`/`no-ballpark → times → done-booked` unchanged (listing appointment). `resched` "Saturday" → new `done-resched-sat` writing `Sat Oct 18 11:30 AM`.
- `hasagent`/`done-sheet`, `valuation`, `no-ballpark` outcomes add `boundary` effects (`declined`/`routed`).
- `s-7` pre-listing packet: narration `"The pre-listing checklist and a net-sheet worksheet go out now; the comparable sales come from Marisol in person Thursday — the system never sends an opinion of price."` `sa-6` and `workflowRun` text match. Step adds a `boundary` effect.
- Net sheet: field `"Total commission"` → two fields: `"Listing-side fee"` (`2.5% → −16,250`, `2% → −13,000`, `1.5% → −9,750`) and `"Buyer-agent compensation offered (optional)"` (`2.5% → −16,250`, `2% → −13,000`, `None → 0`), helper on the second: `"Any offer to a buyer's broker is the seller's choice and is negotiable."` `"Seller closing costs & transfer tax"` standard → `"Standard: about $7,900"` `−7900` with helper `"MA deed excise ($4.56 per $1,000 ≈ $2,964) plus attorney, recording, and smoke/CO certificate."` Description → `"…Pick the terms on a $650,000 list price; generated net sheets become records with automated follow-up."` Remove `sentStageId`. Add `totalLabel: "Estimated net proceeds"`.
- Sim `"Trigger routing escalation"`: replace `updateLead l-whitaker` with a new lead `Hannah Ostrowski / "Buying: 4BR, Hingham" / Realtor.com / new-lead / $18,000 / warm / assignee Chris Meade / note "Unclaimed for 5 minutes, escalated from the on-duty agent to the team lead"` plus a `recovery` effect.
- Sim `"Flag a contingency deadline"` property → `3 Harbor View Ter`.
- Analytics `volume.points` → `33, 36, 35, 41, 42, 38, 43, 44` (sums to 312). `auto-1.runsThisMonth` → `131`. `"Sphere touchpoints"` delta → `"+38"`.
- Dates: `l-frazier.timeline` → `"Within 90 days"`; `l-abrams` → `service: "Past client: bought 2 years ago"`, `fields.closed: "Closed Oct 2023"`, `intent: "Past client (buyer)"`; `rf-2` notify → `"Routed to Dev Okafor, the agent who closed his purchase in 2023."`; `l-dana` assignee → Dev Okafor; `rf-3` detail adds `"Dana opted in by text before anything else was sent."` and lead note `"Referred by Peter Abrams · opted in by text"`.
- `uc-5`: calendar `"Closing: 14 Sea Breeze Ln"` → `Fri Nov 14 11:00 AM`; the lead stays `under-contract`; notify `"Clear to close — closing Nov 14, every contingency met on time."`

### 2.5 Shared UI

- `QuotesView.tsx`: total label from `config.quote.totalLabel ?? "Estimated total"`; negative line amounts render `text-white/60` (not emerald).
- `sections.tsx`: delete `BuilderSection` and `SystemBreakdown` (unused). `BreakdownConfig` stays — `teamControls` is consumed by the Boundaries view.

---

## 3. Boundaries tab

**Purpose:** show the AI declining, verifying, disclosing, and routing as first-class product behaviour. No mainstream CRM surfaces refusals.

### Types (`types.ts`)

```ts
export type BoundaryKind = "never" | "always" | "route";
export type BoundaryOutcome = "declined" | "routed" | "verified" | "disclosed";
export type BoundaryRule = { id: string; label: string; kind: BoundaryKind; detail: string; routesTo?: string /* staff id */ };
export type BoundaryEvent = { id: string; ruleId: string; at: string; summary: string; outcome: BoundaryOutcome; source: "receptionist" | "automation" | "conversation" | "scenario" };
export type BoundariesConfig = { intro: string; rules: BoundaryRule[]; seed: BoundaryEvent[] };
// IndustryConfig.boundaries: BoundariesConfig
// NavId += "boundaries"
// Effect += { kind: "boundary"; ruleId: string; summary: string; outcome: BoundaryOutcome; source?: BoundaryEvent["source"] }
```

### State / engine

`DemoState.boundaryEvents: BoundaryEvent[]` seeded from `config.boundaries.seed`. `applyEffect` for `boundary` prepends an event with `at: "Just now"` and a generated id. `DEMO_SCHEMA_VERSION` → 6.

### Rules per config (5 each)

- **healthwellness**: `clinical` (route → Carly, RN: never answers clinical questions) · `identity` (always verifies the name on a booking before discussing it) · `automated` (always identifies itself as automated) · `pricing` (never quotes a treatment price as final; consult required) · `consent` (never texts without consent on file).
- **contractors**: `site-visit` (never commits to a final price before a site visit) · `fees` (always discloses after-hours or dispatch fees before booking) · `safety` (route → on-call estimator: leaks, electrical, structural) · `automated` · `consent`.
- **realestate**: `valuation` (never gives a value or opinion of price; route → listing specialist) · `representation` (never solicits a represented buyer) · `licensee` (never signs as a licensed agent; always identifies as the team's assistant) · `comps` (never sends comparable sales or CMA conclusions without agent review) · `consent`.

### Effects wired

Receptionist terminal nodes: health `done-resched` (verified), `reassure→done-booked` (routed); contractor `done-roof-tonight` (disclosed), `done-roof*` (routed, safety); realestate `done-sheet` (declined, representation), `done-booked` via valuation (declined, valuation). Guided tours: one new step per demo on the `boundaries` tab (health after s-8, contractor after s-8, realestate after s-7), each firing one boundary effect and narrating what stayed human. Sims: health "Simulate missed call" (routed, clinical).

### View (`ui/BoundariesView.tsx`)

Header stats for this session (declined / routed to a human / identity checks / fees disclosed). Rule cards: kind pill (`never`/`always`/`routes to <staff>`), label, detail, live event count. Event log (newest first, kind-colored dot). "What stays human" panel from `config.breakdown.teamControls`. CTA `"Add these guardrails to my system"` → `openRequest({ source: "boundaries_view", feature: "Guardrails & compliance boundaries" })`. All roles get the tab. `FEATURE_HINTS` adds `[/boundar|guardrail/i, /guardrail|compliance/i]`; `SERVICE_OPTIONS` and each `requestServices` gain `"Guardrails & compliance boundaries"`.

---

## 4. Recovered tab

**Purpose:** counterfactual attribution — the dollars that would have died in silence without the system. Pipelines show what's alive; nobody shows what was saved.

### Types

```ts
export type RecoveryTrigger = "quote-followup" | "missed-call" | "no-show" | "reactivation" | "deadline" | "after-hours" | "referral";
export type RecoveryEvent = { id: string; at: string; contact: string; amount: number; silentFor: string; trigger: RecoveryTrigger; summary: string; automationId?: string; leadId?: string };
export type RecoveredConfig = { intro: string; attributionRule: string; seed: RecoveryEvent[] };
// IndustryConfig.recovered: RecoveredConfig
// NavId += "recovered"; WidgetId += "recovered"
// Effect += { kind: "recovery"; event: Omit<RecoveryEvent, "id" | "at"> }
```

### State / engine

`DemoState.recoveries: RecoveryEvent[]` seeded (8–12 entries per config, dated this month, totals in the plausible range: health ≈ $9k, contractor ≈ $68k, realestate ≈ $95k of gross commission). `deriveAnalytics` gains `recoveredTotal`, `recoveredByTrigger`. The Overview `recovered` widget shows the month total and last three entries; Analytics gains a `"Recovered this month"` KPI.

### Effects wired

Contractor: tour `s-9` (quote-followup, $19,500, "2 days"), `sc-q-4`, `sc-mc-6` (missed-call, $2,400), `sc-re-3` (reactivation, $950), receptionist bookings (after-hours), sims missed-call / quote follow-up / reactivation. Health: tour `s-6` (after-hours DM → consult, $175), sims missed call / reactivation, receptionist `done-booked`. Realestate: tour `s-6` (after-hours, $22,470), Zillow sim (after-hours), routing-escalation sim (deadline: "unclaimed 5 min"), `rf-3` (referral), receptionist `done-booked`/`done-showing`.

### View (`ui/RecoveredView.tsx`)

Headline total this month + count. `BarChart` by trigger. Ledger table (contact · what happened · silent for · amount · automation name). Footnote with `config.recovered.attributionRule` (default text: *"Counted when a contact who had gone quiet for 48 hours or more re-engaged within 24 hours of an automated touch and advanced a stage."*). CTA `"See what this would recover for my business"` → `source: "recovered_view"`. All roles get the tab (the view is read-only).

---

## 5. Tour spotlight

### 5.1 Fresh-entity tracking (engine)

`DemoState.fresh: Record<string, { kind: FreshKind; at: number }>` where `FreshKind = "record" | "message" | "task" | "calendar" | "metric" | "boundary" | "recovery"`. `applyEffect` writes an entry for every entity it creates or mutates (lead, stage move, message, conversation, task, calendar event, review, quote, workflowRun, metric, boundary event, recovery event). Entries older than 60 s are pruned on each `effects` action. `saveSession` strips `fresh` before serialising; `loadSession` restores `{}`.

### 5.2 `Spotlight` primitive (`ui/Spotlight.tsx`)

```tsx
<Spotlight id={lead.id} kind="record" as="tr" className="…">…</Spotlight>
```

Reads `state.fresh[id]`; when present and `< 10 s` old: adds class `demo-spotlight demo-spotlight--<kind>` and a `Just now` pill (visually hidden if the row already shows "Just now"). On first render as fresh, calls `scrollIntoView({ block: "nearest", behavior: "smooth" })` once (guarded by a ref). Tour-visited views wrap: lead rows, pipeline cards, conversation list items and message bubbles, task items, calendar events, review items, quote records, overview metric cards / activity / schedule / task mini-lists, automation execution rows, boundary events, recovery rows.

CSS in `globals.css`:

```css
.demo-spotlight { animation: demo-spotlight 6s ease-out forwards; --spot: var(--demo-accent); }
.demo-spotlight--message { --spot: #38bdf8 } /* sky-400 */
.demo-spotlight--task { --spot: #fbbf24 }    /* amber-400 */
.demo-spotlight--calendar, .demo-spotlight--metric, .demo-spotlight--recovery { --spot: #34d399 } /* emerald-400 */
.demo-spotlight--boundary { --spot: #fb7185 } /* rose-400 */
@keyframes demo-spotlight { 0% { box-shadow: 0 0 0 2px var(--spot), 0 0 22px color-mix(in srgb, var(--spot) 45%, transparent); background-color: color-mix(in srgb, var(--spot) 14%, transparent) } 100% { box-shadow: 0 0 0 0 transparent; background-color: transparent } }
@media (prefers-reduced-motion: reduce) { .demo-spotlight { animation: none; box-shadow: inset 3px 0 0 var(--spot) } }
```

### 5.3 `TourCaption` (`ui/TourCaption.tsx`)

Rendered inside the OS window at the top of the content column whenever `stepIndex >= 0` (including the completed final step, so the closing narration stays in-window) or a quick scenario is running. `position: sticky; top: 0; z-index: 20`, accent-tinted background (`color-mix(accent 10%)`, blurred), border-bottom accent. Contents: eyebrow `Step n of N` (or `Scenario · step n of N`), title, one-line detail, `aria-live="polite"`. **Effect chips** computed from the step's effects: `+1 {record}` · `message` · `task` · `calendar` · `stage → {label}` · `metric` · `boundary` · `recovered ${amount}` — each a button that switches to the owning tab, colored with its kind color (dot + tinted border). Right-aligned compact controls: ‹ · pause/play · › wired to the same `prevStep`/`setPlaying`/`nextStep` handlers as the deck. The OS window container changes `overflow-hidden` → `overflow-clip` so sticky works against page scroll.

### 5.4 Navigation cues

On tour-driven tab change: the target nav item gets a one-shot `demo-nav-pulse` class (kind color of the step's primary effect, 900 ms); on `< lg` the horizontal nav calls `scrollIntoView({ inline: "center", block: "nearest" })` on the active item. If the OS window's top is above `0` or below `50vh`, smooth-scroll the window (not the deck) into view (`scroll-margin-top: 5rem`).

### 5.5 Determinism

`schedule()` stores `{ t, fn }`. `runStep` first calls `flushPending()` — runs every pending fn synchronously in order, clears the list — then schedules the new step's effects. Same in `prevStep` (it already clears) and `runScenario`.

### 5.6 Mobile pass on tour-visited views

`ConversationsView` (24 of ~70 tour steps): on `< lg` the list/thread grid stacks; when a tour step adds a message the thread must be visible → on mobile, an open conversation shows the thread only with a "Back to inbox" control (already exists) and tour effects that add a message to a conversation auto-open it. `LeadsView` table keeps `min-w-[42rem]` inside `overflow-x-auto` (already). `PipelineView` columns scroll horizontally; the fresh card's column scrolls into view. `CalendarView`, `TasksView`, `OverviewView` verified not to overflow at 390 px.

---

## Testing

- `tests/demo-configs.test.ts` (new) — for every config in `DEMO_CONFIGS`: template tokens ⊆ `TEMPLATE_VARIABLES`; assignees/withWhom resolve to staff names (allowing `"Crew A"`/`"Crew B"` style team labels declared in a per-config allowlist); `scheduleDays` ⊇ calendar day/date pairs; all effect-referenced ids resolve; receptionist graph: every `next` exists, every terminal node has an outcome, every node reachable from `start`; boundaries rule ids used by events exist; no forbidden strings (`blood thinner`, `{first name}`, `Service appointment`, `"this is Dev"`); `nav` includes `boundaries` and `recovered`.
- `tests/demo-engine.test.ts` (new) — `boundary` and `recovery` effects append events; `fresh` entries written for each effect kind and pruned after 60 s; `saveSession` strips `fresh`; `flushPending` ordering.
- `tests/demo-request.test.ts` — slug list derived; three slugs.
- `tests/realestate-demo.test.ts` — update assertions for renamed dates/leads.
- Browser verification (via the `run` skill): drive each of the three guided tours end-to-end at 390 px and 1280 px; every step shows its caption, chips, and at least one spotlighted element on the visible tab; no horizontal page scroll at 390 px; reduced-motion renders the static border.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all clean.

## Out of scope

Per-vertical extras (gym churn radar, health credit ledger, contractor photo intake), the `/industries` funnel, and the mobile-preview iframe running the tour (it remains a layout preview).
