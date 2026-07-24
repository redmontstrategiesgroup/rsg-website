# Codebase Audit — ONEHAND OS (GHOST · NEXUS · THE FORGE + shell)

**Date:** 2026-07-24
**Repository:** `C:\Users\josep\Desktop\RSG\Onehand OS` · **Commit/branch:** not a git repository (see H6)
**Detected stack:** zero-build vanilla JS/HTML/CSS (classic scripts for GHOST/NEXUS, ES modules + vendored three.js r160 for FORGE), two stdlib Python static servers. No package manager, no manifest.
**Auditor's stance:** read-only forensic audit. Actions taken solely to verify: started `serve.py` on 127.0.0.1:8100 and exercised the apps in a browser; no repository files were modified. Report saved *outside* the repo.
**Method:** static end-to-end trace of every claimed capability (three parallel tracing passes, key citations spot-checked verbatim against source) + dynamic browser verification (export-blob interception, live state inspection, mobile viewport test).

---

## 1. Executive summary

Onehand OS is an umbrella launcher over three zero-dependency local web apps: GHOST (a cinematic *simulated* AI-fleet command center), NEXUS (a genuinely functioning living-city simulation game), and THE FORGE (a parametric invention generator with real file exporters). The single most important truth: **this codebase is far more real than it looks like it should be.** The exports Forge produces are genuine bytes derived from a live spec (correct binary STL, correct Gerber X2/Excellon syntax, a hand-rolled ZIP with real CRC32, parameterized ESP32-S3 firmware); NEXUS's economy, gossip, election and persistence all execute and persist (verified live: 30 residents, autosaves every game hour, 243 gossip hops, a completed election); and both Claude integrations use the current Anthropic API correctly — including the obscure-sounding "refusal fallback re-served by Opus 4.8," which turned out to be a correctly implemented real beta feature, not marketing fiction.

The dishonesty that does exist is concentrated and specific: one Forge path presents **fabricated inspection findings about the user's own photo with no "simulated" label** (C1); the Forge PCB's copper is routed against a **self-admittedly fake pin mapping** beneath real-looking fab files (H1); GHOST's **Redirect control is pure theater** (H3); and a NEXUS economy bug **prints money nightly**, quietly disabling the business-failure system (H2). The umbrella shell itself breaks on mobile — the hand-preference toggle, the core of its one-handed premise, is unreachable on a phone (H5). And the whole 12.3k-line codebase has no git, no tests, and no automated checks while multiple AI sessions actively rewrite the sibling source folders it was copied from (H6).

- **Product maturity rating:** **Early MVP overall** (per-app: GHOST = honest Prototype/Demo by design; NEXUS = Functional MVP; FORGE = Early MVP; shell = Early MVP) — see §8.
- **Findings:** 1 Critical · 6 High · 10 Medium · 6 Low
- **Bottom line:** an unusually honest demo suite with real engineering under the theater — fix the one deceptive inspection path and the money-printing bug, put the repo under git, and this is a solid foundation.

---

## 2. What the product claims to do (reverse-engineered intent)

From READMEs, UI copy, button labels, and settings panels:

**Shell (Onehand OS)**
1. One-hand-first launcher: boot screen, clock, app tiles, full-screen app stage, thumb-zone dock with persisted L/R hand preference; Esc or ⌂ returns home.

**GHOST**
2. Five mission modes (Build/Company/Research/War Room/OneHand) run by a deterministic fixed-timestep engine; live machine screens, timeline, system map, agent comms, metrics.
3. Operator controls: Approve (gated steps), Pause, **Redirect ("steer a running mission")**, Terminate, Emergency Stop/Restore.
4. Visual anomaly self-correction loop; command bar that classifies typed missions; simulated voice; 3D Home Lab; mission replay telemetry with scrubber; respects `prefers-reduced-motion`; `ghost.html` is an up-to-date single-file build.

**NEXUS**
5. 30 persistent residents (jobs, money, moods, secrets); schedule-driven days; memory & gossip that mutates as it spreads; economy that settles nightly; six-faction reputation; Day-7 election you can canvass; free-text/voice talk with real consequences; Pulse social feed; God Mode (6 policy levers); offline catch-up (~8h = 1 day, cap 7); localStorage persistence; optional Claude-powered NPC minds with structured consequences and local fallback.

**THE FORGE**
6. One sentence → manufacturing package: 3D model, schematic, **validated** binary STL (mm), Gerber X2 + Excellon, ESP32-S3 firmware, **BOM with real MPNs** and supplier links, assembly manual, wiring diagram, product site; layout generated from a physical-ability profile (hand/fingers/reach).
7. Loop: FORGE IT → build it → 📷 Inspect Prototype (Claude vision with key; "simulated inspection" without) → parametric patches → Generate Revision with version history.
8. Woodworking (slab → design, cut list, pricing, **+ photo**), Repair (measurement → parametric part), Inventor (problem → 3 scored concepts) modes; Claude API key in localStorage only, sent only to api.anthropic.com; Fable 5 refusal fallback re-served by Opus 4.8.

---

## 3. Claimed vs. Real — capability matrix

