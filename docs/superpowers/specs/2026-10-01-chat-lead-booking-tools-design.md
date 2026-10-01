# Chat tools: qualify, create the lead, book a call in the conversation

**Date:** 2026-10-01
**Status:** Design approved in conversation; awaiting written-spec review
**Codebase:** `Website/` (Next.js, Supabase `dyajmgddsiqcnlehqbhl`)

## Goal

The site chat (`/api/chat`, Haiku 4.5) should turn conversations into leads and booked
calls. It qualifies the visitor with structured fit fields, creates a scored lead, and
offers real open slots. The visitor books a call without leaving the chat. Success means
more chats end in a lead row or a booking row.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| How far booking goes in chat | All the way: the visitor books inside the chat. |
| Does qualification gate the calendar? | No. Capture and score everything; anyone can book (matches `/book`). |
| Who performs the booking write | The visitor, by clicking **Confirm** on a card. The model only proposes (approach A). |
| `submit_lead` | Replaced by `save_lead_details`. |
| Slot button click | Sent as a normal user message; the model then calls `propose_booking`. |
| Appointment type | The same one `/book` uses: the first public type (currently the 15-minute Initial Fit Call). |
| Stream format | NDJSON frames replace plain text + the U+2063 sentinel. |

## Existing context

- `app/api/chat/route.ts`: system prompt, `sanitizeMessages` (user/assistant strings only),
  layered rate limits, one tool `submit_lead` → `processLead` (source `website_chat`), and
  `QUALIFIED_LEAD_SENTINEL` emitted via the proxy's `emit`.
- `lib/ai/proxy.ts` `streamText`: tool loop (`maxToolRounds`), `onTool(name, input, emit)`,
  where `emit` writes raw text into the response stream.
- `components/ChatWidget.tsx` (334 lines): reads the text stream, strips the sentinel, and
  fires `chatbot_qualified_lead`.
- `lib/chat-knowledge.ts`: `RSG_BOOKING_PLAYBOOK` tells the model to share `/book`.
- `lib/leads.ts` `processLead`: 10-minute email dedupe → `leads` insert → lead-ai
  scheduling → n8n → owner email.
- `lib/scheduling/`:
  - `createBookingSession` / `getSessionByToken` / `patchBookingSession` (72h sessions)
  - `getAvailableSlots` (applies `BOOKING_POLICY`: Tue–Thu, 9–16, 24h notice, max 2/day,
    60-minute gap)
  - `submitIntake` (needs fullName, businessName, email, phone, consent; calls
    `upsertSchedulingLead`; marks the session `qualified`)
  - `createBooking` (eligibility gate, `isSlotAvailable`, idempotency, internal
    notification)
- `app/api/booking/create/route.ts`: `submitIntake` → `createBooking` → lifecycle
  `onBookingCreated`, inline in the route.
- `bookings.session_id` exists, so "this session already booked" needs no new column.
- `/api/booking/session` requires Turnstile; the chat has no Turnstile.

## 1. Architecture

### 1.1 Chat session

- `/api/chat` accepts an optional `chatSession` string in the body.
- The first tool call that needs server state calls `ensureChatSession()`. It creates a
  `booking_sessions` row via `createBookingSession`, with:
  - the fit-call `appointmentTypeId`
  - the visitor timezone (sent by the widget as `timezone`)
  - attribution (page URL, referrer, UTM params the widget already has)
- It then emits `{t:"session", token}`. The widget stores the token in component state and
  `sessionStorage` (key `rsg_chat_session`) and sends it on every later `/api/chat` and
  `/api/chat/book` call.
- The token never enters the model's context. Handlers receive it through a per-request
  context object.
- An invalid or expired token is treated as absent: a fresh session is created on the next
  stateful tool call.
- Sessions are created lazily, so chats that never call a stateful tool create no rows.

### 1.2 Migration

`supabase/migrations/20261001150000_booking_sessions_chat_state.sql`:

```sql
alter table public.booking_sessions
  add column if not exists chat_state jsonb;
```

- Nullable, additive, and safe to apply ahead of the code.
- Shape: `{ channel: "chat", offered: [{start, end, label}], offeredAt, leadCreated: bool }`.
- `answers` stays untouched by chat bookkeeping because it feeds the lead record.

