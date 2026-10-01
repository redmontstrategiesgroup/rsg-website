# Webhooks

The complete list of every webhook the site receives and every event it sends,
and how to set each one up. The event list in section 3 is checked against
`lib/webhooks/catalog.ts` by `tests/outbound-events.test.ts`, so it cannot
drift from the code.

---

## 1. At a glance

### Incoming: other services call us

| Endpoint | From | What it does | Secret env var | Set up in |
|---|---|---|---|---|
| `POST /api/stripe/webhook` | Stripe | Payments, invoices, subscriptions for project billing and managed services | `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks (events listed in `.env.example`) |
| `POST /api/pocket/webhook` | Pocket recorder | Imports new or updated recordings, transcripts, summaries | `POCKET_WEBHOOK_SECRET` | Pocket app → Integrations → Webhooks |
| `POST /api/resend/webhook` | Resend | Hard bounce, spam complaint or Resend suppression → address suppressed; soft bounces and failures logged | `RESEND_WEBHOOK_SECRET` (`whsec_…`) | Resend → Webhooks: `email.bounced`, `email.complained`, `email.suppressed`, `email.failed`, `email.delivery_delayed` |
| `POST /api/cal/webhook` | Cal.com | New public-page booking → lead (owner notified, Claude analysis); reschedules and cancellations become events | `CAL_WEBHOOK_SECRET` | Cal.com → Settings → Developer → Webhooks: Booking Created, Rescheduled, Cancelled |
| `POST /api/twilio/sms` | Twilio | Incoming text → `sms.received`; STOP/START → `sms.opted_out`; optional auto-reply | `TWILIO_AUTH_TOKEN` | Twilio number → Messaging → "A message comes in" |
| `POST /api/twilio/voice` | Twilio | Incoming call → rings `TWILIO_FORWARD_TO`, else voicemail | `TWILIO_AUTH_TOKEN` | Twilio number → Voice → "A call comes in" |
| `POST /api/twilio/voice/status` | Twilio | Unanswered forwarded call → `call.missed` + voicemail | `TWILIO_AUTH_TOKEN` | Automatic (set by our TwiML) |
| `POST /api/twilio/voice/recording` | Twilio | Voicemail recorded → `voicemail.received` | `TWILIO_AUTH_TOKEN` | Automatic (set by our TwiML) |
| `POST /api/briefs/ingest` | n8n / Zapier / scripts | Pushes a call brief in (bearer secret + `Idempotency-Key`) | `BRIEF_INGESTION_SECRET` | Whatever sends briefs: `Authorization: Bearer <secret>` |
| `GET /api/cron/scheduling`, `/api/cron/registry` | Vercel Cron | Reminders, outbox retries, registry reconcile | `CRON_SECRET` | Automatic once the env var exists (Vercel sends it) |

Every incoming route verifies a signature (or bearer secret) in constant time,
returns 503 when its secret is not set, is rate-limited, and is exempt from
browser CSRF checks in `proxy.ts` by exact path only.

**Twilio URLs must use exactly `NEXT_PUBLIC_SITE_URL` as the host** (same
`www.` or not). Twilio signs the URL it calls; a different host fails every
signature check with 401.

### Outgoing: we call other services

| Destination | What gets sent | Configure with |
|---|---|---|
| Subscriber endpoints (`kind = 'client'`) | Every event in section 3 the endpoint subscribes to, as a signed JSON envelope (section 4) | Admin console → Scheduling → Webhooks (URL + event list; empty list = all events) |
| Slack (`kind = 'slack'`) | The events marked "Slack" in section 3, formatted as Slack messages | `SLACK_WEBHOOK_URL` (an incoming-webhook URL). The site registers it as an endpoint on first use. To change which events post, edit that endpoint's `events` list |
| n8n lead capture | Every new lead, plain JSON to `/webhook/rsg-lead-capture` | `N8N_WEBHOOK_URL` |
| Per-app registry sync (`kind = 'registry'`) | Client name/status changes | `registerAppDestination()` (section 6). Currently unused |

---

## 2. How events are produced

All outgoing events go through one function, `emitEvent(type, data, { eventId })`
in `lib/webhooks/emit.ts`:

1. It queues one row per subscribed endpoint in `webhook_deliveries`
   (subscriber endpoints and Slack endpoints).
2. It starts delivery immediately, after the response is sent.
3. It never throws. An event that cannot be queued is logged and the booking,
   payment or form submission that caused it still succeeds.

`eventId` is the identity of the *domain* event (for example
`lead.created:<leadId>`). The same id queued twice for the same endpoint
collapses into one delivery, and subscribers dedupe on it
(`Idempotency-Key`).

To add an event: add it to `EVENT_CATALOG`, call `emitEvent` where it
happens, then run the test suite. It fails until this file lists the new event.

---

## 3. Event catalog

All payloads arrive as `{ id, type, sequence, created_at, data }`; the columns
below describe `data`. "Slack" marks the events posted to Slack by default.

### Leads

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `lead.created` | A lead was stored from any source (contact form, chat, assessment, demo request, connect, private AI, qualification, Cal.com). | `leadId`, `name`, `email`, `phone`, `company`, `source`, `score`, `status`, `message` | yes |
| `lead.status_changed` | An admin changed a lead's pipeline status. | `leadId`, `name`, `email`, `status` |  |
| `lead.analyzed` | Claude finished scoring a lead and drafting a first reply. | `leadId`, `insightId` |  |
| `lead.hot` | Claude's analysis raised a lead into the hot band. | `leadId`, `name`, `email`, `company`, `scoreBefore`, `scoreAfter`, `rationale` | yes |
| `lead.reply_sent` | The drafted first reply was sent to the lead. | `leadId`, `insightId`, `subject` |  |
| `lead.submitted` | Qualification flow: a visitor submitted the qualifier. | `leadId`, `outcome` |  |
| `lead.qualified` | Qualification flow: the visitor qualified for a booking. | `leadId`, `score` |  |
| `lead.disqualified` | Qualification flow: the visitor did not qualify. | `leadId`, `score` |  |
| `lead.manual_review` | Qualification flow: the answers need a human decision. | `leadId`, `score` |  |
| `lead.qualified_abandoned` | A qualified visitor did not finish booking. | `sessionId`, `leadId` |  |

### Bookings

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `booking.created` | A call was booked through the site's own scheduler. | `bookingId`, `leadId`, `startsAt` | yes |
| `booking.rescheduled` | A site booking moved to a new time. | `bookingId`, `startsAt` | yes |
| `booking.cancelled` | A site booking was cancelled. | `bookingId` | yes |
| `reminder.due` | A booking reminder came due. | `bookingId`, `templateKey` |  |
| `cal.booking_created` | A call was booked on the public Cal.com page (also creates a lead). | `bookingUid`, `leadId`, `name`, `email`, `title`, `startsAt` | yes |
| `cal.booking_rescheduled` | A Cal.com booking moved. | `bookingUid`, `startsAt` |  |
| `cal.booking_cancelled` | A Cal.com booking was cancelled. | `bookingUid`, `startsAt` | yes |

### Sales pipeline

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `assessment.submitted` | A prospect completed the assessment. | `assessmentId`, `leadId`, `serviceCategory` |  |
| `questionnaire.submitted` | A prospect completed the pre-call questionnaire. | `questionnaireId`, `bookingId`, `leadId`, `name`, `businessName` |  |
| `proposal.sent` | A proposal was sent to a prospect. | `proposalId`, `opportunityId`, `title`, `totalCents`, `email`, `name` |  |
| `proposal.approved` | The prospect approved a proposal. | `proposalId`, `opportunityId`, `title`, `totalCents`, `approvedBy` | yes |
| `contract.sent` | A contract was sent for signature. | `contractId`, `opportunityId`, `title`, `version`, `email`, `name` |  |
| `contract.signed` | A contract was fully executed. | `contractId`, `opportunityId`, `title`, `signerEmail`, `signerName` | yes |

### Billing

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `invoice.paid` | An invoice was paid in Stripe: project invoices (deposits, milestones) and managed-services subscription invoices (subscriptionId set). | `invoiceId`, `clientId`, `subscriptionId`, `amountCents`, `currency`, `payerEmail` | yes |
| `payment.failed` | A payment attempt failed in Stripe (project invoice or subscription charge). | `invoiceId`, `clientId`, `subscriptionId`, `amountCents`, `payerEmail`, `reason` | yes |
| `subscription.changed` | A managed-services subscription changed status in Stripe (including scheduled cancellation). | `subscriptionId`, `clientId`, `plan`, `status`, `cancelAtPeriodEnd` |  |
| `subscription.ended` | A managed-services subscription ended. | `subscriptionId`, `clientId`, `plan`, `endedAt` | yes |

### Client delivery

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `milestone.status_changed` | A project milestone changed status. | `milestoneId`, `projectName`, `clientId`, `status`, `previousStatus` |  |
| `ticket.created` | A client opened a support ticket. | `ticketId`, `number`, `clientId`, `subject`, `priority` | yes |
| `ticket.resolved` | A support ticket was resolved. | `ticketId`, `number`, `clientId`, `subject` |  |
| `report.published` | A monthly client report was published. | `reportId`, `clientId`, `period` |  |

### Recordings

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `recording.synced` | A Pocket recording was imported or updated. | `pocketId`, `result` |  |

### Email list

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `subscriber.added` | Someone joined the mailing list. | `email`, `source` |  |
| `subscriber.suppressed` | An address was suppressed: unsubscribe link, hard bounce, spam complaint, or Resend suppression. | `email`, `reason` |  |

### Phone (Twilio)

| event | fires when | `data` fields | Slack |
|---|---|---|---|
| `sms.received` | A text message arrived on the business number. | `messageSid`, `from`, `to`, `body` | yes |
| `sms.opted_out` | A texter replied STOP (or opted back in with START). | `from`, `optOutType` |  |
| `call.received` | A call came in to the business number. | `callSid`, `from`, `to` |  |
| `call.missed` | A forwarded call was not answered. | `callSid`, `from`, `dialStatus` | yes |
| `voicemail.received` | A caller left a voicemail. | `callSid`, `recordingSid`, `from`, `recordingUrl`, `durationSeconds` | yes |


### Payload notes

- Lead, booking, SMS and voicemail events carry personal data (name, email,
  phone, message). Only add endpoints you control, over HTTPS.
- `voicemail.received.recordingUrl` is a Twilio media URL. With "HTTP Basic
  authentication for media" on (recommended), fetching it needs the Twilio
  Account SID and Auth Token.
- `invoice.paid` and `payment.failed` fire from both billing systems: project
  invoices (`invoiceId` is our id) and managed-services subscriptions
  (`invoiceId` is the Stripe id and `subscriptionId` is set).

---

## 4. What a subscriber receives

```http
POST /your/endpoint
Content-Type: application/json
x-rsg-signature: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
x-rsg-timestamp: 1785206654102
x-correlation-id: 4f9a…
X-RSG-Event: booking.created
X-RSG-Sequence: 41
Idempotency-Key: booking.created:2f1c…

