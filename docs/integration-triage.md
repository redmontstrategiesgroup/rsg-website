# Integration triage runbook

What to do when an integration is broken, intermittently failing, or a client
says "it stopped working". Written to be read during an incident, not before.

Related: [`lib/integration-log.ts`](../lib/integration-log.ts) (instrumentation),
[`app/api/health/integrations`](../app/api/health/integrations/route.ts) (health),
`supabase/migrations/20260727140000_integration_observability.sql` (schema).

> **Live as of 2026-07-28.** The schema is applied to `dyajmgddsiqcnlehqbhl` and
> verified end to end: a cron heartbeat wrote to `integration_runs` under its
> correlation id, `integration_connections` transitioned `unknown → healthy`
> with `last_success_at` set, and `/api/health/integrations` returned 200 with
> real per-connection data. All 14 `error_class` / `outcome` values were probed
> against the live CHECK constraints and accepted, so failure rows record
> rather than being silently rejected.
>
> The `APPLY-*.sql` files in `supabase/` are retained as the record of what was
> applied — they are idempotent and safe to re-run.

---

## The question every triage answers first

**Is this the provider, this one connection, or our code?** The three have
completely different responses, and most wasted triage time is spent debugging
code during a provider outage — or debugging a provider during our own
regression.

| Signal | Reading |
|---|---|
| All connections to one provider failing | provider outage or a breaking change on their side |
| One connection failing, others fine | credential, permission, or data problem for that client |
| All providers failing at once | our code, our network, or our deploy |
| Started at a deploy boundary | our code — check Vercel deployments first, always |
| Started at a round hour | a provider quota window or a scheduled change |
| Intermittent, load-correlated | rate limits, pool exhaustion, or timeouts |

Establish which one it is **before** touching anything.

---

## Step 1 — Look at health (10 seconds)

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://redmontstrategiesgroup.com/api/health/integrations | jq '.alerts'
```

Returns 503 when anything critical is firing, so an uptime monitor can page on
it without parsing the body. The `alerts` array is the whole story:

| `kind` | Means | Response |
|---|---|---|
| `needs_reauth` | Credential expired or revoked | Rotate the key. Nothing retries out of this. |
| `down` | 3+ consecutive failures on one connection | Check provider status, then the credential |
| `stale` | Expected cadence missed | Usually the cron — see below |
| `dead_lettered` | Operations permanently given up on | **Manual reconciliation needed.** Read them. |

If `internal/cron.scheduling` is stale, stop here and fix that first — the
5-minute cron drains the email queue, sends reminders, retries webhooks, and
runs lifecycle jobs. When it stops, all of those stop silently and every other
symptom you are looking at is downstream of it.

## Step 2 — Establish onset

**Onset is the single most useful fact.** Line it up against the Vercel deploy
log and the provider's status page and the cause is usually obvious in a minute.

```bash
node scripts/export-integration-runs.mjs --hours 48 > runs.ndjson
python3 failure_triage.py runs.ndjson --bucket-minutes 5
```

That clusters failures by normalized error message, breaks them down per
provider and per tenant, and estimates onset from the failure-rate curve. Narrow
with `--provider stripe --failures-only` once you know where to look.

## Step 3 — Check the boring causes

Each is a two-minute check, and one of them is almost always the answer:

- Expired or rotated credential (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`,
  `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- An env var dropped or renamed in a Vercel deploy
- Quota exhausted — Resend monthly sends, Anthropic spend cap
- A provider deprecation that finally shipped
- `CRON_SECRET` rotated in one place but not the other

## Step 4 — Read the requests, not the summary

```sql
-- Everything that happened under one operation, retries included.
select ts, provider, operation, attempt, outcome, error_class,
       error_message, provider_request_id, duration_ms