| Capability | Status | Evidence (file / trace) | Severity if broken |
|---|---|---|---|
| Shell: launcher, app stage, ⌂ dock, L/R persistence | Partial | works desktop; mobile clipped, Esc claim false (`index.html:44,207-210`) | High (H5) / Medium (M9) |
| GHOST: 5 modes → real mission scripts, engine runs them | Real | `data.js:47-53,310` ↔ `engine.js:78-105`; verified live (`G.state` advancing) | — |
| GHOST: Approve/Pause/Terminate/Emergency Stop | Real | `engine.js:166-213`; gates hold at `engine.js:283-288` | — |
| GHOST: **Redirect** "steers the mission" | **Fake** | `engine.js:176-180` — feed line + event with zero subscribers | High (H3) |
| GHOST: replay scrubber | **Fake** | `ui.js:351` — `onclick: () => { }` with `cursor:pointer` | Medium (M7) |
| GHOST: anomaly self-correction loop | Real (as scripted sim; README says so) | fires from engine at `engine.js:257-265`, cleared by fix step `data.js:174` | — |
| GHOST: `ghost.html` current with source | Real | byte-identical inlines of all 6 loaded JS + 2 CSS | — |
| GHOST: `store.js`/`world.js` persistence layer | **Orphaned** | not in `index.html:52-57`, no references anywhere | Medium (M8) |
| NEXUS: residents/schedules/gossip/reputation/God Mode/voice | Real | traced + verified live (localStorage `nexus_world_v1`, 117KB, ticking) | — |
| NEXUS: nightly economy settlement | Partial | real flows, but `economy.js:22/33/36` compounding-revenue bug | High (H2) |
| NEXUS: Day-7 election + canvassing | Partial | real scoring `events.js:145-180`; resolves at 00:00 of day 7; rumors only vote via global scandal flag | Medium (M11) |
| NEXUS: Claude NPC minds | Partial | real fetch/schema/fallback `claude.js:82-114`; >12-turn conversations likely 400 → silent local fallback | High (H4) |
| NEXUS: opening-scenario evidence assembly | Partial | 2 of 5 player-spread clue texts never match `truthCheck` keys | Medium (M11) |
| FORGE: binary STL export | Real bytes; **"validated" false**; woodworking exports 0.14× scale | `exports.js:20-53`; zero validation code; `geometry.js:484` | Medium (M1, M2) |
| FORGE: Gerber X2 + Excellon | Real format, computed geometry; **electrical mapping fabricated** | `pcb.js:133-210` vs `pcb.js:39` "deterministic fake mapping" | High (H1) |
| FORGE: ESP32-S3 firmware | Real, parameterized | `firmware.js:30-174`; macro keycode bug suspected (`:117-134`) | Medium (M6) |
| FORGE: BOM "real MPNs" | Partial | ~60% real / ~40% invented; qty overbilling when fingers reduced (`catalog.js:138` vs `layout.js:81-89`) | Medium (M3) |
| FORGE: ZIP "Everything" | Real | `exports.js:61-119`; dynamically verified 836,052-byte PK zip w/ 6,940-triangle STL | — |
| FORGE: ability-profile layout | Real | `layout.js:23-169`; inputs change placement math, mirroring, recompaction | — |
| FORGE: Inspect Prototype | Partial / **deceptive in one path** | real vision request `claude.js:144-155`; no-key+photo shows fabricated findings unlabeled (`main.js:549`) | **Critical (C1)** |
| FORGE: Generate Revision loop + history | Real | `claude.js:212-233` → `main.js:98-116` full regeneration | — |
| FORGE: Woodworking/Repair/Inventor | Partial | real arithmetic on canned templates; dead photo inputs (`main.js:672-673`) | Medium (M4) |
| FORGE: Claude key handling + Opus 4.8 refusal fallback | Real | `claude.js:27-49` — correct headers, models, structured outputs, real fallback beta | — |

**Features claimed in the interface but absent behind it:** GHOST's Redirect and replay scrubbing; Forge's photo inputs in Woodworking/Repair modes and STL "validation"; NEXUS's "residents can go missing" surface and police "wanted" consequences (dead scaffolding); the shell's "esc closes an app" hint. That is the honest completeness gap — narrow, but real.

---

## 4. Verification results (commands actually run)

| Check | Result | Notes |
|---|---|---|
| Type check | n/a | no TS/jsconfig; no manifest of any kind (`run_checks.sh`: "No recognized manifest found") |
| Lint | n/a | none configured |
| Tests | n/a | **zero test files in the repository** |
| Production build | n/a | zero-build by design; `python -m py_compile` passes on all 3 `.py` files |
| Runtime smoke | ✅ | all 3 apps + shell load and run with **zero console errors** (direct + iframed) |
| Dynamic export check | ✅ | intercepted Forge blobs: real SVG ×2, PK ZIPs (18,782 B Gerber; 836,052 B Everything incl. 347,084 B STL, 6,940 triangles, `84+50n` size law holds), firmware text, quoted CSV (BOM math checks: 17 × $0.35 = $5.95) |
| Dynamic sim check | ✅ | NEXUS ticking + autosaving live; GHOST `G.state` mission advancing; election historically resolved (winner recorded) |
| Secret scan | ✅ clean | no `.env`, no key formats; one generic-pattern hit (`social.js:78`) is a false positive (`cred` = credibility) |

