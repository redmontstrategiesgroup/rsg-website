# Portfolio declutter — website work, Observatory retirement, and a demo audit

**Date:** 2026-08-11 · **Branch:** `cleanup/declutter-pass` · **Status:** design, approved in
conversation, not yet planned or executed.

Every factual claim below was verified against the working tree on 2026-08-11 by reading
the files or running the command named. Where something is an assumption rather than a
reading, it says so.

---

## 1. The decisions this design encodes

Four questions were open when this started. Three are now answered, and the answers are
what make the rest of the document short.

| Question | Answer | Consequence |
|---|---|---|
| Do the five apps move into the website portal? | **No. Apps stay out of the website.** | The live Observatory portal mount must be retired (§4). |
| Are five per-app Supabase projects being created? | **No — not ready to host them.** | `docs/per-app-supabase.md` is retired as a plan, kept as history (§5). |
| What may this work touch? | **`Website/` and repo root. Not the five app folders.** | The demo audit ships as findings, not edits (§6). |
| Who pays for demo AI tokens? | **Moot.** Apps stay out; the website's `lib/ai/proxy.ts` already keeps its own key server-side. | The `localStorage` key issue stays a documented demo limitation, unchanged. |

**Off-limits directories, absolutely:** `GHOST/`, `NEXUS/`, `Observatory/`, `The forge/`,
`Onehand OS/`. No file in any of them is edited by this work. `Website/public/apps/observatory/`
is a *fork* living inside the website and is in scope; the standalone `Observatory/` is not.

---

## 2. Why this is one design and not four

The four threads look independent but share one spine: **the repo currently asserts two
incompatible architectures at the same time**, and almost every piece of clutter is a
sediment layer from one of them.

`docs/per-app-supabase.md` §6 and `boundaries.json` both say so in writing. The latter's
`allow` entry ends: *"Resolve that contradiction before building anything further on
either path."* The per-app Supabase scaffolding, the `registry-sync` webhook machinery,
and the Observatory portal fork are three answers to the same question, all live at once.

Deciding "apps stay out, no new projects" collapses that, and most of the work below is
consequence rather than invention.

---

## 3. Track 1 — the website (`Website/`)

### 3.1 The blocker: 311 uncommitted files

`Website/` has an uncommitted working diff of **311 files, +2,882 / −4,932 (net −2,050
lines)** — 107 under `components/`, 90 under `lib/`, 77 under `app/`.

It is **verified green**: `npx tsc --noEmit` exits 0, and `npm test` reports
**161 tests / 44 suites / 0 fail** (2026-08-11).

It is also a *mixed* diff. A cosmetic em-dash-to-punctuation sweep runs through nearly
every file, and real behaviour changes are interleaved with it:

- `CONTACT_TO_EMAIL` gained comma-separated multi-recipient support **and now replaces the
  defaults rather than adding to them** — a semantic change, sitting inside a punctuation
  pass in `.env.example`.
- Managed services and the ROI calculator were removed from marketing.
- `tests/retail-demo.test.ts` (−121) deleted, `tests/lead-pipeline.test.ts` (+163) added.
- `public/apps/observatory/**` was touched — the fork, which §4 is about to delete.

**Nothing else in this design starts until this lands.** Building on an unreviewable
311-file blob means any later bisect has to cross it.

**Approach:** split by path into separate commits — behaviour and feature removals first
(`components/admin/ManagedServices*`, `components/portal/PlanServices.tsx`, `tests/`,
`.env.example`, `next.config.mjs`, `middleware.ts`), then the cosmetic sweep as one
clearly-labelled commit.

**Stated honestly:** some files carry both kinds of change and **cannot** be cleanly split
by path. Those go with the behaviour commit, and the commit message says which files are
impure rather than implying a perfect split. A per-hunk split of 311 files is not worth
its cost here; the value is isolating the ~10 files where semantics changed, and that is
achievable.

### 3.2 Finish the managed-services removal

Marketing is gone; the machinery is not. Still present:

- `components/admin/ManagedServicesAdminPanel.tsx`
- `components/portal/PlanServices.tsx`
- a reference in `components/admin/AdminConsole.tsx`
- API routes `app/api/admin/managedservices/` and `app/api/portal/managedservices/`

Right now the repo says both "we sell this" and "we don't." **This needs a business answer
before code moves** (§7, open decision D1). If managed services is retired, all five go and
the portal/admin navigation entries with them. If it is retained, marketing gets it back.
Either is fine; the current half-state is not.

### 3.3 Portal surface — findings only

`app/portal/` carries ten sections: `billing`, `invite`, `observatory`, `project`,
`reports`, `roadmap`, `support`, `team`, `training`, `workspace`.

