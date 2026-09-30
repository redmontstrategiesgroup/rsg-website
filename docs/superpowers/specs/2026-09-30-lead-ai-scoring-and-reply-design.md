# Lead AI: Claude scoring adjustment + drafted first reply

**Date:** 2026-09-30
**Status:** Design approved in conversation; awaiting written-spec review
**Codebase:** `Website/` (Next.js, Supabase `dyajmgddsiqcnlehqbhl`)

## Goal

Every new lead gets (1) a Claude-judged adjustment to its existing rule score, with a
readable rationale, and (2) a ready-to-send first reply that Joseph reviews, edits,
and sends with one click from the admin console. Nothing is ever sent without a human.
Claude work must never slow down or break lead capture.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Where the draft lives / who sends | Admin console, on the lead; one-click send via Resend. No auto-send. |
| Relation to rule score | Keep `scoreLead` rules; Claude adjusts within ±20. Both visible. |
| Execution model | `after()` at intake + on-demand Generate/Regenerate route. No job queue. |
| Model | Sonnet 5 (`claude-sonnet-5`), one call returns score + draft together. |
| Build order | Foundation → drafted reply + send (Section 2 first) → score blending. |

## Existing context

- `lib/lead-score.ts` — pure rule scorer (0–100), called by every intake path
  (`app/actions/contact.ts`, `app/actions/connect-lead.ts`, `app/api/chat/route.ts`,
  `app/api/assessment/route.ts`, `app/api/demorequest/route.ts`).
- `lib/leads.ts` — `processLead()` stores to `leads`, dispatches n8n, emails the owner;
  buckets: hot ≥ 70, warm ≥ 45, else cold.
- `lib/integration-log.ts` — `callProvider()` wraps provider calls (logging, redaction).
- `lib/ai/usage.ts` — model pricing + usage recording.
- `app/api/admin/leads/[id]/route.ts` — admin PATCH pattern (`requireAdmin("manage_leads")`,
  `rateLimitAdminMutator`, `writeAuditEvent`).
- `app/api/pocket/webhook/route.ts` — existing `after()` usage.

## 1. Data model

### New table `public.lead_ai_insights` (one row per run; history kept)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `lead_id` | uuid not null → `leads(id)` on delete cascade | indexed with `created_at desc` |
| `created_at` | timestamptz default now() | |
| `model` | text not null | e.g. `claude-sonnet-5` |
| `prompt_version` | text not null | e.g. `lead-ai-v1` |
| `status` | text not null check in (`ok`,`failed`) | |
| `error` | text | failure reason, redacted |
| `ai_fit_score` | int check 0–100 | null when failed |
| `adjustment` | int check −20…20 | null when failed |
| `rationale` | text | 2–3 sentences |
| `signals` | jsonb | `{ positive: string[], negative: string[] }` |
| `red_flags` | text[] | subset of `spam`,`vendor_pitch`,`job_seeker`,`student`,`out_of_scope` |
| `draft_subject` | text | null when no draft |
| `draft_body` | text | plain text, null when no draft |
| `sent_at` | timestamptz | set once; idempotency guard |
| `sent_by` | text | admin id |
| `sent_body` | text | exactly what went out (post-edit), plus `sent_subject` |
| `sent_subject` | text | |
| `input_tokens`, `output_tokens` | int | |

RLS enabled, no policies (service-role only), matching other admin tables.

### New columns on `public.leads`

- `rule_score int` — the `scoreLead` number, written at intake.
- `ai_score int` — `ai_fit_score` of the latest ok run.
- `ai_insight_id uuid` → `lead_ai_insights(id)` on delete set null — latest run.

`lead_score` stays the column of record (sorting, buckets, existing UI). It changes only
in Phase 3 (below). Existing rows: backfill `rule_score = lead_score`.

## 2. Analysis pipeline — `lib/lead-ai/`

- `schema.ts` — zod schema for model output + the JSON schema passed as structured output:
  `{ ai_fit_score, adjustment, rationale, signals, red_flags, draft: { subject, body } | null }`.
- `prompt.ts` — pure prompt builder. System prompt holds RSG context, scoring guidance,
  and drafting rules. All lead-supplied fields go inside a `<lead>…</lead>` block,
  explicitly labeled untrusted data. Exports `PROMPT_VERSION`.