**Actions taken to run the project:** started the repo's own `serve.py` (localhost-only). Nothing else.

---

## 5. Findings

### 🔴 Critical

#### C1 — Forge presents fabricated "inspection" of the user's photo without any simulated label
1. **Problem** (CONFIRMED): with a photo uploaded but no API key, Inspect Prototype runs the demo inspector and shows invented observations — including pseudo-measurements like "wall deflects ≈0.8 mm under connector insertion force" — as if they came from analyzing the user's actual photo. The "simulated" toast fires **only when there is no photo**.
2. **Affected paths:** `apps/forge/js/main.js:547-551`, `apps/forge/js/claude.js:164-209` (demo findings, `:177` fake measurement), `apps/forge/index.html:256-257` (unconditional "visually examines the physical object" copy).
3. **Evidence:**
   ```js
   report = inspectPrototypeDemo(state.spec);
   if (!state.inspectImage) toast("No photo — running simulated inspection of rev " + state.spec.rev, "");
   ```
   (spot-checked verbatim). The demo path is spec-derived and internally coherent, but it never looks at the image.
4. **User / business impact:** anyone without a key who uploads a real photo is told specific, authoritative-sounding things about *their* object that the software never observed. In a demo to a client this is the moment that destroys trust in everything else — including the parts that are real.
5. **Recommended correction:** make the simulated banner unconditional whenever `inspectPrototypeDemo` runs (photo or not), and watermark the demo report ("SIMULATED — not derived from your photo"). One conditional and one template string.
6. **Estimated effort:** ~30 min — two small edits in `main.js`/report renderer.
7. **Fix before further feature development?** Yes — it's the only place the product actively lies about what it did.

### 🟠 High

#### H1 — Forge PCB: real Gerber files over a fabricated electrical mapping
1. **Problem** (CONFIRMED): the Gerber/Excellon files are format-correct and geometry-derived, but the GPIO→header-pad netlist is arbitrary — the code itself says so — so a fabricated board would not electrically match the firmware's pin assignments. The README's "run a DRC pass" disclaimer materially understates this: DRC cannot fix a wrong netlist.
2. **Affected paths:** `apps/forge/js/pcb.js:39-40` (mapping), `:68` (encoder escapes), README.md:80-81.
3. **Evidence:**
   ```js
   // logical GPIO → header pad (deterministic fake mapping; enough for routing)
   const gpioPad = (gpio) => hdrPins[gpio % hdrPins.length];
   ```
4. **User / business impact:** a user could spend real money fabbing a dead board on the strength of "custom PCB… Gerber X2" — the costliest possible failure this app can cause.
5. **Recommended correction:** short term, label the PCB pane and README honestly ("illustrative routing — not electrically verified; do not fab"). Long term, derive `gpioPad` from the same `spec.derived.elec` pin table the firmware uses so copper and code agree.
6. **Estimated effort:** labeling ~30 min; real mapping ~2–4 days (shared pin table + re-route + sanity checks).
7. **Fix before further feature development?** Yes (the labeling at minimum) — it converts a costly deception into an honest limitation.

#### H2 — NEXUS economy prints money: `revenueToday` never resets for open businesses
1. **Problem** (CONFIRMED, spot-checked): the nightly settlement resets `revenueToday` only in the closed/factory branch. Open businesses accumulate onto yesterday's revenue and re-credit the **cumulative** total to cash every night, and are taxed on it. Businesses get monotonically richer; the real staff-cut/closure/hiring machinery (`economy.js:107-126`) becomes practically unreachable.
2. **Affected paths:** `apps/ghost/nexus/js/economy.js:22` (reset in wrong branch), `:33` (accumulate), `:36` (re-credit), `:55` (tax on cumulative).
3. **Evidence:**
   ```js
   if (!b.open || b.type === "factory") { b.revenueToday = 0; continue; }
   ...
   b.revenueToday = (b.revenueToday || 0) + spend;
   ...
   b.cash += b.revenueToday || 0;
   ```
4. **User / business impact:** a headline system ("businesses… fail, and hire") silently never fires; unemployment/election dynamics are skewed toward stability; long saves inflate.
5. **Recommended correction:** reset `b.revenueToday = 0` at the top of the loop for every business (move it above the branch).
6. **Estimated effort:** ~5 min fix; ~1 hr to sanity-check a few simulated weeks.
7. **Fix before further feature development?** Yes — one line, restores a core system.

#### H3 — GHOST's Redirect control is theater
1. **Problem** (CONFIRMED, spot-checked): Redirect pushes a feed line ("Re-planning next phase.") and emits a `"redirect"` event **with zero subscribers**. No step, plan, or state changes. README: "Hit Redirect to steer a running mission" — false.
2. **Affected paths:** `apps/ghost/js/engine.js:176-180`; no `bus.on("redirect")` anywhere (grep-confirmed); README.md:88.
3. **Evidence:**
   ```js
   pushFeed("ORCH", `Redirect received: "${text}". Re-planning next phase.`, "system");
   G.bus.emit("redirect", text);   // nobody listens
   ```