### 1.3 Tools (`lib/chat/tools/`)

One file per tool plus `index.ts`, which exports the `Anthropic.Tool[]` definitions and a
`dispatchChatTool(name, input, ctx)` function. `ctx` = `{ ip, timezone, attribution,
sessionToken | null, emit(frame), setSessionToken(token) }`. Every input is parsed with zod.
A parse failure returns a model-readable error string; it never throws.

**`save_lead_details`**

- Input (all optional strings, capped lengths):
  - `name`, `business_name`, `email`, `phone`, `website`, `industry`
  - `employee_count`, `biggest_problem`, `desired_result`
  - `timeline`: enum Immediately | This month | Next 90 days | Just exploring
  - `preferred_contact`: enum Call | Text | Email
- Behavior:
  1. `ensureChatSession`. Merge provided non-empty fields into the session via
     `patchBookingSession`:
     - `contact`: fullName, businessName, email, phone, website, industry,
       preferredContact
     - `answers`: problem, result, business_size, current_challenge, timeline
  2. If the session has no lead yet and has a name plus a valid email or phone, build a
     `Lead` (source `website_chat`, `scoreLead`) and call **`processLead`**. That keeps the
     owner email, n8n dispatch and lead-ai scheduling `submit_lead` has today. Then:
     - store `lead_id` on the session
     - set `chat_state.leadCreated = true`
     - emit `{t:"lead"}`
  3. If the lead already exists, `updateChatLead(leadId, fields)` (in `lib/chat/lead.ts`) writes only the
     non-empty provided fields plus a recomputed `lead_score` to that row. There is no
     re-notification and no lead-ai rerun.
- Returns, as text: what was saved, and which booking-required fields are still missing
  (`business name`, `email`, `phone`).
- On a store failure (`processLead` reports nothing stored): the model is told to apologize
  and point to the contact form. This is the current behavior.

**`get_open_slots`**

- Input: `day_preference?: string` (free text, ≤ 60 chars, e.g. "Thursday afternoon").
- Behavior:
  - `ensureChatSession`
  - `getAvailableSlots(fitCall, today → +14 days, visitor tz)`
  - `filterByPreference`: a pure function that matches weekday names, "morning" (< 12:00),
    "afternoon" (≥ 12:00), "this week" and "next week" in the visitor timezone. Unknown text
    means no filter.
  - Take the first 6 slots. Store them in `chat_state.offered` with `offeredAt`.
- Emits `{t:"slots", slots:[{start,label}], tz}`.
- Returns the same labeled list as text, plus an instruction: only these times exist.
  Offer them; do not invent others.
- No Supabase, `bookings_paused`, or zero slots → no frame. The model is told to offer
  `/book` and the contact form instead.
- If the preference filter empties the list, the unfiltered first 6 are returned, with a
  note saying so.

**`propose_booking`**

- Input: `start` (ISO string), `meeting_format` (`phone` | `google_meet`, default `phone`).
- Validation, in order:
  1. A session exists.
  2. There is no `bookings` row for the session with status `confirmed` or `rescheduled`. Otherwise return
     "already booked; the confirmation email has the manage link".
  3. `start` matches an entry in `chat_state.offered` (exact ISO match after normalizing to
     UTC).
  4. The session contact passes `intakeContactSchema`. Otherwise return the missing fields.
- Emits `{t:"confirm", start, label, format, formats, contact:{name, business, email,
  phone}}`.
- Returns: "A confirmation card is showing. The visitor must press Confirm. Do not say the
  call is booked."
- **Writes nothing.**

### 1.4 Shared booking helper

Extract the body of `/api/booking/create` (after parsing and rate limiting) into
`lib/scheduling/book-with-intake.ts`:

```ts
bookWithIntake({ session, appointmentTypeId, startsAt, meetingFormat, visitorTimezone,
  visitorNotes?, idempotencyKey?, intake?, source? })
  → { ok: true, bookingId, manageToken } | { ok: false, error, code }
```

- It runs the idempotent replay check, then `submitIntake`, then `createBooking`, then the
  best-effort `onBookingCreated` lifecycle hook.
