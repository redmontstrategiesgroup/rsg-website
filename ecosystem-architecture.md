# Ecosystem Architecture: RSG (Onehand OS · GHOST · NEXUS · Observatory · THE FORGE · Website)

**Repositories inspected:** `RSG\GHOST`, `RSG\Onehand OS`, `RSG\The forge`, `RSG\Website` (no git — no commit SHAs exist; working trees as of 2026-07-24) · **Date:** 2026-07-24 · **Overall confidence:** High for code-level claims, Medium for the two sub-apps only surface-read (Observatory, Website)

> **Scope & verification:** All duplication and divergence claims below were verified by the repo inspector (28 duplicate-file pairs with similarity scores) plus direct `diff`, and build on yesterday's full forensic audit of the Onehand OS tree (every app traced and executed). The original GHOST's new modules (`planner/orchestrator/onehand/shell/store/world`) were verified as *loaded* via its `index.html:66-77` but their internals were only header-read; NEXUS Observatory and the Website were inventoried, not audited. The inspector's 20 "shared table" candidates are all false positives (English words matched in prose/sim data — there is no database anywhere in this ecosystem) and its one "unresilient cross-product call" is a false positive (`btn-ghost` CSS class in a minified Next.js chunk). No cross-product data access exists today.

## Product boundaries

**GHOST** — `RSG\GHOST` (original, actively evolving)
- **Primary user:** Joseph as operator — an internal ops console persona.
- **Core promise:** one screen to command and observe a fleet of machines/agents, with visible plans, approval gates, and verification.
- **Main workflows:** launch missions, approve gated steps, watch fleet/timeline/comms, emergency stop; upstream now adds: natural-language → plan DAG (`js/planner.js`), execution with rollback data (`js/orchestrator.js`), world-model views + audit (`js/shell.js`, `js/world.js`, `js/store.js` — all loaded per `index.html:66-77`).
- **Unique responsibilities:** mission orchestration, approval gating, fleet visualization.
- **Data it owns:** its world model / audit trail / mission state (localStorage via `store.js`).
- **Data it consumes:** (proposed) the shared ability profile; nothing else.
- **Capabilities it exposes:** none formally — and that's correct for now.
- **Integrations:** none at runtime today (simulation); Claude integration exists only in its nested sub-apps.
- **Security:** local, no secrets of its own.
- **Deployment boundary:** static folder, classic scripts, double-click or any static server; fastest-changing product in the portfolio (four new modules + a sub-app in one day).
- **Why it stays separate:** it is the highest-churn codebase and the one experimenting with "real effects." Nothing else should inherit its blast radius.
- ⚠ **Boundary warning:** GHOST is trending god-repo. It now *contains* two unrelated products (NEXUS, Observatory) and has grown its own one-hand subsystem (`js/onehand.js` — "PHANTOM HAND… adaptive one-handed control layout from a capability profile") and its own app-shell layer (`js/shell.js`) — overlapping the Onehand OS shell's job. The portfolio currently has **two competing umbrellas**.

