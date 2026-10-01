# Chat Lead + Booking Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the site chat qualify a visitor, create or update their lead, offer real open
slots, and book a call. The booking happens when the visitor clicks Confirm on an in-chat
card.

**Architecture:**
- Three model tools (`save_lead_details`, `get_open_slots`, `propose_booking`) live in
  `lib/chat/tools/`. They depend on an injected `ChatToolDeps` interface, so they are
  unit-testable without Supabase (the same pattern as `lib/lead-ai`).
- `/api/chat` streams NDJSON frames, so tools can send slot pickers and confirmation cards to
  the widget.
- The only write path for a booking is the new `/api/chat/book` route, triggered by the
  visitor's click. It reuses the `/api/booking/create` sequence through an extracted
  `bookWithIntake` helper.

**Tech Stack:**
- Next.js 16 App Router (Node runtime), React 19
- `@anthropic-ai/sdk` via `lib/ai/proxy`
- Supabase (`dyajmgddsiqcnlehqbhl`), zod 4, luxon
- Tests: `node --test` with native TS stripping (Node 24). **Not vitest.**

**Spec:** `docs/superpowers/specs/2026-10-01-chat-lead-booking-tools-design.md` (RSG repo).
Read it alongside this plan.

## Global Constraints

- All code lives in `Website/`. Work in worktree `Website/.claude/worktrees/chat-booking`,
  branch `feat/chat-booking`.
- Test runner: `npm test` (= `node --test tests/*.test.ts`). Test files go in `tests/`, named
  `*.test.ts`, and import source with explicit `.ts` extensions. Anything that transitively
  imports `@/…` must be loaded with `await import()` **after** `import "./_alias.ts"`
  (Task 1).
- Gates before every commit: `npm run typecheck` clean, `npm run lint` 0 problems, and
  `npm test` all green.
- Lead source for chat: `"website_chat"`. The default for `upsertSchedulingLead` stays
  `"website_booking_funnel"`.
- Booking-required contact fields: name, business name, email, phone (`intakeContactSchema`).
- Lead-creation minimum: a name plus a valid email **or** a phone.
- Chat meeting formats: `phone` | `google_meet`, default `phone`. Only formats the
  appointment type allows are offered.
- Appointment type: the first entry of `listPublicAppointmentTypes()` (same as `/book`).
- Slot window: today → +14 days, in the visitor's timezone. At most **6** slots offered per
  call.
- Limits:
  - chat-created sessions: **5 per IP per 24h** (`chat-session:${ip}`)
  - `/api/chat/book`: **10 per 10 min per IP** (`chat-book:${ip}`)
  - the existing chat limits are unchanged
- "Already booked" means a `bookings` row for the session with `status in ('confirmed',
  'rescheduled')`.
- Copy rules (existing prompt):
  - no emoji, no exclamation marks
  - the model never says a call is booked; only the card books it
- Feature flag: `CHAT_BOOKING_ENABLED`. Booking is on unless the value is exactly
  `"false"`. When off, only `save_lead_details` is registered.
- Later chat updates to an existing lead write `rule_score`, **never** `lead_score`.
  `lead_score` is the lead-ai blended score and must not be clobbered. (This deliberately
  refines spec §1.3, which said "recomputed lead_score".)
- Chat vs `/book` comparison comes from `booking_sessions.chat_state->>'channel' = 'chat'`
  joined to `scheduling_events.session_id`. We do not thread a `channel` detail through
  `trackSchedulingEvent` (`createBookingSession` emits `intake_started` internally). This
  refines spec §3.4; the same comparison is possible with no change to the scheduling
  analytics code.
- Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Prerequisite (do before Task 1, needs Joseph)

The Tue–Thu booking-rules work is **uncommitted** in the main `Website/` checkout on
`fix/mobile-responsive-pass`:
- `lib/scheduling/policy.ts`
- `supabase/migrations/20260930210000_booking_daily_limit.sql`
- modified `availability.ts`, `slots.ts`, `booking.ts`, `SchedulingAdminPanel.tsx`, …

A worktree created from that branch would not contain it. Either commit that work on
`fix/mobile-responsive-pass` first (preferred), or branch from it once Joseph says it is
committed. Do not copy uncommitted files by hand.

## Review Focus

1. **The visitor gives contact details across several messages, out of order** (phone
   first, email three turns later). Expect one lead row, later updated. Never two rows, and
   never an overwrite of another lead. Pinned in Task 6 ("merges across calls…") and Task 2
   (empty-email lookup).