`observatory` is removed by §4. Of the rest, **`team`, `training`, `roadmap`, and
`workspace`** are the ones worth questioning for a solo consultancy — `team` in particular
implies multi-seat client orgs.

**This track produces findings, not deletions.** Only the operator knows which sections
clients actually open, and deleting a portal section a client uses is not recoverable by
`git revert` once their data is gone. Recommendations land in the audit (§6); any removal
is a separate, explicitly approved change.

### 3.4 Documentation truth-up

Three concrete corrections, all verified:

1. **`CLAUDE.md` is wrong about URLs.** It instructs: *"Keep hyphenated marketing URLs in
   routes (`/business-consulting-plymouth-county-ma`, not concatenated slugs)."* The code
   is the opposite — routes are `/businessconsulting`, `/aiautomation`, `/crmsystems`,
   `/servicearea` — and `next.config.mjs` **does** carry hyphenated→concatenated redirects
   (confirmed: `business-consulting-plymouth-county-ma`, `ai-automation`, `service-area`
   all appear there). Per CLAUDE.md's own opening rule — *"If a claim below disagrees with
   the code, the code is right and this file is a bug"* — the line is the bug. **Fix the
   doc; do not re-migrate the URLs.**

   That line most likely describes `rsg-website-main/` (§5.2), which still has the
   hyphenated route directories. That is probably the whole origin of the confusion.

2. **Test counts are stale.** `CLAUDE.md` says 157 tests / 45 suites. Actual: **161 / 44**,
   consistent with the `retail-demo` → `lead-pipeline` swap in §3.1.

3. **`basic website/` paths are dead.** `docs/per-app-supabase.md` alone uses that path
   roughly a dozen times; the directory is `Website/`. This matters because §5 of that doc
   is a runbook someone could follow.

**Explicitly not in scope:** re-hyphenating the marketing slugs.
`demo-to-production-inventory.md:135` argues concatenated slugs are an SEO regression
(`medspabusinessconsultingaiautomation` cannot be tokenized), and that argument has merit.
But the migration is *finished* and the 301s are in place. Reversing it is a third URL
migration and a deliberate SEO decision, not a cleanup side effect. It is recorded in the
audit as a recommendation for a separate decision.

---

## 4. Track 2 — retire the Observatory portal mount

Gated separately from Track 1 because it is the only piece that touches **live production
data**.

### 4.1 What exists

| Piece | Path |
|---|---|
| Portal page | `Website/app/portal/observatory/page.tsx` (+ `ObservatoryFrame.tsx`) |
| Tenant-scoped API | `Website/app/api/portal/observatory/{scenarios,reports,copilot}/route.ts` |
| The forked app | `Website/public/apps/observatory/` (+ `server-adapter.js`) |
| Mount helpers | `Website/lib/apps/context.ts`, `Website/lib/apps/ai.ts` |
| Live tables | `obs_scenarios`, `obs_reports` in Supabase `dyajmgddsiqcnlehqbhl` |

### 4.2 The cut is clean

Verified by grep: `lib/apps/context.ts` has **exactly four consumers**, and all four are
the Observatory portal files listed above. `lib/apps/ai.ts` has **exactly one** — the
`observatory/copilot` route. So removing the mount orphans both, and **the entire
`lib/apps/` directory is deleted**, not just `context.ts`. No stragglers.

**`lib/ai/proxy.ts` survives.** Its consumers are `app/api/chat/route.ts` (the marketing
chat widget), `lib/ai/usage.ts`, `lib/apps/ai.ts`, and two test files. Only the
`lib/apps/ai.ts` and `observatory/copilot` consumers disappear; `/api/chat` keeps it alive.
The marketing chat widget is unaffected.

Exact file list for removal: `app/portal/observatory/{page.tsx,ObservatoryFrame.tsx}`,
`app/api/portal/observatory/{scenarios,reports,copilot}/route.ts`, `public/apps/observatory/`,
`lib/apps/`.

### 4.3 Live data: export first, decide after

`obs_scenarios` and `obs_reports` hold real rows in the production project.

**Sequence, in this order, no exceptions:**

1. **Confirm the project ref** against `list_projects` and against `Website/.env.local`
   before any query. This is a standing rule in `CLAUDE.md` for a reason: multiple
   projects on this account have held a real `clients` table, so *a query succeeding
   proves nothing about which database you are on*, and a migration has been applied to
   the wrong project before.
2. **Export both tables to files** committed under `Website/supabase/`. This is the
   prerequisite for every downstream option, deletes nothing, and is done regardless of
   what is decided later.
3. **Remove the application code** — portal page, three API routes, the `public/apps/`
   fork, `lib/apps/context.ts`.