**NEXUS** — currently `RSG\GHOST\nexus\` (nested by historical accident)
- **Primary user:** a player. **Core promise:** a living city that remembers and continues without you.
- **Main workflows:** talk to residents, spread/assemble evidence, canvass the election, set policy, return after time away.
- **Unique responsibilities:** the social/economic simulation, gossip mechanics, election.
- **Data it owns:** `nexus_world_v1` in localStorage (117 KB live save verified), plus `nexus_api_key`, `nexus_voice`, `nexus_npc_model`.
- **Integrations:** Anthropic API (optional, browser-direct, verified correct), Web Speech API.
- **Deployment boundary:** static folder; self-contained (zero imports from GHOST — verified by the audit).
- **Why it stays separate:** different user (player vs. operator), different pace, different failure tolerance. It shares nothing with GHOST but a parent directory — the nesting is pure accident of where a session happened to build it.

**NEXUS Observatory** — currently `RSG\GHOST\observatory\` (new; surface-read only)
- **Core promise (its README):** "a persistent multi-agent reality simulator for decision analysis… Not a game. The output is a decision report."
- **Why it stays separate:** explicitly a *different product* from NEXUS (analysis tool vs. game — different user intent, different output), and different again from GHOST. Third accidental tenant of the GHOST folder.

**THE FORGE** — `RSG\The forge` (original, actively evolving)
- **Primary user:** a maker/builder. **Core promise:** one sentence → manufacturable package.
- **Main workflows:** forge/iterate a product, woodworking/repair/inventor modes; upstream now adds: requirements engine, DFM/electrical validation (`js/validation.js`), DXF/3MF/STEP drawings (`js/drawings.js`), enclosure + part-library modes, complexity/safety gating (headers read).
- **Unique responsibilities:** parametric CAD/EDA/firmware generation and export.
- **Data it owns:** `forge.settings.v1` (incl. API key), spec/version history in-session; exported files.
- **Integrations:** Anthropic API (browser-direct, verified correct incl. refusal-fallback beta), vendored three.js.
- **Deployment boundary:** ES modules — **requires** an HTTP server (file:// cannot run it); own `serve.py`.
- **Why it stays separate:** deep specialized domain (geometry/EDA/firmware); second-fastest-changing codebase; nothing else needs its internals — they need its *outputs*.

**Onehand OS (shell)** — `RSG\Onehand OS`
- **Primary user:** anyone launching the RSG apps one-handed. **Core promise:** one launcher, everything in thumb reach.
- **Unique responsibilities:** app registry, launch/exit chrome, hand preference; (proposed) owner of the shared ability profile.
- **Data it owns:** `ohos.*` localStorage keys.
- **Why it stays separate:** it must be the *thinnest* thing in the portfolio — a launcher with a manifest, not a platform. Its current `apps/` subtree is not a boundary, it's a stale copy (see Duplication).

**Website** — `RSG\Website`
- **Primary user:** prospective RSG clients (Plymouth County MA small businesses). **Core promise:** RSG's public face — services, industries, demos, booking.
- **Deployment boundary:** static **export** of a Next.js build (25 route folders + `_next/` chunks). ⚠ The *source* for this build is not in the RSG folder — only the artifact is (risk R5).
- **Security:** public internet surface; contains a `/login` route — whatever that becomes must never share a runtime with the local apps.
- **Why it stays separate:** different audience (public), different cadence (marketing), different sensitivity (public brand), different toolchain (Next.js vs. zero-build). Hard separation is correct; only brand assets are shared (as files, `Website/brand/`).

## Shared platform services

Run through the centralization framework (default bias: against). There are **no shared runtime services in this ecosystem, and none should be created.** Everything shareable lands as contract or library:

| Capability | Classification | Reason |
|---|---|---|
| **App registry / launcher** | **Shared contract** — an `apps.json` manifest (name, path, entry, icon, needs-server flag) owned by the shell; apps are listed, not linked | The shell needs to *find* apps, not run them. A manifest decouples the shell from app locations and kills the copy-the-whole-app pattern. Zero runtime coupling; iframes already isolate. |
| **Ability / capability profile** (hand, usable fingers, reach) | **Shared contract** — one JSON schema + one localStorage key, **written only by the shell**, read by all apps | This is the brand capability, now implemented 2.5× (Forge `js/layout.js` physical layout; GHOST `js/onehand.js` control layout; shell's L/R toggle). The *profile* must be one source of truth or the user re-declares their hand in every app; the *use* of it is deeply product-specific and must stay in each app. Contract, not library, not service. Highest-value integration available, near-zero cost. |
| **Anthropic API bridge** (key mgmt, fetch, structured outputs, refusal/fallback, error→local-fallback) | **Shared library** — one `claude-bridge.js` file vendored into each app (classic-script and ESM builds), plus a **contract**: one agreed localStorage key for the API key | Two independent implementations exist (`The forge/js/claude.js`, `GHOST/nexus/js/claude.js`); both are correct on API shapes, but they've already diverged in quality (NEXUS has the >12-turn history bug; Forge doesn't) — the canonical drift argument for a library. A *service* (gateway) would add a backend to a zero-backend ecosystem: over-centralization, rejected. One storage key = paste your key once per origin. |
| **Static serving** (`serve.py` ×3, two identical) | **Consolidate to one root server** as part of unification; delete per-app copies | 14-line stdlib servers; the duplication is harmless but pointless once one origin serves everything. Not a "service" in the coupling sense — any static server is a drop-in. |
| **Design language** (four hand-rolled dark palettes that rhyme) | **Contract only** (a `tokens.css` apps may adopt), **low priority** | Cosmetic consistency has no correctness requirement. A design *service* or forced migration would be pure coupling tax. Adopt opportunistically as files get touched. |
| **DOM/util helpers** (GHOST `lib.js`, NEXUS `util.js`, Forge inline helpers) | **Keep separate** — controlled duplication | Tiny, stable, app-flavored. A shared util library would couple release rhythm of three fast-moving apps to save ~200 lines. Classic "duplication cheaper than the wrong abstraction." |
| **Persistence / save management** | **Contract only** — localStorage namespace convention (`ghost.*`, `nexus_*`, `forge.*`, `ohos.*`) + "no app reads another app's keys" rule (the two shared keys above are the only exceptions) | Each app's save format is its own domain. Nothing to centralize; everything to *fence*. |
| **HTML-escaping / security utils** | **Shared library candidate, deferred** | Forge's weak `esc()` vs NEXUS's complete `NX.esc()` is a real quality gap (audit M5), but fix Forge's four lines first; extract a library only if a fourth implementation appears. |
| **Brand assets** | **Contract** — `Website/brand/` is canonical; apps copy files, never hotlink | Files, not infrastructure. |

**Explicitly not centralized, and why:** mission/simulation engines (specialized domain ×3); voice I/O (Web Speech usage is 20 lines per app); the GHOST event bus (app-internal architecture, not a platform); anything requiring npm/build tooling (the zero-build property is a portfolio-wide asset — it is why four products stayed shippable with no CI; do not spend it casually).

## Data ownership

| Data domain | Authoritative owner | Consumers | Access mechanism |
|---|---|---|---|
| Ability profile (proposed key `rsg.ability.v1`) | **Onehand OS shell** (only writer, via its settings UI) | GHOST onehand, Forge layout, future apps | localStorage read (same origin), schema-versioned |
| Anthropic API key (proposed key `rsg.anthropic_key`) | **Onehand OS shell** settings (single writer post-migration; app-local UIs become read/fallback) | Forge, NEXUS, Observatory | localStorage read; never leaves browser except to api.anthropic.com |
| NEXUS world save (`nexus_world_v1`, `nexus_voice`, `nexus_npc_model`) | **NEXUS** | none | private |
| Forge settings/spec/history (`forge.settings.v1`) | **THE FORGE** | none | private |
| GHOST world model / audit / missions (upstream `store.js` — key name unverified, assumed `ghost.*`) | **GHOST** | none | private |
| Observatory saves (unverified) | **Observatory** | none | private |
| Shell prefs (`ohos.hand`; `ohos.last` is dead — audit L1) | **Shell** | none | private |
| Brand assets | **Website** (`brand/`) | all apps, print/QR collateral | file copy at build/author time |
| Public web content | **Website** | public | static hosting |

One writer per domain throughout. Today's only violations of clean ownership are the **verbatim copies** (two "owners" of the entire GHOST and Forge codebases — resolved under Duplication) and the **API key existing under two app-private keys** (resolved by the shared-key contract).

## Contracts

**1. App manifest (`Onehand OS/apps.json`)** — shell ⇄ apps seam
```json
{ "v": 1, "apps": [
  { "id": "ghost",  "name": "GHOST",       "path": "../GHOST/",        "entry": "index.html", "needsServer": false },
  { "id": "forge",  "name": "THE FORGE",   "path": "../The forge/",    "entry": "index.html", "needsServer": true  },
  { "id": "nexus",  "name": "NEXUS",       "path": "../GHOST/nexus/",  "entry": "index.html", "needsServer": false }
] }
```
Versioned (`v`); unknown fields ignored; shell renders tiles from it. Apps never know the shell exists (they already don't — verified: zero shell references in any app). Compatibility rule: adding apps/fields is minor; changing `path` semantics bumps `v`.

**2. Ability profile (`rsg.ability.v1`)** — shell → apps
```json
{ "v": 1, "hand": "left|right", "fingers": ["thumb","index","middle","ring","pinky"], "reachMM": 95, "input": "touch|mouse|voice" }
```
Writer: shell only. Readers map it themselves (Forge → column filtering/mirroring it already does from identical fields in `layout.js`; GHOST onehand → its control layout). Missing/invalid → app falls back to its own defaults (soft dependency, mandatory). Versioning: additive fields only within `v:1`; breaking change = new key, old key retained for one migration cycle.

**3. API key (`rsg.anthropic_key`)** — shell → AI-using apps
Plain string, single writer (shell settings). Apps check the shared key first, their legacy key second (expand/contract — see Migration). Security note: same-origin serving makes this key readable by every app on the origin; the escaping fixes from the audit (M5) are a precondition for this contract (see Failure isolation).

**4. Claude bridge library (`shared/claude-bridge.js`)** — build-time reuse
Surface: `configure({model, effort})`, `messages(request)` with structured-output schema support, refusal/fallback semantics as Forge implements them today, `onFallback(cb)` for the local-brain hook. Distributed as a vendored file per app (no package manager — preserving zero-build), versioned by header comment; consumers upgrade by copying deliberately. History-windowing rule (start on a `user` turn, no duplicate tail) baked in — fixing NEXUS's H4 class of bug for every future consumer.

**5. Namespace convention** — one page in the repo README: each app prefixes its keys (`ghost.` / `nexus_` / `forge.` / `ohos.`); reading another app's namespace is forbidden except contracts 2–3; `serve.py` at repo root is the one dev server. No service-to-service auth exists or is needed — there are no services.

## Duplication to remove

All verified by the inspector (similarity scores) and `diff`:

1. **`Onehand OS/apps/ghost/` — stale verbatim copy of `GHOST/`** (17 files identical incl. all of `nexus/`; `js/data.js` 0.97, `tools/build_standalone.py` 0.94; missing upstream's `js/{onehand,orchestrator,planner,shell}.js` and the entire `observatory/` sub-app). **Replace with:** manifest entry pointing at `../GHOST/` (Contract 1). The copy is already 9+ hours and four modules behind — it is not a snapshot, it is a fork nobody chose.
2. **`Onehand OS/apps/forge/` — stale verbatim copy of `The forge/`** (`exports/firmware/pcb/serve` identical; `catalog` 0.98 → `modes` 0.88 diverged; missing upstream's `js/{validation,drawings,enclosure,requirements,partlib,complexity}.js`). **Replace with:** manifest entry pointing at `../The forge/`.
3. **`serve.py` ×2 identical** (`Onehand OS/serve.py` ports differ only) + `The forge/serve.py`. **Replace with:** one `RSG/serve.py` at repo root once the manifest lands; delete the others.
4. **Anthropic bridge ×2 independently implemented** (`The forge/js/claude.js` ↔ `GHOST/nexus/js/claude.js` — same capability, different code, quality already diverging). **Replace with:** Contract 4's shared library, adopted opportunistically (NEXUS first — it has the live bug).
5. **Ability-profile logic ×2.5** (`The forge/js/layout.js` ability inputs; `GHOST/js/onehand.js` capability profile; shell's L/R toggle). Not code-identical — *concept* duplication with guaranteed drift. **Replace the data, not the logic:** all three read Contract 2; each keeps its own domain mapping.

Not duplication (deliberately kept): the three sim engines, per-app util helpers, per-app CSS themes, NEXUS/Observatory both being "simulators" (different products), the Website's independent stack.

## Migration plan

Every phase ships alone, breaks nothing, and rolls back with `git revert` (Phase 0 makes that true). User-visible URLs (`localhost:8100`) never change.

**Phase 0 — Baseline (15 min).** `git init` at `RSG\`, commit everything as-is (both copies included — they are evidence and rollback state). *Gate:* `git status` clean. *Rollback:* n/a. **Precondition for every later phase.** Coordinate with the active GHOST/Forge sessions: commit between their runs, not mid-write.

**Phase 1 — One origin, zero moves (1 hr).** Add `RSG/serve.py` (port 8100, serving the whole `RSG\` folder); shell gains `apps.json` (Contract 1) with paths to the **originals**; shell tile code reads the manifest with a hardcoded fallback to the current `apps/` copies if fetch/parse fails. *Ships independently:* copies untouched, old per-app servers still work. *Gate:* all four apps (incl. Observatory, added as a fourth tile) boot from originals via the shell with zero console errors — the audit's smoke method, scripted. *Rollback trigger:* any app fails from its original path → shell falls back to copies automatically.

**Phase 2 — Delete the copies (30 min).** Remove `Onehand OS/apps/` and the redundant `serve.py`s; remove the fallback branch. *Gate:* same smoke script green. *Rollback:* `git revert` restores copies instantly.

**Phase 3 — Un-nest NEXUS and Observatory (half day, do while their sessions are idle).** `git mv GHOST/nexus NEXUS` and `git mv GHOST/observatory Observatory`; update two manifest paths; grep-verify GHOST has no references to either (audit already confirmed zero for nexus; verify for observatory). *Gate:* smoke script + one NEXUS save/load cycle (its localStorage is origin-scoped, not path-scoped — saves survive the move; verify anyway). *Rollback:* `git revert` the move commit.

**Phase 4 — Shared contracts (1–2 days, expand/contract).** *Expand:* shell settings panel writes `rsg.ability.v1` + `rsg.anthropic_key`; Forge/NEXUS/GHOST read shared-key-first-then-legacy; Forge's `layout.js` and GHOST's `onehand.js` read the ability profile with their current inputs as fallback. *Contract (later, separate commit each):* retire legacy key reads once observed unused. *Gate per app:* behavior identical with no shared keys present (fallback path). *Rollback:* each app's adoption is one commit.

**Phase 5 — Claude bridge library (opportunistic).** Extract Forge's `claude.js` core to `shared/claude-bridge.js` (with the history-windowing fix); adopt in NEXUS first (fixes its H4 bug), Forge second, Observatory if/when it calls Claude. One app per commit. *Gate:* one live keyed conversation >15 turns in NEXUS.

**Phase 6 — Hygiene (background).** Commit `apps.json`/contracts doc into the repo root README; recover or regenerate the Website source (R5); adopt `tokens.css` only as files get touched anyway.

## Failure isolation

The ecosystem's isolation story is genuinely good *because* nothing shares a runtime — the design work is to keep it that way:

| Dependency | Type | Blast radius if down/broken | Degradation |
|---|---|---|---|
| `RSG/serve.py` (root server) | Hard for Forge (ESM); soft for GHOST/NEXUS (classic scripts run from `file://`); shell needs it | Nothing loads via the shell | Any static server is a drop-in; `GHOST/ghost.html` single-file build double-clicks with zero deps — keep generating it as the designated disaster mode |
| Anthropic API | Soft by construction in both consumers (verified: local fallbacks engage on any error) | AI features degrade to local engines | Already correct; preserve the fallback contract in the shared library |
| Shared ability profile / API key (localStorage) | Soft, mandatory fallback (Contract 2/3) | App uses own defaults / prompts for key | Missing or corrupt key must never block an app boot — gate in each adoption commit |
| Shell iframe stage | n/a (bulkhead) | A crashing app cannot take down the shell or sibling apps (separate iframes, verified: three apps cycled with zero cross-contamination) | Keep apps ignorant of the shell; never add a shell-side API apps depend on |
| **Single origin (new in Phase 1)** | Shared substrate | Two real couplings appear: (a) all apps share one ~5–10 MB localStorage quota — NEXUS's 117 KB+ growing save and future GHOST world saves now compete; (b) an XSS in *any* app can read the shared API key | (a) namespace convention + NEXUS's existing quota-truncation path; monitor with a one-line usage readout in shell settings. (b) the audit's escaping fixes (Forge M5, GHOST L2) are **prerequisites** for Phase 4's shared key — sequence them first. If either coupling ever bites, per-app ports restore full isolation at the cost of re-entering keys — a deliberate, reversible trade |
| Website | Fully isolated (separate hosting, no runtime link to apps) | none ↔ none | Keep it that way; brand files are copied, never fetched cross-origin |