- `analyze.ts` — `analyzeLead(leadId, deps)`: orchestration with every I/O injected
  (pure for tests). Production `generate` reuses `generateStructured()` from
  `lib/ai/proxy.ts` (forced-tool JSON, `callProvider` logging, AI kill-switch, prompt
  caching) with `tenantId: "rsg-lead-ai"` (non-uuid tenants are nulled by
  `integration-log`), 30 s timeout, 1 SDK retry. Output is zod-validated. The model may
  return any integer adjustment; code clamps it to ±20.
- `compose.ts` — pure: fills the code-owned parts of the draft (booking URL
  `${siteUrl()}/book`, signature from `LEAD_REPLY_SIGNATURE` env with a default). The
  model is instructed to write `{{BOOKING_LINK}}` and never emit URLs; `compose` replaces
  the token and strips any other URL-looking text the model produced.
- `blend.ts` — pure: `blendScore(rule, adjustment) = clamp(rule + clamp(adj, −20, 20), 0, 100)`
  and `crossedIntoHot(before, after)`.
- `persist.ts` — insert insight row; update `leads.ai_score`, `ai_insight_id`
  (and in Phase 3 `lead_score`).
- `index.ts` — production wiring: `runLeadAnalysis(leadId)` and `sendReply(input)` bind the
  pure functions to Supabase, `generateStructured`, and Resend. Never throws: every
  failure path writes a `status='failed'` row (when the lead exists) and returns
  `{ ok: false }`.
- `schedule.ts` — `scheduleLeadAnalysis(leadId)`: `after()` when inside a request,
  fire-and-forget otherwise; no-op without `ANTHROPIC_API_KEY`.

Skips: no `ANTHROPIC_API_KEY` → no-op; lead status `spam`/`archived` → no-op.

### Intake wiring

`processLead` itself, after a successful non-duplicate database insert, calls
`scheduleLeadAnalysis(leadId)`. This one hook covers all five intake paths (contact,
connect, chat, assessment, demo request) without editing them. Visitor latency is
unchanged. `leadToRow` also writes `rule_score` (the intake score, including any
assessment/demo bonus).

### On-demand route

`POST /api/admin/leads/[id]/analyze` — `requireAdmin("manage_leads")`,
`rateLimitAdminMutator`, audit event `lead.ai_analyze`. Runs `analyzeLead` synchronously
(`maxDuration = 60`) and returns the new insight. Serves Generate, Regenerate, and
old/failed leads.

## 3. Drafting rules (prompt contract)

- Joseph's voice, first person, plain text, ≤ ~150 words, no markdown.
- Must reference something specific the lead wrote (problem, industry, or timeline).
- One call to action, by the bucket of `blendScore(rule_score, adjustment)`. The prompt
  gives the model the rule score and the bucket thresholds; this holds in every phase,
  including Phase 2 where the blend is computed but not yet written to `lead_score`:
  - hot → invite to book (`{{BOOKING_LINK}}`); if preferred contact is Call/Text, offer a call.
  - warm → one or two clarifying questions + booking link.
  - cold / weak fit → helpful, courteous, no hard pitch.
- Never: quote prices, promise results or timelines, invent case studies, or assert facts
  about the business the lead did not state.
- `red_flags` containing `spam` or `vendor_pitch` → `draft: null`; UI shows why.
- Signature is appended by code, not written by the model.

## 4. Send flow

`POST /api/admin/leads/[id]/reply` with `{ insightId, subject, body }` (zod: subject
1–200 chars, body 1–5000 chars).

1. `requireAdmin("manage_leads")`, `rateLimitAdminMutator`.
2. Load insight; must belong to lead `id`; lead must have an email.
3. Claim the send atomically: `update lead_ai_insights set sent_at = now(), sent_by = …
   where id = … and sent_at is null returning id`. No row → **409 Already sent**.
4. Send via Resend: `from` = `LEAD_REPLY_FROM_EMAIL` ?? `CONTACT_FROM_EMAIL`, `to` = lead email,
   `replyTo` = `DEFAULT_OWNER_NOTIFY_EMAIL`, text body (plus a minimal escaped HTML
   version), through `callProvider({ provider: "resend", operation: "email.send.lead_reply" })`.
5. On success: store `sent_subject`, `sent_body`; if lead status is `new`, set `contacted`;
   audit event `lead.reply_sent`.
6. On failure: release the claim (`sent_at = null`, `sent_by = null`), return 502 with the
   error. No retry queue — a manual send fails loudly.

