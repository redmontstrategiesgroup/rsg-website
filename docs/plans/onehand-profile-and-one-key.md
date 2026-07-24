# Implementation Plan: Onehand Profile + One Key in RSG / Onehand OS

## Desired outcome

Joseph declares his physical-ability profile (hand, usable fingers, reach, grip, fatigue, extra inputs) **once**, in the Onehand OS shell — and every RSG app adapts to it: THE FORGE lays out hardware around that hand, GHOST's PHANTOM HAND dock builds its reach-optimized layout from it, and the shell places its own controls on the right side. He pastes his Anthropic API key **once**, in the same settings panel — and Forge's AI generation, NEXUS's Claude minds, and Observatory's copilot all unlock, with NEXUS's long-conversation failure fixed for good.

## Current system

All paths relative to `C:\Users\josep\Desktop\RSG\` (git repo, `main`, HEAD `2e20ed4`). Everything below was read directly; audited behaviors reference `onehand-os-audit.md`.

**Shell** — `Onehand OS/index.html` (~260 lines, single file)
- Builds tiles from `Onehand OS/apps.json` (manifest, `v:1`); static tiles as fallback. Apps run in a full-screen iframe stage, `⌂` dock button in the thumb zone.
- Hand preference: an L/R toggle writing `localStorage["ohos.hand"]`, which only flips the dock side. No settings panel of any kind exists. `ohos.last` is written but never read (audit L1).

**GHOST** — `GHOST/js/onehand.js` (139 lines, PHANTOM HAND)
- Profile shape (`onehand.js:15-17`): `{ hand, thumbReach: "limited", fingers: <count>, grip: "weak", fatigue: "low", inputs: ["voice","foot"], targetScale: 1.5 }` — note `fingers` is a **count**.
- `generateLayout()` (`:32-49`) derives item cap from fatigue/fingers, target px from `targetScale`, arc side from `hand`, sticky modifiers from grip/fingers.
- Persists via `G.store.setting("onehand", active)` on activate/deactivate (`:122,132`) into the `ghost:v2` localStorage blob (`GHOST/js/store.js:10`, `settings` at `:33`). The in-dock "⇄ swap hand" button (`:107`) mutates the active profile locally.

**THE FORGE** — ES modules
- Ability shape: `spec.ability = { hand, fingers: {thumb:…,index:…,…} <boolean map>, reachMM }` — consumed by `The forge/js/layout.js:24-30` (`ability.reachMM` radius, `ability.fingers[f.id]` column filter). Set by the ability panel: `readAbilityPanel` (`The forge/js/main.js:119`), controls `#seg-hand` / `#finger-picker` / `#reach-range` (`main.js:943-946`); the panel shows in `product` and `access` modes (`main.js:335`).
- Key/model: `The forge/js/claude.js:7-14` — JSON blob `localStorage["forge.settings.v1"]` `{apiKey, model}` (default `claude-fable-5`); `callClaude` (`:16-52`) holds the canonical request implementation: `output_config` structured outputs, browser-access header, and the Fable-5 refusal-fallback beta (`:33-37`).

**NEXUS** — `GHOST/nexus/js/claude.js` (123 lines, classic script, `NX.claude`)
- Key `localStorage["nexus_api_key"]`, model `nexus_npc_model` (default `claude-haiku-4-5`) (`:8-11`). Same correct API shapes.
- **Live bug (audit H4):** `:76-80` — history passed already containing the in-flight message, then `messages.push({role:"user", content:text})` duplicates it; `history.slice(-12)` can start the array on an `assistant` turn → API 400 → silent local fallback after ~6 exchanges. Local fallback contract: `{reply, effects}` applied by `NX.dialogue.applyEffects` — shared by both brains (the architecture worth preserving).

**Observatory** — `GHOST/observatory/js/copilot.js` (226 lines, classic script, `OBS.copilot`)
- Key `localStorage["obs_api_key"]` (`:8-10`); model `OBS.store.data.settings.copilotModel || "claude-opus-4-8"`; same fetch/headers/`output_config`/refusal patterns (`:124-140`); deterministic `localBrief` fallback (`:64-107`).

**Serving** — `serve.py` (repo root) serves everything on `127.0.0.1:8100`, `/` → shell. All apps share one origin (so one localStorage namespace), which is what makes cross-app contracts possible at all. The forge's own `serve.py` (`:8137`, roots at its folder) cannot see files above its folder.

**Testing infrastructure:** none anywhere (no test files, no CI — audit H6). Verification to date is browser-driven smoke checks.

## Gaps