- `/api/booking/create` becomes a thin wrapper. Its existing tests must pass unchanged.

### 1.5 `/api/chat/book` (new route)

- Body: `{ chatSession, start, meetingFormat, consent, idempotencyKey }`.
- Rate limit: `chat-book:${ip}` 10 per 10 minutes. 503 when Supabase is not configured.
- Re-validates everything server-side:
  - token valid
  - `start` in `chat_state.offered`
  - `consent === true`
  - no `confirmed` or `rescheduled` booking for the session
  - `meetingFormat` allowed for the type
  - contact passes `intakeContactSchema`
- Calls `bookWithIntake` with `intake` built from the session contact and answers, and
  `source: "website_chat"`.
- Response: `{ ok, label, manageUrl, calendarLinks }` (via `calendarLinksForBooking`), or
  `{ error, code }` with status 409 (conflict), 403 (not_eligible), 400 or 500.

## 2. Stream protocol and widget

### 2.1 Frames (`lib/chat/frames.ts`)

The response becomes `Content-Type: application/x-ndjson`, one JSON object per line:

| Frame | Meaning |
|---|---|
| `{t:"text", d}` | text delta |
| `{t:"session", token}` | chat session token |
| `{t:"lead"}` | lead created; widget fires `chatbot_qualified_lead` |
| `{t:"slots", slots, tz}` | render the slot picker |
| `{t:"confirm", …}` | render the confirmation card |
| `{t:"error", d}` | in-band apology (refusal, upstream error) |

- `createFrameParser()` is a line-buffered parser that handles split and merged chunks and
  skips malformed lines. It is pure and unit-tested.
- Non-stream errors (429/400/503 JSON) keep their current shape.

### 2.2 Proxy change

`streamText` gains `format?: "text" | "frames"` (default `"text"`).

- In frames mode:
  - text deltas are written as `{t:"text"}` lines
  - `emit` accepts a frame object
  - `refusalText` and `errorText` go out as `{t:"error"}`
- Other callers are unaffected. `QUALIFIED_LEAD_SENTINEL` is deleted from the route and the
  widget.

### 2.3 Widget

- **Message shape:** `{ role, content, ui?: {kind:"slots", …} | {kind:"confirm", …} |
  {kind:"booked", …} }`. Only `role` and `content` go to the server. Assistant messages
  with empty `content` (UI only) are not sent.
- **New components:**
  - `components/chat/SlotPicker.tsx`
    - The buttons use `components/ui` primitives with a minimum 44px tap target, and they
      wrap.
    - Clicking one sends `"<label> works for me."` as a user message and disables the set.
  - `components/chat/BookingConfirmCard.tsx`
    - Content: summary, format toggle (if more than one format), and consent checkbox using
      the `/book` wording.
    - **Confirm booking** posts to `/api/chat/book` with a per-card `idempotencyKey`
      (`crypto.randomUUID()`).
    - States: idle, submitting, conflict, error, done.
    - On 409, the card shows "That time was just taken", and the widget sends "That time
      was taken. What else is open?"
    - On success, the card collapses and the widget appends an assistant message it
      renders itself: "You're booked for {label}. A confirmation with calendar and manage
      links is on its way to {email}." It also includes calendar links and announces
      "Booking confirmed" in a polite live region.
    - Focus moves to the card when it appears. The card is a labelled `role="group"`.
- **Clean-up:** `ChatWidget.tsx` keeps orchestration only. Frame parsing moves to
  `lib/chat/frames.ts` and the rendering to the two components above.

## 3. Abuse, errors, prompt

### 3.1 Limits

- Existing chat limits are unchanged: burst 20/5 min, 60/day per IP, global
  `CHAT_DAILY_LIMIT`, 40-message conversation cap, 3 tool rounds.
- New:
  - chat-created sessions: 5 per IP per day (`chat-session:${ip}`)
  - `/api/chat/book`: 10 per 10 minutes per IP
- The booking caps (2 per day, gap rule, DB constraint) still apply below all of this.

### 3.2 Error handling

