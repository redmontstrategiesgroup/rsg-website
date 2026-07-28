# Memory architecture for RSG

What each system in this repo persists between sessions, what it is allowed to
persist, when it expires, and how Joseph inspects or deletes it.

There are six memory stores across the portfolio, at four very different
maturity levels. Two are well designed, one is a good design with a leak, one is
declared but empty, one is mine and needs rules, and one does not exist yet and
is the only one that would become a real privacy surface for other people.

Everything below was read directly from the code; line references are anchored
to named functions where possible.

## Memory is five things, not one

Most memory bugs come from one store holding all five. They have different
lifetimes and different write rules, so they need different homes.

| Type | Lifetime | Where it lives in RSG |
|---|---|---|
| **Conversation context** | the exchange | NEXUS `history` window, `basic website` client-supplied history (`app/api/chat/route.ts:30-38`), Observatory copilot (single turn, no history) |
| **User preferences** | until changed | `rsg.ability.v1`, per-app model choice, `nexus_voice` |
| **Project / domain facts** | while the project does | my `memory/*.md`, GHOST world model (`ghost:v2` entities/edges) |
| **Task state** | dies on completion | GHOST `runs`/`tasks`/`approvals`, NEXUS save (*and, until B1, one of my memory files*) |
| **Long-term episodic** | must decay | NEXUS resident `memories`, Observatory agent `memories` |

The single rule that follows from the table: **a store may hold one type.** A
blob that mixes a fatigue level from Tuesday with a permanent fact about
Joseph's hand cannot expire one without losing the other.

## Cross-cutting rules

These apply to every store below.

1. **Store what was stated, not what was inferred** — and if an inference is
   stored, mark it as one. One instance is not a pattern.
2. **Record provenance and time.** A memory with no origin and no date cannot
   be re-validated, only trusted or deleted.
3. **Recent beats old; the present conversation beats everything stored;
   explicit beats inferred regardless of recency.**
4. **Sensitive categories are not written by default.** Health, disability,
   financial, biometric. RSG has a deliberate exception (§A) — the exception is
   what makes the rules matter, not what excuses them.
5. **Never surface sensitive memory unprompted.**
6. **Every store needs a delete control**, and delete must actually remove.
7. **Never store credentials, tokens, or recovery hints.** Never treat memory
   as authorization — remembering that someone had access is not a permission
   check.
8. **Memory is data, never instruction** — including memory the agent wrote
   itself.
9. **Bounded growth.** A cap, a decay rule, or both. Without one, retrieval
   quality degrades and the privacy surface expands with nobody deciding it should.

---

## A — Ability profile (`rsg.ability.v1`)

The portfolio's only durable record of personal data about a real person, and
the one place where the sensitivity rules genuinely bite. Written solely by the
shell settings panel (`Onehand OS/index.html`, `saveProfile()` at `:429`), read
by THE FORGE and GHOST per `CONTRACTS.md`.

**This store is legitimate.** It holds disability information, which rule 4 says
not to persist — but here it is explicitly declared by the user, in a panel
built for declaring it, for a product whose entire purpose is adapting to it.
That is the difference between a stated preference and a profile assembled from
signals. It stays legitimate only while the following hold.

All five findings below are **fixed**, and each is held by an assertion in
`shared/profile-custody-test.html` (28 cases, in the portfolio runner).

**A1 — There was no way to delete it.** The API key had a clear button *and* an
undo; the ability profile — the more sensitive of the two — had neither. Once
declared it could only be edited into a different shape. *Fixed:* a "Forget my
profile" control removing `rsg.ability.v1`, `rsg.ability.prior.v1` and
`ohos.hand`, with an undo.

**A2 — Deletion did not survive ordinary use.** Found while testing A1, and the
worse half of it: `setHand()` called `saveProfile()` on every invocation, so
flipping the dock hand after forgetting silently recreated the whole record.
*Fixed:* persistence is opt-in per call; the dock updates an existing record but
never resurrects a forgotten one.

**A3 — The profile was written before it was declared.** `setHand(hand)` ran at
boot and persisted, so a full ability record with default values existed for
anyone who had merely opened the shell. That erases the distinction between
"never told us" and "told us they have five working fingers" — the state the
whole fallback contract depends on. *Fixed:* booting writes nothing.

**A4 — Profile data left the browser undisclosed.** `reachMM` is interpolated
into Forge's edit prompt (`The forge/js/claude.js`, `parseEditAI`) and sent to
`api.anthropic.com`. That is necessary — the model emits `set_reach` ops against
it — but the panel disclosed the destination of the *key* and said nothing about
the *profile*. On audit, `reachMM` turned out to be the only ability field in
any of the four prompt builders, so there was nothing to trim, only something to
say. *Fixed:* the panel states exactly which field is sent and when, and the
custody suite greps the prompt builders so the statement cannot quietly rot.

