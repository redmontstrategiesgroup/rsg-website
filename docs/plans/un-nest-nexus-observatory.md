# Implementation Plan: Un-nest NEXUS + Observatory in RSG

## Desired outcome

NEXUS and Observatory become **top-level RSG products** (`RSG/NEXUS/`, `RSG/Observatory/`) instead of living inside `RSG/GHOST/`. From the user's side nothing visibly changes — both still launch from the Onehand OS shell, keep every saved city/scenario, and use the shared key — but the folder structure now matches what they actually are: three independent apps, not one app with two unrelated products buried in its tree.

## Current system

All paths relative to `C:\Users\josep\Desktop\RSG\` (git repo, `main`, HEAD `0864b6e`). Verified by direct reads this session.

- **The two sub-apps are self-contained.** `GHOST/nexus/` (living-city sim, `NX.*` globals, classic scripts) and `GHOST/observatory/` (decision-analysis sim, `OBS.*` globals, classic scripts) each have their own `index.html` + `css/` + `js/`. Confirmed: **GHOST proper references neither** (`grep "nexus\|observatory"` over `GHOST/index.html`, `GHOST/js/*.js`, `GHOST/ghost.html`, `GHOST/tools/build_standalone.py` → 0 hits), and neither sub-app hardcodes an absolute path or the string "GHOST" (grep → 0 hits). They sit in `GHOST/` only by accident of where a session built them.
- **The one cross-folder dependency each** is the shared bridge: `GHOST/nexus/index.html:80` and `GHOST/observatory/index.html:62` both load `../../shared/claude-bridge.js` (two levels up from a depth-2 folder). This is the *only* `../`-parent reference in either app.
- **The shell finds apps by manifest.** `Onehand OS/apps.json` (`v:1`) lists tile `path`s: `../GHOST/nexus/` (line 30) and `../GHOST/observatory/` (line 40). The shell's static-fallback array in `Onehand OS/index.html` (~line 522) also carries a NEXUS entry pointing at `../GHOST/nexus/` (there is **no** static Observatory entry — Observatory comes only from the manifest).
- **Serving:** `serve.py` at the repo root serves the whole `RSG/` folder on `:8100`; the shell lives at `/Onehand OS/`, so a manifest `path` of `../NEXUS/` resolves to `/NEXUS/`.
- **Storage is origin-scoped, not path-scoped.** NEXUS owns `nexus_world_v1`, `nexus_api_key`, `nexus_npc_model`, `nexus_voice`; Observatory owns `obs_store_v1` (`GHOST/observatory/js/core.js:71`) and `obs_api_key` (`copilot.js:8`). All keyed on the origin `http://localhost:8100`, which does **not** change when a folder moves within the same server — so every saved city and scenario survives the move.
- **Git is in place** (baseline `48634ae` → HEAD `0864b6e`), so `git mv` is a tracked rename and any phase is `git revert`-able.

## Gaps

1. The folders are in the wrong place — a structural/ownership gap, not a functional one. Nothing is broken; it's mis-located.
2. After a move from depth-2 (`GHOST/nexus/`) to depth-1 (`NEXUS/`), each sub-app's bridge path `../../shared/…` is one `../` too many and would 404 (the bridge would silently not load; apps still run via their inline fallback, but that's a regression in the shared path).
3. Three manifest/fallback path references still point at the old `GHOST/*` locations.
4. **Cross-session hazard (the real risk, not code):** `GHOST/` — including `nexus/` and `observatory/` — is the working tree of other Claude sessions. A `git mv` while one of those sessions has these folders open mid-edit would either conflict or strand their edits at the old path. This gates *when* the plan runs, not *how*.

## Proposed architecture

- **Frontend responsibilities:** none change inside the apps beyond one path string each. The move is a rename + reference fix-up.
- **Backend / Database / APIs / Jobs:** none — zero-backend static portfolio; no server code, no DB, no endpoints touched.
- **Authentication / authorization:** N/A — single local user, no auth, no roles.
- **External integrations:** the Anthropic bridge — its *path* from each app changes by one `../`; its behavior is untouched.
- **Data ownership:** unchanged. Each app keeps sole ownership of its own `localStorage` namespace; the move can't alter origin-scoped storage. This is the load-bearing safety property and every phase re-verifies it.
- **Trust boundaries / logging / error handling:** unchanged.
- **Reuse:** this is pure reuse — the manifest mechanism (built in ecosystem Phase 1) already exists precisely so apps are referenced by path; we're just changing two paths. No new infrastructure.

**Naming:** move to `RSG/NEXUS/` and `RSG/Observatory/` (matching `ecosystem-architecture.md`). Case is deliberate and the manifest path must match the folder exactly; on case-insensitive Windows the rename is safe because the parent directory differs.

## User flows

**Primary (unchanged, must keep working):** open shell → tap the NEXUS tile → NEXUS loads full-screen with the user's existing city intact → talk to a resident (uses the shared key via the bridge) → ⌂/Esc returns home. Same for Observatory.

**Failure/edge flows to hold:** if the bridge path were wrong, `window.RSGClaude` would be undefined and each app would fall back to its inline Claude path (degraded but not broken) — so "bridge loads" is an explicit acceptance check, not an assumption. If a folder were moved while a save existed, the save must still load (origin-scoped) — also an explicit check.

## Implementation phases

Each phase is one commit, independently shippable and `git revert`-able. **Precondition for the whole plan:** run it only while the sessions that own `GHOST/` are idle (Gap 4); do the moves between their runs.

**Phase 1 — Move NEXUS (thin, complete, usable slice).**
- `git mv "GHOST/nexus" "NEXUS"`
- `NEXUS/index.html`: `../../shared/claude-bridge.js` → `../shared/claude-bridge.js`
- `Onehand OS/apps.json`: nexus `path` `../GHOST/nexus/` → `../NEXUS/`
- `Onehand OS/index.html` static-fallback NEXUS entry: `../GHOST/nexus/` → `../NEXUS/`
- *Ships alone:* Observatory still works from `GHOST/observatory/` untouched; GHOST unaffected.
- *How I'll know it works:* see Acceptance P1.

**Phase 2 — Move Observatory (independent of Phase 1).**
- `git mv "GHOST/observatory" "Observatory"`
- `Observatory/index.html`: `../../shared/claude-bridge.js` → `../shared/claude-bridge.js`
- `Onehand OS/apps.json`: observatory `path` `../GHOST/observatory/` → `../Observatory/`
- *Ships alone:* order vs Phase 1 doesn't matter; either can revert without the other.

**Phase 3 — Docs + final sweep.**
- `Onehand OS/README.md` (path list line ~22), `CONTRACTS.md` (any `GHOST/nexus` mention), and mark ecosystem Phase 3 done in `ecosystem-architecture.md`.
- Grep the whole repo for surviving `GHOST/nexus`/`GHOST/observatory` references outside historical docs (`docs/plans/*`, the audit) and fix live ones.
- Re-run the all-apps smoke check; update the session memory note.

## Acceptance criteria

- **P1 (NEXUS):** navigating the shell's NEXUS tile loads `http://localhost:8100/NEXUS/index.html` (not `/GHOST/nexus/`); inside it `window.RSGClaude` is defined (bridge loaded from the new `../shared/` path) and `NX` exists; a `nexus_world_v1` value written *before* the move still parses and loads *after* it (save survived); **zero console errors**; and `GHOST/index.html` still boots clean (nothing lost from GHOST). Old path `GET /GHOST/nexus/index.html` now 404s.
- **P2 (Observatory):** shell Observatory tile loads `/Observatory/index.html`; `window.RSGClaude` defined and `OBS` exists; a pre-move `obs_store_v1` value still loads post-move; zero console errors.
- **P3 (sweep):** `grep -rn "GHOST/nexus\|GHOST/observatory"` returns hits only in historical docs (`docs/plans/`, `*-audit.md`), none in `apps.json`, `Onehand OS/index.html`, `CONTRACTS.md`, or app code; all four apps boot with zero console errors in one pass.

## Testing plan

- **Unit:** none needed — no logic changes. (`shared/bridge-test.html` still 13/13 confirms the bridge itself is unaffected; run it once as a guard.)
- **Integration:** the acceptance checks above are the integration tests — shell manifest → new path → app boots → bridge loads → save loads — run in the live browser via `serve.py`.
- **End-to-end (manual click-through):** from the shell home, launch NEXUS, confirm the city renders and a resident conversation works; return home; launch Observatory, confirm a scenario loads; launch GHOST and THE FORGE to confirm they're untouched.
- **Security:** N/A (no auth/authz/endpoints introduced or moved); the shared key remains origin-scoped and readable exactly as before.
- **Failure-state:** before Phase 1, write a sentinel `nexus_world_v1` (e.g. a known small JSON); after the move confirm it loads — proves the origin-scoped-survival claim rather than trusting it. Repeat for `obs_store_v1` in Phase 2. Also confirm a wrong bridge path would be caught: temporarily check `window.RSGClaude` is truthy (if the `../shared/` edit were forgotten it'd be undefined).
- **Fixtures:** none. Verification uses the real apps through the root server.

## Deployment plan

- No environments, migrations, or env vars. "Deploy" = commit on `main`.
- Sequence = phase order; each phase is one commit. Do the moves only while the GHOST-owning sessions are idle (coordinate: commit between their runs, never mid-write).
- Compatibility window: because Phase 1 updates the manifest **and** the static fallback in the same commit, there is no in-between state where the shell points at a folder that moved — the tile path and the folder move atomically per commit.

## Rollback

- Per phase: `git revert <that commit>` — restores the folder to `GHOST/*` and reverts the path edits together, instantly and cleanly (the move is a tracked rename). No data migration to undo; saves are origin-scoped and unaffected either direction.
- If a GHOST-owning session recreated `GHOST/nexus/` after the move (the Gap-4 hazard materializing), reverting won't silently clobber it — `git` will surface the conflict; resolve by choosing the intended location. Mitigation is prevention: run only while those sessions are idle.

## Risks

- **Cross-session file contention (integration/operational, the top risk):** moving another session's folders. *Mitigation:* gate on idle; moves are atomic commits; revert is clean. **Impact if ignored:** stranded edits or a recreated `GHOST/nexus`.
- **Forgotten bridge-path edit (integration):** if the `../../` → `../` fix is missed, the bridge silently 404s and the app quietly runs on its inline fallback (degraded Claude path, no visible error). *Mitigation:* the acceptance check asserts `window.RSGClaude` is defined, catching exactly this.
- **Manifest/folder-name mismatch (integration):** a `path` that doesn't match the actual folder case/name → the tile 404s (now caught by the shell's stage error panel, but still wrong). *Mitigation:* P1/P2 checks load the *new* URL explicitly.
- **Data integrity (low, mitigated):** theoretical only — origin is unchanged, so saves cannot be lost; the sentinel-save failure test proves it rather than assuming it.
- **Migration difficulty:** minimal — 4 small edits + 2 `git mv`s, fully reversible.
