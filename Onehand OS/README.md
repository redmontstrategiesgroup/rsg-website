# 🖐 ONEHAND OS

**One hand, full control.** The RSG umbrella shell that boots into a launcher and
runs every RSG app full-screen — designed so everything important stays inside
one thumb's reach.

## Run it

```bash
python serve.py
```

Open **http://127.0.0.1:8100**. No build step, no dependencies beyond Python and
a browser.

(Double-clicking `index.html` also works, but THE FORGE and NEXUS voice input
need the http server — the shell will show a warning when opened from `file://`.)

## Apps

| App | What it is |
|---|---|
| **👻 GHOST** | AI command center — a cinematic control room that runs whole missions across a simulated fleet and visually verifies its own work. Includes the voice-first **OneHand** mission mode. |
| **⚒ THE FORGE** | Describe the problem, manufacture the solution — 3D model, schematic, PCB, firmware, BOM and assembly docs generated from one sentence, laid out around your physical-ability profile. |
| **🌆 NEXUS** | The city that remembers — a living-city simulation with 30 persistent residents, spreading rumors, a real economy, and a Day-7 election. |

Each app is untouched upstream code living in `apps/` — see each app's own
README for its full documentation.

## Shell features

- **Boot screen → home** with clock and app tiles.
- **Full-screen app stage** — apps run in an iframe with a floating **⌂ home**
  button placed in the thumb zone; **Esc** also returns home.
- **L / R hand toggle** (bottom-right of home) moves the dock to whichever
  thumb you use; the preference persists in `localStorage`.
- Zero dependencies, fully offline, respects `prefers-reduced-motion`.

## Layout

```
index.html        the OS shell (boot, home screen, app stage, dock)
serve.py          static server for the whole OS on :8100
apps/ghost/       GHOST — AI command center      (also: apps/ghost/ghost.html single-file build)
apps/ghost/nexus/ NEXUS — living-city simulation
apps/forge/       THE FORGE — invention fabricator
```
