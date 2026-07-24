# NEXUS Observatory — architecture

Zero-build browser application (classic scripts, no bundler — the host has no
Node.js). Services from §15 of the product spec map to modules; in a server
deployment each module has a natural service boundary.

```
┌────────────────────────── Visualization client (ui.js, mapview.js, charts.js) ─┐
│  Overview · World view · Scenario builder/results · Timeline · Entities ·      │
│  Graph · Data & calibration · Reports · Audit · Settings · Inspector           │
└───────┬────────────────────────────────────────────────────────────────────────┘
        │
  scenario.js  ── Scenario Manager: spec schema, NL parser, templates,
        │         branch runner (Monte Carlo over seeds), divergence, sensitivity
        │
  engine.js   ── Simulation Engine + Event Engine + Causal Trace + Metrics:
        │         Run class, daily pipeline, event DAG (causeId), checkpoints,
        │         org decision rules, agent memories
        │
  models.js   ── Analytical models: traffic (Dijkstra + BPR), demand (Huff),
        │         labor/income (MPC), power dependency, queues (Erlang-C)
        │
  world.js    ── World Model Service + Entity Graph: typed entities,
        │         relationships, parameter registry w/ provenance, Harborview
        │         demo builder, mutable-state extraction
        │
  core.js     ── Rng (serializable), stats (quantiles, MAPE), store
        │         (localStorage), audit log, role gate
        │
  copilot.js  ── Scenario Copilot: evidence pack builder, deterministic local
        │         brief, optional Claude calls (NL→spec parse, brief) — the
        │         ONLY code that ever contacts an LLM
        │
  report.js   ── Report Generator: 12-section decision report, winners/losers,
                  reversibility, print CSS, JSON export
```

## Core entity model (world.js)

Entities: `neighborhood, region, road, substation, organization, cohort, agent`
— each `{id, type, name, attrs, nb, source{kind,ref,date}, confidence, updatedAt}`.
Relationships: `connects, powered_by, located_in, lives_in, works_at, member_of,
purchases_from, ships_via` — persistent, queryable (`out/inn/neighbors/byType`).

Spec-suggested tables → implementation: worlds/world_versions → `world.id/version`;
entities/relationships → Graph; agents/agent_states/memories → agent samples +
per-run agent state; scenarios/scenario_branches/assumptions → spec objects
(persisted); simulation_runs/checkpoints → `Run` + `snapshots`; metrics/
metric_values → metric registry + per-run series; causal_edges/outcomes →
event DAG; confidence_ranges → seed bands; data_sources → `source` on every
entity/param; calibration_runs → store.calibrations; reports/users/roles/
audit_events → store.reports / settings.role / store.audit.

## Determinism & reproducibility

- One `Rng` stream per run, seeded `hash(specId|branchId) ^ seed`; state serializable.
- No `Date.now`/`Math.random` in any simulation path; fixed iteration order (sorted ids).
- A run is reproducible from `(engine version, world@version, spec hash, seed, params)` —
  stamped on results and reports; verified by `Run.fingerprint()` (hash of all
  metric series), stable across page reloads.
- Uncertainty = Monte Carlo across seeds (noise enters via explicitly declared
  channels: daily demand noise, facility arrival noise). Deterministic state
  changes stay deterministic.

## The daily pipeline (engine.js)

1. Apply scheduled scenario deltas (root causal events)
2. Infrastructure state (outages → closures, backup power, spoilage)
3. Traffic skims when dirty (two-pass congested assignment, BPR)
4. Workforce behavior (lateness vs baseline commutes → employer responses)
5. Income & spending power (wages, benefits, MPC → `spendScale`)
6. Demand allocation (Huff) → business revenue → P&L
7. Weekly organizational decisions (staff cuts, closure, hiring) — rule-based
8. Facility queues (Erlang-C with saturation + balking)
9. Agent sample memories (epistemic tags, decay) + institutional memory
10. Metrics recording; per-edge and per-org series
11. Checkpoints (day 1 + every 14 days) — the substrate for rewind/fork

## Causality

`run.emit(type, label, data, causeId)` builds a DAG. Model code passes the
triggering event id downstream (closure → traffic_shifted → lateness_pattern →
employer_response; layoff → jobs_lost → revenue_shift → staff_reduction →
business_failed). The Causal Inspector walks parents/children; reports flatten
the top chains. Aggregate-channel effects (a revenue shift) name their measured
mechanism in the label and link to the active root cause.

## LLM boundary (deliberate)

The engine never calls a model. `copilot.js` calls Claude for exactly two jobs —
translating plain language into a reviewable spec (with every inferred default
flagged), and writing a brief strictly from the engine-generated evidence pack —
and both have deterministic local fallbacks. Model output never becomes
simulation state.

## Porting to a server stack

`world.js` graph → Postgres tables mirroring the entity model; `engine.js` runs
unchanged in Node workers (no DOM dependencies in core/world/models/engine/
scenario); store → API + auth (the client-side role gate is a stand-in);
copilot → server-side Anthropic SDK. The module boundaries above are the
service boundaries.