## Risks

1. **Live divergence during migration.** Other AI sessions are actively rewriting GHOST and The forge (four new modules appeared in one day). A move or delete mid-session could orphan their work. *Mitigation:* Phase 0 git baseline first; execute Phases 2–3 only while those sessions are idle; never edit the originals from the shell's session.
2. **The two-umbrella problem compounds.** GHOST's new `shell.js`/`onehand.js` layer overlaps the Onehand OS shell's mandate; left alone, GHOST becomes the de-facto OS and the shell becomes dead weight — or worse, both evolve half of the same feature. *Mitigation:* decide the seam now (recommended: shell owns *launching and the ability profile*; GHOST's onehand subsystem consumes the profile and owns only its in-app control layout); put that one sentence in both READMEs.
3. **Shared-origin key exposure.** Phase 4 widens who can read the Anthropic key from one app to all apps on the origin. *Mitigation:* land the escaping fixes first (they're small); the key remains a user-pasted, user-revocable credential; document that demo machines should use a low-limit key.
4. **Copies resurrect.** The pattern that created `apps/` (copy-to-integrate) is one convenient instinct away from recurring. *Mitigation:* the manifest makes referencing cheaper than copying; a repo-root README rule ("apps are referenced, never copied") plus git review makes regressions visible.
5. **Website source is missing.** Only the Next.js build export exists in `RSG\Website`; the source presumably lives in a chat session or another machine. The site cannot be edited, only replaced. *Mitigation:* locate and commit the source (or accept regenerate-from-scratch as the plan and write that down).
6. **Migration cost is low but not zero, and it's all Joseph.** Six phases of coordination overhead on a solo founder + AI sessions. *Mitigation:* Phases 0–2 are ~2 hours total and deliver most of the value (one source of truth); Phases 4–6 are opportunistic and can trail by weeks without harm.
7. **Over-centralization temptation.** The next natural-sounding step — "one shared engine/UI kit/state store for all apps" — would convert four independently-shippable products into a distributed monolith with zero correctness gain. *Mitigation:* this document's classifications; anything promoted to "shared service" must first fail the library/contract test in writing.