1. No shared profile exists. Three disjoint shapes: shell (`hand` only), GHOST (count-based, rich), Forge (map-based + mm). A user re-declares their hand per app, and the declarations can contradict.
2. No shared key. Three stores (`forge.settings.v1`, `nexus_api_key`, `obs_api_key`) — three paste-the-key ceremonies per browser.
3. Three independent Anthropic bridge implementations; quality already diverges (NEXUS's H4 bug; Forge's is the best).
4. The shell has no settings UI to own any of this — it must grow one (*new*).
5. Precondition from the audit: Forge's weak `esc()` (M5) and GHOST's redirect innerHTML (L2) are open XSS surfaces; a shared key raises their stakes (any-app XSS → key theft).
6. No test harness of any kind to verify against.

## Proposed architecture

- **Frontend responsibilities (shell)** — *new* ⚙ settings overlay in `Onehand OS/index.html` (same single-file, zero-build style): hand L/R (replacing/absorbing the existing footer toggle), five finger checkboxes, reach slider (mm), grip + fatigue selectors, input-aids checkboxes (voice / foot pedal), and an API-key field (password input, show/hide). Writes the two shared keys below. The shell's dock side reads `profile.hand`.
- **Contracts (the core of the design)** — two localStorage keys, single writer = shell:
  - `rsg.ability.v1` — superset schema so every consumer finds its fields:
    ```json
    { "v": 1, "hand": "right", "fingers": {"thumb": true, "index": true, "middle": false, "ring": false, "pinky": false},
      "reachMM": 95, "grip": "weak", "fatigue": "low", "inputs": ["voice","foot"], "targetScale": 1.4 }
    ```
    Forge consumes `hand`/`fingers`/`reachMM` directly (its exact shape). GHOST maps `fingers` → count (`Object.values(f).filter(Boolean).length`) and reads `grip`/`fatigue`/`inputs`/`targetScale` directly; its `thumbReach` derives from `reachMM < 80 ? "limited" : "full"`. Unknown fields must be preserved by any reader that round-trips. Missing/corrupt key ⇒ every consumer uses its current defaults (soft dependency, mandatory).
  - `rsg.anthropic_key` — plain string. Consumers read shared-first, legacy-second: Forge `getSettings()` overlays `apiKey: shared || settings.apiKey`; NEXUS `C.getKey()`; Observatory `CP.getKey()`. Per-app **model** choices stay app-local (defaults genuinely differ: Fable 5 / Haiku 4.5 / Opus 4.8 — a deliberate non-centralization).
