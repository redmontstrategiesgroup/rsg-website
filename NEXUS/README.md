# NEXUS — The City That Remembers

> Every person has a life. Every action becomes history. The world continues without you.

A living-city simulation that runs entirely in your browser. One neighborhood — **Rusthook** — with 30 persistent AI residents who have jobs, money, moods, goals, fears, secrets, relationships, and memories. Rumors mutate as they spread. The economy actually settles every midnight. An election happens on Day 7 whether you show up or not. Close the tab for a day and the city simulates the time you missed.

**Zero dependencies. No build step. No server-side anything.** State persists in `localStorage`.

## Run it

```
python -m http.server 8741
```

…from the folder above this one, then open **http://localhost:8741/nexus/**.
(Double-clicking `index.html` also works for everything except voice input.)

## The opening scenario

Day 1, 08:00 — the **Halcyon Assembly Plant** closes with one day's notice. Nine residents lose their jobs. An anonymous Pulse post claims the closure was intentional. It was: the land was quietly sold to *Meridian Development*, and five residents each hold one piece of the proof (a ledger, a memo, a land file, a delivered envelope, a thirty-year-old memory). They guard what they know. Nobody has assembled the picture.

You arrive with $600 and no reputation. What happens next is not scripted.

## What's simulated

- **Residents** — schedule-driven days (sleep, work, errands, social hour), needs, mood, energy. Unemployed residents burn savings, hunt for work, drift toward the protest — or the Red Knives.
- **Memory & gossip** — witnessed events become memories; memories spread person-to-person with distortion ("stole" becomes "robbed at knifepoint — or so they say"). Guarded secrets leak slowly; ordinary news spreads fast. What people believe about *you* spreads the same way.
- **Economy** — businesses earn from simulated customers with real wallets, pay wages, pay taxes, cut staff, fail, and hire. City treasury, unemployment, crime index, price index.
- **Reputation** — six factions (police, Red Knives, business, workers, city hall, public) each track you separately.
- **Election** — Day 7, Vasquez vs. Okafor. Every resident's vote drifts with their employment, mood, and what they've heard. You can canvass.
- **Talk to anyone** — free text (or voice). Accuse, bribe, threaten, flirt, recruit, persuade, spread evidence. NPCs react from personality + memory and take real actions: warn the gang, call the police, offer hush money, confess, hire you.
- **Pulse** — the district's social network: news, promos, complaints, and anonymous conspiracy posts.
- **God Mode** — tax rate, minimum wage, police budget, UBI, business subsidies, surveillance. Watch 30 lives respond.
- **Offline simulation** — ~8 real hours away = 1 city day (capped at 7). You get a "WHILE YOU WERE AWAY" report.

## Claude-powered minds (optional)

Out of the box, residents run on a built-in intent-matching engine — they still remember everything and react to reputation. Paste an **Anthropic API key** in ⚙ Settings and every conversation is instead played by a Claude model (`claude-haiku-4-5` by default; Sonnet/Opus selectable) receiving the character's full sheet, memories, relationships, and world state, and returning structured consequences (relationship shift, a permanent memory, and actions like `warn_associates` or `confess`). The key lives only in your browser's localStorage and is sent only to `api.anthropic.com`. If a call fails, the local mind answers instead.

## Architecture

| File | Role |
|---|---|
| `js/util.js` | seeded RNG, formatting helpers |
| `js/data.js` | map, buildings, businesses, 30 hand-authored residents, `newWorld()` |
| `js/social.js` | memories, gossip + distortion, relationships, faction reputation |
| `js/economy.js` | nightly settlement: customers, wages, taxes, failures, hiring, policy levers |
| `js/feed.js` | Pulse post generation |
| `js/events.js` | opening scenario, crime/arrests/recruitment/protests, election, scandal logic, daily digest |
| `js/sim.js` | the tick engine (48 ticks/day), schedules, movement, encounters |
| `js/dialogue.js` | local NPC brain: intent detection → in-character reply + consequences |
| `js/claude.js` | Claude API brain (browser fetch, structured JSON output), same consequence shape |
| `js/map.js` | isometric canvas renderer: day/night, pan/zoom, picking |
| `js/ui.js` | panels, chat, toasts, voice in/out |
| `js/app.js` | boot, autosave, offline catch-up, main loop |

## Tuning knobs worth knowing

- `events.js → truthCheck`: scandal breaks at **10 evidence-holders / 3 distinct clues**. Organically rare before the election; fast if you carry the evidence yourself.
- `social.js → gossip`: guarded knowledge leaks at 3% per exchange (12% between close friends).
- `app.js → catchUp`: 8 real hours = 1 city day, capped at 7.
- `data.js`: add a resident to the array and they're alive — schedule, economy, gossip and all.