{
  "id": "booking.created:2f1c…",
  "type": "booking.created",
  "sequence": 41,
  "created_at": "2026-07-28T03:17:00.000Z",
  "data": { "bookingId": "2f1c…", "leadId": "8ab2…", "startsAt": "…" }
}
```

### Verify the signature

```
expected = HMAC_SHA256(your_secret, "{x-rsg-timestamp}.{raw_request_body}")
```

Hex-encoded, compared to `x-rsg-signature` **in constant time**.

Three rules that are not optional:

- **Sign the raw bytes.** Re-serialising parsed JSON changes key order and
  whitespace, and the signature stops matching.
- **Reject a timestamp more than 5 minutes old.** The timestamp is inside the
  signed material specifically so it cannot be rewritten, a signature with no
  freshness check is valid forever, which is what makes captured requests
  replayable.
- **Compare in constant time.** `==` leaks how many leading characters matched.

Reference implementations: `lib/webhooks/sign.ts` (sender + verifier) and
`shared/supabase/functions/registry-sync/index.ts` (a receiver).

### Dedupe on `Idempotency-Key`

Delivery is **at-least-once**. If our process dies between sending and recording
the result, you get the event again. The key is stable across every retry of the
same domain event, so:

> Record the key before you act on the event. If you have seen it, return 200 and
> do nothing.

Returning 200 for a duplicate is correct; it is not an error, and treating it as
one makes us retry something you already processed.

### Ordering

`X-RSG-Sequence` is monotonic **per endpoint**. Events are attempted in sequence
order, but a failed event backs off while later ones proceed, so arrival order
can still differ from production order. There is deliberately no head-of-line
blocking, one poisoned event must not freeze your entire stream.

Use the sequence to *detect* a gap or a reorder. Do not assume it never happens.

### Your response

| you return | we do |
|---|---|
| `2xx` | mark delivered, done |
| `408`, `429` | retry with backoff (`Retry-After` honoured, capped at 1h) |
| other `4xx` | **give up immediately**: dead-letter it |
| `5xx`, timeout, connection error | retry with backoff |

A `4xx` means the request is wrong; repeating it unchanged cannot succeed. If you
return `400` for a transient problem, you will lose the event.

Retry schedule: exponential with full jitter, up to 8 attempts, capped at one
hour between attempts. Roughly 2s → 4s → 8s → … → 1h, randomised.

---

## 5. Operating the outbox

### When an endpoint has been broken

Deliveries dead-letter after 8 attempts (or immediately on a permanent 4xx).
After fixing the endpoint:

```ts
import { replayDeadLetters } from "@/lib/webhooks/outbox";