4. **User / business impact:** within an app whose honesty is its differentiator ("what's real vs. what would need wiring" is a README section), this is the one operator control that claims effect and has none.
5. **Recommended correction:** minimum: make the feed line honest ("Redirect noted (not yet wired)"). Better: a real subscriber that, e.g., reorders/skips remaining steps or swaps the active machine assignment.
6. **Estimated effort:** honest copy ~10 min; real steering ~0.5–1 day.
7. **Fix before further feature development?** Yes for the copy; the real implementation can wait.

#### H4 — NEXUS Claude conversations silently degrade after ~6 exchanges
1. **Problem** (SUSPECTED-strong, structurally confirmed): the just-sent player message is included in the history **and** appended again (`claude.js:80`), so the final user turn is always duplicated; and `history.slice(-12)` on an odd-length alternating log eventually produces a messages array starting with an `assistant` turn — which the API rejects — so every call in a mature conversation errors and falls back to the local brain with only a transient toast.
2. **Affected paths:** `apps/ghost/nexus/js/ui.js:260` (passes history including the pushed message), `apps/ghost/nexus/js/claude.js:76-80`.
3. **Evidence:**
   ```js
   for (const turn of (history || []).slice(-12)) { messages.push({ role: turn.who === "you" ? "user" : "assistant", ... }); }
   messages.push({ role: "user", content: text });   // duplicate of history's last entry
   ```
4. **User / business impact:** the paid, headline "Claude-powered minds" feature quietly stops working exactly when a conversation gets interesting; the user has no idea they're back on the intent-matcher.
5. **Recommended correction:** exclude the in-flight message from history (`slice(0,-1)`), then trim from the front to keep the array starting with a `user` turn. One runtime test with a key confirms.
6. **Estimated effort:** ~1 hr including the live test.
7. **Fix before further feature development?** Yes — small fix protecting the feature users would pay API money for.

#### H5 — Shell breaks on mobile; the hand-preference control is unreachable on a phone
1. **Problem** (CONFIRMED dynamically): at 375×812 the home content is 890 px tall inside `overflow:hidden` with no scroll: the third app tile is clipped and the footer — containing the L/R hand toggle, the core of the one-handed premise — is entirely off-screen and unreachable.
2. **Affected paths:** `index.html:44` (`overflow:hidden`), `:63-66` (`#home` flex without scroll), `:70-71` (grid min 250px), footer `:167-175`. (Auditor-authored code; measured: tile bottom 845 px / footer below 812 px viewport.)
3. **Evidence:** browser measurement — `{scrollH: 890, clientH: 812, overflows: true, footerVisible: false}`.
4. **User / business impact:** on the device where one-handed use matters most, a third of the launcher is missing and handedness can't be set.
5. **Recommended correction:** allow `#home` to scroll (`overflow-y:auto`), or reflow: tiles above the fold, hand toggle moved into the always-visible header/dock.
6. **Estimated effort:** ~1–2 hrs including re-testing at mobile/tablet sizes.
7. **Fix before further feature development?** Yes — it contradicts the product's founding premise.

