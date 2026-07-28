# RSG portfolio contracts

The RSG apps (GHOST, NEXUS, Observatory, THE FORGE) are separate products that
share **one browser origin** when served by `serve.py`. They coordinate through
a few localStorage contracts — nothing more. There is no backend, no shared
runtime service, and no app reads another app's private state.

Rule of thumb: **apps are referenced, never copied; data is shared by contract,
never by reaching into another app's keys.**

## localStorage namespaces

Each app owns a prefix and must not read another app's keys, with the two
shared contracts below as the only exceptions.

| Prefix | Owner | Contents |
|---|---|---|
| `ohos.*` | Onehand OS shell | shell prefs (`ohos.hand`) |
| `ghost:*` | GHOST | world model, audit, missions (`ghost:v2`) |
| `nexus_*` | NEXUS | city save (`nexus_world_v1`), voice/model prefs |
| `forge.*` | THE FORGE | settings/spec (`forge.settings.v1`) |
| `obs_*` | Observatory | saves, `obs_api_key` (legacy fallback) |
| **`rsg.*`** | **Onehand OS shell (sole writer)** | the shared contracts below (`rsg.ability.v1`, `rsg.ability.prior.v1`, `rsg.anthropic_key`) |

## Contract 1 — Ability profile (`rsg.ability.v1`)

**Sole writer: the Onehand OS shell settings panel.** Every app reads it and
adapts; no app writes it. Missing or corrupt → each app falls back to its own
defaults (soft dependency, mandatory).

```json
{
  "v": 1,
  "hand": "right",
  "fingers": { "thumb": true, "index": true, "middle": true, "ring": true, "pinky": true },
  "reachMM": 95,
  "grip": "weak | moderate | strong",
  "fatigue": "low | med | high",
  "precision": "low | moderate | high",
  "permanence": "temporary | permanent | changing",
  "inputs": ["voice", "foot", "switch"],
  "targetScale": 1.4,
  "updated": "2026-07-28T02:52:09.466Z"
}
```

`precision` (tremor / fine control) and `permanence` are additive `v: 1` fields.
**They are omitted entirely when the person hasn't answered them** — never written
with a guessed middle value. `ability-resolver.js` then reports them in
`layout.unresolved`, so the gap stays visible instead of being papered over.

Every field describes **function, not diagnosis**. A diagnosis predicts need
worse and raises the data's sensitivity tier for nothing.

Consumers (each maps only the fields it needs; unknown fields are ignored,
never dropped on write since only the shell writes):

- **THE FORGE** — `spec.js` `sharedAbility()` reads `hand`, `fingers` (map),
  `reachMM`; `defaultSpec()` overlays it and the ability panel is seeded at boot.
- **GHOST** — `onehand.js` `sharedProfile()` maps `fingers` → a count,
  `reachMM < 80` → `thumbReach: "limited"`, and passes through
  `grip`/`fatigue`/`inputs`/`targetScale`.

Versioning: additive fields only within `v: 1`; a breaking change uses a new key
(`rsg.ability.v2`) and keeps the old one for one migration cycle.

### Custody rules

This is the only durable record of a person in the portfolio, so the contract
covers more than its shape. All four are enforced by
`shared/profile-custody-test.html`.

- **Written only on declaration.** Booting the shell writes nothing. The key's
  *absence* means "never told us" and must stay distinguishable from a declared
  profile that happens to hold default values.
- **`updated`** is an ISO stamp written on every commit. It exists so a stale
  profile can be re-checked rather than asserted: with `permanence: "changing"`
  the shell prompts a re-check after 30 days, with `"temporary"` after 14, and
  with `"permanent"` never. This is the `revisitPrompt` the resolver emits.
- **`rsg.ability.prior.v1`** holds the profile that was in force before the
  person stepped to a `temporary` one, so a bad stretch is reversible — the
  resolver's `preservePriorLayout`. Written once on entering `temporary`,
  cleared on leaving it or on restore.
- **Deletion is offered and real.** "Forget my profile" removes
  `rsg.ability.v1`, `rsg.ability.prior.v1` and `ohos.hand`, with an undo. No
  code path may recreate the record as a side effect of ordinary use — flipping
  the dock hand updates an existing record but never resurrects a forgotten one.

### What leaves the browser

The profile is never transmitted as a profile. One field crosses the network:
`reachMM` is interpolated into THE FORGE's natural-language edit prompt
(`The forge/js/claude.js`, `parseEditAI`) and reaches `api.anthropic.com` with
that request, because the model emits `set_reach` ops against it. Nothing else —
not `hand`, `fingers`, `grip`, `fatigue`, `precision` or `permanence` — appears
in any prompt. The settings panel says so in those terms, and the custody suite
greps the prompt builders to keep the statement true.

## Contract 2 — Anthropic API key (`rsg.anthropic_key`)

Plain string. **Sole writer: the Onehand OS shell.** AI-using apps read
**shared-first, legacy-second**, so the key is pasted once but each app still
works standalone with its own key field:

- THE FORGE — `getSettings().apiKey` overlays the shared key
- NEXUS — `NX.claude.getKey()`
- Observatory — `OBS.copilot.getKey()`

The key never leaves the browser except to `api.anthropic.com`. Per-app **model**
choice stays app-local (defaults differ on purpose: Fable 5 / Haiku 4.5 / Opus 4.8).

> **Security:** on one origin, any app's XSS can read this key. Exported HTML and
> all user/AI strings are escaped at every sink (see the Phase 0 commit). Prefer a
> spend-capped key on shared/demo machines.

## Shared library — `shared/ability-resolver.js`

`window.RSGAbility` — the one place a capability profile becomes a control
layout. **Pure**: `(capability, application) → layout`. No I/O, no clock, no
randomness, no model in the resolution path. Same input, same output, every run
— a person builds motor memory around control positions, so a layout that
drifts between sessions damages the accommodation it exists to provide.