## 5. Admin UI

In the existing lead detail view in `components/admin/AdminConsole.tsx`, a new
**AI** section built from `components/ui` primitives (new component
`components/admin/LeadAiPanel.tsx` to keep AdminConsole from growing):

- **Score strip** — blended score + bucket, `rule 52 · +15 Claude`, rationale,
  positive/negative signal chips, red flags in amber. (Phase 2 shows `ai_fit_score` and
  the proposed adjustment labelled "suggested" until Phase 3 applies it.)
- **Draft** — editable subject input + body textarea; **Send reply** (confirm step
  inline, not `confirm()`), **Copy**, **Regenerate**. After send: read-only
  "Sent <date> by <admin>" showing `sent_subject`/`sent_body`.
- **Empty/failed** — "Not analyzed yet" / "Analysis failed: <reason>" + **Generate**.
- No draft because of red flags — "No reply drafted: looks like <flag>".
- Leads list: a small marker on the score cell when a Claude adjustment is applied.

Lead list/detail data: `store.ts` reads `rule_score`, `ai_score`, `ai_insight_id`; the
panel fetches the latest insight via `GET /api/admin/leads/[id]/analyze` (same auth).

## 6. Score blending (Phase 3)

After an ok run, `persist` sets `lead_score = blendScore(rule_score, adjustment)`.
If `crossedIntoHot(old, new)`, send a short owner email "Lead upgraded to hot: <name>"
through the existing notification path (enqueue-on-failure like `emailOwner`).
Regenerate re-blends from `rule_score`, never from the previous blended value.

## 7. Error handling & cost

- Timeouts, API errors, invalid JSON, or zod failure → `failed` row; nothing partial written.
- `analyzeLead` never throws into intake; `after()` callback is wrapped in try/catch.
- Tokens are stored on each insight row (`ai_usage` is tenant-scoped with a non-null
  `client_id` FK, so it cannot hold internal usage); cost is derivable with
  `estimateCostUsd` from `lib/ai/usage.ts`. Estimate ≈ 1.5k in / 400 out ≈ $0.01/lead.
- Privacy: DSAR erase deletes `leads` rows, which cascades to insights. DSAR export
  (`lib/privacy/erase.ts` `exportDataSubject`) gains an `aiInsights` array.

## 8. Build order

- **Phase 1 — Foundation:** migration, `lib/lead-ai/` (schema, prompt, analyze, compose,
  persist, index), analyze route (POST + GET), intake `after()` wiring, `rule_score` write.
- **Phase 2 — Drafted reply (Section 2 first):** reply route, `LeadAiPanel` with draft
  editor/send/regenerate, score strip showing suggested adjustment (not applied).
- **Phase 3 — Score blending:** apply blend to `lead_score`, hot-upgrade email,
  list marker.

## 9. Testing

Node test runner (existing `tests/` pattern):

- Pure: `blendScore` clamping + `crossedIntoHot`; zod parse of good / malformed / partial
  output; prompt builder fences lead text and contains no URLs; `compose` inserts the
  booking link + signature and strips model-emitted URLs; red-flag → no draft.
- `analyzeLead` with stubbed Anthropic + Supabase: success writes ok row; timeout / bad
  JSON writes failed row and resolves `{ ok: false }`; skip conditions.
- Routes: 401/403 without `manage_leads`; reply 409 on second send; claim released on
  Resend failure; `new → contacted` transition; insight/lead mismatch → 404.
- Migration applied to prod only after tests pass (`dyajmgddsiqcnlehqbhl`).
- Real end-to-end: submit a test lead → insight row appears → send reply to Joseph's
  own address → confirm receipt → delete the test lead.

## Out of scope

Auto-send, follow-up sequences, SMS replies, learning from edits (`sent_body` is kept
so a later iteration can use it), bulk backfill of historical leads (Regenerate covers
individual old leads).

## Environment

- Existing: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`.
- New (optional): `LEAD_AI_MODEL` (default `claude-sonnet-5`), `LEAD_REPLY_SIGNATURE`,
  `LEAD_REPLY_FROM_EMAIL` (a personal sender such as `Joseph <josephoday@…>`; falls back
  to `CONTACT_FROM_EMAIL`).
  Per the site-chat lesson, a Vercel env value overrides the code default — keep both
  in sync if changed.
