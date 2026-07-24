# 👻 GHOST — General Hardware Orchestration & Systems Terminal

The operating and orchestration layer between you and your digital + physical
systems. Tell GHOST what needs to happen; it works out which systems are
involved, builds a **visible execution plan**, asks for approval where it
matters, performs the work against real state, **independently verifies the
result**, and shows exactly what happened — with a full audit trail and
rollback.

> **Design principle GHOST enforces on itself: it never marks a task complete
> until verification re-reads real state and confirms it.** No fake "done".

Built **zero-build** (no Node, no bundler, no server): classic scripts + linked
CSS, all state persisted in the browser. Open it and it runs — offline.

---

## Run it

**Easiest — double-click** [`ghost.html`](ghost.html) (one self-contained file).
Or open [`index.html`](index.html) for the readable multi-file source. Or serve
the folder: `python -m http.server 8777` → <http://127.0.0.1:8777/>.

State persists in `localStorage` (per-origin). To wipe and re-seed, open the
console and run `G.store.reset(); location.reload()`.

---

## The six views (top bar)

| View | What it is |
|------|-----------|
| **Live Ops** | The cinematic command center — live machine screens, agent comms, mission timeline, visual self-correction, cost/token meters. The ambient "operations feed." |
| **Command** | The real pipeline. A directive → **structured plan** (goal, systems, impact levels, risks, verification, resource estimate) → **Execute** → a live **agent-orchestration DAG** with per-task verification evidence → rollback. |
| **World Model** | A persistent, queryable **relationship graph** of everything GHOST can observe or control. Click any node to trace its dependencies and **blast radius**. Ask it questions in plain English. |
| **Devices** | The device registry — every node with its real **control method** (API / SSH / RDP / KVM / ADB / vision), capabilities, and status. Wake / probe actions. |
| **Approvals** | High-impact and irreversible actions hold here until you approve or reject them. |
| **Audit** | Append-only log of every plan, approval, action, and verification. |

**Global command bar** (always visible, `Ctrl/Cmd+K`): type a directive → get a
plan. Try the demo chips in the Command view.

**PHANTOM HAND / OneHand** (top-right ✋): a first-class accessibility mode. From
a capability profile it generates an adaptive **radial command menu** placed in
your reach zone, with sticky modifiers, enlarged targets, number-key/voice
operation, and a two-step guard on destructive actions.

---

## The command pipeline (what makes it real)

```
directive → PLAN → [approval gate] → EXECUTE (mutates real state) → VERIFY (re-reads state) → AUDIT → [rollback]
```

- **Plan** — every command becomes a plan with an *interpreted goal*, the *systems
  involved* (resolved from the world graph), per-step **impact level 0–4**,
  reversibility, risks, a verification method, and a resource estimate.
- **Impact levels** (spec §9): `L0 Observe · L1 Reversible · L2 Controlled ·
  L3 High-Impact (needs approval) · L4 Prohibited (blocked)`.
- **Execute** — the orchestrator runs the plan as a task DAG. Safe tasks run;
  L3+/irreversible tasks **pause at an approval gate**. Effects mutate the real
  world model (e.g. leads actually change CRM stage, a device actually flips
  online) and capture rollback state.
- **Verify** — a *separate* verification step re-reads state and asserts the
  expected outcome (entity-field assertion, CRM query, device probe, record
  existence). A task only reaches `completed` if verification passes.
- **Audit + Rollback** — every transition is recorded; reversible runs can be
  rolled back from their captured before-state.

### Try these (Command view)

1. *"Investigate why the site is slow"* — opens an incident, checks deploy/server/DB, proposes a fix, **holds before any production change** (Demo 2).
2. *"Deploy the roofing site to production"* — pauses at an L3 approval gate; on approval, deploys and verifies health.
3. *"Move qualified leads and follow up on missed calls"* — moves qualified leads a CRM stage (verified), then **holds for approval** before external outreach (Demo 3).
4. *"Start my dev workspace across both computers, one-handed"* — wakes machines, opens apps, verifies availability, activates OneHand (Demo 1).
5. *"Build a workflow: when a lead misses a call, text them and notify the crew"* — parses it, maps integrations, **flags Twilio as not connected** (Demo 4).

