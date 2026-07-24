# 🖐 ONEHAND OS

**One hand, full control.** The RSG umbrella shell: a launcher that runs every
RSG app full-screen — designed so everything important stays inside one
thumb's reach.

## Run it

From the **RSG folder** (one level up):

```bash
python serve.py
```

Open **http://127.0.0.1:8100** — it lands on the shell. No build step, no
dependencies beyond Python and a browser.

## How apps are wired

Apps are **referenced, never copied.** [apps.json](apps.json) is the manifest:
each entry points at an app's original folder (`../GHOST/`, `../The forge/`,
`../GHOST/nexus/`, `../GHOST/observatory/`). The shell builds its tiles from
it; the static tiles in `index.html` are only a fallback for when the manifest
can't be fetched. To add an app, add a manifest entry — do not copy the app in.

| App | What it is |
|---|---|
| **👻 GHOST** | AI command center — plans, approval gates, fleet screens, world model, audit, and the PHANTOM HAND one-handed subsystem. |
| **⚒ THE FORGE** | One sentence → manufacturing package: requirements, 3D model, PCB, firmware, BOM, drawings, validation gates. |
| **🌆 NEXUS** | The city that remembers — a living-city simulation with persistent residents, rumors, an economy and an election. |
| **🔭 OBSERVATORY** | Decision-analysis simulator — change one decision in a modeled world and observe the consequences. |

Each app is untouched upstream code in its own folder with its own README.

## Shell features

- Boot screen → home with clock and app tiles.
- Full-screen app stage (iframe) with a floating **⌂ home** button in the
  thumb zone; **Esc** also returns home while the shell has focus.
- **L / R hand toggle** moves the dock to whichever thumb you use; persists
  in `localStorage` (`ohos.*` keys).
- Zero dependencies, respects `prefers-reduced-motion`.

## Layout

```
index.html   the shell (boot, home, app stage, dock, manifest loader)
apps.json    app manifest — the only place apps are registered
../serve.py  one static server for the whole RSG portfolio on :8100
```

## Shared contracts

The shell owns two shared localStorage contracts that the apps consume:

- **`rsg.ability.v1`** — your ability profile (hand, fingers, reach, grip,
  fatigue, input aids). Set it once in ⚙ Settings; THE FORGE and GHOST adapt
  their layouts to it.
- **`rsg.anthropic_key`** — your Anthropic API key. Paste it once; THE FORGE,
  NEXUS and Observatory all use it.

See [`../CONTRACTS.md`](../CONTRACTS.md) for the full schema, the single-writer
rule, and the shared `claude-bridge.js` library.

See `../ecosystem-architecture.md` for the portfolio architecture and
migration plan, and `../onehand-os-audit.md` for the 2026-07-24 audit.