from integration_runs
where correlation_id = 'evt_1abc...'   -- Stripe event id, or x-correlation-id
order by ts;
```

The correlation id comes from the `x-correlation-id` response header on any
request. For Stripe, the event id **is** the correlation id — every delivery
attempt of the same event, ours and theirs, groups under it.

---

## Per-symptom

### "The sync isn't working" / "I didn't get the email"

```sql
select ts, operation, outcome, error_class, error_message, attempt
from integration_runs
where provider = 'resend' and ts > now() - interval '24 hours'
order by ts desc limit 50;
```

Then check whether it is queued rather than lost — most email failures fall
through to the durable queue rather than disappearing:

```sql
select id, kind, status, attempts, last_error, next_attempt_at
from email_jobs where status <> 'sent' order by updated_at desc limit 20;
```

`status = 'failed'` means it gave up. Validation-class failures are **not**
retried — a malformed address fails identically every time, so it dead-letters
on the first attempt rather than burning four more.

### "Is it just this customer?"

```sql
select provider, outcome, error_class, count(*)
from integration_runs
where tenant_id = '<client-uuid>' and ts > now() - interval '24 hours'
group by 1, 2, 3 order by 4 desc;
```

Compare against the same query without the tenant filter. One tenant failing
while others succeed is a credential, permission, or data problem specific to
them — not an outage.

### "Is the provider down?"

Per-provider, per-connection — never an aggregate rate, which is exactly what
hides one connection failing 100%:

```sql
select provider, connection_id, error_class,
       count(*) filter (where outcome = 'failed') as failed,
       count(*) as total
from integration_runs
where ts > now() - interval '2 hours'
group by 1, 2, 3 order by failed desc;
```

Status pages: [Stripe](https://status.stripe.com),
[Resend](https://resend.com/status), [Anthropic](https://status.anthropic.com),
[Supabase](https://status.supabase.com), [Vercel](https://www.vercel-status.com).

### Stripe webhook stopped arriving

`last_success_at` on `stripe/webhook` stops moving and nothing else complains —
we cannot detect an event that was never sent, only the absence of events.

1. Stripe Dashboard → Developers → Webhooks → check the endpoint is enabled and
   the URL is right
2. Check for delivery failures on Stripe's side (they retry for 3 days)
3. Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret — a
   mismatch returns 400 on every delivery, which Stripe shows and we log

### Dead-lettered Stripe events

```sql
select ts, correlation_id, operation, error_message
from integration_runs
where provider = 'stripe' and outcome = 'dead_lettered'
order by ts desc;
```

These need manual reconciliation. The webhook claims each event id **before**
processing, so an event that failed mid-processing is permanently dropped —
Stripe's retry is treated as a duplicate and skipped. The `correlation_id` is
the Stripe event id: look it up in the Stripe Dashboard and apply its effect by
hand.

---

## Before contacting a provider

Have all of this ready. Without the request id, the first reply is a request for
more information and you lose a day.

- **`provider_request_id`** from `integration_runs` — the first thing they ask for
- Timestamps **in UTC** with the window (onset → now)
- The account/customer id on our side
- The exact operation and endpoint
- Our error classification and the raw status code
- Whether it affects all connections or one
- What we already ruled out

```sql
select ts, operation, status_code, error_class, error_message, provider_request_id
from integration_runs
where provider = 'stripe' and outcome in ('failed','dead_lettered')
  and ts > now() - interval '6 hours'
order by ts desc limit 20;
```

---

## Guardrails

- **Never conclude from an aggregate error rate.** One connection failing 100%
  hides inside a healthy average and never alerts.
- **Never show a provider's raw error to a user.** Use
  `IntegrationError.userMessage`; the original is logged.
- **Never triage without establishing onset first.**
- **Never let a client be the monitoring.** If they told us before the health
  endpoint did, that gap is the finding — fix it in the same incident and add
  the missing check.
- **Never log a credential.** `lib/integration-log.ts` redacts structurally, at
  the logger. Do not build a log line that bypasses it. A credential in a log is
  a credential that must be rotated, and the log aggregator outlives the
  incident.

---

## After: write down what it was

Add a dated entry below. The same integration fails the same way again, usually
to someone who wasn't here the first time.

| Date | Provider | Symptom | Root cause | Fix | Detected by |
|---|---|---|---|---|---|
| 2026-07-28 | Resend | Lead-notification emails that failed their first send were never retried and never reported | `email_jobs` was defined in `20260715180000_enterprise_hardening.sql` but never applied to the live database. `lib/leads.ts` falls back to that queue on send failure, and `enqueueEmailJob` catches the "relation does not exist" error and returns `false` — so the lead's email was dropped with a single `console.warn` | `APPLY-integration-observability.sql` creates the table; the enqueue path is now also recorded against the Resend connection | Probing the live schema while wiring instrumentation — nothing alerted, and nothing would have |
