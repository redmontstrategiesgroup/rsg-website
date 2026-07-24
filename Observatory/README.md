# NEXUS Observatory

**The World That Remembers** — a persistent multi-agent reality simulator for
decision analysis. Build a living model of a system, change one decision, and
observe the modeled consequences across time — with assumptions, uncertainty,
and causal pathways exposed at every step.

Not a game. No players, no scores, no scripted stories. The output of this
platform is a **decision report**, not an experience.

## Run it

```
python -m http.server 8741
```

from the folder above this one, then open **http://localhost:8741/observatory/**.
Zero dependencies, no build step; state persists in the browser (localStorage).

## What it does

- **World model** — a typed, queryable entity graph: neighborhoods, roads,
  substations, organizations, population cohorts, sample agents, with
  relationships (`works_at`, `powered_by`, `purchases_from`, …). Every entity
  and every model parameter carries a **source and confidence**.
- **Deterministic simulation engine** — daily pipeline over named
  methodologies: BPR traffic assignment, Huff demand allocation,
  MPC income response, Erlang-C facility queues, rule-based organizational
  decisions. Reproducible from `(world version, spec hash, seed, params)` —
  verified by run fingerprints.
- **Scenarios in natural language** — "What happens if Harbor Bridge closes
  for six months?" becomes a structured spec (deltas, horizon, metrics,
  assumptions). Every inferred default is flagged; **nothing runs until a
  human confirms the assumption review**. Unmappable requests are refused,
  not silently approximated. An optional Claude-backed parser handles harder
  phrasings — its output goes through the same review gate.
- **Branching realities** — every run compares intervention branches against
  an automatic no-change baseline from the same initial state and seeds.
  Divergence detection reports the first sustained separation and the first
  branch-specific events. Any checkpoint (every 14 sim-days) can be **forked**
  into a new scenario that inherits the exact world state of that moment.
- **Uncertainty, honestly** — every metric is the median of N seeded Monte
  Carlo runs with a P10–P90 band; one-at-a-time ±20% sensitivity (tornado)
  identifies which assumptions the answer actually depends on — and says so
  when the answer is robust. Copy throughout uses "the model estimates…",
  never "this will happen".
- **Causal traces** — every event carries its cause; outcomes link back
  through the mechanism chain (closure → reroute → lateness → employer
  response → productivity). The Causal Inspector walks any event up to its
  root and down to its consequences.
- **Memory** — synthetic agents accumulate epistemically tagged memories
  (experienced vs reported) with decay; organizations keep institutional
  memory logs (incidents, workforce actions); the world keeps full event
  history and checkpoints.
- **Data & calibration** — CSV import for organizations and for historical
  actuals; a calibration loop (run baseline vs actuals → MAPE → adjust
  parameters → save) that changes parameter provenance to "calibrated/user"
  and is audit-logged.
- **Decision reports** — 12 sections: decision summary, executive summary,
  outcome tables with bands, causal pathways, winners/losers by cohort and
  organization, risks, sensitivity, reversibility of each action, recommended
  pilot, monitoring triggers, assumptions with sources, limitations,
  reproducibility stamp. Print-to-PDF and JSON export.
- **Copilot (optional)** — an Anthropic API key (Settings) enables plain-
  language parsing and evidence-grounded executive briefs. The copilot sees
  only an engine-generated evidence pack and is instructed to cite it or say
  "not modeled". Deterministic local fallbacks exist for both jobs. **The
  simulation engine itself never calls a language model.**

## The five built-in demonstrations

| Demo | Question | Decision surface |
|---|---|---|
| 1 · Business location | Premium fitness studio: Midtown vs Northfield? | Revenue vs margin tradeoff; cannibalization of the incumbent; sensitivity to price elasticity & travel tolerance |
| 2 · Road closure | Harbor Bridge closed 180 days | Commutes, congestion rerouting, lateness → employer adaptation, business access, recovery |
| 3 · Power outage | 3-day South Substation failure | Closures, spoilage, grocery/care access, backup-power value, recovery bump |
| 4 · Workforce reduction | Largest employer cuts 20% | Income → spending → local revenue → staffing second-order chain; relief-policy branch |
| 5 · Facility redesign | Clinic under a 20% demand surge | Add a provider vs triage+layout redesign, measured in waits and lost visits |

## Ethics & safety (built in, not bolted on)

Fully synthetic population — cohorts plus clearly labeled archetype sample
agents; no entity represents a real person and the UI says so wherever agents
appear. No sensitive-trait modeling (income band + geography only).
Distributional impact (winners/losers) is part of every report. All assumption
changes, imports, calibrations, runs, forks and reports are append-only
audit-logged with the acting role. The platform informs human decisions; it
automates none.

## Limitations (read before trusting anything)

1. **The demo world is synthetic and uncalibrated.** Until you import data and
   calibrate, magnitudes are illustrative; directions and mechanisms are the
   product. Every screen says so because it is true.
2. **Modeled channels only.** Transit routes, supply-chain lead times, housing
   prices, crime, and health outcomes are not modeled in v1; the scenario
   parser refuses these rather than faking them.
3. **Client-side deployment.** Roles and the audit log are honest bookkeeping,
   not security — a single-workstation tool. Multi-user RBAC requires the
   server deployment path in ARCHITECTURE.md.
4. **Small network, aggregate agents.** Six neighborhoods, 11 road segments,
   18 cohorts (~10.5k synthetic residents), 72 sample agents. The architecture
   scales by data, not by code change, but v1 numbers are district-scale.
5. **Weekly-quantized organizational decisions** can make some outcomes
   insensitive to small parameter changes — the tornado reports this
   explicitly instead of manufacturing spurious precision.

## Files

`js/core.js` RNG/stats/store/audit · `js/world.js` entity graph + Harborview +
parameter registry · `js/models.js` traffic/demand/labor/power/queues ·
`js/engine.js` runs, events, causality, metrics, checkpoints ·
`js/scenario.js` specs, NL parsing, templates, Monte Carlo, divergence,
sensitivity · `js/copilot.js` evidence packs, briefs, Claude boundary ·
`js/report.js` decision reports · `js/charts.js` bands/tornado/tables ·
`js/mapview.js` spatial view + replay · `js/ui.js` the Observatory ·
`js/app.js` boot. See `ARCHITECTURE.md` and `AUDIT.md`.

The original game prototype this platform grew out of remains at `../nexus/`
(see `AUDIT.md` for what was kept, removed, and found to be fake).