4. **Drop the tables — separately, and only on explicit approval** (§7, D2). Code removal
   and schema destruction do not belong in one commit.

Steps 1–3 are safe and reversible. Step 4 is neither, and is deliberately not bundled.

### 4.4 Consequence for `boundaries.json`

The `allow` entry at `boundaries.json:50-59` exists solely to sanction the
`Website/public/apps/observatory` fork, documenting an accepted drift risk that had already
materialized once (the `OBS.store.save()` data-loss fix had to be hand-copied). When the
fork is deleted, the entry is deleted with it and the accepted risk disappears rather than
being carried forward.

`scripts/check_boundaries.py` must still pass afterward.

---

## 5. Track 3 — repo-root prune

### 5.1 The local-services stack (remove)

`scripts/install-n8n-and-nodered.ps1`, `scripts/start-local-services.ps1`, and
`scripts/n8n-lead-webhook.json` install and launch n8n, Node-RED, Ollama, and Redis.

**Verified: no application code consumes any of them.** A case-insensitive grep for
`n8n|node-red|ollama|redis` across the repo hits only `.env.example`,
`ENVIRONMENT_SETUP_CHECKLIST.md`, `docs/mcp-servers-removed.md`, `.mcp.json`, the three
scripts themselves, the dead `rsg-website-main/` copy, and two false positives
(the word "redistribute" in `Observatory/js/models.js` and `The forge/vendor/three.module.js`).

The n8n workflow is the clearest evidence: **webhook → merge-by-email → noOp**. It receives
a lead and does nothing with it. The website already has a real booking funnel with Resend
notification and Stripe behind it, tested by `tests/lead-pipeline.test.ts`.

This is the clearest instance of "extra added that doesn't correlate with the business
type": a self-hosted workflow-automation and local-LLM stack, with no consumer, in a repo
whose products are a Next.js consultancy site and five browser demos.

**Remove:** the three scripts, their `.env.example` entries, their
`ENVIRONMENT_SETUP_CHECKLIST.md` sections, and the `redis` MCP server from `.mcp.json`.

### 5.2 `rsg-website-main/` — do NOT delete

**Safety finding.** This directory is **749 MB** and is a full second checkout:

- its own `.git`, pointing at a **personal** remote (`josephpoday/rsg-website-main`) rather
  than the org repo (`redmontstrategiesgroup/rsg-website`);
- exactly **one commit**, `e915844` "Initial import: rsg-website-main";
- a **dirty working tree**, including a *deleted* `business-consulting-plymouth-county-ma/page.tsx`;
- the **old hyphenated** route directories.

It holds uncommitted modifications that exist nowhere else. Project memory calls it a dead
end, and it almost certainly is — but "dead end" and "safe to delete" are different claims,
and only the first is established.

**Action: add to `.gitignore` so it stops appearing as untracked. Leave it on disk.**
Deleting 749 MB with uncommitted changes is a separate, explicitly-approved decision
(§7, D3), never a cleanup side effect.

### 5.3 MCP server surface

`.mcp.json` declares eleven servers: `supabase`, `github`, `filesystem`, `memory`,
`sequential-thinking`, `context7`, `brave-search`, `redis`, `slack`, `playwright`,
`puppeteer`.

`redis` goes with §5.1. **`playwright` and `puppeteer` are redundant** — two browser
automation servers for the same job. Recommend keeping `playwright` and dropping
`puppeteer`. The rest are judgment calls recorded in the audit rather than acted on;
several are agent tooling rather than project dependencies, which is legitimate.

### 5.4 Retire the per-app Supabase plan

`docs/per-app-supabase.md` describes six Supabase projects, a registry-sync push with HMAC
signing and nightly reconcile, per-app `ai` edge functions, and a create-project runbook.
None of it was built. The hosting decision retires it.

**Keep the document. Do not delete it.** It is genuinely good design work and the reasoning
(RLS-as-isolation-boundary, credential blast radius, why the mount pattern was rejected)
stays valuable if the decision is ever revisited.

**Add a status banner at the top** stating: retired 2026-08-11, no projects created, apps
remain localStorage-only demos, and the trigger that would justify reopening it. Fix the
`basic website/` paths so the runbook is not silently wrong. Resolve §6's open question in
favour of "the mount is retired and the apps stay standalone."

`docs/plans/backend-dependency-plan.md` needs the same banner: it references the per-app
topology in six places (verified by grep), so it is stale in the same way and for the same
reason.

**Not in scope:** removing the `*/supabase/` scaffolding inside the four app directories.
Those are off-limits (§1). The scaffolding stays; the *documentation* stops calling it
imminent. This is a known, deliberate inconsistency, and it is recorded in the audit so it
is not mistaken for an oversight.