| Situation | Behavior |
|---|---|
| Supabase not configured / bookings paused | `save_lead_details` still captures via `processLead`; `get_open_slots` tells the model to offer `/book` + the contact form |
| Lead store failure | Model apologizes and points to the contact form |
| Slot taken at confirm (409) | Card shows the conflict; the widget asks for fresh slots |
| Session expired between propose and confirm | 401 → the card says to ask for times again; the next tool call makes a new session |
| Already booked | Tool and route both refuse; the model points to the manage link in the email |
| Tool input invalid | Model-readable error string; no throw |

### 3.3 Prompt (`lib/chat-knowledge.ts`)

Rewrite `RSG_BOOKING_PLAYBOOK` and the Handoff block in the route:

- Gather fit details conversationally, one or two at a time. Call `save_lead_details`
  whenever new details arrive.
- When the visitor wants a call, collect the missing booking fields (name, business name,
  email, phone) and call `get_open_slots`.
- Mention only times returned by the tool. Never invent a time.
- When the visitor picks a time, call `propose_booking`. Never say a call is booked; only
  the confirmation card books it.
- If tools report scheduling is unavailable, share `/book` and the contact form.
- The route stops appending the `/book` system line except as that fallback.

### 3.4 Data and analytics

- The lead source is `website_chat`. It is preserved through booking because
  `upsertSchedulingLead` gains a `source` parameter, passed through `submitIntake` and
  `bookWithIntake`. The default stays `website_booking_funnel`.
- `trackSchedulingEvent` calls from chat paths include `detail.channel = "chat"`.
- Widget events:
  - `chatbot_qualified_lead` (as today)
  - `chatbot_slots_shown`
  - `chatbot_slot_selected`
  - `chatbot_booking_confirmed`
  - `chatbot_booking_failed` (with `code`)

## 4. Fixes to existing code

1. `upsertSchedulingLead`: add the optional `source` parameter (see 3.4).
2. `findExistingLead`:
   - **skip the email match when the email is empty.** Today `ilike("email", "")` would
     match any blank-email lead and overwrite it.
   - escape LIKE wildcards with `escapeLikePattern`, as `findRecentLeadByEmail` already
     does.
   - Regression tests for both.

## 5. Testing

Vitest, matching the current suite (385 passing).

- `lib/chat/frames.test.ts`: split frames, merged frames, malformed lines, trailing
  partial line.
- `lib/chat/tools/*.test.ts` (scheduling and `processLead` mocked):
  - **save_lead_details:** merge; create-once then update; missing-field report; `lead`
    frame fires once; store-failure message.
  - **get_open_slots:** preference filtering (weekday, morning/afternoon, next week, junk),
    6-slot cap, empty-filter fallback, paused, unconfigured.
  - **propose_booking:** rejects an unoffered start, missing contact, and an
    already-booked session; never calls a write function.
- `app/api/chat/book/route.test.ts`: bad token, consent false, unoffered start, disallowed
  format, 409 passthrough, idempotent retry, success payload.
- `lib/scheduling/book-with-intake.test.ts`, plus the existing `/api/booking/create` tests
  unchanged.
- `lib/scheduling/leads.test.ts`: the empty-email and wildcard regressions.
- Widget: slot click sends the message; card confirm, conflict and error states; no
  sentinel handling remains.
- Gates: typecheck clean, lint 0, full suite green, webpack build.

**End-to-end** (local against prod, `is_test` sessions):

1. Run chat → fit questions → slots → pick → confirm.
2. Verify the `leads` row (source `website_chat`, score), the `bookings` row, notification
   logs and scheduling events.
3. Delete the test rows afterward.

## 6. Rollout

- Branch `feat/chat-booking`, worktree `Website/.claude/worktrees/chat-booking`, off
  `fix/mobile-responsive-pass`.
- Apply the migration to prod before deploying.
- `CHAT_BOOKING_ENABLED` (default on; `"false"` disables it): when off, only
  `save_lead_details` is registered. Lead capture continues; the playbook falls back to
  `/book`.
- The prod deploy stays a manual step for Joseph.

## Out of scope

- Reschedule or cancel from chat (the manage link covers it)
- Choosing among appointment types
- SMS or voice channels
- Turnstile in chat
- Attributing chat spend in `ai_usage`