- `resolve(capability, application)` → `{ zones, target, columns, placements,
  deferred, substitutions, voice, sequential, safeguards, fatigue, unresolved,
  why }`. The `why` array traces every decision to the input that caused it.
- `checkInvariants(layout, application)` → `{ ok, violations }`. Six rules the
  generator cannot pass while violating: no two-contact requirement, no
  drag-only path, no timing dependence, destructive actions never adjacent to
  frequent ones nor in the comfortable zone, every action reachable by every
  declared input method, every action reversible.

The **capability** profile is the person's and travels with them; the
**application** profile (`{id, surface, actions[]}`) describes what needs
mapping. Changing one must not require re-deriving the other.

Consumers: GHOST (`onehand.js` — PHANTOM HAND dock) delegates to it and falls
back to an inline path when the shared file isn't served. `ghost.html` inlines
it via `tools/build_standalone.py`.

Tests: `shared/resolver-test.html` (52 assertions, in the portfolio runner).
The load-bearing ones are the **differential** tests — one ability dimension
changes, the output must change in the way the rule predicts — and the
**negative** test: two substantially different profiles must not produce
identical output. That last one is what catches a canned default, and it is the
one most likely to be missing. Do not tune the rules without it in place.

## Shared library — `shared/input-devices.js`

`window.RSGInput` — capability-based input hardware (foot pedals, switches,
adaptive controllers). Designed against one assumption: **the device will
disconnect at the worst moment, and for some people it is their only way to
operate the software.**

- `createManager({source, clock, storage, storageKey, debounceMs})` — the
  device source and clock are **injected**, so disconnect-mid-action, reconnect,
  reduced capabilities and permission denial are all exercisable without real
  hardware. `mockSource()` is the test double.
- Devices are described by **capabilities** (`buttons`, `axes`, `analog`,
  `haptics`), never by model name, so an unfamiliar pedal works on first
  connection and gets a default mapping derived from what it reports.
- `registerAction(id, label, fallbacks)` then `bind(deviceId, inputKey, action)`.
  **`bind()` refuses** any action with no non-hardware fallback — hardware
  cannot become the only route to anything. `hardwareOnlyActions()` must always
  return `[]`.
- Mappings are to **actions, not keystrokes**, survive disconnect and
  reconnect, support one input → a sequence, and many inputs → one action.
  Remapping works with no device attached.
- `status()` reports `connected | no-device | disconnected | denied |
  unsupported` with an honest message; disconnect is detected immediately and
  announced on-screen, so dismissing it never needs the device that went away.
- `debounceMs` is configurable — tremor produces repeat activations that need
  filtering, while an aggressive default swallows someone else's fast input.

**Sources.** `defaultSource()` composes two, so a gamepad-class controller and
a HID pedal can be live simultaneously:

- `gamepadSource()` — Gamepad API. No permission prompt, polled.
- `hidSource({hid})` — WebHID. Chromium-only, secure context. Enumerates
  already-granted devices via `getDevices()` (**this is the persisted pairing**
  — a returning user is not prompted again), opens them, and decodes
  `inputreport` events by walking the report descriptor: usage page `0x09` =
  buttons, `0x01` usages `0x30–0x38` = axes, with per-report-id bit cursors and
  two's-complement axis decoding. Bit offsets are **read from the descriptor**,
  never hard-coded, which is what lets an unfamiliar pedal work on first
  connection. `requestDevice()` must be called from a user gesture; an empty
  result (chooser closed) is reported as denial, not an error.
  `hid: null` explicitly means "no WebHID here" — it does not fall back to
  `navigator.hid`.

Foot pedals that emulate a keyboard need no source at all — they arrive as key
events and the keyboard fallback already covers them.

`canRequestDevice()` is false when the browser cannot prompt, so a connect
control is never offered where it could not work. `connectRequirements()`
returns the driver/pairing prerequisites to show **before** the chooser opens.

> **Tested against**: mock sources only, including a mock `navigator.hid`.
> **No physical device has been tested.** Report-descriptor parsing is verified
> against a synthetic 3-button pedal descriptor, not a real one. Devices whose
> descriptors use features this parser ignores (arrays/hat switches, vendor
> usage pages, feature reports) will report fewer capabilities than they have.
> Do not read any of this as broad compatibility.

Tests: `shared/input-devices-test.html` (66 assertions, in the portfolio runner).

## Shared library — `shared/claude-bridge.js`

A classic script exposing `window.RSGClaude` (build-time reuse, no runtime
coupling). Loaded by each AI app via a `<script>` tag; consumers guard
`window.RSGClaude || <legacy inline path>` so standalone serving degrades
instead of breaking.

- `request({ key, model, system, messages, schema, maxTokens, effort })` —
  structured outputs, browser-access header, the Fable-5 server-side
  refusal-fallback beta, and refusal detection. Returns `{ text, msg }`.
- `windowMessages(prior, currentText, { max })` — de-dups the in-flight turn,
  keeps the last `max` (12), and guarantees the array starts with a `user`
  turn. This is the fix for the NEXUS bug where long conversations silently
  fell back to the local brain.

## Serving

`serve.py` at the repo root serves the whole portfolio on
`http://127.0.0.1:8100`; `/` redirects to the shell. The shell's
`Onehand OS/apps.json` manifest points tiles at the original app folders.
`GHOST/ghost.html` (single-file build) remains the zero-dependency disaster mode.

See [`docs/plans/onehand-profile-and-one-key.md`](docs/plans/onehand-profile-and-one-key.md)
for the plan these contracts came from, and [`ecosystem-architecture.md`](ecosystem-architecture.md)
for the portfolio architecture.