---

## 6. Track 4 — demo system audit (findings only)

**Deliverable:** `docs/demo-system-audit-2026-08-11.md`. **Changes no application code.**

Scope: the five apps, read-only, assessed on whether they are *honest* and *realistic* —
not whether they are production-ready, which
`demo-to-production-inventory.md` already answers at length (the answer is no, deliberately,
and that is fine for capability demos).

The audit covers:

1. **Overclaiming** — anywhere the UI implies capability the code does not have. The known
   examples to re-verify: GHOST's approval gates resolving on any click with actor
   hardcoded to `"operator"`; Observatory's `viewer/analyst/admin` roles being a free
   `<select>`; the per-app `ai` edge function accepting a `stream` flag it ignores.
2. **Seed-data realism** — whether each app's seeded world reads as a plausible demo or as
   one person's personal data. GHOST seeds an entire RSG world including fleet, clients,
   leads, and audit history.
3. **Business-type fit** — what a Plymouth County business-consulting practice gains from
   each demo, and which are portfolio pieces rather than sales tools. NEXUS (a city-builder
   game) is the obvious question mark.
4. **Cross-references that no longer hold** — `docs/plans/` still uses pre-un-nest paths
   like `GHOST/nexus/`; `CLAUDE.md` itself flags this.
5. **Recommendations, ranked by effort against sales value**, each labelled as a
   suggestion. Acting on any of them means editing app folders, which is out of scope here
   and would be its own approved piece of work.

The audit also carries the two items this design deliberately declined to act on: the URL
re-hyphenation question (§3.4) and the portal-surface question (§3.3).

---

## 7. Open decisions

These block specific steps. Everything else proceeds without them.

- **D1 — Is managed services a service line you still sell?** Blocks §3.2. Marketing says
  no, admin and portal say yes.
- **D2 — Drop `obs_scenarios` / `obs_reports` after export?** Blocks only step 4 of §4.3.
  Steps 1–3 proceed regardless.
- **D3 — What happens to `rsg-website-main/` (749 MB, uncommitted work)?** Blocks nothing;
  gitignoring it is sufficient for this work.

---

## 8. Verification

Nothing in this design is claimed complete without the corresponding command run and its
output read.

**Website** (from `Website/`), all three must pass, and the baseline to beat is today's:
`tsc --noEmit` clean, `161/161` tests, build succeeding.

```bash
npm run typecheck
npm test
npm run build
```

**Portfolio boundaries** (from repo root):

```bash
python scripts/check_boundaries.py
```

Must pass after the `boundaries.json` `allow` entry is removed in §4.4.

**The five apps:** `python serve.py`, then `/shared/test-runner.html`. The baseline is
4 apps booted clean, 188/188 assertions across 8 suites. **This work should not change that
number at all** — if it does, something touched an app folder and the scope was violated.
It is a scope tripwire, not a feature test.

**Live database:** every step of §4.3 confirms the project ref against `list_projects`
before it runs.

---

## 9. Sequencing

1. §3.1 — split and land the 311-file diff. **Blocks everything else in `Website/`.**
2. §5.1, §5.3 — repo-root prune. Independent, can run in parallel with 1.
3. §5.2 — gitignore `rsg-website-main/`. Trivial, independent.
4. §5.4 — retire the per-app Supabase plan in docs. Independent.
5. §3.4 — documentation truth-up. After 1 and 4.
6. §3.2 — managed services. **Needs D1.**
7. §4.3 steps 1–3 — export data, remove Observatory mount code. After 1.
8. §4.4 — remove the `boundaries.json` allow entry, re-run the checker. After 7.
9. §6 — the demo audit. Fully independent; can be written at any point.
10. §4.3 step 4 — drop the tables. **Needs D2.** Last, and separate.

---

## 10. Risks

- **The 311-file diff hides a real regression.** Tests and typecheck pass, but 161 tests
  over a 61-route app is not exhaustive coverage. Mitigation: `npm run build` as well, and
  isolate the ~10 semantically-changed files into their own commit so a revert is targeted.
- **`CONTACT_TO_EMAIL` now replaces defaults instead of adding to them.** If production env
  sets it to a single address, lead notifications silently stop reaching the second
  recipient. **Check the deployed Vercel env var before this ships.** Called out separately
  because it is the one change in the diff that can quietly lose business email.
- **Observatory portal users lose access the moment §4.3 step 3 lands.** If any client has
  the portal page bookmarked, they get a 404. Whether any client actually uses it is
  unknown and should be checked before removal, not after.
- **Scope violation into app folders.** The 188/188 assertion count in §8 is the tripwire.