await replayDeadLetters({ endpointId: "…", since: new Date("2026-07-01") });
```

Replay resets the attempt counter: it is a deliberate decision made after the
cause was addressed, so it gets a fresh budget rather than one attempt against an
exhausted one.

### Monitoring

`outboxHealth()` returns `{ pending, sending, dead, oldestPendingAgeSeconds }`.

**`oldestPendingAgeSeconds` is the number that matters.** Counts alone look
healthy right up until they do not; a steadily climbing oldest-pending age is
what a stopped cron looks like. Alert on it, not on `pending`.

Dead letters are also reported through `recordDeadLettered()` into the
integration log, so they surface alongside every other provider failure rather
than only in this table.

### When delivery happens

- **Immediately.** `emitEvent()` queues the event and then delivers a batch
  right after the response is sent (`after()`), so n8n and Slack see events in
  seconds.
- **Retries ride the cron.** `/api/cron/scheduling` (daily at 03:00 in
  `vercel.json`) delivers whatever is still pending, releases claims orphaned
  by workers that died mid-flight, and drains client tombstones. A failed
  delivery's backoff can be short, but the next attempt only happens on the
  next emit or cron run, so a broken endpoint is retried roughly daily.
- `/api/cron/registry` daily at 03:17: reconciles the client registry.

Both crons require `CRON_SECRET`. Without it they return 503 and nothing
retries. If the cron stops firing, nothing errors; that is why the scheduling
route records a heartbeat *before* doing any work.

---

## 6. Registry sync specifics

The website is the source of truth for who a client is; each app project keeps a
read-only mirror. See `docs/per-app-supabase.md` §2 for the topology.

- **Version, not timestamp.** `clients.registry_version` is bumped by a trigger
  only when `name` or `status` changes, not on every dashboard refresh. The
  receiver applies an event only if `version` is greater than what it holds, so
  out-of-order delivery settles correctly with no coordination.
- **Deletion is an event.** Clients are hard-deleted, so an `AFTER DELETE`
  trigger writes `client_registry_tombstones`. Without it a deleted client would
  simply stop being mentioned and live on in five app databases forever.
- **Push plus reconcile.** Push handles latency; the nightly sweep handles what
  was dropped while an app project was paused. Do not rely on push alone, a
  paused project errors for days, by which time every delivery for it has
  dead-lettered and nothing else would retry them.

### Registering an app destination

Once its Supabase project exists:

```ts
import { registerAppDestination } from "@/lib/webhooks/registry-sync";

await registerAppDestination({
  app: "observatory",
  projectRef: "…",
  secret: process.env.REGISTRY_SYNC_SECRET_OBSERVATORY!,
});
```

The secret must match that project's `REGISTRY_SYNC_SECRET` and must be
**distinct per app**, one shared secret across five projects means one leak
compromises all five.
