# Implementation Plan: RSG Portfolio Hardening (harness · NEXUS economy · Forge PCB honesty · Website recovery)

One coordinated plan for the four remaining audit items. They are sequenced deliberately: **the verification harness ships first so every later fix has a real, one-click gate to prove itself against** — turning the recurring "no mechanical gates" limitation (audit H6) into the backbone the other three workstreams verify through, rather than four disconnected chores.

## Desired outcome

- **Verification:** anyone can open one page (`/shared/test-runner.html`), and in a few seconds see a single green/red verdict that (a) every RSG app boots with no console errors and (b) every logic regression suite passes — so a broken change is caught before it ships.
- **NEXUS:** a player's city behaves honestly — businesses that can't cover payroll actually run down, cut staff, and close; unemployment, crime, protests, and the election respond to a real economy instead of a rigged one where money is printed nightly.
- **THE FORGE:** a maker can never fab a dead board thinking it's verified — the PCB export plainly states its header-pin mapping is an unverified routing placeholder, and the app's own validation surfaces that gap as a warning, not just prose.
- **Website:** the RSG marketing site (`redmontstrategiesgroup.com`) becomes editable again — either by recovering its real source, or by reconstructing an editable Next.js project from the deployed build.

## Current system

All paths relative to `C:\Users\josep\Desktop\RSG\` (git repo `main`, HEAD `10dfa45`). Every claim below was read from current code this session (recon + spot-checks), not inferred.

**Verification substrate (partial today).** Two zero-build browser test pages exist and each exposes `window.__results = {passed,total,cases}`: `shared/bridge-test.html` (13 assertions on the Claude bridge) and `The forge/inspect-test.html` (4 assertions guarding the C1 fix). There is **no runner** that aggregates them and **no app-boot smoke check**. The root server `serve.py` sets no COOP/COEP headers, so same-origin iframes are fully introspectable (`frame.contentWindow.eval` works — used all session). Per-app boot signals confirmed live: GHOST → `window.G` (+`G.engine`,`G.onehand`); NEXUS → `window.NX` (+`NX.claude`,`NX.sim`); Observatory → `window.OBS` (+`OBS.copilot`,`OBS.store`); THE FORGE (ES module, no global) → `document.getElementById("btn-forge")` + `window.RSGClaude`. The app list is already data: `Onehand OS/apps.json` (`v:1`, four entries with `path`+`entry`).

**NEXUS economy (H2 — confirmed verbatim).** Settlement is `NX.economy.daily(state)` at `NEXUS/js/economy.js:17`, called only from `NX.sim.newDay` (`sim.js:108`) on midnight rollover (`sim.js:62-67`); the batch driver is `NX.sim.runTicks(state, n, fast)` (`sim.js:115`), DOM-free and safe to call from a test. The bug: the per-business loop resets `b.revenueToday=0` **only** in the closed/factory branch — `economy.js:23`: `if (!b.open || b.type === "factory") { b.revenueToday = 0; continue; }`. For open non-factory businesses it accumulates (`:34` `b.revenueToday = (b.revenueToday||0) + spend`), re-credits the **cumulative** total to cash every night (`:37` `b.cash += b.revenueToday||0`), and taxes the cumulative figure (`:55`). So cash grows without bound; the `cash<0 → badDays++` path (`:109`) never fires, staff-cut (`badDays>=2`, `:110`) and closure (`badDays>=5`, `:117`) are unreachable, and `cash>3200` hiring (`:122`) stays permanently on — pinning unemployment low. Downstream, `eco.unemployment` (`:129`) feeds `EV.electionSupport` jobless scoring (`events.js:151,155`), desperation crime/gang recruitment (`events.js:48,69`), and protest formation (`events.js:86-96`). Business shape (`data.js:207`): `{id,name,building,type,owner,cash,price,wage,quality,baseDemand,open,employees:[],revenueToday:0,badDays:0,closedDay:null}`; `revenueToday` is **never shown in the UI** (so the fix has zero UI ripple). No NEXUS tests exist.

**THE FORGE PCB (H1 — confirmed verbatim).** `The forge/js/pcb.js:40` `const gpioPad = (gpio) => hdrPins[gpio % hdrPins.length]` — a "deterministic fake mapping" (its own comment, `:39`). The header pads are an anonymous `HDR{side}_{i}` grid (`:35`) with no GPIO identity; `gpioPad` even *receives* the real GPIO number (`:77` `e.matrix.cols[c]`, `:84` `e.matrix.rows[r]`) and destroys it via `% hdrPins.length`. The Gerber/Excellon files (`gerberFiles`, `:139`) derive real *geometry* from `spec.derived.pcb`, so they're structurally valid but the copper doesn't reach the correct DevKitC-1 pins. Labeling sites: the on-screen preview title `pcbSVG` (`:109`, no caveat); the gerber-zip `README.txt` NOTE (`:207-209`, mentions DRC only); the PCB-pane hint `main.js:597` (mentions DRC only) — the most-seen site; and `README.md:155-156`. Crucially, `js/validation.js` reads `spec.derived.pcb` **zero times** (grep-confirmed): its `elecChecks` (`:111-157`) validate the *schematic* netlist (`spec.derived.elec`), and `firmwareConsistency` (`:169-186`) compares firmware↔schematic — **nothing validates the copper**, and the standalone Gerber download (`main.js:600`) has no gate/ack at all. The real GPIO source of truth exists (`electronics.js:7-36` → `spec.derived.elec.matrix`), which firmware, schematic, and PCB already read — so a *real* mapping is feasible but needs a new DevKitC-1 physical-pin table that does not exist today.

**Website (build-only — confirmed).** `RSG/Website` is a deployed-build mirror of a Vercel-hosted **Next.js App Router + Tailwind** site (buildId `PyoYSE3uLfurL9cEJLj4U`, domain `redmontstrategiesgroup.com`). Present: 30 rendered `index.html` pages, `_next/static/{chunks,css,media}`, sitemap/robots/brand assets. **Absent: all source and all reconstruction aids** — no `package.json`/`next.config`/`tsconfig`/`tailwind.config`, no `app/`/`pages/` source, no `.git`, and **no source maps** (verified). Content is ~90% recoverable from the SSR HTML (copy, unique meta, abundant JSON-LD incl. real phone/service-area, nav/footer); the 12 SEO landing pages share one chunk hash (a single data-driven template in source). Not recoverable from here: TSX, Tailwind config, and all form/auth/server logic (minified only).

## Gaps

1. **No aggregated verification** and no app-boot smoke check (H6) — the two suites must be run by hand, and nothing catches "an app stopped booting."
2. **NEXUS economy is a rigged simulation** — money printed nightly; the failure/hiring/unemployment/election pressure loop is dead code in practice (H2).
3. **Forge PCB presents fabricated copper as a real deliverable** — no honest label, and the app's validation is blind to the netlist, so every gate passes on a dead board (H1).
4. **The Website cannot be edited** — only its build exists; the real source is elsewhere (Vercel/Git) or gone.

## Proposed architecture

**The unifying idea:** a single manifest-driven runner is the backbone; each fix adds a small regression suite that plugs into it, so "is the portfolio healthy?" becomes one page load.

- **A · Verification harness.** *New* `shared/test-runner.html` (classic, zero-build): reads `apps.json`, and for each app loads it in a hidden same-origin iframe and asserts (a) its boot signal exists (per-app table above — a fatal load error prevents the global, so this catches boot failures with zero app changes) and (b) no console errors were logged after load (hook `iframe.contentWindow.console.error`/`onerror` on the `load` event). Then it loads each logic suite (`bridge-test.html`, `inspect-test.html`, and the two *new* suites below), reading their `window.__results`. It renders one green/red verdict and exposes its own `window.__results` so it is itself scriptable (future CI or a `--headless` driver). **Reuse:** the suites already expose `__results`; the runner only aggregates. *Optional layer A2 (documented, not required first):* a *new* `shared/rsg-testkit.js` error-beacon (`window.__rsgErrors=[]` + `error`/`unhandledrejection`/`console.error` capture) that each app loads **only** under a `?rsgtest=1` query flag (a 2-line inline guard in each `index.html`), giving the runner complete *pre-boot* console visibility that the load-event hook can't see. Ship A1 first; A2 is polish.
- **B · NEXUS economy.** The minimal correct fix is a one-line hoist at `economy.js:23`: reset `b.revenueToday = 0` at the **top** of the per-business loop (before the closed/factory `continue`), so line 37 credits and line 55 taxes only *today's* revenue. No other file changes; no UI ripple (`revenueToday` is never displayed). *New* `NEXUS/economy-test.html` is the revert-guard.
- **C · Forge PCB honesty.** Two tiers. **C1 (labeling, ships first):** four data-free text edits — `pcbSVG` preview caveat (`pcb.js:109`), gerber `README.txt` netlist caveat (`pcb.js:207-209`), PCB-pane hint (`main.js:597`), `README.md:155-156`. **C2 (machine-surface the gap):** a *new* check in `validation.js` that reads `spec.derived.pcb` and emits a `warn` (new area `PCB`, id `pcb-netlist`) stating the header→GPIO mapping is an unverified placeholder — so the gate/validation system *reports* the gap instead of silently passing; surface it in the PCB pane and Gate list. *New* `The forge/pcb-honesty-test.html` is the revert-guard (asserts the warning exists and the gerber README carries the caveat). **C3 (real fix, explicitly deferred):** author a DevKitC-1 physical-pin table and have `gpioPad` derive from `spec.derived.elec` — genuine engineering, out of scope for honesty, flagged as a follow-up.
- **D · Website recovery.** **D1 (investigation, no code):** locate the real source — the strongest lead is the Vercel project for `redmontstrategiesgroup.com` and its linked Git repo; also scan this machine and prior sessions. This is primarily a *user action* (account access) plus a local search. **D2 (reconstruction, only if D1 fails):** scaffold a *new* Next.js App Router + Tailwind project, port the scrapable content/meta/JSON-LD from the 30 rendered pages, rebuild the shared landing-page template + demos `[slug]` + layout + brand tokens (crimson, 3 fonts), and **rebuild form/auth/server logic from scratch** (it did not survive minification). High effort, high content-fidelity, zero logic-fidelity.
- **Backend / DB / jobs / authz:** none across A–C (local, single-user, zero-backend). D is the sole exception — a reconstructed site *would* reintroduce a backend (forms/auth), scoped in D2, not here.
- **Data ownership / trust boundaries:** unchanged for A–C. The harness only *reads* app state in throwaway iframes; the NEXUS test uses `NX.newWorld()` (a fresh world — never touches the live `nexus_world_v1` save); the Forge tests use synthetic specs.

## User flows

- **Verification:** open `/shared/test-runner.html` → within ~5 s a summary reads e.g. "6/6 suites green — 4 apps booted clean, 17 assertions passed"; a red line names exactly which app failed to boot or which assertion broke. Failure flow: an app that throws on load shows "GHOST — did not boot (window.G undefined)".
- **NEXUS:** play a city where the plant closure actually bites — over days, a weak business (garage/club) runs low, cuts staff, and can close; unemployment climbs; the Day-7 election can swing to Okafor. (Invisible per-tick; visible over a play session and asserted by the test.)
- **Forge:** open the PCB tab → the preview and the pane hint plainly say the header mapping is an unverified placeholder; downloading the Gerbers, the embedded `README.txt` repeats it; the validation panel shows a `PCB` warning. Failure/edge: none introduced — the caveat is always shown for the demo/auto-routed board.
- **Website:** D1 — Joseph checks the Vercel dashboard / linked repo for the domain and reports found/gone. D2 (if gone) — a scaffolded repo renders the home + a templated landing page + demos locally, matching the deployed content.

## Implementation phases

Ordered, each an independent commit, each `git revert`-able, none depending on a later phase. **Cross-session precondition:** Phases 2–3 edit `NEXUS/` and `The forge/` (other sessions' folders) — run only while those sessions are idle, committing between their runs (the pattern used all session).

**Phase 1 — Verification harness A1 (the backbone; ship first).**
- *New* `shared/test-runner.html`: manifest-driven app-boot smoke check (boot-signal table + post-load console hook) + aggregation of `bridge-test.html` and `inspect-test.html`; renders one verdict, exposes `window.__results`.
- *Testable now, no app changes.* Ships value immediately: one page proves the current portfolio is green.
- **Acceptance:** loading `/shared/test-runner.html` reports all 4 apps booted (each boot-signal present) with no post-load console errors, and both existing suites green (13/13 + 4/4); its `window.__results.passed === window.__results.total`; temporarily breaking one app (e.g. rename its bridge path) turns the runner red and names that app. (I'll verify the red path by inducing and reverting a fault.)

**Phase 2 — NEXUS economy fix (H2).**
- Edit `NEXUS/js/economy.js:23`: hoist `b.revenueToday = 0` to the top of the `for (const b of state.businesses)` loop; drop the now-redundant reset in the closed/factory branch.
- *New* `NEXUS/economy-test.html`: on a fresh `NX.newWorld()`, run `NX.sim.runTicks(w, NX.sim.TICKS_PER_DAY, true)` for 30–60 days; assert a tracked business's cash is **not** monotonic (`downDays > 0`) and `maxBadDays > 0` (failure path reachable); assert at least one weak business can reach `badDays>=5`/close over the longer horizon.
- Register the suite in `test-runner.html`.
- **Acceptance:** `economy-test.html` is green **after** the fix and **red** on the pre-fix code (I'll confirm both by toggling the line); the runner now shows the NEXUS economy suite; a manual play/skip-day cycle shows unemployment moving off its pinned-low value. No console errors; live `nexus_world_v1` save untouched (test uses `newWorld()`).

**Phase 3 — Forge PCB honesty (H1: C1 labeling + C2 validation warning).**
- C1: add the netlist caveat at the four sites (`pcb.js` preview + gerber README, `main.js:597` hint, `README.md`).
- C2: add a `spec.derived.pcb`-reading check to `validation.js` (area `PCB`, id `pcb-netlist`, severity `warn`) and surface it in the PCB pane + Gate list.
- *New* `The forge/pcb-honesty-test.html`: assert `gerberFiles(spec)` README contains the netlist caveat, and the new validation check returns a `PCB`/`warn` for a normal spec; register in the runner.
- **Acceptance:** PCB pane + preview + gerber README all show the "unverified header mapping" caveat (verified live); the validation panel lists the `PCB` warning; `pcb-honesty-test.html` green (and red if the caveat/flag is removed); runner shows the Forge PCB suite. No console errors.

**Phase 4 — Harness A2 (optional polish).**
- *New* `shared/rsg-testkit.js` error-beacon + a `?rsgtest=1`-gated 2-line include in each app's `index.html`; runner reads `contentWindow.__rsgErrors` for complete pre-boot error visibility; optionally refactor the three suites onto the testkit's shared assert/report API (DRY).
- **Acceptance:** with `?rsgtest=1`, the runner reports zero `__rsgErrors` across all apps; production loads (no flag) include nothing extra (verify no network request for the testkit without the flag).

**Phase 5 — Website source hunt (D1; can run anytime, parallel).**
- Local search of this machine and prior sessions for a Next.js working copy of the site; Joseph checks the Vercel project for `redmontstrategiesgroup.com` and its linked Git repo. *No code.*
- **Acceptance:** a written finding — either "source located at <repo/Vercel project>; clone it" (→ recovery done) or "source confirmed absent from all reachable locations" (→ D2 is the path). This gate decides whether Phase 6 is needed.

**Phase 6 — Website reconstruction (D2; only if Phase 5 finds nothing; large, separate).**
- Scaffold `RSG/Website-src/` (*new*) as Next.js App Router + Tailwind; extract copy/meta/JSON-LD from the 30 pages; rebuild the `(marketing)` layout, the one data-driven SEO-landing template (drives all 12), demos `[slug]`, connect/login shells; re-derive theme tokens (crimson + 3 fonts) from the compiled CSS; rebuild form/auth logic anew.
- Independently shippable in slices: **6a** scaffold + layout + home renders locally; **6b** the templated landing pages from extracted data; **6c** demos + remaining static pages; **6d** forms/auth (new backend — its own scoped sub-plan). Each slice `npm run build`s and renders.
- **Acceptance (per slice):** the slice's pages build and render locally matching the deployed content for that route; a diff of visible copy/meta against the corresponding `RSG/Website/<route>/index.html` matches.

## Acceptance criteria (consolidated, observable)

- **P1:** `/shared/test-runner.html` → all 4 apps boot, 2 suites green, `__results` all-pass; an induced app fault turns it red and names the app.
- **P2:** `economy-test.html` green post-fix / red pre-fix; runner includes it; live save untouched.
- **P3:** caveat visible in PCB pane + preview + gerber README + README.md; `validation.js` emits `PCB`/`warn`; `pcb-honesty-test.html` green (red if caveat removed).
- **P4:** `?rsgtest=1` → zero `__rsgErrors`; no testkit load without the flag.
- **P5:** written located/absent verdict.
- **P6 (per slice):** slice builds and renders, content matches the deployed route.

## Testing plan

- **Unit/logic (zero-build browser suites):** `economy-test.html` and `pcb-honesty-test.html` (new), plus existing `bridge-test.html`/`inspect-test.html` — all aggregated by `test-runner.html`. Each is a **revert-guard**: designed to fail if the fix is undone (economy → cash monotonic again; PCB → caveat/flag gone).
- **Integration/smoke:** the runner's per-app boot + no-console-error checks, driven through the real `serve.py`.
- **e2e / manual browser:** NEXUS play/skip-day showing unemployment move; Forge PCB tab showing the caveat and the validation warning; the runner's red path induced and reverted. Recorded live.
- **Security / authorization:** N/A for A–C (no server, no roles). For D2's forms/auth, a real authz plan is required and is explicitly deferred to slice 6d.
- **Failure-state:** runner must go red (not error out) when an app 404s or throws — assert it reports the failure rather than hanging; economy test must not touch the live save even if it throws (uses `newWorld()` in a try).
- **Fixtures:** none external; NEXUS uses `newWorld()`, Forge uses synthetic specs, the runner uses the real apps.

## Deployment plan

- No environments/migrations/env-vars for A–C. "Deploy" = commit on `main`. Phase order = commit order; each is one commit. Phases 2–3 land only while the NEXUS/Forge sessions are idle (commit between their runs).
- D1 is investigation (no deploy). D2, if pursued, is a **new project** (`Website-src/`) with its own build/deploy pipeline (Vercel) and its own env/secrets for any rebuilt forms/auth — scoped there, not here.
- Compatibility: the harness and suites are additive (new files) and touch no app runtime; the economy fix is behavior-only with no schema/save-format change (old `nexus_world_v1` saves load unchanged — `revenueToday` is just reset sooner each night).

## Rollback

- Each of Phases 1–4 is one additive-or-one-line commit → `git revert <commit>` restores prior state instantly; no data migration. The economy fix revert simply restores the (buggy) prior behavior; existing saves are unaffected either direction.
- D2 is isolated in a new folder; abandoning it is deleting `Website-src/` — the deployed `Website/` build is never touched.

## Risks

- **Cross-session contention (top risk):** Phases 2–3 edit other sessions' folders (`NEXUS/`, `The forge/`). *Mitigation:* gate on idle; edits are one-line/text-only and function-anchored; commits are atomic and revertible.
- **Harness console-hook blind spot (integration):** the load-event hook can miss *pre-boot* non-fatal `console.error`s; a broken app that still sets its global but logs an error at parse time could read green on that axis. *Mitigation:* the boot-signal check catches fatal load failures with zero app changes; Phase 4's `?rsgtest=1` beacon closes the pre-boot gap for full coverage — sequenced as polish, and the limitation is documented in the runner UI.
- **Economy fix second-order effects (data integrity, intended):** correcting the money flow will *change* gameplay — unemployment rises, businesses close, the election can swing. This is the intended behavior, but it alters the balance players saw. *Mitigation:* it's a simulation, not stored financial truth; the test asserts the pressure loop is *reachable*, not a specific balance; note the change in NEXUS's README.
- **PCB labeling vs. real fix (honesty/scope):** C1+C2 make the tool *honest* but the copper is still wrong; a user could still fab the board and get a dead one despite the warning. *Mitigation:* the caveat is unmissable (pane + preview + embedded README + a machine `warn`), and C3 (the real DevKitC-1 pin table) is flagged as the follow-up that actually fixes it — the plan does not claim C1+C2 make the board fab-ready.
- **Website recovery depends on external access (integration/operational):** D1's best outcome needs the Vercel/GitHub account, which is outside this environment. *Mitigation:* D1 is framed as a user action + local search; D2 is the self-contained fallback that needs no external access, at the cost of rebuilding logic.
- **D2 logic fidelity (correctness):** forms/auth/server actions are unrecoverable from the build and must be rebuilt from scratch — a reconstruction that *looks* identical could behave differently. *Mitigation:* scope 6d as its own sub-plan with a real backend/authz design and its own tests; don't present a reconstructed site as byte-equivalent to the original.
- **Migration difficulty:** low for A–C (additive files + one-line fixes); high and optional for D2.