### Ask the World Model

- *"What breaks if the database goes offline?"* → 5 dependent systems.
- *"What has access to production?"* → the operator + the Stripe key.
- *"Which devices are reachable remotely?"*

---

## Architecture

```
styles/  core.css      theme tokens + ambient FX
         app.css       live-ops command center
         views.css     app shell + operational views + OneHand dock

js/  lib.js            DOM/util/event-bus helpers
     store.js          durable state + append-only audit log (localStorage)
     world.js          THE WORLD MODEL — typed entity graph + traversal + NL query
     data.js           agents + live-ops mission scripts
     planner.js        natural language → structured execution plan (impact levels)
     orchestrator.js   plan → task DAG → real effects + verification + rollback
     onehand.js        PHANTOM HAND accessibility engine
     engine.js         live-ops simulation (drives the cinematic view)
     viz.js            canvas visuals (machine screens, system map, sparkline)
     ui.js             the Live-Ops command center DOM
     shell.js          app bar, router, and the World/Command/Devices/Approvals/Audit views
     app.js            bootstrap
```

**Separation of concerns** (spec §13): planning (`planner`), authorization
(`approvals` + gates), execution (`orchestrator` effects), verification
(`orchestrator` verify + `verifications` records), and logging (`store.audit`)
are distinct. The model never performs unrestricted operations — it emits plans;
execution goes through typed effects with impact gating.

**Everything is event-driven** off `G.bus`, so real backends attach by emitting
the same events the UI already consumes.

---

## What's real vs. what's an adapter seam

**Real and functioning today** (persisted, verifiable, non-fakeable):
the world model + queries, the command→plan→approval→execute→verify→audit→rollback
pipeline, impact-level authorization, the agent-orchestration DAG, per-task
verification against real state, the device registry, PHANTOM HAND, and the full
audit log.

**Adapter seams** (clearly labeled, deliberately not wired):
actual external side effects — real Vercel deploys, SSH/RDP/PiKVM/ADB device
control, Stripe/Twilio/Gmail transmission. This machine has **no Node/toolchain**
to run a real backend, and — per the spec's own rule — GHOST must not *pretend*
an external action occurred. So those operations run against GHOST's own world
model and are marked honestly (e.g. outreach is **prepared, not sent**, and
Twilio shows **not connected**). Each seam is a single function in
`orchestrator.js` (`applyEffect`) or an integration entity in `world.js`.

**Credentials** are represented as reference entities only — **never values** —
and never surfaced in the UI, logs, or agent memory.

---

## Implemented vs. next phase (against the 16-section spec)

**Implemented:** world model (§2), command center + visible plans (§3),
multi-agent orchestration with verification (§4), device registry with honest
method labeling (§5), PHANTOM HAND / OneHand (§6), operating modes (§7),
impact-based approval + rollback + audit (§9), verification framework + status
lifecycle (§11), operations-console design for the new views (§12), durable
entity model with separated planning/auth/execution/verification/logging (§13),
demo flows 1–5 (§14).

**Deferred (next phase):** the two-way visual↔natural-language **workflow builder**
(§8), the scoped **memory** inspector UI (§10), real **multi-user auth/roles**,
a **server/queue** backend, and live **external adapters** — all of which need
either a real runtime (Node/Supabase) or authorized integrations that this
zero-build environment can't provide. The seams for each are in place.

---

## Rebuilding `ghost.html`

```bash
python tools/build_standalone.py
```

Inlines all CSS + JS into the single-file build. Edit the source under `styles/`
and `js/`; `ghost.html` is a convenience artifact for sharing / offline use.

## Notes
- No external network calls, no CDNs. `localStorage` degrades gracefully to
  in-memory if a sandbox blocks it.
- Keyboard: `Ctrl/Cmd+K` command bar · `Esc` close overlays · `Space` pause live-ops.
- Tuned for ≥1200px; degrades narrower.