#### H6 — No version control, no tests, no checks — while the source of truth actively diverges
1. **Problem** (CONFIRMED): 12.3k lines across four codebases with no git, zero test files, and no lint/typecheck/build harness. Meanwhile `apps/ghost` and `apps/forge` are snapshots of sibling folders (`RSG\GHOST`, `RSG\The forge`) that other AI sessions were still editing minutes before the copy — divergence has already begun (see M8: files newer than the shipped build).
2. **Affected paths:** repository root (absence); `run_checks.sh` output ("No recognized manifest found").
3. **Evidence:** `find` shows no `.git`, no `*test*`, no manifest; GHOST's `js/store.js`/`js/world.js` mtimes (12:51) postdate `ghost.html` (04:13) and the `apps/` copy (12:53).
4. **User / business impact:** any future overwrite/re-sync is unrecoverable; regressions in 12.3k lines of interlocking sim logic are undetectable except by eye.
5. **Recommended correction:** `git init` at `RSG\` level (one repo covering originals + Onehand OS), commit as baseline; add a trivial smoke harness (even one headless-browser script asserting "all three apps boot with zero console errors" — exactly what this audit automated).
6. **Estimated effort:** git ~15 min; smoke harness ~half a day.
7. **Fix before further feature development?** Yes — cheapest insurance in the whole report.

### 🟡 Medium

#### M1 — Forge STL "validated" claim is false
1. **Problem** (CONFIRMED): README and export copy say "binary, mm, validated"; grep finds zero validation code — no manifold, degenerate-triangle, or bounds checks. (The writer itself is correct — see §6.)
2. **Affected paths:** `apps/forge/js/exports.js:20-53` (no validation); README.md:36.
3. **Evidence:** `grep -rn "valid" js/` → only README claims.
4. **Impact:** overstated word on an otherwise-real feature; slicers will catch most issues, but the claim is unearned.
5. **Correction:** delete the word, or add a cheap check (finite coords + non-zero-area triangles + closed-shell warning).
6. **Effort:** ~10 min (word) / ~half a day (real checks).
7. **Fix first?** No.

#### M2 — Forge woodworking STL exports at 0.14× scale
1. **Problem** (SUSPECTED): the wood model bakes `scale.setScalar(0.14)` into `matrixWorld`, which the STL writer applies — an 1800 mm desk exports as a ~252 mm miniature. Repair-mode STL is true-mm.
2. **Affected paths:** `apps/forge/js/geometry.js:484`; `exports.js:27` (applies world matrix).
3. **Evidence:** display-scaling constant sits on the exported object rather than the camera/scene.
4. **Impact:** physically wrong output on a mode that quotes real dimensions and prices.
5. **Correction:** export from unscaled geometry (clone with identity scale) or move display scaling to a parent group excluded from export. Confirm by exporting and measuring bounds.
6. **Effort:** ~1–2 hrs.
7. **Fix first?** No, but before anyone prints from Woodworking mode.

#### M3 — Forge BOM: invented MPNs mixed with real ones; quantity overbilling
1. **Problem** (CONFIRMED): UI says "Every part is a real, orderable component with MPN"; ~40% of MPNs are plausible inventions (`KN-20-6D`, `DSA-1U-PBT`, `M3X8-SHCS`…) beside genuinely real ones (Bourns `PEC11R-4215F-S0024`, `PIM447`, `1N4148TR`). Separately, the BOM bills the *requested* key count while the ability-layout may place far fewer (e.g. 24 requested → ~11 placed with 2 usable fingers) — switches/caps/diodes are overbilled.
2. **Affected paths:** `apps/forge/js/catalog.js:5-120` (parts), `:138` (`m.keys.count`) vs `apps/forge/js/layout.js:81-89` (capped placement); UI claim `main.js:333`.
3. **Evidence:** catalog self-admits search-links (`catalog.js:3`); dynamic BOM row verified real (17 × $0.35 = $5.95).
4. **Impact:** a user ordering from this BOM overbuys, and some MPNs won't resolve to real parts.
5. **Correction:** bill from `derived.keyTotal`; sweep invented MPNs → real equivalents or mark "generic."
6. **Effort:** qty ~30 min; MPN sweep ~half a day.
7. **Fix first?** No.

#### M4 — Forge dead photo inputs (Woodworking, Repair)
1. **Problem** (CONFIRMED): both "📷 Upload…" inputs only set a filename label; the image bytes are never read by anything. README lists "(+ photo)" as a Woodworking input.
2. **Affected paths:** `apps/forge/index.html:117,128`; `apps/forge/js/main.js:672-673`.
3. **Evidence:** handlers write `files[0].name` into a label; no FileReader, no storage, no use.
4. **Impact:** classic UI theater — user believes the photo informed the design.
5. **Correction:** remove the inputs, or wire them into the AI paths like the (real) inspect photo flow.
6. **Effort:** removal ~15 min; wiring ~half a day.
7. **Fix first?** No.

#### M5 — Forge exported HTML self-XSS; unescaped name in PCB SVG
1. **Problem** (CONFIRMED vector, low likelihood): the exported assembly manual and product site interpolate the raw user sentence (`spec.tagline`) unescaped — a sentence containing `<script>` produces a self-XSSing HTML file; `pcbSVG` injects `spec.name` unescaped into `innerHTML` (name is schema-constrained AI output offline-safe, so low probability). The API key in plaintext localStorage is the asset such an XSS would steal.
2. **Affected paths:** `apps/forge/js/exports.js:210,249`; `apps/forge/js/pcb.js:108` → `main.js:309`; weak `esc()` at `main.js:820` (escapes only `&`,`<`).
3. **Evidence:** traced interpolation sites; in-app panes for user text do use `esc()`.
4. **Impact:** local, self-inflicted, but a shared exported file could carry it to someone else's browser.
5. **Correction:** run tagline/name through a full escaper (add `>`,`"`,`'`) at every HTML/SVG interpolation.
6. **Effort:** ~1 hr.
7. **Fix first?** No.

#### M6 — Forge firmware macros likely press wrong keys on hardware
1. **Problem** (SUSPECTED): macro paths call `Kbd.press(HID_KEY_*)` — raw usage codes into an API expecting ASCII/Arduino codes (the matrix path correctly uses `pressRaw`). KVM/voice/undo macros would emit wrong keys on a real board. Confirm by compiling against esp32 core 3.x.
2. **Affected paths:** `apps/forge/js/firmware.js:117-134` (vs correct `:142`).
3. **Evidence:** API-семantics mismatch between the two call sites.
4. **Impact:** firmware compiles and mostly works; macros misfire — confusing hardware debugging for a builder.
5. **Correction:** use `pressRaw` for usage codes in macros too.
6. **Effort:** ~30 min + a compile check.
7. **Fix first?** No.

#### M7 — GHOST replay scrubber is a dead control
1. **Problem** (CONFIRMED, spot-checked): the scrub track's `onclick` is literally empty while CSS sets `cursor:pointer`; no seek/replay capability exists anywhere.
2. **Affected paths:** `apps/ghost/js/ui.js:351`; `apps/ghost/styles/app.css:273`.
3. **Evidence:** `const track = h("div", { class: "track", onclick: () => { } }, ...)`.
4. **Impact:** invites interaction it can't honor; "Mission Replay" title oversells a live sparkline.
5. **Correction:** drop the pointer cursor and knob (honest telemetry display), or implement seek over `metrics.series`.
6. **Effort:** cosmetic ~15 min; real seek ~1 day.
7. **Fix first?** No.