2. **The visitor clicks Confirm twice, or the network retries.** Expect exactly one
   booking, with the second response identical to the first. Pinned in Task 8 (idempotent
   replay) and Task 9 (already-booked refusal returns the existing state, not an error the
   visitor can't act on).
3. **The visitor's history is edited in devtools to claim a slot that was never offered, or
   a start time in the past.** Expect `propose_booking` and `/api/chat/book` to both refuse.
   Pinned in Task 7 and Task 9 ("rejects a start that was not offered").
4. **A frame splits across network chunks mid-JSON, or one chunk carries several frames.**
   Expect no lost text and no crash. Pinned in Task 3.
5. **Scheduling is down (Supabase unset, or bookings paused) mid-conversation.** Expect lead
   capture to keep working and the model to point to `/book` and the contact form. Pinned in
   Task 6 ("creates the lead without a session…") and Task 7 ("paused → fallback text, no
   frame").

---

## File Structure

| File | Responsibility |
|---|---|
| `tests/_alias.ts` (new) | Registers the `@/` resolve hook once; side-effect import for tests |
| `lib/scheduling/leads.ts` (modify) | `findExistingLead` empty-email + escaping fix; `source` param |
| `lib/scheduling/intake.ts` (modify) | Pass `source` through `submitIntake` |
| `supabase/migrations/20261001150000_booking_sessions_chat_state.sql` (new) | `chat_state jsonb` |
| `lib/chat/types.ts` (new) | `ChatFrame`, `OfferedSlot`, `ChatState`, `ChatSessionRecord`, `ChatToolDeps`, `ChatToolContext` |
| `lib/chat/frames.ts` (new) | `encodeFrame`, `createFrameParser` (pure) |
| `lib/ai/proxy.ts` (modify) | `format: "frames"` option on `streamText` |
| `lib/chat/slot-filter.ts` (new) | `filterSlotsByPreference` (pure) |
| `lib/chat/contact.ts` (new) | Pure mapping: tool input ↔ session contact/answers ↔ `Lead` ↔ intake |
| `lib/chat/session.ts` (new) | `ensureChatSession(ctx, deps)` |
| `lib/chat/tools/save-lead-details.ts` (new) | Tool definition + handler |
| `lib/chat/tools/get-open-slots.ts` (new) | Tool definition + handler |
| `lib/chat/tools/propose-booking.ts` (new) | Tool definition + handler |
| `lib/chat/tools/index.ts` (new) | `chatTools(enabled)`, `dispatchChatTool` |
| `lib/scheduling/book-with-intake.ts` (new) | Shared intake → booking → lifecycle sequence |
| `app/api/booking/create/route.ts` (modify) | Thin wrapper over `bookWithIntake` |
| `lib/chat/confirm.ts` (new) | `confirmChatBooking(input, deps)`: validation + call into booking |
| `lib/chat/deps.ts` (new) | Real Supabase-backed `ChatToolDeps` and `ConfirmDeps` |
| `app/api/chat/book/route.ts` (new) | Thin route over `confirmChatBooking` |
| `app/api/chat/route.ts` (modify) | Frames, session token, new tools, flag, prompt hand-off |
| `lib/chat-knowledge.ts` (modify) | New `RSG_BOOKING_PLAYBOOK` |
| `lib/chat/widget-state.ts` (new) | Pure widget helpers: `toHistory`, `applyFrame` |
| `components/chat/SlotPicker.tsx` (new) | Slot buttons |
| `components/chat/BookingConfirmCard.tsx` (new) | Confirm card |
| `components/ChatWidget.tsx` (modify) | Orchestration; frames; session token; renders UI attachments |
| `lib/events.ts` (modify) | New event names |

---

### Task 1: Test alias helper + lead lookup fixes + `source` passthrough

**Files:**
- Create: `tests/_alias.ts`
- Modify: `lib/scheduling/leads.ts` (`findExistingLead`, `upsertSchedulingLead`)
- Modify: `lib/scheduling/intake.ts` (`submitIntake`)
- Test: `tests/scheduling-lead-lookup.test.ts`

**Interfaces:**
- Produces:
  - `findExistingLead(input: { email: string; phone?: string; website?: string }, sb?:
    SupabaseClient): Promise<{ id: string } | null>`
  - `upsertSchedulingLead({..., source?: string})`
  - `submitIntake({..., source?: string})`

- [ ] **Step 0: Create the worktree** (after the Prerequisite is resolved)

```bash
cd /c/Users/josep/Desktop/RSG/Website
git worktree add .claude/worktrees/chat-booking -b feat/chat-booking fix/mobile-responsive-pass
cd .claude/worktrees/chat-booking && npm ci && npm test 2>&1 | tail -5
```
Expected: the suite passes (baseline count noted for later).

- [ ] **Step 1: Create the alias helper**

`tests/_alias.ts`:
```ts
/**
 * Side-effect import for tests: maps the "@/…" tsconfig alias for plain
 * `node --test`. Import it first, then load app code with `await import()`
 * (static imports are resolved before this hook registers).
 */
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    }
    try {
      return nextResolve(spec, context);
    } catch (err) {
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(`${spec}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});
```

`npm test` globs `tests/*.test.ts`, so `_alias.ts` is never run as a test.

- [ ] **Step 2: Write the failing test**

`tests/scheduling-lead-lookup.test.ts`:
```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { findExistingLead } = await import("../lib/scheduling/leads.ts");

type Call = { column: string; op: string; value: string };

/** Minimal PostgREST builder fake: records filters, answers from `hits`. */
function fakeSb(hits: Record<string, { id: string }>) {
  const calls: Call[] = [];
  const sb = {
    from() {
      let current: Call | null = null;
      const q = {
        select: () => q,
        ilike: (column: string, value: string) => {
          current = { column, op: "ilike", value };
          calls.push(current);
          return q;
        },
        eq: (column: string, value: string) => {
          current = { column, op: "eq", value };
          calls.push(current);
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({
          data: current ? hits[`${current.column}:${current.value}`] ?? null : null,
        }),
      };
      return q;
    },
  };
  return { sb: sb as never, calls };
}

describe("findExistingLead", () => {
  it("never matches on a blank email (would hit every blank-email lead)", async () => {
    const { sb, calls } = fakeSb({ "email:": { id: "someone-else" } });
    const found = await findExistingLead({ email: "", phone: "781-555-0100" }, sb);
    assert.equal(found, null);
    assert.ok(!calls.some((c) => c.column === "email"));
    assert.ok(calls.some((c) => c.column === "phone_normalized"));
  });

  it("escapes LIKE wildcards in the email", async () => {
    const { sb, calls } = fakeSb({});
    await findExistingLead({ email: "%@%.com" }, sb);
    const emailCall = calls.find((c) => c.column === "email");
    assert.equal(emailCall?.value, String.raw`\%@\%.com`);
  });

  it("still matches by lower-cased email first", async () => {
    const { sb } = fakeSb({ "email:ada@x.com": { id: "lead-1" } });
    const found = await findExistingLead({ email: " Ada@X.com " }, sb);
    assert.deepEqual(found, { id: "lead-1" });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test tests/scheduling-lead-lookup.test.ts`
Expected: FAIL. The first test sees an `email` call; the second sees the unescaped value.

- [ ] **Step 4: Implement the fix in `lib/scheduling/leads.ts`**

Change the imports and `findExistingLead`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeLikePattern } from "@/lib/validate";
```
```ts
export async function findExistingLead(
  input: { email: string; phone?: string; website?: string },
  sb: SupabaseClient = requireSupabase()
): Promise<{ id: string } | null> {
  const email = input.email.trim().toLowerCase();
  const phoneNorm = input.phone ? normalizePhone(input.phone) : "";
  const domain = input.website ? extractDomain(input.website) : "";

  // A blank email must not reach ilike: "" would match every lead that has
  // no email and the caller would overwrite a stranger's row.
  if (email) {
    const { data: byEmail } = await sb
      .from("leads")
      .select("id")
      .ilike("email", escapeLikePattern(email))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byEmail) return byEmail;
  }
  // …phone and domain branches unchanged…
```

In `upsertSchedulingLead`:
- add `source?: string;` to the input type
- replace `source: "website_booking_funnel",` with
  `source: input.source ?? "website_booking_funnel",`

- [ ] **Step 5: Pass `source` through `submitIntake`** (`lib/scheduling/intake.ts`)

- Add `source?: string;` to the `submitIntake` input type.
- In the `upsertSchedulingLead({...})` call, add `source: input.source,`.

- [ ] **Step 6: Run the tests and gates**

Run: `node --test tests/scheduling-lead-lookup.test.ts && npm run typecheck && npm test`
Expected: PASS; the full suite count is baseline + 3.

- [ ] **Step 7: Commit**

```bash
git add tests/_alias.ts tests/scheduling-lead-lookup.test.ts lib/scheduling/leads.ts lib/scheduling/intake.ts
git commit -m "scheduling: blank-email lookup no longer matches every lead; escape LIKE; source param

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration + shared chat types

**Files:**
- Create: `supabase/migrations/20261001150000_booking_sessions_chat_state.sql`
- Create: `lib/chat/types.ts`

**Interfaces:**
- Produces every type below. Later tasks import them from `@/lib/chat/types`.

- [ ] **Step 1: Write the migration**

```sql
-- Chat-booking bookkeeping (offered slots, lead-created flag). Kept out of
-- `answers`, which feeds the lead record. Additive and nullable: safe to apply
-- ahead of the code that reads it.
alter table public.booking_sessions
  add column if not exists chat_state jsonb;
```

- [ ] **Step 2: Write `lib/chat/types.ts`**

```ts
import type { Attribution, ContactInfo } from "@/lib/scheduling/types";
import type { Lead } from "@/lib/types";

export type ChatMeetingFormat = "phone" | "google_meet";
export const CHAT_MEETING_FORMATS: readonly ChatMeetingFormat[] = ["phone", "google_meet"];

/** A slot the server offered in this conversation. `start`/`end` are ISO UTC. */
export type OfferedSlot = { start: string; end: string; label: string };

export type ConfirmContact = {
  name: string;
  business: string;
  email: string;
  phone: string;
};

/** One NDJSON line of the /api/chat response. */
export type ChatFrame =
  | { t: "text"; d: string }
  | { t: "session"; token: string }
  | { t: "lead" }
  | { t: "slots"; slots: OfferedSlot[]; tz: string }
  | {
      t: "confirm";
      start: string;
      label: string;
      format: ChatMeetingFormat;
      formats: ChatMeetingFormat[];
      contact: ConfirmContact;
    }
  | { t: "error"; d: string };

/** booking_sessions.chat_state */
export type ChatState = {
  channel: "chat";
  offered: OfferedSlot[];
  offeredAt: string | null;
  leadCreated: boolean;
};

export const EMPTY_CHAT_STATE: ChatState = {
  channel: "chat",
  offered: [],
  offeredAt: null,
  leadCreated: false,
};

export type ChatSessionRecord = {
  id: string;
  token: string;
  leadId: string | null;
  contact: Partial<ContactInfo>;
  answers: Record<string, unknown>;
  chatState: ChatState;
  timezone: string | null;
  isTest: boolean;
};

export type SessionPatch = {
  contact?: Partial<ContactInfo>;
  answers?: Record<string, unknown>;
  leadId?: string;
  chatState?: ChatState;
};

/** Everything the tool handlers touch outside their own logic. */
export interface ChatToolDeps {
  getSession(token: string): Promise<ChatSessionRecord | null>;
  /** null when scheduling storage is unavailable or the IP hit the session cap. */
  createSession(input: {
    ip: string;
    timezone: string;
    attribution: Attribution;
  }): Promise<ChatSessionRecord | null>;
  patchSession(id: string, patch: SessionPatch): Promise<void>;
  /** processLead: stores, emails owner, n8n, schedules lead-ai. */
  createLead(lead: Lead): Promise<{ ok: boolean; leadId?: string }>;
  /** Partial update of an existing leads row (column names). */
  updateLead(leadId: string, columns: Record<string, unknown>): Promise<void>;
  /** Supabase configured and bookings not paused. */
  schedulingAvailable(): Promise<boolean>;
  appointmentType(): Promise<{ id: string; formats: ChatMeetingFormat[] } | null>;
  listSlots(input: {
    appointmentTypeId: string;
    from: string;
    to: string;
    timezone: string;
  }): Promise<OfferedSlot[]>;
  hasActiveBooking(sessionId: string): Promise<boolean>;
  now(): Date;
}

/** Per-request context the route builds; mutable sessionToken. */
export type ChatToolContext = {
  ip: string;
  timezone: string;
  attribution: Attribution;
  sessionToken: string | null;
  bookingEnabled: boolean;
  emit(frame: ChatFrame): void;
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261001150000_booking_sessions_chat_state.sql lib/chat/types.ts
git commit -m "chat: booking_sessions.chat_state migration and shared chat types

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: NDJSON frames (encode + streaming parser)

**Files:**
- Create: `lib/chat/frames.ts`
- Test: `tests/chat-frames.test.ts`

**Interfaces:**
- Consumes: `ChatFrame` (Task 2).
- Produces:
  - `encodeFrame(frame: ChatFrame): string` (one line ending in `\n`)
  - `createFrameParser(): { push(chunk: string): ChatFrame[]; flush(): ChatFrame[] }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFrame, createFrameParser } from "../lib/chat/frames.ts";

describe("encodeFrame", () => {
  it("writes one JSON object per line", () => {
    assert.equal(encodeFrame({ t: "text", d: "hi\nthere" }), '{"t":"text","d":"hi\\nthere"}\n');
  });
});

describe("createFrameParser", () => {
  it("parses several frames delivered in one chunk", () => {
    const p = createFrameParser();
    const out = p.push(encodeFrame({ t: "text", d: "a" }) + encodeFrame({ t: "lead" }));
    assert.deepEqual(out, [{ t: "text", d: "a" }, { t: "lead" }]);
  });

  it("buffers a frame split mid-JSON across chunks", () => {
    const p = createFrameParser();
    const line = encodeFrame({ t: "text", d: "hello" });
    assert.deepEqual(p.push(line.slice(0, 7)), []);
    assert.deepEqual(p.push(line.slice(7)), [{ t: "text", d: "hello" }]);
  });

  it("skips malformed lines and frames of unknown type", () => {
    const p = createFrameParser();
    const out = p.push('not json\n{"t":"bogus"}\n{"t":"lead"}\n');
    assert.deepEqual(out, [{ t: "lead" }]);
  });

  it("flush returns a trailing line with no newline", () => {
    const p = createFrameParser();
    assert.deepEqual(p.push('{"t":"lead"}'), []);
    assert.deepEqual(p.flush(), [{ t: "lead" }]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/chat-frames.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/chat/frames.ts`**

```ts
import type { ChatFrame } from "./types.ts";

/** NDJSON wire format for /api/chat: one frame per line. Pure, client + server. */
export function encodeFrame(frame: ChatFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

const KNOWN = new Set(["text", "session", "lead", "slots", "confirm", "error"]);

function parseLine(line: string): ChatFrame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const value = JSON.parse(trimmed) as { t?: unknown };
    if (value && typeof value.t === "string" && KNOWN.has(value.t)) {
      return value as ChatFrame;
    }
  } catch {
    /* malformed line: skip */
  }
  return null;
}

/** Line-buffered parser: network chunks need not align with frames. */
export function createFrameParser() {
  let buffer = "";
  return {
    push(chunk: string): ChatFrame[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.map(parseLine).filter((f): f is ChatFrame => f !== null);
    },
    flush(): ChatFrame[] {
      const rest = parseLine(buffer);
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}
```

`lib/chat/types.ts` imports `@/…` types only (type imports are erased), so this test needs no
alias hook.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/chat-frames.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/chat/frames.ts tests/chat-frames.test.ts
git commit -m "chat: NDJSON frame encoder and chunk-safe parser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `streamText` frames mode

**Files:**
- Modify: `lib/ai/proxy.ts` (the `ToolHandler` type and `streamText`)
- Test: `tests/ai-proxy.test.ts` (append)

**Interfaces:**
- Produces:
  - `export function makeStreamWriter(format: "text" | "frames", enqueue: (s: string) =>
    void): { text(s: string): void; error(s: string): void; frame(f: ChatFrame): void }`
  - `ToolHandler` now receives `emit: (frame: ChatFrame | string) => void`. A string emits
    as text in either mode.
  - `streamText({..., format?: "text" | "frames"})`

- [ ] **Step 1: Write the failing test** (append to `tests/ai-proxy.test.ts`; that file
  already registers the alias hook and imports the proxy dynamically)

Change its import line to:
```ts
const { AiError, aiErrorResponse, generateStructured, makeStreamWriter } = await import("../lib/ai/proxy.ts");
```
Then append:
```ts
describe("makeStreamWriter", () => {
  it("text mode writes raw text and drops structured frames", () => {
    const out: string[] = [];
    const w = makeStreamWriter("text", (s) => out.push(s));
    w.text("hi");
    w.frame({ t: "lead" });
    w.error("oops");
    assert.deepEqual(out, ["hi", "oops"]);
  });

  it("frames mode wraps text and errors as NDJSON frames", () => {
    const out: string[] = [];
    const w = makeStreamWriter("frames", (s) => out.push(s));
    w.text("hi");
    w.frame({ t: "lead" });
    w.error("oops");
    assert.deepEqual(out, [
      '{"t":"text","d":"hi"}\n',
      '{"t":"lead"}\n',
      '{"t":"error","d":"oops"}\n',
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/ai-proxy.test.ts`
Expected: FAIL (`makeStreamWriter` is not a function).

- [ ] **Step 3: Implement it in `lib/ai/proxy.ts`**

Add the imports:
```ts
import type { ChatFrame } from "@/lib/chat/types";
import { encodeFrame } from "@/lib/chat/frames";
```
Add, above `ToolHandler`:
```ts
/**
 * Where streamed output goes. "text" is the historical raw-text stream;
 * "frames" is NDJSON (lib/chat/frames) so a tool can hand the client
 * structured UI alongside the model's words. Text mode silently drops
 * structured frames, which only frame-aware clients can render.
 */
export function makeStreamWriter(
  format: "text" | "frames",
  enqueue: (s: string) => void,
) {
  if (format === "frames") {
    return {
      text: (s: string) => enqueue(encodeFrame({ t: "text", d: s })),
      error: (s: string) => enqueue(encodeFrame({ t: "error", d: s })),
      frame: (f: ChatFrame) => enqueue(encodeFrame(f)),
    };
  }
  return {
    text: (s: string) => enqueue(s),
    error: (s: string) => enqueue(s),
    frame: (_f: ChatFrame) => {},
  };
}
```
Change `ToolHandler`'s `emit` parameter to `emit: (frame: ChatFrame | string) => void`, and
update its doc comment ("a string is emitted as text; a frame needs `format: "frames"`").
Add `format?: "text" | "frames";` to the `streamText` options. Inside `start(controller)`,
replace the `emit` definition and its uses:
```ts
const writer = makeStreamWriter(opts.format ?? "text", (s) =>
  controller.enqueue(encoder.encode(s)),
);
const emit = (f: ChatFrame | string) =>
  typeof f === "string" ? writer.text(f) : writer.frame(f);
```
- text deltas → `writer.text(event.delta.text)`
- refusal → `writer.error(opts.refusalText ?? "[The assistant declined to respond to that.]")`
- catch block → `writer.error(opts.errorText ?? "The assistant hit an error. Please try again
  in a moment.")`
- `opts.onTool(block.name, block.input, emit)` is unchanged.

- [ ] **Step 4: Check the other `streamText` callers still compile**

Run: `grep -rn "streamText(" app lib --include=*.ts | grep -v "lib/ai/proxy.ts"` then
`npm run typecheck`.
Expected: clean. The existing chat route's `emit(QUALIFIED_LEAD_SENTINEL)` passes a string,
which is still valid until Task 10 removes it.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/ai-proxy.test.ts && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/proxy.ts tests/ai-proxy.test.ts
git commit -m "ai/proxy: optional NDJSON frames output for streamText

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Slot preference filter + contact mapping (pure)

**Files:**
- Create: `lib/chat/slot-filter.ts`
- Create: `lib/chat/contact.ts`
- Test: `tests/chat-pure.test.ts`

**Interfaces:**
- Consumes: `OfferedSlot`, `ConfirmContact`, `ChatMeetingFormat` (Task 2); `Lead`; `ContactInfo`;
  `scoreLead` (`lib/lead-score.ts`); `isEmail` (`lib/validate.ts`); `splitFullName`
  (`lib/scheduling/intake-schema.ts`).
- Produces:
  - `filterSlotsByPreference(slots: OfferedSlot[], preference: string | undefined, timezone:
    string, now: Date): { slots: OfferedSlot[]; matched: boolean }`
  - `type SaveLeadInput` (the parsed tool input)
  - `mergeContact(prev: Partial<ContactInfo>, input: SaveLeadInput): Partial<ContactInfo>`
  - `mergeAnswers(prev: Record<string, unknown>, input: SaveLeadInput): Record<string,
    unknown>`
  - `contactName(c: Partial<ContactInfo>): string`
  - `meetsLeadMinimum(c: Partial<ContactInfo>): boolean`
  - `missingForBooking(c: Partial<ContactInfo>): string[]` (labels: `"name"`, `"business
    name"`, `"email"`, `"phone"`)
  - `buildChatLead(c, answers, attribution, now: Date): Lead` (with `score` and `ruleScore`
    set)
  - `leadUpdateColumns(c, answers, attribution, now: Date): Record<string, unknown>`
    (non-empty columns + `rule_score`; never `lead_score`)
  - `toConfirmContact(c): ConfirmContact`
  - `toIntakeContact(c): { fullName; businessName; email; phone; industry; website;
    preferredContact: "email" | "phone" | "text" }`
  - `toIntakeAnswers(answers): { problem?; result?; business_size? }`

- [ ] **Step 1: Write the failing test**

`tests/chat-pure.test.ts`:
```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { filterSlotsByPreference } = await import("../lib/chat/slot-filter.ts");
const c = await import("../lib/chat/contact.ts");

// Tue 2026-10-06 … Thu 2026-10-15, New York (UTC-4).
const slot = (iso: string) => ({ start: iso, end: iso, label: iso });
const SLOTS = [
  slot("2026-10-06T13:00:00.000Z"), // Tue 9:00 ET
  slot("2026-10-06T18:00:00.000Z"), // Tue 14:00 ET
  slot("2026-10-08T14:00:00.000Z"), // Thu 10:00 ET
  slot("2026-10-13T19:00:00.000Z"), // Tue the week after 15:00 ET
  slot("2026-10-15T13:00:00.000Z"), // Thu the week after 9:00 ET
];
const NOW = new Date("2026-10-02T15:00:00.000Z"); // Fri
const TZ = "America/New_York";

describe("filterSlotsByPreference", () => {
  it("no preference returns all, matched", () => {
    assert.deepEqual(filterSlotsByPreference(SLOTS, undefined, TZ, NOW), { slots: SLOTS, matched: true });
  });
  it("weekday name", () => {
    const r = filterSlotsByPreference(SLOTS, "Thursday", TZ, NOW);
    assert.deepEqual(r.slots.map((s) => s.start), [SLOTS[2].start, SLOTS[4].start]);
  });
  it("afternoon in the visitor timezone", () => {
    const r = filterSlotsByPreference(SLOTS, "tuesday afternoon", TZ, NOW);
    assert.deepEqual(r.slots.map((s) => s.start), [SLOTS[1].start, SLOTS[3].start]);
  });
  it("next week (NOW is Fri Oct 2, so next week is Mon Oct 5 – Sun Oct 11)", () => {
    const r = filterSlotsByPreference(SLOTS, "next week", TZ, NOW);
    assert.deepEqual(r.slots.map((s) => s.start), [SLOTS[0].start, SLOTS[1].start, SLOTS[2].start]);
  });
  it("unknown text means no filter", () => {
    assert.equal(filterSlotsByPreference(SLOTS, "whenever works", TZ, NOW).slots.length, 5);
  });
  it("a filter that empties the list falls back to all, matched=false", () => {
    const r = filterSlotsByPreference(SLOTS, "monday", TZ, NOW);
    assert.equal(r.matched, false);
    assert.equal(r.slots.length, 5);
  });
});

describe("contact mapping", () => {
  it("merges across calls without blanking earlier fields", () => {
    let contact = c.mergeContact({}, { phone: "781-555-0100" });
    contact = c.mergeContact(contact, { name: "Ada Lovelace", email: "ada@x.com", phone: "" });
    assert.equal(contact.phone, "781-555-0100");
    assert.equal(contact.firstName, "Ada");
    assert.equal(contact.lastName, "Lovelace");
    assert.equal(contact.email, "ada@x.com");
  });
  it("ignores an invalid email", () => {
    assert.equal(c.mergeContact({}, { email: "nope" }).email, undefined);
  });
  it("lead minimum is name + (email or phone)", () => {
    assert.equal(c.meetsLeadMinimum({ firstName: "Ada" }), false);
    assert.equal(c.meetsLeadMinimum({ firstName: "Ada", phone: "781-555-0100" }), true);
  });
  it("lists what booking still needs", () => {
    assert.deepEqual(c.missingForBooking({ firstName: "Ada", email: "a@x.com" }), ["business name", "phone"]);
  });
  it("buildChatLead sets source, scores, and maps answers", () => {
    const lead = c.buildChatLead(
      { firstName: "Ada", lastName: "L", email: "a@x.com", businessName: "Glow" },
      { problem: "Missed calls", result: "Faster follow-up", timeline: "This month" },
      {},
      NOW,
    );
    assert.equal(lead.source, "website_chat");
    assert.equal(lead.company, "Glow");
    assert.equal(lead.problem, "Missed calls");
    assert.equal(lead.timeline, "This month");
    assert.equal(typeof lead.score, "number");
    assert.equal(lead.ruleScore, lead.score);
  });
  it("leadUpdateColumns never writes lead_score", () => {
    const cols = c.leadUpdateColumns({ firstName: "Ada", phone: "781-555-0100" }, {}, {}, NOW);
    assert.equal("lead_score" in cols, false);
    assert.equal(typeof cols.rule_score, "number");
    assert.equal(cols.phone, "781-555-0100");
    assert.equal("email" in cols, false);
  });
  it("maps preferred contact to the intake enum", () => {
    assert.equal(c.toIntakeContact({ preferredContact: "Text" }).preferredContact, "text");
    assert.equal(c.toIntakeContact({ preferredContact: "Call" }).preferredContact, "phone");
    assert.equal(c.toIntakeContact({}).preferredContact, "email");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/chat-pure.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/chat/slot-filter.ts`**

```ts
import { DateTime } from "luxon";
import type { OfferedSlot } from "./types.ts";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * Narrow offered slots by a free-text preference ("Thursday afternoon",
 * "next week"). Unknown words do not filter. If the filter would leave
 * nothing, every slot comes back with matched=false so the model can say so.
 */
export function filterSlotsByPreference(
  slots: OfferedSlot[],
  preference: string | undefined,
  timezone: string,
  now: Date,
): { slots: OfferedSlot[]; matched: boolean } {
  const pref = (preference ?? "").toLowerCase();
  const days = WEEKDAYS.map((d, i) => (pref.includes(d) ? i + 1 : 0)).filter(Boolean);
  const morning = pref.includes("morning");
  const afternoon = pref.includes("afternoon");
  const thisWeek = pref.includes("this week");
  const nextWeek = pref.includes("next week");
  if (!days.length && !morning && !afternoon && !thisWeek && !nextWeek) {
    return { slots, matched: true };
  }

  const startOfWeek = DateTime.fromJSDate(now).setZone(timezone).startOf("week");
  const filtered = slots.filter((s) => {
    const t = DateTime.fromISO(s.start, { zone: "utc" }).setZone(timezone);
    if (days.length && !days.includes(t.weekday)) return false;
    if (morning && !afternoon && t.hour >= 12) return false;
    if (afternoon && !morning && t.hour < 12) return false;
    const weekOffset = Math.floor(t.startOf("week").diff(startOfWeek, "weeks").weeks + 0.5);
    if (thisWeek && weekOffset !== 0) return false;
    if (nextWeek && weekOffset !== 1) return false;
    return true;
  });
  return filtered.length ? { slots: filtered, matched: true } : { slots, matched: false };
}
```

- [ ] **Step 4: Implement `lib/chat/contact.ts`**

```ts
import type { Attribution, ContactInfo } from "@/lib/scheduling/types";
import type { Lead } from "@/lib/types";
import { scoreLead } from "@/lib/lead-score";
import { isEmail } from "@/lib/validate";
import { splitFullName } from "@/lib/scheduling/intake-schema";
import type { ConfirmContact } from "./types.ts";

export type SaveLeadInput = {
  name?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  employee_count?: string;
  biggest_problem?: string;
  desired_result?: string;
  timeline?: "Immediately" | "This month" | "Next 90 days" | "Just exploring";
  preferred_contact?: "Call" | "Text" | "Email";
};

const PHONE = /(\d[^\d]*){10,}/;
const has = (v: string | undefined): v is string => typeof v === "string" && v.trim() !== "";

/** Merge new non-empty, valid fields over what the session already holds. */
export function mergeContact(
  prev: Partial<ContactInfo>,
  input: SaveLeadInput,
): Partial<ContactInfo> {
  const next: Partial<ContactInfo> = { ...prev };
  if (has(input.name)) Object.assign(next, splitFullName(input.name));
  if (has(input.business_name)) next.businessName = input.business_name.trim();
  if (has(input.email) && isEmail(input.email.trim())) next.email = input.email.trim().toLowerCase();
  if (has(input.phone) && PHONE.test(input.phone)) next.phone = input.phone.trim();
  if (has(input.website)) next.website = input.website.trim();
  if (has(input.industry)) next.industry = input.industry.trim();
  if (has(input.employee_count)) next.employeeCount = input.employee_count.trim();
  if (has(input.preferred_contact)) next.preferredContact = input.preferred_contact;
  return next;
}

export function mergeAnswers(
  prev: Record<string, unknown>,
  input: SaveLeadInput,
): Record<string, unknown> {
  const next = { ...prev };
  if (has(input.biggest_problem)) next.problem = input.biggest_problem.trim();
  if (has(input.desired_result)) next.result = input.desired_result.trim();
  if (has(input.employee_count)) next.business_size = input.employee_count.trim();
  if (has(input.timeline)) next.timeline = input.timeline;
  return next;
}

export function contactName(c: Partial<ContactInfo>): string {
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

export function meetsLeadMinimum(c: Partial<ContactInfo>): boolean {
  return contactName(c) !== "" && (has(c.email) || has(c.phone));
}

export function missingForBooking(c: Partial<ContactInfo>): string[] {
  const missing: string[] = [];
  if (!contactName(c)) missing.push("name");
  if (!has(c.businessName)) missing.push("business name");
  if (!has(c.email)) missing.push("email");
  if (!has(c.phone)) missing.push("phone");
  return missing;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function buildChatLead(
  c: Partial<ContactInfo>,
  answers: Record<string, unknown>,
  attribution: Attribution,
  now: Date,
): Lead {
  const lead: Lead = {
    name: contactName(c),
    company: c.businessName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    website: c.website ?? "",
    industry: c.industry ?? "",
    problem: str(answers.problem),
    improve: str(answers.result),
    preferredContact: c.preferredContact ?? "",
    timeline: str(answers.timeline),
    pageUrl: attribution.pageUrl,
    referrer: attribution.referrer,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmContent: attribution.utmContent,
    utmTerm: attribution.utmTerm,
    source: "website_chat",
    submittedAt: now.toISOString(),
  };
  lead.score = scoreLead(lead);
  lead.ruleScore = lead.score;
  return lead;
}

/**
 * Columns for updating an existing chat lead. Only non-empty values, plus
 * the recomputed rule_score. Never lead_score: that is lead-ai's blend.
 */
export function leadUpdateColumns(
  c: Partial<ContactInfo>,
  answers: Record<string, unknown>,
  attribution: Attribution,
  now: Date,
): Record<string, unknown> {
  const lead = buildChatLead(c, answers, attribution, now);
  const cols: Record<string, unknown> = {
    name: lead.name,
    business_name: lead.company,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    industry: lead.industry,
    employee_count: c.employeeCount ?? "",
    biggest_problem: lead.problem,
    improvement_goal: lead.improve,
    preferred_contact: lead.preferredContact,
    timeline: lead.timeline,
  };
  for (const k of Object.keys(cols)) if (cols[k] === "" || cols[k] == null) delete cols[k];
  cols.rule_score = lead.ruleScore;
  cols.updated_at = now.toISOString();
  return cols;
}

export function toConfirmContact(c: Partial<ContactInfo>): ConfirmContact {
  return {
    name: contactName(c),
    business: c.businessName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
  };
}

export function toIntakeContact(c: Partial<ContactInfo>) {
  const preferred =
    c.preferredContact === "Text" ? "text" : c.preferredContact === "Call" ? "phone" : "email";
  return {
    fullName: contactName(c),
    businessName: c.businessName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    industry: c.industry ?? "",
    website: c.website ?? "",
    preferredContact: preferred as "email" | "phone" | "text",
  };
}

export function toIntakeAnswers(answers: Record<string, unknown>) {
  const out: { problem?: string; result?: string; business_size?: string } = {};
  if (str(answers.problem)) out.problem = str(answers.problem).slice(0, 2000);
  if (str(answers.result)) out.result = str(answers.result).slice(0, 120);
  if (str(answers.business_size)) out.business_size = str(answers.business_size).slice(0, 40);
  return out;
}
```

`Lead` has no `ruleScore` writer path in `leadToRow` beyond `rule_score: lead.ruleScore ??
lead.score`, so setting both is correct.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/chat-pure.test.ts`
Expected: PASS (13 tests). If the "next week" test fails on the week-offset rounding, check
it against luxon's `startOf("week")` (Monday-based) before changing the fixture.

- [ ] **Step 6: Commit**

```bash
git add lib/chat/slot-filter.ts lib/chat/contact.ts tests/chat-pure.test.ts
git commit -m "chat: slot preference filter and contact/lead mapping helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `ensureChatSession` + `save_lead_details`

**Files:**
- Create: `lib/chat/session.ts`
- Create: `lib/chat/tools/save-lead-details.ts`
- Create: `tests/chat-tools-fakes.ts` (shared fakes; not a test file)
- Test: `tests/chat-tools-lead.test.ts`

**Interfaces:**
- Consumes: Task 2 types; Task 5 `contact.ts`.
- Produces:
  - `ensureChatSession(ctx: ChatToolContext, deps: ChatToolDeps):
    Promise<ChatSessionRecord | null>`. It sets `ctx.sessionToken` and emits `{t:"session"}`
    when it creates a session.
  - `SAVE_LEAD_DETAILS_TOOL: Anthropic.Tool`
  - `handleSaveLeadDetails(input: unknown, ctx, deps): Promise<string>`

- [ ] **Step 1: Write the shared fakes** (`tests/chat-tools-fakes.ts`)

```ts
import type {
  ChatFrame,
  ChatSessionRecord,
  ChatToolContext,
  ChatToolDeps,
  OfferedSlot,
} from "../lib/chat/types.ts";
import { EMPTY_CHAT_STATE } from "../lib/chat/types.ts";
import type { Lead } from "../lib/types.ts";

export function makeCtx(over: Partial<ChatToolContext> = {}) {
  const frames: ChatFrame[] = [];
  const ctx: ChatToolContext = {
    ip: "1.2.3.4",
    timezone: "America/New_York",
    attribution: {},
    sessionToken: null,
    bookingEnabled: true,
    emit: (f) => frames.push(f),
    ...over,
  };
  return { ctx, frames };
}

export function makeDeps(over: Partial<ChatToolDeps> = {}) {
  const sessions = new Map<string, ChatSessionRecord>();
  const created: Lead[] = [];
  const updated: { leadId: string; columns: Record<string, unknown> }[] = [];
  let n = 0;
  const deps: ChatToolDeps = {
    getSession: async (token) => sessions.get(token) ?? null,
    createSession: async ({ timezone }) => {
      n += 1;
      const s: ChatSessionRecord = {
        id: `sess-${n}`,
        token: `tok-${n}`,
        leadId: null,
        contact: {},
        answers: {},
        chatState: { ...EMPTY_CHAT_STATE },
        timezone,
        isTest: true,
      };
      sessions.set(s.token, s);
      return s;
    },
    patchSession: async (id, patch) => {
      for (const s of sessions.values()) {
        if (s.id !== id) continue;
        if (patch.contact) s.contact = patch.contact;
        if (patch.answers) s.answers = patch.answers;
        if (patch.leadId) s.leadId = patch.leadId;
        if (patch.chatState) s.chatState = patch.chatState;
      }
    },
    createLead: async (lead) => {
      created.push(lead);
      return { ok: true, leadId: `lead-${created.length}` };
    },
    updateLead: async (leadId, columns) => {
      updated.push({ leadId, columns });
    },
    schedulingAvailable: async () => true,
    appointmentType: async () => ({ id: "type-1", formats: ["phone", "google_meet"] }),
    listSlots: async () => [] as OfferedSlot[],
    hasActiveBooking: async () => false,
    now: () => new Date("2026-10-02T15:00:00.000Z"),
    ...over,
  };
  return { deps, sessions, created, updated };
}
```

- [ ] **Step 2: Write the failing test** (`tests/chat-tools-lead.test.ts`)

```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeCtx, makeDeps } from "./chat-tools-fakes.ts";

const { handleSaveLeadDetails } = await import("../lib/chat/tools/save-lead-details.ts");
const { ensureChatSession } = await import("../lib/chat/session.ts");

describe("ensureChatSession", () => {
  it("creates once, emits the token, then reuses it", async () => {
    const { ctx, frames } = makeCtx();
    const { deps } = makeDeps();
    const a = await ensureChatSession(ctx, deps);
    const b = await ensureChatSession(ctx, deps);
    assert.equal(a?.id, b?.id);
    assert.equal(ctx.sessionToken, a?.token);
    assert.deepEqual(frames, [{ t: "session", token: a?.token }]);
  });

  it("replaces an expired or unknown token with a fresh session", async () => {
    const { ctx } = makeCtx({ sessionToken: "stale" });
    const { deps } = makeDeps();
    const s = await ensureChatSession(ctx, deps);
    assert.equal(ctx.sessionToken, s?.token);
    assert.notEqual(ctx.sessionToken, "stale");
  });
});

describe("save_lead_details", () => {
  it("rejects invalid input with a readable message", async () => {
    const { ctx } = makeCtx();
    const { deps } = makeDeps();
    const out = await handleSaveLeadDetails({ timeline: "someday" }, ctx, deps);
    assert.match(out, /not saved/i);
  });

  it("saves partial details without creating a lead below the minimum", async () => {
    const { ctx, frames } = makeCtx();
    const { deps, created } = makeDeps();
    const out = await handleSaveLeadDetails({ name: "Ada Lovelace" }, ctx, deps);
    assert.equal(created.length, 0);
    assert.ok(!frames.some((f) => f.t === "lead"));
    assert.match(out, /email or phone/i);
  });

  it("merges across calls: one lead created, later calls update the same row", async () => {
    const { ctx, frames } = makeCtx();
    const { deps, created, updated } = makeDeps();
    await handleSaveLeadDetails({ name: "Ada Lovelace", phone: "781-555-0100" }, ctx, deps);
    await handleSaveLeadDetails({ email: "ada@x.com", business_name: "Glow" }, ctx, deps);
    assert.equal(created.length, 1);
    assert.equal(created[0].source, "website_chat");
    assert.equal(updated.length, 1);
    assert.equal(updated[0].leadId, "lead-1");
    assert.equal(updated[0].columns.email, "ada@x.com");
    assert.equal("lead_score" in updated[0].columns, false);
    assert.equal(frames.filter((f) => f.t === "lead").length, 1);
  });

  it("reports what booking still needs", async () => {
    const { ctx } = makeCtx();
    const { deps } = makeDeps();
    const out = await handleSaveLeadDetails({ name: "Ada", email: "ada@x.com" }, ctx, deps);
    assert.match(out, /business name/);
    assert.match(out, /phone/);
  });

  it("creates the lead without a session when scheduling storage is unavailable", async () => {
    const { ctx, frames } = makeCtx();
    const { deps, created } = makeDeps({ createSession: async () => null });
    const out = await handleSaveLeadDetails({ name: "Ada", email: "ada@x.com" }, ctx, deps);
    assert.equal(created.length, 1);
    assert.ok(frames.some((f) => f.t === "lead"));
    assert.match(out, /lead saved/i);
  });

  it("tells the model to fall back to the contact form when the store fails", async () => {
    const { ctx } = makeCtx();
    const { deps } = makeDeps({ createLead: async () => ({ ok: false }) });
    const out = await handleSaveLeadDetails({ name: "Ada", email: "ada@x.com" }, ctx, deps);
    assert.match(out, /contact form/i);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test tests/chat-tools-lead.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `lib/chat/session.ts`**

```ts
import type { ChatSessionRecord, ChatToolContext, ChatToolDeps } from "./types.ts";

/**
 * Resolve this conversation's booking session, creating it on first need.
 * The token lives only in ctx and the session frame, never in model context.
 */
export async function ensureChatSession(
  ctx: ChatToolContext,
  deps: ChatToolDeps,
): Promise<ChatSessionRecord | null> {
  if (ctx.sessionToken) {
    const existing = await deps.getSession(ctx.sessionToken);
    if (existing) return existing;
  }
  const created = await deps.createSession({
    ip: ctx.ip,
    timezone: ctx.timezone,
    attribution: ctx.attribution,
  });
  if (!created) return null;
  ctx.sessionToken = created.token;
  ctx.emit({ t: "session", token: created.token });
  return created;
}
```

- [ ] **Step 5: Implement `lib/chat/tools/save-lead-details.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ChatToolContext, ChatToolDeps } from "../types.ts";
import { ensureChatSession } from "../session.ts";
import {
  buildChatLead,
  leadUpdateColumns,
  meetsLeadMinimum,
  mergeAnswers,
  mergeContact,
  missingForBooking,
  type SaveLeadInput,
} from "../contact.ts";

const text = (max: number) => z.string().max(max).optional();

const schema = z
  .object({
    name: text(120),
    business_name: text(160),
    email: text(254),
    phone: text(40),
    website: text(200),
    industry: text(80),
    employee_count: text(40),
    biggest_problem: text(2000),
    desired_result: text(500),
    timeline: z.enum(["Immediately", "This month", "Next 90 days", "Just exploring"]).optional(),
    preferred_contact: z.enum(["Call", "Text", "Email"]).optional(),
  })
  .strict();

export const SAVE_LEAD_DETAILS_TOOL: Anthropic.Tool = {
  name: "save_lead_details",
  description:
    "Save details the visitor has shared so the RSG team can follow up. Call it whenever new details arrive; it is safe to call repeatedly and only the fields you pass are updated. A lead is created once there is a name plus an email or phone. Never invent values; only pass what the visitor said.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The visitor's full name" },
      business_name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      website: { type: "string" },
      industry: { type: "string", description: "e.g. med spa, HVAC, law firm" },
      employee_count: { type: "string", description: "Rough team size, as they said it" },
      biggest_problem: { type: "string", description: "The main problem, in their words" },
      desired_result: { type: "string", description: "What they want to improve or achieve" },
      timeline: { type: "string", enum: ["Immediately", "This month", "Next 90 days", "Just exploring"] },
      preferred_contact: { type: "string", enum: ["Call", "Text", "Email"] },
    },
    additionalProperties: false,
  },
};

export async function handleSaveLeadDetails(
  input: unknown,
  ctx: ChatToolContext,
  deps: ChatToolDeps,
): Promise<string> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    return "Details not saved: some values were invalid. Only pass fields the visitor actually gave, using the allowed options.";
  }
  const fields: SaveLeadInput = parsed.data;
  const now = deps.now();
  const session = await ensureChatSession(ctx, deps);

  const contact = mergeContact(session?.contact ?? {}, fields);
  const answers = mergeAnswers(session?.answers ?? {}, fields);
  if (session) await deps.patchSession(session.id, { contact, answers });

  if (!meetsLeadMinimum(contact)) {
    return "Saved. Before RSG can follow up, ask for their name and an email or phone number.";
  }

  if (session?.leadId) {
    await deps.updateLead(session.leadId, leadUpdateColumns(contact, answers, ctx.attribution, now));
  } else {
    const result = await deps.createLead(buildChatLead(contact, answers, ctx.attribution, now));
    if (!result.ok) {
      return "Lead NOT saved: an internal error occurred. Apologize briefly and suggest the contact form in the Contact section instead.";
    }
    if (session && result.leadId) {
      await deps.patchSession(session.id, {
        leadId: result.leadId,
        chatState: { ...session.chatState, leadCreated: true },
      });
    }
    ctx.emit({ t: "lead" });
  }

  const missing = missingForBooking(contact);
  const bookingNote = !ctx.bookingEnabled
    ? "If they want a call, share /book."
    : missing.length
      ? `To book a call in this chat you still need: ${missing.join(", ")}.`
      : "Everything needed to book is on file; if they want a call, call get_open_slots.";
  return `Lead saved for the RSG team. ${bookingNote} Do not promise a specific response time.`;
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/chat-tools-lead.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/chat/session.ts lib/chat/tools/save-lead-details.ts tests/chat-tools-fakes.ts tests/chat-tools-lead.test.ts
git commit -m "chat: save_lead_details tool with lazy session and create-once lead

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `get_open_slots` + `propose_booking` + dispatcher

**Files:**
- Create: `lib/chat/tools/get-open-slots.ts`
- Create: `lib/chat/tools/propose-booking.ts`
- Create: `lib/chat/tools/index.ts`
- Test: `tests/chat-tools-booking.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 5, 6.
- Produces:
  - `GET_OPEN_SLOTS_TOOL`, `handleGetOpenSlots(input, ctx, deps): Promise<string>`
  - `PROPOSE_BOOKING_TOOL`, `handleProposeBooking(input, ctx, deps): Promise<string>`
  - `chatTools(bookingEnabled: boolean): Anthropic.Tool[]`
  - `dispatchChatTool(name: string, input: unknown, ctx, deps): Promise<string>`
  - `MAX_OFFERED_SLOTS = 6`
  - `sameInstant(a: string, b: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeCtx, makeDeps } from "./chat-tools-fakes.ts";

const { handleGetOpenSlots } = await import("../lib/chat/tools/get-open-slots.ts");
const { handleProposeBooking } = await import("../lib/chat/tools/propose-booking.ts");
const { chatTools, dispatchChatTool } = await import("../lib/chat/tools/index.ts");

const slots = Array.from({ length: 8 }, (_, i) => ({
  start: `2026-10-0${6 + (i % 3)}T1${i}:00:00.000Z`,
  end: `2026-10-0${6 + (i % 3)}T1${i}:15:00.000Z`,
  label: `Slot ${i}`,
}));

const fullContact = {
  firstName: "Ada", lastName: "Lovelace", businessName: "Glow",
  email: "ada@x.com", phone: "781-555-0100",
};

describe("get_open_slots", () => {
  it("offers at most 6, stores them on the session, emits a slots frame", async () => {
    const { ctx, frames } = makeCtx();
    const { deps, sessions } = makeDeps({ listSlots: async () => slots });
    const out = await handleGetOpenSlots({}, ctx, deps);
    const frame = frames.find((f) => f.t === "slots");
    assert.equal(frame?.t === "slots" && frame.slots.length, 6);
    const s = [...sessions.values()][0];
    assert.equal(s.chatState.offered.length, 6);
    assert.ok(s.chatState.offeredAt);
    assert.match(out, /Slot 0/);
    assert.match(out, /only these times/i);
  });

  it("paused or unavailable → fallback text, no frame", async () => {
    const { ctx, frames } = makeCtx();
    const { deps } = makeDeps({ schedulingAvailable: async () => false });
    const out = await handleGetOpenSlots({}, ctx, deps);
    assert.ok(!frames.some((f) => f.t === "slots"));
    assert.match(out, /\/book/);
  });

  it("no open slots → fallback text, no frame", async () => {
    const { ctx, frames } = makeCtx();
    const { deps } = makeDeps({ listSlots: async () => [] });
    const out = await handleGetOpenSlots({}, ctx, deps);
    assert.ok(!frames.some((f) => f.t === "slots"));
    assert.match(out, /\/book/);
  });
});

async function sessionWithOffer(over = {}) {
  const made = makeDeps({ listSlots: async () => slots.slice(0, 3), ...over });
  const { ctx, frames } = makeCtx();
  await handleGetOpenSlots({}, ctx, made.deps);
  const s = [...made.sessions.values()][0];
  s.contact = { ...fullContact };
  frames.length = 0;
  return { ...made, ctx, frames, session: s };
}

describe("propose_booking", () => {
  it("emits a confirm frame for an offered slot and writes nothing", async () => {
    const { ctx, frames, deps, created, updated } = await sessionWithOffer();
    const out = await handleProposeBooking({ start: slots[1].start, meeting_format: "google_meet" }, ctx, deps);
    const f = frames.find((x) => x.t === "confirm");
    assert.ok(f && f.t === "confirm");
    assert.equal(f.label, "Slot 1");
    assert.equal(f.format, "google_meet");
    assert.deepEqual(f.formats, ["phone", "google_meet"]);
    assert.equal(f.contact.email, "ada@x.com");
    assert.equal(created.length + updated.length, 0);
    assert.match(out, /must press confirm/i);
  });

  it("accepts the same instant written differently", async () => {
    const { ctx, frames, deps } = await sessionWithOffer();
    const sameInstant = new Date(slots[0].start).toISOString().replace(".000Z", "Z");
    await handleProposeBooking({ start: sameInstant }, ctx, deps);
    assert.ok(frames.some((f) => f.t === "confirm"));
  });

  it("rejects a start that was not offered", async () => {
    const { ctx, frames, deps } = await sessionWithOffer();
    const out = await handleProposeBooking({ start: "2026-10-20T14:00:00.000Z" }, ctx, deps);
    assert.ok(!frames.some((f) => f.t === "confirm"));
    assert.match(out, /not one of the offered/i);
  });

  it("rejects when contact details are missing", async () => {
    const { ctx, frames, deps, session } = await sessionWithOffer();
    session.contact = { firstName: "Ada", email: "ada@x.com" };
    const out = await handleProposeBooking({ start: slots[0].start }, ctx, deps);
    assert.ok(!frames.some((f) => f.t === "confirm"));
    assert.match(out, /business name/);
  });

  it("refuses when the session already has a booking", async () => {
    const { ctx, frames, deps } = await sessionWithOffer({ hasActiveBooking: async () => true });
    const out = await handleProposeBooking({ start: slots[0].start }, ctx, deps);
    assert.ok(!frames.some((f) => f.t === "confirm"));
    assert.match(out, /already booked/i);
  });

  it("refuses a format the appointment type does not allow", async () => {
    const { ctx, frames, deps } = await sessionWithOffer({
      appointmentType: async () => ({ id: "type-1", formats: ["phone"] }),
    });
    await handleProposeBooking({ start: slots[0].start, meeting_format: "google_meet" }, ctx, deps);
    const f = frames.find((x) => x.t === "confirm");
    assert.ok(f && f.t === "confirm" && f.format === "phone");
  });
});

describe("tool registry", () => {
  it("only registers save_lead_details when booking is disabled", () => {
    assert.deepEqual(chatTools(false).map((t) => t.name), ["save_lead_details"]);
    assert.deepEqual(chatTools(true).map((t) => t.name), ["save_lead_details", "get_open_slots", "propose_booking"]);
  });

  it("refuses booking tools when disabled even if the model calls them", async () => {
    const { ctx } = makeCtx({ bookingEnabled: false });
    const { deps } = makeDeps();
    assert.match(await dispatchChatTool("get_open_slots", {}, ctx, deps), /unknown tool/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/chat-tools-booking.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/chat/tools/get-open-slots.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { z } from "zod";
import type { ChatToolContext, ChatToolDeps } from "../types.ts";
import { ensureChatSession } from "../session.ts";
import { filterSlotsByPreference } from "../slot-filter.ts";

export const MAX_OFFERED_SLOTS = 6;
const WINDOW_DAYS = 14;

const FALLBACK =
  "Online scheduling is not available in this chat right now. Share the booking page /book, or the contact form in the Contact section.";

export const GET_OPEN_SLOTS_TOOL: Anthropic.Tool = {
  name: "get_open_slots",
  description:
    "Look up real open times for a free 15-minute fit call with RSG. Call it when the visitor wants to book. Pass their stated preference if they gave one. The times are shown to the visitor as buttons.",
  input_schema: {
    type: "object",
    properties: {
      day_preference: {
        type: "string",
        description: "Optional, e.g. 'Thursday', 'afternoon', 'next week'",
      },
    },
    additionalProperties: false,
  },
};

const schema = z.object({ day_preference: z.string().max(60).optional() }).strict();

export async function handleGetOpenSlots(
  input: unknown,
  ctx: ChatToolContext,
  deps: ChatToolDeps,
): Promise<string> {
  const parsed = schema.safeParse(input ?? {});
  const preference = parsed.success ? parsed.data.day_preference : undefined;

  if (!(await deps.schedulingAvailable())) return FALLBACK;
  const type = await deps.appointmentType();
  const session = await ensureChatSession(ctx, deps);
  if (!type || !session) return FALLBACK;

  const today = DateTime.fromJSDate(deps.now()).setZone(ctx.timezone);
  const all = await deps.listSlots({
    appointmentTypeId: type.id,
    from: today.toISODate()!,
    to: today.plus({ days: WINDOW_DAYS }).toISODate()!,
    timezone: ctx.timezone,
  });
  if (!all.length) return `There are no open times in the next two weeks. ${FALLBACK}`;

  const { slots: filtered, matched } = filterSlotsByPreference(all, preference, ctx.timezone, deps.now());
  const offered = filtered.slice(0, MAX_OFFERED_SLOTS);
  await deps.patchSession(session.id, {
    chatState: { ...session.chatState, offered, offeredAt: deps.now().toISOString() },
  });
  ctx.emit({ t: "slots", slots: offered, tz: ctx.timezone });

  const note = matched ? "" : "Nothing matched their preference, so these are the earliest times. Say so. ";
  const list = offered.map((s) => `${s.label} (start=${s.start})`).join("; ");
  return `${note}Open times, shown to the visitor as buttons: ${list}. Only these times exist; never offer others. Mention two or three briefly. When they pick one, call propose_booking with its start.`;
}
```

- [ ] **Step 4: Implement `lib/chat/tools/propose-booking.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ChatMeetingFormat, ChatToolContext, ChatToolDeps } from "../types.ts";
import { missingForBooking, toConfirmContact } from "../contact.ts";

export const PROPOSE_BOOKING_TOOL: Anthropic.Tool = {
  name: "propose_booking",
  description:
    "Show the visitor a confirmation card for one of the times get_open_slots returned. This does NOT book: the visitor must press Confirm on the card. Requires name, business name, email, and phone saved via save_lead_details.",
  input_schema: {
    type: "object",
    properties: {
      start: { type: "string", description: "The exact start value from get_open_slots" },
      meeting_format: { type: "string", enum: ["phone", "google_meet"] },
    },
    required: ["start"],
    additionalProperties: false,
  },
};

const schema = z
  .object({
    start: z.string().min(10).max(40),
    meeting_format: z.enum(["phone", "google_meet"]).optional(),
  })
  .strict();

/** Same instant regardless of ISO spelling ("…00.000Z" vs "…00Z"). */
export function sameInstant(a: string, b: string): boolean {
  const ta = Date.parse(a);
  return Number.isFinite(ta) && ta === Date.parse(b);
}

export async function handleProposeBooking(
  input: unknown,
  ctx: ChatToolContext,
  deps: ChatToolDeps,
): Promise<string> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return "Invalid request: pass the exact start value from get_open_slots.";

  const session = ctx.sessionToken ? await deps.getSession(ctx.sessionToken) : null;
  if (!session) return "No times have been offered in this conversation yet. Call get_open_slots first.";

  if (await deps.hasActiveBooking(session.id)) {
    return "This visitor is already booked. Tell them the confirmation email has a link to reschedule or cancel. Do not offer new times.";
  }

  const slot = session.chatState.offered.find((s) => sameInstant(s.start, parsed.data.start));
  if (!slot) {
    return "That start is not one of the offered times. Call get_open_slots and use one of the returned start values.";
  }

  const missing = missingForBooking(session.contact);
  if (missing.length) {
    return `Cannot show the confirmation yet. Ask for: ${missing.join(", ")}, then save them with save_lead_details.`;
  }

  const type = await deps.appointmentType();
  const formats = (type?.formats ?? ["phone"]) as ChatMeetingFormat[];
  const requested = parsed.data.meeting_format ?? "phone";
  const format = formats.includes(requested) ? requested : formats[0];

  ctx.emit({
    t: "confirm",
    start: slot.start,
    label: slot.label,
    format,
    formats,
    contact: toConfirmContact(session.contact),
  });
  return `A confirmation card for ${slot.label} is showing. The visitor must press Confirm on it. Do not say the call is booked; tell them to review the details and press Confirm.`;
}
```

- [ ] **Step 5: Implement `lib/chat/tools/index.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ChatToolContext, ChatToolDeps } from "../types.ts";
import { SAVE_LEAD_DETAILS_TOOL, handleSaveLeadDetails } from "./save-lead-details.ts";
import { GET_OPEN_SLOTS_TOOL, handleGetOpenSlots } from "./get-open-slots.ts";
import { PROPOSE_BOOKING_TOOL, handleProposeBooking } from "./propose-booking.ts";

export function chatTools(bookingEnabled: boolean): Anthropic.Tool[] {
  return bookingEnabled
    ? [SAVE_LEAD_DETAILS_TOOL, GET_OPEN_SLOTS_TOOL, PROPOSE_BOOKING_TOOL]
    : [SAVE_LEAD_DETAILS_TOOL];
}

export async function dispatchChatTool(
  name: string,
  input: unknown,
  ctx: ChatToolContext,
  deps: ChatToolDeps,
): Promise<string> {
  if (name === "save_lead_details") return handleSaveLeadDetails(input, ctx, deps);
  if (ctx.bookingEnabled && name === "get_open_slots") return handleGetOpenSlots(input, ctx, deps);
  if (ctx.bookingEnabled && name === "propose_booking") return handleProposeBooking(input, ctx, deps);
  return "Unknown tool.";
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/chat-tools-booking.test.ts && npm test`
Expected: PASS (11 new tests).

- [ ] **Step 7: Commit**

```bash
git add lib/chat/tools tests/chat-tools-booking.test.ts
git commit -m "chat: get_open_slots and propose_booking tools (propose never writes)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Extract `bookWithIntake`; `/api/booking/create` becomes a wrapper

**Files:**
- Create: `lib/scheduling/book-with-intake.ts`
- Modify: `app/api/booking/create/route.ts`
- Test: `tests/book-with-intake.test.ts`

**Interfaces:**
- Consumes: `submitIntake` (now with `source`), `createBooking`,
  `findBookingByIdempotencyKey`, `getSessionByToken`, lifecycle `onBookingCreated`.
- Produces:
```ts
export type BookWithIntakeInput = {
  sessionToken: string;
  appointmentTypeId: string;
  startsAt: string;
  meetingFormat: MeetingFormat;
  visitorTimezone: string;
  visitorNotes?: string;
  idempotencyKey?: string;
  intake?: { contact: IntakeContact; answers: IntakeAnswers; consent: boolean };
  source?: string;
};
export type BookWithIntakeResult =
  | { ok: true; bookingId: string; manageToken: string; replayed: boolean }
  | { ok: false; error: string; code: string };
export type BookWithIntakeDeps = {
  getSession(token: string): Promise<{ id: string } | null>;
  findByIdempotencyKey(key: string): Promise<{ bookingId: string; manageToken: string } | null>;
  submitIntake: typeof submitIntake;
  createBooking: typeof createBooking;
  afterBooked(input: { bookingId: string; sessionToken: string; startsAt: string; visitorTimezone: string }): Promise<void>;
};
export function bookWithIntake(input: BookWithIntakeInput, deps?: BookWithIntakeDeps): Promise<BookWithIntakeResult>;
export const realBookWithIntakeDeps: BookWithIntakeDeps;
```

- [ ] **Step 1: Write the failing test**

```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { bookWithIntake } = await import("../lib/scheduling/book-with-intake.ts");

function deps(over = {}) {
  const calls: string[] = [];
  const d = {
    getSession: async () => ({ id: "s1" }),
    findByIdempotencyKey: async () => null,
    submitIntake: async (i: { source?: string }) => { calls.push(`intake:${i.source}`); return { ok: true as const, leadId: "l1" }; },
    createBooking: async () => { calls.push("create"); return { ok: true as const, bookingId: "b1", manageToken: "m1" }; },
    afterBooked: async () => { calls.push("after"); },
    ...over,
  };
  return { d: d as never, calls };
}

const base = {
  sessionToken: "t".repeat(24),
  appointmentTypeId: "c0000000-0000-4000-8000-000000000001",
  startsAt: "2026-10-06T13:00:00.000Z",
  meetingFormat: "phone" as const,
  visitorTimezone: "America/New_York",
  intake: {
    contact: { fullName: "Ada L", businessName: "Glow", email: "a@x.com", phone: "7815550100", industry: "", website: "", preferredContact: "email" as const },
    answers: {},
    consent: true,
  },
  source: "website_chat",
};

describe("bookWithIntake", () => {
  it("runs intake → booking → lifecycle in order, passing source", async () => {
    const { d, calls } = deps();
    const r = await bookWithIntake(base, d);
    assert.deepEqual(r, { ok: true, bookingId: "b1", manageToken: "m1", replayed: false });
    assert.deepEqual(calls, ["intake:website_chat", "create", "after"]);
  });

  it("an idempotent replay returns the first booking and runs nothing else", async () => {
    const { d, calls } = deps({ findByIdempotencyKey: async () => ({ bookingId: "b0", manageToken: "m0" }) });
    const r = await bookWithIntake({ ...base, idempotencyKey: "k1" }, d);
    assert.deepEqual(r, { ok: true, bookingId: "b0", manageToken: "m0", replayed: true });
    assert.deepEqual(calls, []);
  });

  it("an expired session → code session", async () => {
    const { d } = deps({ getSession: async () => null });
    const r = await bookWithIntake(base, d);
    assert.deepEqual(r, { ok: false, error: "Session expired.", code: "session" });
  });

  it("passes a booking conflict through without running lifecycle", async () => {
    const { d, calls } = deps({
      createBooking: async () => ({ ok: false as const, error: "taken", code: "conflict" }),
    });
    const r = await bookWithIntake(base, d);
    assert.equal(r.ok === false && r.code, "conflict");
    assert.ok(!calls.includes("after"));
  });

  it("a lifecycle failure never fails the booking", async () => {
    const { d } = deps({ afterBooked: async () => { throw new Error("email down"); } });
    const r = await bookWithIntake(base, d);
    assert.equal(r.ok, true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/book-with-intake.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/scheduling/book-with-intake.ts`**

Move the lifecycle block from `app/api/booking/create/route.ts` (the `try { const fresh =
await getSessionByToken(...) … onBookingCreated(...) } catch` section) into
`realAfterBooked`, unchanged except for its input names:
```ts
import { createBooking, findBookingByIdempotencyKey } from "./booking";
import { getSessionByToken } from "./sessions";
import { submitIntake } from "./intake";
import { sessionContactName } from "./intake-schema";
import type { IntakeAnswers, IntakeContact } from "./intake-schema";
import type { MeetingFormat } from "./types";

// (types from Interfaces above)

async function realAfterBooked(input: {
  bookingId: string;
  sessionToken: string;
  startsAt: string;
  visitorTimezone: string;
}): Promise<void> {
  const fresh = await getSessionByToken(input.sessionToken);
  const contact = (fresh?.contact ?? {}) as {
    firstName?: string; lastName?: string; name?: string; email?: string; businessName?: string;
  };
  if (!contact.email) return;
  const { onBookingCreated } = await import("@/lib/lifecycle/orchestrate");
  const { serviceCategoryForSlug } = await import("@/lib/lifecycle/category-map");
  let serviceSlug: string | null = null;
  if (fresh?.service_id) {
    const { getSupabase } = await import("@/lib/supabase");
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.from("services").select("slug").eq("id", fresh.service_id).maybeSingle();
      serviceSlug = (data?.slug as string | undefined) ?? null;
    }
  }
  await onBookingCreated({
    bookingId: input.bookingId,
    leadId: fresh?.lead_id ?? null,
    email: contact.email,
    name: sessionContactName(contact),
    businessName: contact.businessName,
    appointmentStartsAt: input.startsAt,
    appointmentTimeLocal: new Date(input.startsAt).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: input.visitorTimezone,
    }),
    serviceCategory: serviceCategoryForSlug(serviceSlug),
  });
}

export const realBookWithIntakeDeps: BookWithIntakeDeps = {
  getSession: getSessionByToken,
  findByIdempotencyKey: findBookingByIdempotencyKey,
  submitIntake,
  createBooking,
  afterBooked: realAfterBooked,
};

/**
 * Intake → booking → lifecycle, shared by /api/booking/create and
 * /api/chat/book. An idempotent retry returns the original booking before
 * anything else runs (re-running intake would log a second intake_completed;
 * re-running lifecycle would repeat its side effects).
 */
export async function bookWithIntake(
  input: BookWithIntakeInput,
  deps: BookWithIntakeDeps = realBookWithIntakeDeps,
): Promise<BookWithIntakeResult> {
  const session = await deps.getSession(input.sessionToken);
  if (!session) return { ok: false, error: "Session expired.", code: "session" };

  if (input.idempotencyKey) {
    const existing = await deps.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { ok: true, ...existing, replayed: true };
  }

  if (input.intake) {
    const intake = await deps.submitIntake({
      sessionToken: input.sessionToken,
      contact: input.intake.contact,
      answers: input.intake.answers,
      consent: input.intake.consent,
      source: input.source,
    });
    if (!intake.ok) return { ok: false, error: intake.error, code: intake.code };
  }

  const result = await deps.createBooking({
    sessionId: session.id,
    sessionToken: input.sessionToken,
    appointmentTypeId: input.appointmentTypeId,
    startsAt: input.startsAt,
    meetingFormat: input.meetingFormat,
    visitorTimezone: input.visitorTimezone,
    visitorNotes: input.visitorNotes,
    idempotencyKey: input.idempotencyKey,
  });
  if (!result.ok) return { ok: false, error: result.error, code: result.code ?? "error" };

  try {
    await deps.afterBooked({
      bookingId: result.bookingId,
      sessionToken: input.sessionToken,
      startsAt: input.startsAt,
      visitorTimezone: input.visitorTimezone,
    });
  } catch (err) {
    console.error("[booking] lifecycle hook failed", err);
  }
  return { ok: true, bookingId: result.bookingId, manageToken: result.manageToken, replayed: false };
}
```

- [ ] **Step 4: Make `/api/booking/create` a thin wrapper**

In `app/api/booking/create/route.ts`, keep the `schema`, `bookingResponse`, the 503 check,
the rate limit and the error `catch`. Replace everything from `const session = await
getSessionByToken(...)` through the lifecycle `try/catch` with:
```ts
    const result = await bookWithIntake({
      sessionToken: body.sessionToken,
      appointmentTypeId: body.appointmentTypeId,
      startsAt: body.startsAt,
      meetingFormat: body.meetingFormat,
      visitorTimezone: body.visitorTimezone,
      visitorNotes: body.visitorNotes,
      idempotencyKey:
        body.idempotencyKey || request.headers.get("idempotency-key") || undefined,
      intake: body.intake,
    });

    if (!result.ok) {
      const status =
        result.code === "session" ? 401
        : result.code === "conflict" ? 409
        : result.code === "not_eligible" ? 403
        : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }
    return NextResponse.json(bookingResponse(result.bookingId, result.manageToken, body));
```
Remove the imports this leaves unused (`createBooking`, `findBookingByIdempotencyKey`,
`getSessionByToken`, `submitIntake`, `sessionContactName`). Keep the intake schema imports.

Behavior notes, so a reviewer can check them against the old route:
- An expired session was `{error:"Session expired."}` 401 with no code; it now includes
  `code: "session"`. That is additive.
- A failed intake was 400 with `{error, code}`. `submitIntake` codes are `consent` and
  `session`, so a session-expired intake now maps to 401 instead of 400. Accept that; it is
  more correct.

- [ ] **Step 5: Run the tests and gates**

Run: `node --test tests/book-with-intake.test.ts && npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/scheduling/book-with-intake.ts app/api/booking/create/route.ts tests/book-with-intake.test.ts
git commit -m "scheduling: extract bookWithIntake from /api/booking/create

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `confirmChatBooking` + `/api/chat/book`

**Files:**
- Create: `lib/chat/confirm.ts`
- Create: `app/api/chat/book/route.ts`
- Test: `tests/chat-confirm.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 5 `toIntakeContact`/`toIntakeAnswers`/`missingForBooking`,
  Task 7 `sameInstant`, Task 8 `bookWithIntake` types.
- Produces:
```ts
export type ConfirmInput = { chatSession: string; start: string; meetingFormat: string; consent: boolean; idempotencyKey: string };
export type ConfirmDeps = {
  getSession(token: string): Promise<ChatSessionRecord | null>;
  hasActiveBooking(sessionId: string): Promise<boolean>;
  appointmentType(): Promise<{ id: string; formats: ChatMeetingFormat[] } | null>;
  book(input: BookWithIntakeInput): Promise<BookWithIntakeResult>;
  bookingLinks(bookingId: string): Promise<{ google: string; outlook: string; office365: string } | null>;
  siteUrl(): string;
};
export type ConfirmResult =
  | { status: 200; body: { ok: true; label: string; email: string; manageUrl: string; calendarLinks: { google: string; outlook: string; office365: string } | null } }
  | { status: 400 | 401 | 403 | 409 | 500; body: { error: string; code: string } };
export function confirmChatBooking(input: unknown, deps: ConfirmDeps): Promise<ConfirmResult>;
```

- [ ] **Step 1: Write the failing test**

```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CHAT_STATE } from "../lib/chat/types.ts";

const { confirmChatBooking } = await import("../lib/chat/confirm.ts");

const OFFER = { start: "2026-10-06T13:00:00.000Z", end: "2026-10-06T13:15:00.000Z", label: "Tue, Oct 6, 9:00 AM" };
const session = () => ({
  id: "s1", token: "tok", leadId: "l1", timezone: "America/New_York", isTest: true, answers: {},
  contact: { firstName: "Ada", lastName: "L", businessName: "Glow", email: "a@x.com", phone: "7815550100" },
  chatState: { ...EMPTY_CHAT_STATE, offered: [OFFER] },
});

function deps(over = {}) {
  const booked: unknown[] = [];
  const d = {
    getSession: async () => session(),
    hasActiveBooking: async () => false,
    appointmentType: async () => ({ id: "type-1", formats: ["phone", "google_meet"] as ("phone" | "google_meet")[] }),
    book: async (i: unknown) => { booked.push(i); return { ok: true as const, bookingId: "b1", manageToken: "m1", replayed: false }; },
    bookingLinks: async () => ({ google: "g", outlook: "o", office365: "x" }),
    siteUrl: () => "https://example.com",
    ...over,
  };
  return { d, booked };
}

const body = { chatSession: "tok", start: OFFER.start, meetingFormat: "phone", consent: true, idempotencyKey: "k".repeat(20) };

describe("confirmChatBooking", () => {
  it("books an offered slot with source website_chat and returns links", async () => {
    const { d, booked } = deps();
    const r = await confirmChatBooking(body, d);
    assert.equal(r.status, 200);
    assert.equal(r.status === 200 && r.body.manageUrl, "https://example.com/booking/manage?token=m1");
    const call = booked[0] as { source: string; intake: { consent: boolean; contact: { fullName: string } } };
    assert.equal(call.source, "website_chat");
    assert.equal(call.intake.consent, true);
    assert.equal(call.intake.contact.fullName, "Ada L");
  });

  it("rejects missing consent", async () => {
    const { d, booked } = deps();
    const r = await confirmChatBooking({ ...body, consent: false }, d);
    assert.equal(r.status, 400);
    assert.equal(booked.length, 0);
  });

  it("rejects an unknown or expired session", async () => {
    const { d } = deps({ getSession: async () => null });
    assert.equal((await confirmChatBooking(body, d)).status, 401);
  });

  it("rejects a start that was not offered", async () => {
    const { d, booked } = deps();
    const r = await confirmChatBooking({ ...body, start: "2026-10-20T13:00:00.000Z" }, d);
    assert.equal(r.status, 400);
    assert.equal(booked.length, 0);
  });

  it("rejects a disallowed meeting format", async () => {
    const { d } = deps();
    assert.equal((await confirmChatBooking({ ...body, meetingFormat: "zoom" }, d)).status, 400);
  });

  it("rejects when already booked, asking bookWithIntake for a replay only", async () => {
    const calls: { replayOnly?: boolean }[] = [];
    const { d } = deps({
      hasActiveBooking: async () => true,
      book: async (i: { replayOnly?: boolean }) => {
        calls.push(i);
        return { ok: false as const, error: "Already booked.", code: "already_booked" };
      },
    });
    const r = await confirmChatBooking(body, d);
    assert.equal(r.status === 409 && r.body.code, "already_booked");
    assert.equal(calls[0].replayOnly, true);
  });

  it("an idempotent replay succeeds even though the session now has a booking", async () => {
    const { d } = deps({
      hasActiveBooking: async () => true,
      book: async () => ({ ok: true as const, bookingId: "b1", manageToken: "m1", replayed: true }),
    });
    // The replay check must run before the already-booked refusal.
    assert.equal((await confirmChatBooking(body, d)).status, 200);
  });

  it("maps a slot conflict to 409", async () => {
    const { d } = deps({ book: async () => ({ ok: false as const, error: "taken", code: "conflict" }) });
    const r = await confirmChatBooking(body, d);
    assert.equal(r.status === 409 && r.body.code, "conflict");
  });

  it("rejects malformed bodies", async () => {
    const { d } = deps();
    assert.equal((await confirmChatBooking({ nope: 1 }, d)).status, 400);
  });
});
```

The idempotent-replay test means `confirmChatBooking` cannot refuse an already-booked
session outright. A double-clicked Confirm, whose first request already booked, must get the
same success back. Design: when `hasActiveBooking` is true, still call `deps.book(...)`, but
with `replayOnly: true`. `bookWithIntake` then returns the replay if this idempotency key
made the booking, and otherwise stops **before any write** with `already_booked`. Add to
`BookWithIntakeInput`:
```ts
  /** Return the idempotent replay if there is one; otherwise stop before any write. */
  replayOnly?: boolean;
```
and in `bookWithIntake`, right after the idempotency check:
```ts
  if (input.replayOnly) return { ok: false, error: "Already booked.", code: "already_booked" };
```
Add a test to `tests/book-with-intake.test.ts`:
```ts
  it("replayOnly stops before any write when there is no replay", async () => {
    const { d, calls } = deps();
    const r = await bookWithIntake({ ...base, idempotencyKey: "k1", replayOnly: true }, d);
    assert.equal(r.ok === false && r.code, "already_booked");
    assert.deepEqual(calls, []);
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/chat-confirm.test.ts tests/book-with-intake.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `replayOnly` to `lib/scheduling/book-with-intake.ts`** as described
  above.

- [ ] **Step 4: Implement `lib/chat/confirm.ts`**

```ts
import { z } from "zod";
import type { BookWithIntakeInput, BookWithIntakeResult } from "@/lib/scheduling/book-with-intake";
import type { ChatMeetingFormat, ChatSessionRecord } from "./types.ts";
import { missingForBooking, toIntakeAnswers, toIntakeContact } from "./contact.ts";
import { sameInstant } from "./tools/propose-booking.ts";

// (ConfirmDeps / ConfirmResult types from Interfaces above)

const schema = z.object({
  chatSession: z.string().min(20).max(200),
  start: z.string().min(10).max(40),
  meetingFormat: z.string().max(40),
  consent: z.boolean(),
  idempotencyKey: z.string().min(16).max(120),
});

const fail = (status: 400 | 401 | 403 | 409 | 500, code: string, error: string): ConfirmResult => ({
  status,
  body: { error, code },
});

/**
 * The only chat path that writes a booking, reached by the visitor's click.
 * Re-validates everything propose_booking checked: client history and card
 * contents are untrusted.
 */
export async function confirmChatBooking(raw: unknown, deps: ConfirmDeps): Promise<ConfirmResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(400, "invalid", "Please try again.");
  const input = parsed.data;
  if (!input.consent) {
    return fail(400, "consent", "Please check the box so we can contact you about your appointment.");
  }

  const session: ChatSessionRecord | null = await deps.getSession(input.chatSession);
  if (!session) return fail(401, "session", "This chat session expired. Ask the assistant for times again.");

  const slot = session.chatState.offered.find((s) => sameInstant(s.start, input.start));
  if (!slot) return fail(400, "slot", "That time is no longer on offer. Ask the assistant for times again.");

  const type = await deps.appointmentType();
  if (!type) return fail(500, "type", "Scheduling is unavailable right now. Please use /book.");
  if (!type.formats.includes(input.meetingFormat as ChatMeetingFormat)) {
    return fail(400, "format", "Please choose phone or Google Meet.");
  }
  if (missingForBooking(session.contact).length) {
    return fail(400, "contact", "Some contact details are missing. Tell the assistant your name, business, email, and phone.");
  }

  const alreadyBooked = await deps.hasActiveBooking(session.id);
  const result = await deps.book({
    sessionToken: session.token,
    appointmentTypeId: type.id,
    startsAt: slot.start,
    meetingFormat: input.meetingFormat as ChatMeetingFormat,
    visitorTimezone: session.timezone ?? "America/New_York",
    idempotencyKey: input.idempotencyKey,
    intake: {
      contact: toIntakeContact(session.contact),
      answers: toIntakeAnswers(session.answers),
      consent: true,
    },
    source: "website_chat",
    replayOnly: alreadyBooked,
  });

  if (!result.ok) {
    if (result.code === "already_booked") {
      return fail(409, "already_booked", "You're already booked. Your confirmation email has a link to reschedule.");
    }
    if (result.code === "conflict") return fail(409, "conflict", result.error);
    if (result.code === "session") return fail(401, "session", result.error);
    if (result.code === "not_eligible") return fail(403, "not_eligible", result.error);
    return fail(400, result.code, result.error);
  }

  return {
    status: 200,
    body: {
      ok: true,
      label: slot.label,
      email: session.contact.email ?? "",
      manageUrl: `${deps.siteUrl()}/booking/manage?token=${result.manageToken}`,
      calendarLinks: await deps.bookingLinks(result.bookingId),
    },
  };
}
```

**Before writing the URL, verify the manage path.** Run `ls app/booking app/(marketing)/booking
2>/dev/null; grep -rn "manage?token\|/manage/" lib/scheduling/notifications.ts
lib/scheduling/booking.ts | head`. Use whatever path the confirmation email already uses. If
it differs from `/booking/manage?token=`, change both the code and the test assertion to
match.

- [ ] **Step 5: Implement `app/api/chat/book/route.ts`**

```ts
import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { confirmChatBooking } from "@/lib/chat/confirm";
import { realConfirmDeps } from "@/lib/chat/deps";

export const runtime = "nodejs";

/** Visitor-confirmed booking from the chat card. CSRF-checked by proxy.ts. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Scheduling is temporarily unavailable.", code: "unavailable" }, { status: 503 });
  }
  if (!(await rateLimit(`chat-book:${clientIp(request)}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "invalid" }, { status: 400 });
  }
  try {
    const result = await confirmChatBooking(body, realConfirmDeps());
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("[/api/chat/book]", err);
    return NextResponse.json({ error: "Unable to book right now.", code: "error" }, { status: 500 });
  }
}
```

`realConfirmDeps` arrives in Task 10. **Commit this route in Task 10**, not here, so every
commit typechecks. In this task, commit only `confirm.ts` and the tests.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/chat-confirm.test.ts tests/book-with-intake.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/chat/confirm.ts lib/scheduling/book-with-intake.ts tests/chat-confirm.test.ts tests/book-with-intake.test.ts
git commit -m "chat: confirmChatBooking re-validates the card server-side; replayOnly guard

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Real deps + route wiring + prompt + flag

**Files:**
- Create: `lib/chat/deps.ts`
- Create: `app/api/chat/book/route.ts` (code from Task 9, Step 5)
- Modify: `app/api/chat/route.ts`
- Modify: `lib/chat-knowledge.ts` (`RSG_BOOKING_PLAYBOOK`)
- Test: `tests/chat-knowledge.test.ts` (new, small)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `realChatToolDeps(): ChatToolDeps`
  - `realConfirmDeps(): ConfirmDeps`
  - `bookingEnabled(): boolean`

- [ ] **Step 1: Implement `lib/chat/deps.ts`**

```ts
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { rateLimit } from "@/lib/security";
import { processLead } from "@/lib/leads";
import { createBookingSession, getSessionByToken } from "@/lib/scheduling/sessions";
import { getAvailableSlots } from "@/lib/scheduling/slots";
import { getSettings } from "@/lib/scheduling/notifications";
import { listPublicAppointmentTypes } from "@/lib/scheduling/catalog";
import { calendarLinksForBooking } from "@/lib/scheduling/booking";
import { siteUrl } from "@/lib/scheduling/db";
import { bookWithIntake } from "@/lib/scheduling/book-with-intake";
import type { ConfirmDeps } from "./confirm";
import {
  CHAT_MEETING_FORMATS,
  EMPTY_CHAT_STATE,
  type ChatMeetingFormat,
  type ChatSessionRecord,
  type ChatState,
  type ChatToolDeps,
} from "./types";

export function bookingEnabled(): boolean {
  return process.env.CHAT_BOOKING_ENABLED !== "false";
}

function toRecord(row: Record<string, unknown>): ChatSessionRecord {
  const state = (row.chat_state ?? null) as Partial<ChatState> | null;
  return {
    id: row.id as string,
    token: row.token as string,
    leadId: (row.lead_id as string | null) ?? null,
    contact: (row.contact ?? {}) as ChatSessionRecord["contact"],
    answers: (row.answers ?? {}) as Record<string, unknown>,
    chatState: { ...EMPTY_CHAT_STATE, ...(state ?? {}) },
    timezone: (row.timezone as string | null) ?? null,
    isTest: Boolean(row.is_test),
  };
}

async function appointmentType() {
  const [first] = await listPublicAppointmentTypes();
  if (!first) return null;
  const formats = first.meeting_formats.filter((f): f is ChatMeetingFormat =>
    (CHAT_MEETING_FORMATS as readonly string[]).includes(f),
  );
  return { id: first.id, formats: formats.length ? formats : (["phone"] as ChatMeetingFormat[]) };
}

async function getSession(token: string) {
  if (!isSupabaseConfigured()) return null;
  const row = await getSessionByToken(token);
  return row ? toRecord(row as Record<string, unknown>) : null;
}

async function hasActiveBooking(sessionId: string) {
  const sb = getSupabase();
  if (!sb) return false;
  const { data } = await sb
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .in("status", ["confirmed", "rescheduled"])
    .limit(1);
  return Boolean(data?.length);
}

export function realChatToolDeps(): ChatToolDeps {
  return {
    getSession,
    async createSession({ ip, timezone, attribution }) {
      if (!isSupabaseConfigured()) return null;
      if (!(await rateLimit(`chat-session:${ip}`, 5, 24 * 60 * 60_000))) return null;
      const type = await appointmentType();
      const { token } = await createBookingSession({
        attribution,
        timezone,
        appointmentTypeId: type?.id,
      });
      const sb = getSupabase()!;
      await sb.from("booking_sessions").update({ chat_state: EMPTY_CHAT_STATE }).eq("token", token);
      return getSession(token);
    },
    async patchSession(id, patch) {
      const sb = getSupabase();
      if (!sb) return;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.contact) update.contact = patch.contact;
      if (patch.answers) update.answers = patch.answers;
      if (patch.leadId) update.lead_id = patch.leadId;
      if (patch.chatState) update.chat_state = patch.chatState;
      const { error } = await sb.from("booking_sessions").update(update).eq("id", id);
      if (error) throw error;
    },
    async createLead(lead) {
      const r = await processLead(lead);
      return { ok: r.storedInDatabase || r.storedLocally || r.emailed, leadId: r.leadId };
    },
    async updateLead(leadId, columns) {
      const sb = getSupabase();
      if (!sb) return;
      const { error } = await sb.from("leads").update(columns).eq("id", leadId);
      if (error) throw error;
    },
    async schedulingAvailable() {
      if (!isSupabaseConfigured()) return false;
      const settings = await getSettings();
      return !settings.bookings_paused;
    },
    appointmentType,
    async listSlots({ appointmentTypeId, from, to, timezone }) {
      return getAvailableSlots({ appointmentTypeId, from, to, visitorTimezone: timezone });
    },
    hasActiveBooking,
    now: () => new Date(),
  };
}

export function realConfirmDeps(): ConfirmDeps {
  return {
    getSession,
    hasActiveBooking,
    appointmentType,
    book: (input) => bookWithIntake(input),
    async bookingLinks(bookingId) {
      const sb = getSupabase();
      if (!sb) return null;
      const { data } = await sb
        .from("bookings")
        .select("starts_at, ends_at, meeting_format, appointment_types(name, public_description)")
        .eq("id", bookingId)
        .maybeSingle();
      return data ? calendarLinksForBooking(data as never) : null;
    },
    siteUrl,
  };
}
```

`processLead`'s `leadId` is the inserted row id. On a duplicate it is the earlier row's id,
which is the row we want to keep updating. Check `siteUrl()` in `lib/scheduling/db.ts` has
no trailing slash (`sed -n 34,40p lib/scheduling/db.ts`); if it has one, strip it in
`confirm.ts`.

- [ ] **Step 2: Create `app/api/chat/book/route.ts`** with the code from Task 9, Step 5.

- [ ] **Step 3: Rewire `app/api/chat/route.ts`**

1. **Remove:** `SUBMIT_LEAD_TOOL`, `QUALIFIED_LEAD_SENTINEL`, `handleSubmitLead`, and the
   now-unused imports (`processLead`, `scoreLead`, `isEmail`, `toStr`, `Lead`, the
   `Anthropic` type import if nothing else uses it).
2. **Imports:**
```ts
import { chatTools, dispatchChatTool } from "@/lib/chat/tools";
import { bookingEnabled, realChatToolDeps } from "@/lib/chat/deps";
import type { ChatToolContext } from "@/lib/chat/types";
```
3. **Body extras**, after `sanitizeMessages`:
```ts
  const chatSession =
    typeof body.chatSession === "string" && body.chatSession.length <= 200 ? body.chatSession : null;
  const timezone = validTimezone(body.timezone) ?? "America/New_York";
  const attribution = sanitizeAttribution(body.attribution);
```
with these helpers near `sanitizeMessages`:
```ts
function validTimezone(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 80) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return null;
  }
}

const ATTRIBUTION_KEYS = ["pageUrl", "referrer", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const;

function sanitizeAttribution(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const k of ATTRIBUTION_KEYS) {
    const val = (v as Record<string, unknown>)[k];
    if (typeof val === "string" && val) out[k] = val.slice(0, 500);
  }
  return out;
}
```
4. **The system prompt hand-off.** Replace the `/book` line:
```ts
  const enabled = bookingEnabled();
  const system = enabled
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\n\n# Booking\nIn-chat booking is off. When a visitor wants a call, share this exact path: /book`;
```
5. **The `streamText` call:** add `format: "frames"`, set `tools: chatTools(enabled)`, and
   replace `onTool`:
```ts
      onTool: async (name, input, emit) => {
        const ctx: ChatToolContext = {
          ip,
          timezone,
          attribution,
          sessionToken: toolSession.token,
          bookingEnabled: enabled,
          emit: (f) => emit(f),
        };
        const result = await dispatchChatTool(name, input, ctx, toolDeps);
        toolSession.token = ctx.sessionToken; // carry a newly created session into later rounds
        return result;
      },
```
   Declare `const toolDeps = realChatToolDeps();` and `const toolSession = { token: chatSession };`
   before the call.
6. **Response header:** `"Content-Type": "application/x-ndjson; charset=utf-8"`.
7. **Handoff paragraph in `SYSTEM_PROMPT`:** change "submitting details here via
   submit_lead" to "saving their details here with save_lead_details", and "collect their
   details with submit_lead" to "collect their details with save_lead_details".
8. **Header doc comment:** change "the submit_lead tool hands qualified visitors into the
   same lead pipeline as the contact form" to "tools in lib/chat/tools capture the lead and
   book a fit call; only the visitor's click on the confirmation card (POST /api/chat/book)
   writes a booking".

- [ ] **Step 4: Rewrite `RSG_BOOKING_PLAYBOOK`** in `lib/chat-knowledge.ts`

Replace the paragraphs from "If they choose to book and a booking link is configured…"
through "…call the submit_lead tool with everything gathered." **and** the "After the tool
succeeds" text that follows. Keep "Booking triggers" and the "Recommended response". New
text:
```
If they want to book, book it here in the chat. Collect what is missing conversationally, one or two details at a time, never as a list: name, business name, email, and phone are required to book. Save details with save_lead_details as soon as the visitor gives them, including fit details when they come up naturally: industry, rough team size, biggest problem, the result they want, timeline (Immediately, This month, Next 90 days, or Just exploring), and preferred contact method (Call, Text, or Email).

Once the required details are saved, call get_open_slots (pass their day or time preference if they gave one). The times appear as buttons; mention two or three in one sentence and let them pick. Never mention a time the tool did not return. When they pick, call propose_booking with that time's start value and their preferred format (phone or google_meet). A confirmation card appears; tell them to review it and press Confirm. Never say the call is booked: only the card books it.

If they would rather not book, save what they shared with save_lead_details and tell them the RSG team will review their business before following up. Do not promise a specific response time.

If the tools say scheduling is unavailable, share the booking page /book or the contact form in the Contact section.
```

- [ ] **Step 5: Write a guard test** (`tests/chat-knowledge.test.ts`)

```ts
import "./_alias.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { RSG_BOOKING_PLAYBOOK } = await import("../lib/chat-knowledge.ts");

describe("booking playbook", () => {
  it("names the new tools and never the removed one", () => {
    for (const t of ["save_lead_details", "get_open_slots", "propose_booking"]) {
      assert.ok(RSG_BOOKING_PLAYBOOK.includes(t), t);
    }
    assert.ok(!RSG_BOOKING_PLAYBOOK.includes("submit_lead"));
  });
  it("tells the model only the card books", () => {
    assert.match(RSG_BOOKING_PLAYBOOK, /Never say the call is booked/);
  });
});
```

- [ ] **Step 6: Gates**

Run: `npm run typecheck && npm run lint && npm test && grep -rn "submit_lead\|QUALIFIED_LEAD_SENTINEL" app lib`
Expected:
- the gates are clean
- the grep finds nothing in `app/` or `lib/` (the widget still has the sentinel until Task 11)

- [ ] **Step 7: Commit**

```bash
git add lib/chat/deps.ts app/api/chat/book/route.ts app/api/chat/route.ts lib/chat-knowledge.ts tests/chat-knowledge.test.ts
git commit -m "chat: wire lead + booking tools into /api/chat; NDJSON stream; /api/chat/book

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

The deployed widget would now break (it reads plain text), so Task 11 must land before any
deploy. The branch is not deployable between Tasks 10 and 11.

---

### Task 11: Widget: frames, slot picker, confirmation card

**Files:**
- Create: `lib/chat/widget-state.ts`
- Create: `components/chat/SlotPicker.tsx`
- Create: `components/chat/BookingConfirmCard.tsx`
- Modify: `components/ChatWidget.tsx`
- Modify: `lib/events.ts`
- Test: `tests/chat-widget-state.test.ts`

**Interfaces:**
- Consumes: `ChatFrame`, `OfferedSlot`, `ConfirmContact`, `ChatMeetingFormat`
  (Task 2); `createFrameParser` (Task 3); `/api/chat/book` response (Task 9).
- Produces:
```ts
export type UiAttachment =
  | { kind: "slots"; slots: OfferedSlot[]; used: boolean }
  | { kind: "confirm"; start: string; label: string; format: ChatMeetingFormat; formats: ChatMeetingFormat[]; contact: ConfirmContact }
  | { kind: "booked"; calendarLinks: { google: string; outlook: string; office365: string } | null; manageUrl: string };
export type WidgetMessage = { role: "user" | "assistant"; content: string; ui?: UiAttachment };
export function toHistory(messages: WidgetMessage[]): { role: "user" | "assistant"; content: string }[];
export function applyFrame(messages: WidgetMessage[], frame: ChatFrame): WidgetMessage[];
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyFrame, toHistory, type WidgetMessage } from "../lib/chat/widget-state.ts";

const start: WidgetMessage[] = [
  { role: "assistant", content: "greeting" },
  { role: "user", content: "hi" },
  { role: "assistant", content: "" },
];

describe("applyFrame", () => {
  it("appends text to the last assistant message", () => {
    const m = applyFrame(applyFrame(start, { t: "text", d: "Hel" }), { t: "text", d: "lo" });
    assert.equal(m[2].content, "Hello");
  });
  it("attaches slots to the streaming assistant message", () => {
    const slots = [{ start: "s", end: "e", label: "L" }];
    const m = applyFrame(start, { t: "slots", slots, tz: "UTC" });
    assert.deepEqual(m[2].ui, { kind: "slots", slots, used: false });
  });
  it("a confirm after slots goes into its own UI-only message", () => {
    let m = applyFrame(start, { t: "slots", slots: [], tz: "UTC" });
    m = applyFrame(m, { t: "confirm", start: "s", label: "L", format: "phone", formats: ["phone"], contact: { name: "A", business: "B", email: "e", phone: "p" } });
    assert.equal(m.length, 4);
    assert.equal(m[3].ui?.kind, "confirm");
    assert.equal(m[3].content, "");
  });
  it("error frames append text", () => {
    assert.equal(applyFrame(start, { t: "error", d: "oops" })[2].content, "oops");
  });
  it("session and lead frames don't change messages", () => {
    assert.equal(applyFrame(start, { t: "lead" }), start);
  });
});

describe("toHistory", () => {
  it("drops the greeting, UI-only messages and attachments", () => {
    const msgs: WidgetMessage[] = [
      { role: "assistant", content: "greeting" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "Here are times", ui: { kind: "slots", slots: [], used: false } },
      { role: "assistant", content: "", ui: { kind: "confirm", start: "s", label: "L", format: "phone", formats: ["phone"], contact: { name: "", business: "", email: "", phone: "" } } },
      { role: "user", content: "ok" },
    ];
    assert.deepEqual(toHistory(msgs), [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Here are times" },
      { role: "user", content: "ok" },
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/chat-widget-state.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/chat/widget-state.ts`**

```ts
import type { ChatFrame, ChatMeetingFormat, ConfirmContact, OfferedSlot } from "./types.ts";

// (UiAttachment / WidgetMessage types from Interfaces above)

/** Model history: skip the UI greeting (index 0) and UI-only messages. */
export function toHistory(messages: WidgetMessage[]) {
  return messages
    .slice(1)
    .filter((m) => m.content.trim() !== "")
    .map(({ role, content }) => ({ role, content }));
}

/** Fold one stream frame into the message list (pure; returns same array if unchanged). */
export function applyFrame(messages: WidgetMessage[], frame: ChatFrame): WidgetMessage[] {
  const last = messages[messages.length - 1];
  switch (frame.t) {
    case "text":
    case "error": {
      if (!last || last.role !== "assistant" || (last.ui && last.content === "")) {
        return [...messages, { role: "assistant", content: frame.d }];
      }
      return [...messages.slice(0, -1), { ...last, content: last.content + frame.d }];
    }
    case "slots":
    case "confirm": {
      const ui: UiAttachment =
        frame.t === "slots"
          ? { kind: "slots", slots: frame.slots, used: false }
          : { kind: "confirm", start: frame.start, label: frame.label, format: frame.format, formats: frame.formats, contact: frame.contact };
      if (last && last.role === "assistant" && !last.ui) {
        return [...messages.slice(0, -1), { ...last, ui }];
      }
      return [...messages, { role: "assistant", content: "", ui }];
    }
    default:
      return messages;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/chat-widget-state.test.ts`
Expected: PASS (6 tests). If "a confirm after slots" fails, check the `!last.ui` branch: a
confirm must not overwrite an existing slots attachment.

- [ ] **Step 5: Add the event names** to `lib/events.ts` `EventName`:

```ts
  | "chatbot_slots_shown"
  | "chatbot_slot_selected"
  | "chatbot_booking_confirmed"
  | "chatbot_booking_failed"
```

- [ ] **Step 6: Implement `components/chat/SlotPicker.tsx`**

```tsx
"use client";

import type { OfferedSlot } from "@/lib/chat/types";

/** Open times as buttons; picking one sends it as the visitor's reply. */
export function SlotPicker({
  slots,
  disabled,
  onPick,
}: {
  slots: OfferedSlot[];
  disabled: boolean;
  onPick: (slot: OfferedSlot) => void;
}) {
  return (
    <div role="group" aria-label="Open times" className="mt-3 flex flex-wrap gap-2">
      {slots.map((s) => (
        <button
          key={s.start}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="inline-flex min-h-11 items-center border border-white/15 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

The button styles match the existing quick replies in `ChatWidget.tsx` (`min-h-11` = 44px).
`components/ui` has no Button primitive (`Dialog`, `IconButton`, `Popover`, `ScrollRail`),
so matching the widget's own button classes is the established pattern.

- [ ] **Step 7: Implement `components/chat/BookingConfirmCard.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { postJson } from "@/lib/api";
import type { ChatMeetingFormat, ConfirmContact } from "@/lib/chat/types";

const FORMAT_LABEL: Record<ChatMeetingFormat, string> = { phone: "Phone call", google_meet: "Google Meet" };

export type BookedResult = {
  label: string;
  email: string;
  manageUrl: string;
  calendarLinks: { google: string; outlook: string; office365: string } | null;
};

type Status = "idle" | "submitting" | "error";

export function BookingConfirmCard(props: {
  chatSession: string | null;
  start: string;
  label: string;
  format: ChatMeetingFormat;
  formats: ChatMeetingFormat[];
  contact: ConfirmContact;
  onBooked: (r: BookedResult) => void;
  onConflict: () => void;
  onFailed: (code: string) => void;
}) {
  const [format, setFormat] = useState(props.format);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  async function confirm() {
    if (!consent) {
      setError("Please check the box so we can contact you about your appointment.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await postJson("/api/chat/book", {
        chatSession: props.chatSession,
        start: props.start,
        meetingFormat: format,
        consent,
        idempotencyKey: idempotencyKey.current,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        props.onBooked(data as BookedResult);
        return;
      }
      setStatus("error");
      setError(data.error ?? "Something went wrong. Please try again.");
      if (data.code === "conflict") props.onConflict();
      else props.onFailed(String(data.code ?? res.status));
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
      props.onFailed("network");
    }
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label={`Confirm your call on ${props.label}`}
      className="mt-3 space-y-3 border border-white/15 p-4 text-sm text-white/75 focus:outline-hidden"
    >
      <p className="text-white">{props.label}</p>
      <p className="text-xs text-white/50">
        15-minute fit call with RSG, free. {props.contact.name}, {props.contact.business}
        <br />
        {props.contact.email} · {props.contact.phone}
      </p>

      {props.formats.length > 1 && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Meeting format</legend>
          {props.formats.map((f) => (
            <label
              key={f}
              className={`inline-flex min-h-11 cursor-pointer items-center border px-3 py-2 text-xs ${
                format === f ? "border-white/50 text-white" : "border-white/15 text-white/60"
              }`}
            >
              <input
                type="radio"
                name={`fmt-${props.start}`}
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="sr-only"
              />
              {FORMAT_LABEL[f]}
            </label>
          ))}
        </fieldset>
      )}

      <label className="flex items-start gap-2 text-xs text-white/60">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4"
          aria-invalid={error && !consent ? true : undefined}
        />
        <span>
          I agree to be contacted about this appointment and consent to the{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link> and{" "}
          <Link href="/terms" className="underline">Terms</Link>.
        </span>
      </label>

      {error && <p role="alert" className="text-xs text-crimson-light">{error}</p>}

      <button
        type="button"
        onClick={() => void confirm()}
        disabled={status === "submitting"}
        className="inline-flex min-h-11 w-full items-center justify-center border border-white/30 px-4 py-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:border-white/60 disabled:opacity-40"
      >
        {status === "submitting" ? "Booking" : "Confirm booking"}
      </button>
    </div>
  );
}
```

The consent copy is the `BookingFunnel.tsx` wording verbatim. Check that the `crimson-light`
color token exists (`grep -rn "crimson-light" app/globals.css components/ChatWidget.tsx`;
the widget's cursor already uses it).

- [ ] **Step 8: Rewire `components/ChatWidget.tsx`**

1. **Delete** `QUALIFIED_LEAD_SENTINEL` and its handling. `ChatMessage` becomes
   `WidgetMessage` (import from `@/lib/chat/widget-state`). Import `applyFrame`,
   `toHistory`, `createFrameParser`, `SlotPicker`, `BookingConfirmCard`, `BookedResult`.
2. **Add state:**
```tsx
const [chatSession, setChatSession] = useState<string | null>(null);
const [announce, setAnnounce] = useState("");
useEffect(() => {
  try {
    setChatSession(sessionStorage.getItem("rsg_chat_session"));
  } catch {
    /* storage blocked: session lives in memory only */
  }
}, []);
function rememberSession(token: string) {
  setChatSession(token);
  try {
    sessionStorage.setItem("rsg_chat_session", token);
  } catch {
    /* ignore */
  }
}
```
3. **In `send`**, compute `history` as `WidgetMessage[]`. Post:
```tsx
const res = await postJson("/api/chat", {
  messages: toHistory(history),
  chatSession,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  attribution: { pageUrl: window.location.href, referrer: document.referrer },
});
```
   Replace the read loop body:
```tsx
setMessages((m) => [...m, { role: "assistant", content: "" }]);
const reader = res.body.getReader();
const decoder = new TextDecoder();
const parser = createFrameParser();
const handle = (frames: ChatFrame[]) => {
  for (const f of frames) {
    if (f.t === "session") rememberSession(f.token);
    if (f.t === "lead") trackEvent("chatbot_qualified_lead");
    if (f.t === "slots") trackEvent("chatbot_slots_shown", { count: String(f.slots.length) });
  }
  setMessages((m) => frames.reduce(applyFrame, m));
};
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  handle(parser.push(decoder.decode(value, { stream: true })));
}
handle(parser.flush());
```
   Leave the existing message cap check (`messages.length > 40`) as is.
4. **Slot pick** (marks the set used, then sends):
```tsx
function pickSlot(index: number, label: string) {
  trackEvent("chatbot_slot_selected");
  setMessages((m) =>
    m.map((msg, i) =>
      i === index && msg.ui?.kind === "slots" ? { ...msg, ui: { ...msg.ui, used: true } } : msg,
    ),
  );
  void send(`${label} works for me.`);
}
```
   Note: `send` reads `messages` from its closure. Because `setMessages` above is
   asynchronous, `send` may build `history` from the pre-update list. That is fine: `used`
   is UI-only and `toHistory` strips `ui`.
5. **Booked handler:**
```tsx
function onBooked(index: number, r: BookedResult) {
  trackEvent("chatbot_booking_confirmed");
  setAnnounce("Booking confirmed");
  setMessages((m) => [
    ...m.filter((_, i) => i !== index),
    {
      role: "assistant",
      content: `You're booked for ${r.label}. A confirmation with calendar and manage links is on its way to ${r.email}.`,
      ui: { kind: "booked", calendarLinks: r.calendarLinks, manageUrl: r.manageUrl },
    },
  ]);
}
```
6. **Rendering:** under the assistant `<p>`, render by `m.ui?.kind`:
   - `"slots"`: `<SlotPicker slots={m.ui.slots} disabled={busy || m.ui.used} onPick={(s) => pickSlot(i, s.label)} />`
   - `"confirm"`: `<BookingConfirmCard key={m.ui.start} chatSession={chatSession} {...m.ui} onBooked={(r) => onBooked(i, r)} onConflict={() => void send("That time was just taken. What else is open?")} onFailed={(code) => trackEvent("chatbot_booking_failed", { code })} />`
   - `"booked"`: a row of links (Google, Outlook, Office 365 when `calendarLinks` is
     present, plus "Manage booking" → `manageUrl`), each `target="_blank" rel="noopener
     noreferrer"` with `LINK_CLASS`
   - Skip the `<p>` entirely when `m.content === ""`, so UI-only messages render no empty
     bubble.
   - Keep the streaming cursor condition as is.
7. **Live region:** add `<p aria-live="polite" className="sr-only">{announce}</p>` inside
   the dialog.

- [ ] **Step 9: Gates and a local smoke test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean, all green.

Then `npm run dev` (with `.env.local`, which has prod Supabase and the Anthropic key). Open
`http://localhost:3000` and the chat, and type "Book a strategy call".

Expected:
- the bot asks for details
- after giving name, business, email (use `+chattest` addressing) and phone, slot buttons
  appear
- clicking one shows the confirmation card

**Do not press Confirm here**; that is Task 12. Check at 400px width that the buttons wrap
and the card does not overflow. Check that the sentinel is gone:
`grep -rn "2063\|SENTINEL" components lib app`.

- [ ] **Step 10: Commit**

```bash
git add lib/chat/widget-state.ts components/chat components/ChatWidget.tsx lib/events.ts tests/chat-widget-state.test.ts
git commit -m "chat widget: NDJSON frames, slot picker, in-chat booking confirmation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Prod migration, end-to-end run, cleanup

**Files:** none (verification). Note results in the final report.

- [ ] **Step 1: Apply the migration to prod.** Use the Supabase MCP `apply_migration` on
  project `dyajmgddsiqcnlehqbhl`, named `booking_sessions_chat_state`, with the SQL from
  Task 2. Then verify:

```sql
select column_name, data_type, is_nullable from information_schema.columns
where table_schema='public' and table_name='booking_sessions' and column_name='chat_state';
```
Expected: one row, `jsonb`, `YES`.

- [ ] **Step 2: Run the end-to-end chat** (local dev against prod, as in Task 11 Step 9).
  Use an email like `joseph+chate2e@…`, an obviously fake business "E2E Chat Test Co", and
  a slot at least 3 weeks out if one is offered (ask for "next week", or the latest slot
  shown).
  - Press **Confirm** without consent → the inline error shows and no request is sent.
  - Tick consent → Confirm → the booked message and calendar links appear.
  - Press Confirm again by re-sending a propose: ask "can you book that again?" → the bot
    says already booked.

- [ ] **Step 3: Verify the rows**

```sql
select id, source, email, rule_score, lead_score, status from leads where email ilike 'joseph+chate2e%';
select b.id, b.status, b.starts_at, b.meeting_format, s.chat_state->'offered' is not null as offered
  from bookings b join booking_sessions s on s.id=b.session_id
  where s.lead_id in (select id from leads where email ilike 'joseph+chate2e%');
select event_type, created_at from scheduling_events
  where session_id in (select session_id from bookings where lead_id in (select id from leads where email ilike 'joseph+chate2e%'))
  order by created_at;
```
Expected:
- exactly **one** lead with `source = website_chat`
- one booking, `confirmed`
- `intake_started`, `intake_completed` and booking events present
- the owner notification and confirmation emails show in the Resend log or the
  notification log table

- [ ] **Step 4: Clean up the test rows.** Take note of the ids first, then delete the
  bookings, the reminder or email jobs keyed to that booking, consent_records,
  scheduling_events, activity rows, lead_ai_insights, the session and the lead. Follow
  the same order used in the call-proposal cleanup. Start by reading the FK-dependent
  tables:

```sql
select conrelid::regclass, conname from pg_constraint
where confrelid in ('public.bookings'::regclass, 'public.leads'::regclass, 'public.booking_sessions'::regclass) and contype='f';
```
Delete children before parents, then re-run the Step 3 queries and expect zero rows.

- [ ] **Step 5: Final gates and handoff**

Run: `npm run typecheck && npm run lint && npm test && npx next build --webpack`
Expected: all clean.

Report:
- test count vs baseline
- E2E result
- the cleanup done
- that the prod deploy (`npx vercel deploy --prod` from a clean worktree) is Joseph's step
- that `CHAT_BOOKING_ENABLED=false` is the kill switch
