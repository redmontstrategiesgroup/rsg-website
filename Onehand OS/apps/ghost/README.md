# 👻 GHOST — AI Command Center

A cinematic, real-time control room for watching and operating a fleet of machines,
sites, and business systems from one screen. You give GHOST a single mission; it
decomposes the work across desktops, a VPS, a phone, your CRM, and a security
sentinel — then **verifies its own results visually** and self-corrects when it
sees something wrong.

Built as a **zero-build, self-contained web app**: no Node, no npm, no bundler.
Open it and it runs.

---

## Run it

**Easiest — double-click:**

```
ghost.html
```

A single self-contained file. Works fully offline in any modern browser
(Chrome, Edge, Firefox). Nothing to install.

**Or run the multi-file source** (identical app, split into readable modules).
Because it uses classic scripts + linked CSS, it also works by opening
`index.html` directly — or serve the folder if you prefer:

```bash
python -m http.server 8777
```

then open <http://127.0.0.1:8777/index.html>.

> `ghost.html` is generated from the source files — see *Rebuilding* below.

---

## What you're looking at

On boot, GHOST auto-launches its flagship **Build** mission —
*"Create and launch a complete website and sales system for a South Shore roofing
company."* — and the room comes alive:

- **Fleet · Live Screens** — a live animated preview of every machine (VS Code
  building the app, a browser painting the site, Vercel deploy logs, a Stripe
  checkout, the phone under ADB, the CRM pipeline, the security camera grid).
- **Mission Timeline** — the 10 phases, lighting up as agents complete them.
- **Global System Map** — a radial graph of the fleet with data pulses flowing
  from the GHOST core to whichever machines are working.
- **Agent Comms** — the agents (ORCHESTRATOR, RECON, ATELIER, FORGE, KEEP,
  RELAY, ARGUS, WARDEN, STEWARD) talking to each other as work happens.
- **Cost / Tokens / Throughput** meters and a **Mission Replay** telemetry
  sparkline + scrubber.

### The signature moment: visual self-correction

GHOST does **not** trust *"Deployment successful."* After deploy, the **ARGUS**
vision agent re-opens the site on a *different* machine, clicks through every
page, then drives the real **phone over ADB** to test mobile checkout. When it
sees the checkout button overlap the sticky nav at 390px, a **Visual Anomaly
Detected** panel fires — severity, viewport, offending elements, a live
screenshot with the overlap boxed in red — and the task is routed back to the
frontend agent, which patches it and re-verifies. Only then does the mission
complete.

---

## Mission modes

Switch modes from the left rail (or the command bar / chips):

| Mode | What it runs |
|------|--------------|
| **Build** | Ship software, sites & automations (the roofing flagship). |
| **Company** | Approved RSG ops: review leads → proposals → client portals → updates → monthly report. Gated approvals for anything client-facing. |
| **Research** | Fans out across machines, compares sources, **red-teams its own conclusion**, assembles a cited report. |
| **War Room** | A production incident (checkout 500s): isolate → reproduce → propose fix → **waits for your approval before touching production** → verify. |
| **OneHand** | Voice-first accessible control — wake the lab, read back leads, cast a quote to the big screen. |

### Controls

- **Approve / Pause / Redirect / Terminate** (right rail). Approve pulses when a
  mission is holding for your sign-off.
- **Command bar** — type a mission in plain English; GHOST classifies it, shows a
  briefing, and deploys. Hit **Redirect** to steer a running mission.
- **🎙️ Voice** — simulated voice capture demo (kicks off OneHand mode).
- **🧊 Home Lab** — a rotating 3D map of the physical fleet (PiKVM, Pi cluster,
  NAS, cameras, smart plugs, phone).
- **Emergency Stop** (top-right) — halts every agent, powers the fleet down, and
  isolates the network. Click again / **Restore Fleet** to recover.
- Keyboard: **Space** = pause/resume, **Esc** = close overlays.

---

## Architecture

```
index.html            shell + mount points, loads CSS then classic JS in order
styles/core.css       theme tokens + ambient FX (starfield, grid, scanlines, aurora)
styles/app.css        layout grid + every component
js/lib.js             DOM helpers, event bus, formatters, RNG
js/data.js            machines, agents, mission scripts (the 5 modes)
js/engine.js          simulation core — clock, mission state machine, metrics,
                      gates, anomaly triggers, emergency stop  (single source of truth: G.state)
js/viz.js             all canvas rendering (machine scenes, system map, sparkline, starfield)
js/ui.js              builds every DOM panel, wires them to the engine's event bus
js/app.js             bootstrap (boot sequence → build UI → run engine)
ghost.html            generated single-file build (all of the above inlined)
```

**Data flow:** `engine` mutates `G.state` and broadcasts on `G.bus`
(`feed`, `machine`, `step`, `metrics`, `anomaly`, `gate`, …). `ui` subscribes and
updates the DOM incrementally; `viz` runs one `requestAnimationFrame` loop reading
`G.state` for the canvases. The mission "engine" is a fixed-timestep state machine,
so playback is deterministic and never skips a phase.

### What's real vs. what would need wiring

This is a **fully working command-center front end driven by a live simulation
engine**. Everything you interact with — modes, missions, gates, the anomaly
loop, metrics, emergency stop, the 3D lab — is real and functioning. The device
layer is modeled so that real backends drop into clear seams:

- **Machines** (`js/data.js`) are plain objects with `scene` / `task` / `status`.
  Replace the simulated scenes with real screen streams (PiKVM MJPEG, VNC/RDP
  frames, ADB `screenrecord`, or `getDisplayMedia`).
- **Agents / the mission engine** (`js/engine.js`) is where scripted steps live.
  Swap the scripted step-runner for calls into an actual agent orchestrator
  (e.g. the Claude Agent SDK) and stream tool results onto the same `G.bus`
  events — the entire UI already renders from those events.
- **Anomaly detection** currently fires on a scripted cue. Point it at a real
  vision check (screenshot diff / VLM review) and emit the same `anomaly` event.

Because the UI is 100% event-driven, wiring real systems means feeding the same
events GHOST already consumes — no UI rewrite.

---

## Rebuilding `ghost.html`

The single-file build is produced by inlining the source. If you edit anything
under `styles/` or `js/`, regenerate it:

```bash
python tools/build_standalone.py    # (the inliner used during the build)
```

*(Editing the source files directly is the normal workflow; `ghost.html` is just
a convenience artifact for sharing / offline double-click.)*

---

## Notes

- No external network calls, no CDNs, no trackers — everything is local and
  offline-capable.
- Single-theme by design: a dark ops-room aesthetic. Respects
  `prefers-reduced-motion`.
- Tuned for a ~1280px-wide window; degrades gracefully narrower.