#### M8 — GHOST `store.js` + `world.js`: an entire unintegrated persistence layer
1. **Problem** (CONFIRMED): both files (newest in the app, 12:51 mtimes) are loaded by nothing, referenced by nothing, and absent from `ghost.html` and the build script's list; `world.js` would throw on first use anyway (`nlQuery` touches `entity("sys.prod-env").id` pre-seed). `store.js`'s own header claims it makes actions "REAL… instead of ephemeral demo state" — aspirational dark matter.
2. **Affected paths:** `apps/ghost/js/store.js` (whole file), `apps/ghost/js/world.js` (whole file, `:80-88` latent TypeError); loaders `index.html:52-57`, `tools/build_standalone.py:12-13`.
3. **Evidence:** grep: no `G.store`/`G.world` references in loaded code.
4. **Impact:** whoever picks this up next will assume persistence exists; it doesn't. Also confirms live divergence between the evolving original and this copy (see H6).
5. **Correction:** either wire them (script tags + build list + fix `nlQuery` guard) or move them out of `js/` until integration starts.
6. **Effort:** decision ~5 min; integration ~1–2 days.
7. **Fix first?** No — but decide before re-syncing from the original.

#### M9 — Shell: "esc closes an app" is false once you've clicked into the app
1. **Problem** (CONFIRMED dynamically): the Esc handler lives on the parent window; as soon as focus is inside the app iframe (i.e., immediately, for any real use), Esc goes to the app and never reaches the shell. The ⌂ button works.
2. **Affected paths:** `index.html:207-210` (parent-only keydown), footer hint `:170`.
3. **Evidence:** dispatched Escape inside iframe → stage stays open; on parent → closes.
4. **Impact:** advertised keyboard exit fails in practice — notable for an accessibility-branded shell.
5. **Correction:** listen for Esc inside each same-origin iframe after load (`frame.contentWindow.addEventListener`), or drop the hint.
6. **Effort:** ~30 min.
7. **Fix first?** No.

#### M10 — GHOST: Emergency Stop → Restore leaves an in-flight mission unresumable
1. **Problem** (CONFIRMED): after stop→restore, `running` stays false and `pause()` early-returns unless `state.running` — Space/Resume do nothing until a mode is relaunched; the mission that was interrupted is simply lost.
2. **Affected paths:** `apps/ghost/js/engine.js:166` (guard), `:194-213` (stop/restore).
3. **Evidence:** traced state machine; restore resets machines but not mission run state.
4. **Impact:** the most dramatic control quietly eats the current mission.
5. **Correction:** preserve mission state across lockdown and resume on restore, or explicitly toast "mission terminated by emergency stop."
6. **Effort:** honest toast ~15 min; true resume ~half a day.
7. **Fix first?** No.

#### M11 — NEXUS scenario/election gaps: 2 of 5 evidence texts can't register; day-7 canvassing is dead; save wiped on version mismatch
1. **Problem** (CONFIRMED ×2, plus design gap): (a) the player-spread texts for clues #2/#4 don't contain the `truthCheck` key substrings ("profitable the quarter" ≢ "profit the quarter"; "envelope went from City Hall" ≢ "envelope from city hall") — residents receiving them count as holding nothing; (b) the election resolves at the first tick of day 7, so day-7 canvassing can't matter; (c) a `v !== 1` or corrupt save silently falls through to a fresh world — total progress loss with no warning or backup.
2. **Affected paths:** `apps/ghost/nexus/js/dialogue.js:32,34` vs `events.js:186`; `events.js:163-180`; `app.js:15-23`.
3. **Evidence:** string comparison (spot-checked verbatim); load path `if (s.v !== 1) return null`.
4. **Impact:** the flagship investigation is degraded for hand-carried evidence; a future schema bump deletes every player's city.
5. **Correction:** align the two string sets (or match on the same constants); resolve the election at end of day 7; on version mismatch, back the old save up under another key and tell the user.
6. **Effort:** ~1–2 hrs total.
7. **Fix first?** No.

#### M12 — GHOST accessibility/copy overclaims
1. **Problem** (CONFIRMED): README's blanket "Respects `prefers-reduced-motion`" covers CSS only — the rAF canvas loop (starfield, scenes, rotating map) has no reduced-motion check, and canvases are most of the motion. The Home Lab caption claims GHOST "can power-cycle any node… take over a frozen machine through PiKVM-01… migrate a running mission" — none of it exists even as simulation. Boot screen brands a "Fable 5 core" with no model integration in this app.
2. **Affected paths:** `apps/ghost/styles/core.css:227-230` (the only reduced-motion handling); `apps/ghost/js/viz.js` (no check); `ui.js:437` (caption), `:20,28` (boot copy).
3. **Evidence:** grep `viz.js` for `reduced|matchMedia` → nothing.
4. **Impact:** motion-sensitive users get most of the motion anyway, under a README that says otherwise; copy promises capabilities beyond even the simulation's terms.
5. **Correction:** gate the rAF loop's decorative layers on `matchMedia("(prefers-reduced-motion: reduce)")`; soften the two copy blocks.
6. **Effort:** ~2 hrs.
7. **Fix first?** No.

