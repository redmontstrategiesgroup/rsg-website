# Audit of the prior NEXUS application (`/nexus`, v0.1 "The City That Remembers")

Date: 2026-07-23 · Auditor: platform rebuild, step 1 of the upgrade plan.
The game remains untouched at `/nexus` as a reference prototype. The decision
platform at `/observatory` is a new codebase that reuses the audited-good parts.

## What existed

A browser city-sim *game*: 30 hand-authored NPCs with schedules, money, moods,
memories, gossip, a scripted plant-closure arc, an election, a chat system
(local intent engine + optional Claude), a social feed, "God Mode" sliders,
and localStorage persistence with offline catch-up.

## Verdict by component

### Kept (directly or as a pattern)

| Component | Assessment | Disposition in platform |
|---|---|---|
| Seeded mulberry32 RNG | Sound; already used for all sim randomness | Promoted to a serializable `Rng` class; one stream per run; **reproducibility is now a hard guarantee** (fingerprint-verified) |
| Zero-build classic-script architecture | Fits the environment (no Node.js on host) | Kept |
| localStorage persistence + versioned store | Sound | Kept, restructured (`obs_store_v1`), plus append-only audit log |
| Tick pipeline with deterministic iteration order | Sound core idea | Rebuilt as a daily pipeline over cohorts/organizations with explicit model stages |
| Memory with provenance (witness vs gossip, credibility decay) | The single best idea in the game | Generalized into the epistemic tagging requirement (observed / reported / experienced) + memory decay rules |
| Economy skeleton (wages → spending → business revenue → staffing) | Directionally right, magnitudes arbitrary | Rebuilt on named methodologies (MPC income response, Huff demand, P&L with COGS) |
| Claude browser integration (structured outputs, key in localStorage) | Sound | Kept for the Copilot; **removed from the simulation loop entirely** |

### Removed (game-only mechanics, per upgrade mandate)

- Player character, wallet, reputation meters, "wanted" level
- NPC chat-as-gameplay: bribes, threats, flirting, recruitment, quest-like offers
- The scripted conspiracy arc, election drama, rumor-distortion flavor text
- The Pulse social feed (entertainment content)
- Cyberpunk visual identity (neon, scanlines, boot sequence, ticker)
- "God Mode" as an unaudited cheat panel → replaced by **policy deltas that are
  scenario inputs with provenance, review, and audit logging**
- Voice synthesis/recognition

### Identified as fake or unsupported (the important part)

| Fake system | Why it failed the standard | Replacement |
|---|---|---|
| "PROJECTION" text in God Mode | Hard-coded strings, not derived from the model | Monte Carlo bands (P10–P90 across seeds), sensitivity tornado, divergence detection |
| "Crime index" | A counter with no generating model | Dropped (out of v1 scope; honest absence beats a fake number) |
| Election "polls" | Score function dressed as measurement | Dropped from platform scope |
| Single-run outcomes presented flatly | No uncertainty communication at all | Every reported metric carries a seed-band; hedged language enforced in briefs/reports |
| Implicit assumptions everywhere | Constants buried in code, invisible to the user | Parameter registry with per-value provenance (default / calibrated / scenario override / csv-import), surfaced in a mandatory pre-run review |
| Causality by narration | Event log said *what*, never *why* | Causal event DAG: every emitted event carries `causeId`; traces are inspectable per outcome |
| "The world remembers" as flavor | Memories affected only dialogue | Individual memories (epistemic tags, decay), institutional memory logs on organizations, world history via events + checkpoints + forkable snapshots |

## Defects found in the game during audit (fixed in platform design)

1. Non-serializable RNG state meant reload ≠ resume (acceptable for a game, fatal for reproducibility).
2. No separation between world definition and run state — scenario comparison was impossible.
3. LLM in the hot path (every conversation) — the platform calls a model only for NL parsing and brief writing, never per tick or per agent.
4. Magnitudes were vibes. The platform's magnitudes are still *synthetic defaults* — but they are labeled as such, calibratable, and sensitivity-tested, which is the honest version of the same limitation.