- **Shared library** (*new*) — `shared/claude-bridge.js`, a classic script assigning `window.RSGClaude` (works for NEXUS/Observatory IIFEs; Forge's ES modules read the global after a `<script>` tag in its `index.html` — no build step, one source file). API: `getKey()/setKey()` (delegating to `rsg.anthropic_key` + legacy fallback), `request({system, messages, schema, model, maxTokens, effort})` — Forge's `callClaude` semantics verbatim (refusal-fallback beta for Fable 5, structured outputs, refusal detection), plus `windowHistory(turns, {max=12})` which drops the in-flight message, trims from the front, and guarantees the array starts with a `user` turn — the H4 fix, baked in so no consumer can reintroduce it.
- **Backend responsibilities / Database changes / Background jobs / APIs** — none; there is no backend by design. localStorage is the only store; the "API" is the two key contracts above.
- **Authentication and authorization** — n/a (single local user, no roles). The API key is user-supplied and user-revocable; it never leaves the browser except to `api.anthropic.com` (already true in all three apps; the bridge preserves it).
- **External integrations** — Anthropic Messages API only, via the bridge. Failure behavior unchanged per app: every consumer keeps its existing local fallback (Forge offline interpreter, NEXUS local brain, Observatory `localBrief`).
- **Logging and analytics** — none added (matches the portfolio); bridge surfaces errors to callers, callers keep their toasts/`lastError` surfaces.
- **Error handling** — bridge throws typed-ish errors (`no-key`, HTTP message, refusal); consumers' existing catch-and-fallback paths handle them. Corrupt `rsg.ability.v1` JSON ⇒ `try/catch` → defaults; corrupt is never written back.
- **Trust boundaries** — user-typed sentence/text already crosses into innerHTML in Forge exports (audit M5) and GHOST redirect (L2); **fixing those two escapers is Phase 0 of this plan** because the shared key widens what an XSS can steal. Profile values are constrained enums/numbers, clamped on read.
- **Data ownership** — shell owns both shared keys (sole writer). Apps own their local stores exactly as today; GHOST's in-app "swap hand" stays a session-local override in `ghost:v2` and is **not** written back (single-writer preserved; the shared profile is the default, not a live sync).

## User flows

**Primary — profile:** open shell → ⚙ → set left hand, uncheck ring/pinky, reach 80 mm → close. Shell dock moves left immediately. Launch Forge → ability panel already shows LEFT/3 fingers/80 mm → FORGE IT lays out around that hand. Launch GHOST → activate PHANTOM HAND → dock renders lower-left, 3-finger cap, sticky mods.

**Primary — key:** ⚙ → paste key → launch NEXUS → talk to a resident → Claude replies (no per-app key step). Same for Forge AI generation and Observatory brief.

**Alternates / failures:** no profile set → every app behaves exactly as today (defaults). Corrupt profile JSON → same. No key → apps' existing no-key paths (offline interpreter / local brain / local brief + their own key fields as legacy fallback). Invalid key → API 401 surfaces through each app's existing error toast; fallback engages. NEXUS conversation past 6 exchanges → stays on Claude (H4 fixed). App launched standalone from `file://` or Forge's own `:8137` server → bridge script may 404; consumers must no-op gracefully (feature only guaranteed via the root server).

## Implementation phases

Each phase is one commit, independently testable, revertible with `git revert`. Phases 2–5 touch `GHOST/` and `The forge/` — **coordinate with the sessions that own those folders** (edits are small and localized; do them while those sessions are idle, as with ecosystem Phases 0–2).

**Phase 0 — Close the XSS preconditions (Forge M5, GHOST L2).**
Extend Forge's `esc()` (`The forge/js/main.js:820` — verify line upstream) to escape `>`, `"`, `'`; escape `spec.name` in `pcbSVG` and `spec.tagline` in `manualHTML`/`productSiteHTML` (`The forge/js/exports.js`). Escape redirect text in `GHOST/js/engine.js` feed line. *Testable:* forge a product named `<img src=x onerror=alert(1)>` → exported manual renders it inert; GHOST redirect with `<b>x</b>` renders literally.

**Phase 1 — Shell settings panel + `rsg.anthropic_key` (thin slice: key only).**
New ⚙ button + overlay in `Onehand OS/index.html`; key field writes/clears `rsg.anthropic_key`. Consumer edits (3 lines each): `The forge/js/claude.js:10` overlay shared key; `GHOST/nexus/js/claude.js:8`; `GHOST/observatory/js/copilot.js:9` — shared-first, legacy-second. *Testable:* paste key in shell → `hasKey()`/`enabled()` true in all three apps with their legacy stores empty; clear key in shell (legacy also empty) → all three revert to local fallbacks.

**Phase 2 — `rsg.ability.v1` + shell profile editor.**
Settings panel grows the profile fields; writes the superset schema; initializes `hand` from legacy `ohos.hand` on first open; shell dock side now follows `profile.hand` (keep `ohos.hand` as fallback read). Delete the dead `ohos.last` write while in the file (audit L1). *Testable:* set left/3-fingers/80 mm → localStorage holds the documented schema; dock moves left; corrupting the JSON by hand → shell falls back to right-hand defaults without console errors.

**Phase 3 — Forge consumes the profile.**
In Forge's boot path (where the default spec/ability panel initializes — `main.js` near `readAbilityPanel`), seed `spec.ability` from `rsg.ability.v1` (`hand`, `fingers` map, `reachMM`) when present; panel remains fully editable (in-app override, not written back). *Testable:* with profile set left/3/80, opening Forge shows the ability panel pre-set to LEFT · 3 fingers · 80 mm and the generated deck mirrors/compacts accordingly; with no profile, panel shows today's defaults.

**Phase 4 — GHOST consumes the profile.**
`GHOST/js/onehand.js` `defaultProfile()` reads `rsg.ability.v1` and maps: count from the fingers map, `thumbReach` from `reachMM`, pass-through `grip`/`fatigue`/`inputs`/`targetScale`; falls back to current literals. Session persistence and swap-hand behavior unchanged. *Testable:* with fatigue "high" in the shared profile, activating PHANTOM HAND renders ≤5 targets; with the key absent, behavior identical to today.

**Phase 5 — `shared/claude-bridge.js` + adoption (NEXUS first).**
Create the bridge (*new file*, Forge's `callClaude` semantics + `windowHistory`). Load via `<script>` in `GHOST/nexus/index.html`; `NX.claude.respond` delegates the request + history windowing to it (keeping NEXUS's schema, system prompt, and `{reply, effects}` handling). Then Observatory (`copilot.js` request path), then Forge (script tag + `callClaude` delegates to `window.RSGClaude.request`, keeping its exported app-specific functions). Consumers guard `window.RSGClaude || legacy path` so standalone serving degrades instead of breaking. *Testable per app:* one live keyed request succeeds; NEXUS: a 16+ exchange conversation stays on Claude (`NX.claude.lastError` stays null) — the H4 regression test.

**Phase 6 — Docs.** `CONTRACTS.md` at repo root documenting both keys, the schema, single-writer rule, and the namespace convention; pointer from `Onehand OS/README.md`. *Testable:* file exists and matches the implemented schema (review).

Parallelism: Phases 3 and 4 are independent of each other (both depend on 2). Phase 5 is independent of 2–4 (depends only on 1). Phase 0 can land any time before Phase 1 completes.

## Acceptance criteria

- **P0:** malicious product name/tagline renders inert in exported manual + site HTML and PCB SVG pane; GHOST redirect input renders as text. Pass/fail by direct attempt.
- **P1:** with all legacy key stores empty and `rsg.anthropic_key` set: Forge `hasKey()` === true, NEXUS `NX.claude.enabled()` === true, Observatory `OBS.copilot.enabled()` === true (console-verifiable); removing the shared key flips all three false.
- **P2:** `JSON.parse(localStorage["rsg.ability.v1"])` matches the documented schema after editing; shell dock obeys `hand`; hand-corrupted JSON → no console errors, defaults apply.
- **P3:** Forge ability panel reflects the shared profile on load (LEFT/3/80 case); no profile → today's defaults byte-for-byte in `readAbilityPanel` output.
- **P4:** PHANTOM HAND layout parameters (`generateLayout()` output: item count, targetPx, arc) change per shared profile as specified; no profile → identical to current `defaultProfile()` output.
- **P5:** live keyed NEXUS conversation ≥16 exchanges with zero fallback engagements; `windowHistory` unit-checks: output starts with `user`, never contains the in-flight message, length ≤ max.
- **P6:** CONTRACTS.md exists, schema matches implementation.

## Testing plan

No test infrastructure exists (audit H6), so the plan is deliberately harness-light and browser-real:

- **Unit-ish:** *new* `shared/bridge-test.html` — a page loading the bridge and asserting `windowHistory` edge cases (empty history, odd lengths, in-flight dedup, user-first invariant) and key-precedence logic into a pass/fail list. No framework; open the page, read green/red.
- **Integration:** the browser-console checks in Acceptance (each is a one-liner against a live app through `serve.py`).
- **End-to-end (manual click-through):** the two primary flows in User flows, on desktop viewport; repeat the profile flow at 375×812 **after** the shell mobile fix lands (audit H5 — separate work; until then verify the panel is at least reachable on desktop).
- **Security:** P0 attempts (script-bearing name/tagline/redirect); verify the key never appears in any URL or non-Anthropic request via DevTools network capture during a keyed run.
- **Authorization:** n/a — no roles exist; noted, not skipped.
- **Failure-state:** no key / bad key (401) / network offline (DevTools offline) per app → local fallback engages with the app's existing toast; corrupt profile JSON → defaults.
- **Fixtures/stubs:** none needed — the local fallbacks are the stubs, and one real low-limit API key is required for Phase 5 verification (Joseph supplies at run time; never committed).

## Deployment plan

- No environments, no migrations, no env vars — local static files under git. "Deploy" = commit on `main`.
- Sequencing = phase order; each phase is one commit; rollback = `git revert <commit>` (verified pattern from ecosystem Phases 0–2).
- Feature-flag equivalents: every consumer treats both shared keys and the bridge global as optional (absence = today's behavior), so a revert of any single phase cannot break another app.
- Compatibility window: legacy key stores keep working throughout (shared-first, legacy-second); retire legacy reads only after weeks of observed non-use, as its own commit.
- Monitoring: none exists; observable signals are each app's existing error toasts and `lastError` surfaces.

## Risks

- **Cross-session file contention (migration/integration):** Phases 0 and 3–5 edit `GHOST/` and `The forge/`, which other Claude sessions actively develop. *Mitigation:* small, localized diffs; land while those sessions are idle; git baseline already in place; if upstream churn collides, re-derive the 3-line consumer edits against the new code (the contracts don't change).
- **Schema drift (integrity):** GHOST's profile vocabulary is evolving fast (it grew `grip`/`fatigue`/`inputs` in a day). *Mitigation:* superset schema + preserve-unknown-fields rule + `v` field; new fields are additive within `v:1`.
- **Shared-origin key exposure (security):** one key readable by all apps on the origin; an XSS anywhere steals it. *Mitigation:* Phase 0 lands first (hard precondition); key is user-revocable; recommend a spend-capped key in `CONTRACTS.md`.
- **Standalone serving (integration):** Forge on its own `:8137` server (and `file://` shells) can't load `../shared/claude-bridge.js`. *Mitigation:* `window.RSGClaude || legacy` guard in every consumer; document that the shared features are guaranteed only via root `serve.py`.
- **Verified-line staleness (migration):** line numbers cited from The forge/GHOST may shift under active development between planning and implementation. *Mitigation:* every edit is anchored to a named function/constant (`getSettings`, `C.getKey`, `defaultProfile`, `esc`), not a line.
- **Accessibility:** the settings panel itself must be one-hand usable (it configures one-handedness). *Mitigation:* large targets, bottom-anchored panel on the dock side, keyboard-operable controls; include in the manual click-through.
- **Performance:** negligible — two localStorage reads per app boot and one ~4 KB script. No mitigation needed.