### ⚪ Low

#### L1 — Dead code inventory (all four codebases)
CONFIRMED, cite-checked by the tracing passes: GHOST — `drawAnomalyShot`, `stopLoop`, `lib.createStore`/`easeInOut`, `.an-shot .box`/`.boot-ring`/`.sweep` CSS, vestigial `clockk`/`clockk-tl` spans, hardcoded "8 NODES"/"218 actions". NEXUS — write-only `beliefs`, `crimesKnown`, `customersToday`, `dailyNote`, `election.polls`, `arrests`; `NX.listNames` never called; `comply` action with no handler (`dialogue.js:270`); `r.missing` checked ~12 places, set nowhere; `player.wanted` displayed but consequence-free; zero-delta rep call (`events.js:94`); stale "6+ people" comment (`events.js:183`). FORGE — `#repair-dims` never populated (`index.html:142`); dead double-toggle (`main.js:522-523`). Shell — `ohos.last` written, never read (`index.html:196`). **Impact:** hygiene; each is a small lie to the next reader. **Fix:** batch cleanup, ~half a day. **Fix first?** No.

#### L2 — GHOST self-XSS via Redirect text
CONFIRMED: redirect input is interpolated into feed HTML (`engine.js:178` → `ui.js:248` innerHTML). Self-only, local sim. Escape it (~15 min) or fix as part of H3.

#### L3 — NEXUS cosmetic fakery
CONFIRMED: Pulse likes/reposts are random numbers (`feed.js:15,34`); anon post says "80 people lose work" vs the actual 9 (`feed.js:66` — possibly intentional rumor exaggeration, SUSPECTED); away-digest labeled with the wrong day (`events.js:219`); boot "wiring 30 nervous systems…" is timed theater (`app.js:43-46`). Harmless in a fiction engine; list kept for honesty.

#### L4 — FORGE theater bits
CONFIRMED: pipeline stage timings include injected `sleep(90+rnd·240)` displayed as measured ms (`main.js:54`); testing procedure references nonexistent "TP1/TP2" test points (`exports.js:180`); magnet catalog link points to 6.35×3.2 mm for a 6×3 mm part (`catalog.js:69`).

#### L5 — Shell polish gaps
CONFIRMED: boot overlay is `aria-hidden="true"` while visibly presenting the brand; no iframe load-error state (404 → blank stage); hand toggle affects only dock position, so the "one-hand-first" claim is thin on the home screen itself.

#### L6 — NEXUS save robustness edges
CONFIRMED/SUSPECTED: quota-full save truncates feed but doesn't retry the failed write (`app.js:12`); a hand-edited valid-JSON `v:1` save missing fields crashes boot at `app.js:57` (only reachable by manual tampering); PEOPLE search input can lose focus to the 2-tick re-render (`app.js:106`).

---

## 6. What's genuinely strong

- **Forge's exporters are real engineering.** A correct hand-rolled binary STL writer (endianness, y-up→z-up with orientation-preserving determinant, world-matrix baking — `exports.js:20-53`); a ~55-line ZIP writer with real CRC32 and central directory (`exports.js:61-119`); modern Gerber X2 with TF attributes, FSLAX46, negative-polarity masks, tool-grouped Excellon, from computed geometry (`pcb.js:133-210`). All dynamically verified as valid bytes.
- **Both Claude integrations are model citizens of the current API** — correct `output_config.format` structured outputs, valid current model IDs, the browser-CORS header, refusal `stop_reason` handling, graceful offline fallback; Forge additionally implements the real server-side refusal-fallback beta correctly (`apps/forge/js/claude.js:25-49`; `apps/ghost/nexus/js/claude.js:82-114`). The README claim that looked most like fiction is the best-implemented feature in the repo.
- **NEXUS is nearly vaporware-free.** The local and Claude "minds" share one `{reply, effects}` contract with a single `applyEffects` (`dialogue.js:399-444`), so consequences are identical on both paths; offline catch-up runs the *actual simulation*; the systems genuinely interlock (surveillance→witnesses→arrests; policy→mood→protest→election; gossip→reputation→dialogue). Consistent `NX.esc()` output escaping; every growth array bounded; seeded RNG for continuity.
- **GHOST's architecture claim is structurally true**: engine emits events, all DOM updates subscribe in one `wire()` (`ui.js:522-538`), one rAF loop reads state; bus handlers are try/catch-isolated (`lib.js:66,78`); the fixed-timestep engine really is deterministic (`engine.js:11,234-239`); `ghost.html` is byte-for-byte current with the loaded source.
- **Honest self-labeling, mostly**: GHOST's README explicitly frames what's simulated and where real backends would plug in; the voice demo toast says "simulated"; Forge's README admits the comb-router, multi-solid STL, and seeded keymaps; `catalog.js` admits search links. The exceptions are exactly findings C1/H1/H3.
- **Forge's ability-profile layout is real ergonomic math** — polar fingertip anchors, column filtering by usable fingers, hand mirroring, bbox recompaction (`layout.js:23-169`) — the one place the "OneHand" concept is functionally embodied.

---

## 7. Biggest technical risks & biggest product gaps