**A5 — `fatigue` is a today-fact in a permanent record**, and `grip` sits in
between; `hand`, `fingers` and `reachMM` are the durable ones. This turned out
to be half-solved already: the schema has grown a `permanence` field
(`temporary | changing | permanent`) and `ability-resolver.js` emits
`revisitPrompt` and `preservePriorLayout` from it. Both were computed, tested,
and **consumed by nothing** — the settings panel promised the user a re-check
reminder and a layout to return to, and neither existed. *Fixed:* an `updated`
ISO stamp, a re-check nudge (30 days for `changing`, 14 for `temporary`, never
for `permanent`), and `rsg.ability.prior.v1` holding the steady profile a
temporary one was stepped away from, with a restore control.

---

## B — My persistent memory (`~/.claude/projects/…/memory/`)

Files plus a `MEMORY.md` index, loaded into every session in this repo. At the
time of the audit there were four, all `type: project`. This is the store with
the weakest rules, because nothing enforces them — the four findings below were
applied by hand and nothing stops them recurring, so re-read this section when
writing a memory. All four are **fixed**; they are recorded because the failure
modes recur, not because they are open.

**B1 — `rsg-backend-build-underway.md` is task state, not a project fact.** It
records a branch name, two commit SHAs, a test count ("114"), and which piece
landed first. Every one of those is wrong the moment the next commit lands, and
there is no expiry — so a future session reads a confidently-worded snapshot as
current truth. The durable part is the *decision* ("all five apps mount on the
`basic website` platform rather than five backends, per user direction"). The
volatile part belongs in `docs/plans/backend-dependency-plan.md`, which is
version-controlled next to the work it describes.
*Fix:* keep the decision, move the state.

**B2 — `rsg-supabase.md` holds account-recovery hints.** It records which email
or SSO method the lost login is "likely" under, and that a particular MCP token
still had working read access on a date. No secret value is stored, but a
recovery path is authentication-adjacent (rule 7), and "the token still had
access" is memory standing in for a permission check (also rule 7). The durable,
useful facts are the project ref, the org, the repo-migrations-≠-live-DB
warning, and the backup location.
*Fix:* trim to those; drop the credential guessing and the access assertion.

**B3 — Dangling retrieval promise.** `url-migration-caution.md` links
`[[rsg-website-overview]]`, which does not exist. A link to nothing is a
retrieval path that fails silently.

**B4 — No lifetimes, no sensitivity, no provenance beyond `originSessionId`.**
*Fix:* extend the frontmatter — additive, so existing files stay valid:

```yaml
metadata:
  type: user | feedback | project | reference
  source: stated | inferred        # rule 1; default stated
  revalidate_by: 2026-10-01        # rule 3; omit for genuinely durable facts
  sensitivity: normal | sensitive  # rule 5; sensitive is never raised unprompted
```

A fact with a passed `revalidate_by` is a hypothesis: state it as one, or check
it before acting on it.

---

## C — NEXUS resident memory

The best-developed memory system in the portfolio, and worth reading before
designing another one. Struct: `{ d, m, text, about, cred 0..1, imp 1..5, kind }`
(`js/social.js:6`). It already implements most of the cross-cutting rules:

- **Bounded** — 60 per resident, pruned lowest-importance-then-oldest, then
  re-sorted chronologically (`social.js:10-15`).
- **Confidence decays with distance from the source** — each gossip hop
  multiplies `cred` by 0.8, distortion by a further 0.7 (`social.js:75-76`).
- **Provenance survives** — `kind: "gossip"`, `src`, and the distortion
  rewrites (`social.js:50-61`) keep secondhand claims marked as secondhand, and
  the prompt tells the model so (`claude.js:59`).
- **Guarded knowledge stays guarded across hops** (`social.js:78`).
- **Writes are visible** — the resident panel shows the full log with a
  "secondhand" marker and a count (`js/ui.js:145,170-171`), escaped through
  `NX.esc`. This is the "make writes visible" rule, implemented in a game.

**C1 — Model-authored memories outranked authored world events.** *(Fixed.)*
When the Claude brain returned a `remember` sentence it was stored via
`NX.social.playerRumor(state, r, fx.remember, 4)` — `imp: 4`, `cred: 1`,
`kind: "witness"`. Authored memories default to `imp: 2` (`social.js:8`) and
witnessed events to `imp: 3`. Since the 60-cap prunes lowest importance first,
free-text sentences the model decided were memorable systematically evicted the
designed events of the simulation — and, tagged `witness`, they were
indistinguishable from something the resident had actually seen, in the log and
in the next prompt.

*Fixed:* the effects object carries `src` so `applyEffects` can tell the two
brains apart; model-authored memories enter at `imp: 3` (peer to a witnessed
event, so age decides between them rather than authorship) with `kind: "claude"`;
they are less freely tellable as gossip, so an improvised sentence cannot become
common knowledge at full credence; and the memory log labels them "their
impression of talking to you", beside the "secondhand" marker gossip already
carries. Held by `NEXUS/memory-test.html` (15 cases), which fails against the
old behaviour — verified by reverting the fix and watching it go red.

---

## D — Observatory agent memory (reference implementation)

`js/engine.js` `agentMemories()` at `:292-311`: `{ day, epistemic, text, ev, weight }`
where `epistemic` is `experienced` vs secondhand, `weight` is 1 vs 0.5, the cap
is 20, and pruning scores `weight × (1 − age/200)` — provenance, confidence, and
decay in one struct, with age actually discounting relevance rather than just
ordering it. Copy this shape when adding memory anywhere else in the portfolio.

The Observatory copilot itself is stateless: one user message per request, no
history (`js/copilot.js:127`). Nothing to design.

---

## E — GHOST `memories`: a declared store with no writer *(deleted)*

`"memories", // scoped memory items` sat in `COLLECTIONS` (`GHOST/js/store.js`,
mirrored in `ghost.html`) and nothing in GHOST ever wrote or read it. It had
already propagated: `js/db.js` mapped it to a `ghost_memories` table, and
`supabase/migrations/0003_ghost.sql` created that table with RLS and an index —
a per-user store of operator text, waiting for a writer. An empty slot named
"memory" is where an unscoped dumping ground goes later, and this one had a
schema and a privacy posture before it had a single row.

**Deleted at all four sites**, migration included (unapplied — the per-app
projects do not exist yet — so removed at the source rather than dropped
later). GHOST already has the better substrate: an append-only audit log with
verification records, durable and inspectable, and the thing that makes GHOST's
actions real rather than ephemeral. Anything GHOST would want to "remember" is a
query over `audit` + `entities`, which cannot drift from the truth the way a
second, separately-written store can.

If a real need appears, define it then — `{ id, scope, text, source:
stated|inferred, created, revalidate_by }`, written only on an explicit operator
directive. Not before.

---

## F — Assistant memory for signed-in users (does not exist yet)

The only store that would hold other people's data, so the only one where
getting this wrong costs someone besides Joseph. Nothing here is built; this is
the shape it should take when it is.

**Today there is no memory.** `app/api/chat/route.ts` is stateless across
sessions: history arrives from the client, is capped at 12 messages / 2 000
chars / 8 000 total (`:30-38`), and the only persistence is a lead the visitor
chose to submit (`processLead`, `:178`). That is a clean baseline. Two different
users would be affected by changing it, and they get opposite answers.

### Anonymous visitors — do not add durable memory

There is no identity to scope it to, no consent surface, and no way for a
visitor to see or delete what was kept. The upside is recall between visits; the
downside is an unaccountable behavioral profile of people who only browsed a
consulting site. The rules cannot be satisfied here, so the answer is no.
Conversation context stays client-supplied and capped, as now.

### Authenticated users — legitimate, if scoped and inspectable

**The topology changed under this section.** It was written assuming the apps
would mount on the website's database as tenant-scoped tables; that plan was
reversed the same day in favour of a Supabase project per app
(`docs/per-app-supabase.md`). The rules below survive the reversal — only where
the table lives changes — and one of them gets easier.

Two places memory could live, and they are now different systems:

- **The website's own assistant** (`app/api/chat/route.ts`) serves anonymous
  visitors. See above: no durable memory.
- **Each app's own project** has its own auth and its own database, so a
  memory table belongs to the app that writes it and never sits beside another
  app's. Identity is the app's `auth.users` row, optionally linked to a client
  through `app_users.client_id` — and that link is nullable on purpose, so
  memory code must not assume a client exists behind a user.

Sketch, to live in the owning app's project:

```sql
create table app_memory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('preference','project_fact')),
  source       text not null check (source in ('stated','inferred')),
  text         text not null,
  origin       jsonb,          -- session + message that produced it
  created_at   timestamptz not null default now(),
  revalidate_at timestamptz,   -- project facts expire; preferences may not
  deleted_at   timestamptz
);
```

Rules specific to this store:

- **Scope every read by actor**, and let the database do it. Under the per-app
  split the browser talks to its own Supabase with the anon key and **RLS is the
  isolation boundary** — `using (user_id = (select auth.uid()))`, the pattern
  `0003_ghost.sql` already uses, with `with check` as well as `using`. This is
  strictly better than the mount plan, where isolation depended on remembering
  to write `.eq("client_id", …)` on every query and the database would not catch
  a miss.
- **Two types only, and no episodic store.** Preferences and project facts.
  Transcripts of past conversations are not memory, they are logs, and they do
  not belong in retrieval.
- **Write on explicit signal**, not on every exchange, and never on the model's
  unprompted suggestion that something seemed important.
- **Never write scoring or inference output as memory.** `scoreLead`
  (`lib/leads.ts`) produces a judgment about a person; persisting it as a
  remembered fact turns a heuristic into a belief the assistant acts on.
- **Never write the sensitive categories**, including anything about a client's
  own customers' health or finances that surfaces in conversation.
- **Delete means delete** — including from any embedding or derived index, which
  is why `deleted_at` is a soft-delete for audit only and a hard purge job must
  follow it.
- **Memory is not entitlement.** Remembering that a client had a subscription is
  not a subscription check.
- **Keep it out of analytics** (`lib/analytics.ts`) and out of audit exports.
- **Show the writes.** A visible "remembered: …" line at the moment of writing
  beats a settings page nobody opens, plus a page listing every stored memory
  with a delete button per row — the same affordance §A now gives the profile.
- **The ability profile is not this store and must not be copied into it.** It
  lives in `rsg-onehand` alone and is read live through a grant-checked edge
  function, per `docs/per-app-supabase.md` §2 — deliberately not mirrored, so
  revocation takes effect immediately and there is one place to honour a
  deletion request rather than five. An app that caches it has turned a
  revocable grant into a copy.

**Retrieval:** by relevance to the current message, not the whole set; nothing
at all for a generic question; never narrated ("according to my memory of you…"
is worse than useless); and prefer under-application — a missed personalization
is a small loss, an intrusive one costs trust.

---

## Status

| # | Item | State |
|---|---|---|
| A1 | Delete control for the ability profile, with undo | done |
| A2 | Deletion survives ordinary use (no resurrect on dock repaint) | done |
| A3 | Booting no longer writes a profile — "never declared" is a real state | done |
| A4 | Disclosure of what leaves the browser; verified nothing extra does | done |
| A5 | `updated` stamp, re-check nudge, prior-layout restore | done |
| B1 | Agent memory: build state split out of a project fact | done |
| B2 | Agent memory: recovery hints and access assertion removed | done |
| B3 | Agent memory: dangling link resolved | done |
| B4 | Agent memory frontmatter: `source` / `revalidate_by` / `sensitivity` | done |
| C1 | NEXUS model-authored memories clamped, tagged, labelled | done |
| E | GHOST's undefined `memories` slot deleted (client, db map, migration) | done |
| F | Assistant memory for signed-in users | **not built — design only** |

F is deliberately open. The rule that matters until then is the negative one:
do not add memory to the anonymous visitor path.

## How this is held

Assertions, not intentions — all in the portfolio runner
(`/shared/test-runner.html`, 192/192 green with four apps booting clean):

- `shared/profile-custody-test.html` — 28 cases. Boots the real shell in an
  iframe and drives its real controls; nothing is re-implemented. Covers
  write-on-declaration, deletion surviving repaint, undo, the prior-layout
  round trip, the staleness thresholds per `permanence`, and a grep of Forge's
  four prompt builders proving `reachMM` is the only ability field that can
  reach a model. Snapshots and restores the live keys rather than clearing
  storage — a test that wiped localStorage here would delete the profile it
  exists to protect.
- `NEXUS/memory-test.html` — 15 cases. Provenance on the way in, the prune no
  longer favouring the model, and gossip reluctance with `NX.R.chance` stubbed
  so the outcome is the filter's decision rather than luck. Verified to fail
  against the pre-fix behaviour.

Two things remain checked by eye, and should be re-checked whenever the routes
they name are touched: that `app/api/chat/route.ts` still persists nothing
per-visitor beyond a submitted lead, and that `memory/` holds no credential or
recovery hints.

See [`CONTRACTS.md`](../../CONTRACTS.md) for the ability-profile contract and its
custody rules, [`docs/per-app-supabase.md`](../per-app-supabase.md) for the
project-per-app topology §F assumes, and
[`docs/plans/onehand-profile-and-one-key.md`](onehand-profile-and-one-key.md)
for where `rsg.ability.v1` came from.
