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
| **`rsg.*`** | **Onehand OS shell (sole writer)** | the shared contracts below |

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
  "inputs": ["voice", "foot"],
  "targetScale": 1.4
}
```

Consumers (each maps only the fields it needs; unknown fields are ignored,
never dropped on write since only the shell writes):

- **THE FORGE** — `spec.js` `sharedAbility()` reads `hand`, `fingers` (map),
  `reachMM`; `defaultSpec()` overlays it and the ability panel is seeded at boot.
- **GHOST** — `onehand.js` `sharedProfile()` maps `fingers` → a count,
  `reachMM < 80` → `thumbReach: "limited"`, and passes through
  `grip`/`fatigue`/`inputs`/`targetScale`.

Versioning: additive fields only within `v: 1`; a breaking change uses a new key
(`rsg.ability.v2`) and keeps the old one for one migration cycle.

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