**Top technical risks**
1. No git/tests/checks while the upstream source folders actively diverge (H6, M8) — the only copy of everything is one overwrite away from gone.
2. NEXUS economy corruption compounds silently in every long-running save (H2).
3. Fabbing/printing costs from outputs that look production-grade but aren't verified: PCB netlist (H1), woodworking STL scale (M2), BOM quantities (M3).
4. Silent degradation of the paid Claude path in NEXUS (H4) — failures are invisible by design.
5. XSS surface around the plaintext API keys in localStorage (M5, L2) — small today, grows with every new innerHTML.

**Top product gaps**
1. The inspection loop's no-key+photo path actively misrepresents what it did (C1) — the one true deception.
2. The shell's one-handed premise isn't yet delivered by the shell itself (H5, L5) — ironically, Forge's layout engine already contains the thinking the shell lacks.
3. GHOST's operator story has two dead controls (H3, M7) in an otherwise fully-wired room.
4. The NEXUS investigation fiction degrades for hand-carried evidence (M11).
5. An entire authored persistence layer for GHOST sits unintegrated (M8) — the biggest available capability gain for the least new code.

---

## 8. Product maturity rating

**Rating: Early MVP (suite overall)** — GHOST: *Prototype/Demo by design, and honestly so*; NEXUS: *Functional MVP* (core loop real, persists, robust to corrupt saves); FORGE: *Early MVP* (real generation/export core; electrical truth and two modes still partly canned); Shell: *Early MVP* (works on desktop, fails its premise on mobile).

| Level | Meaning |
|---|---|
| **Prototype / Demo** | Looks like the product; core flows are fake, mocked, or broken. |
| **Early MVP** | Some core flows genuinely work; significant gaps, thin/no tests. |
| **Functional MVP** | Core value flow works end to end and persists; known gaps; some tests. |
| **Production-leaning** | Core flows solid and secured; reasonable tests and error handling. |
| **Production-ready** | Secure, tested, resilient; only polish remaining. |

Why: the cores are unusually real for a "vibe-coded" suite — verified bytes, verified persistence, verified API correctness — but there is zero safety net (no VCS, no tests), a handful of dishonest surfaces, and sim-corrupting bugs. One week of focused fixes (below) moves the suite to Functional MVP; the gap to Production-leaning is mostly the harness (tests, git, error visibility), not rewrites.

---

## 9. Recommended order of operations

1. **H6 — `git init` + baseline commit (RSG level), today.** Everything else becomes reversible; nothing else should precede it.
2. **C1 — label the simulated inspection unconditionally.** The only active deception; 30 minutes.
3. **H2 — one-line economy reset fix**, before more NEXUS saves accumulate corruption.
4. **H1 (labeling) + H3 (honest copy) + M1 (drop "validated")** — one honesty pass across Forge/GHOST copy, ~1 hour total, closes every "claims vs. reality" gap that can be closed by words while the real fixes are scheduled.
5. **H4 — NEXUS history windowing fix** (with one live keyed test), protecting the flagship AI feature.
6. **H5 — shell mobile reflow**, restoring the product premise.
7. **M2, M3, M6 — Forge physical-output correctness** (STL scale, BOM quantities, macro keycodes) before anyone builds from exports.
8. **M8 decision — wire or shelve `store.js`/`world.js`** before any re-sync from `RSG\GHOST` (re-syncing first would compound the divergence).
9. Remaining Mediums (M4, M5, M7, M9–M12), then the L1 dead-code sweep last.

Why this order: irreversibility first (git), deception second (trust), silent corruption third (compounding cost), then honesty-by-copy (cheap), then the features users would pay for, then physical-cost bugs, then polish.

## 10. Phased recovery / improvement roadmap

**Phase 1 — Stop the bleeding (1 day)**
Goal: nothing is dishonest, nothing corrupts, nothing is unrecoverable. Includes: H6 (git+baseline), C1, H2, honesty edits from H1/H3/M1. Exit test: fresh NEXUS save survives 14 simulated days with stable business cash; inspection without key is visibly simulated.

**Phase 2 — Make the claims true (1 week)**
Goal: every advertised control and path does what it says. Includes: H4, H5, M2, M3, M6, M9, M10, M11; real PCB pin mapping from the shared spec table (H1 full fix) if fabbing is actually on the roadmap — otherwise keep the honest label. Exit test: a keyed NEXUS conversation runs 20+ turns on Claude; shell fully usable at 375×812; Forge exports dimension-checked.

**Phase 3 — Harden & converge (1–2 weeks)**
Goal: one source of truth and a safety net. Includes: decide the GHOST integration (M8 — wire store/world or remove), formal re-sync strategy between `RSG\*` originals and `apps/*` (or collapse to one location under the new repo), a browser smoke script in CI-style use (boot all apps, assert zero console errors, run one Forge export and byte-check it — this audit's checks, automated), M5/L2 escaping pass, M12 reduced-motion gating, L1 dead-code sweep.

---

*End of audit. Findings reflect the working tree as of 2026-07-24 (no VCS commit exists to pin — see H6) and the verification runs recorded in §4. SUSPECTED items (M2, M6, H4's 400-behavior, L3's "80 people") note exactly what would confirm them; everything else was traced or executed.*
