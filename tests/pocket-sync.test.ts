import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  extractSummary,
  extractTranscript,
  parseAudioUrl,
  parseListPage,
  parsePocketRecording,
  pocketStatus,
  webhookRecordingId,
} from "../lib/pocket/parse.ts";
import { pocketTimestamp, verifyPocketSignature } from "../lib/pocket/signature.ts";

// Envelope from the public docs (docs.heypocketai.com/docs/api), with the
// transcript/summarization bodies in the shape the Pocket app uses.
const recording = {
  id: "rec_123",
  title: "Discovery call",
  duration: 1834.2,
  language: "en",
  recording_at: "2026-09-28T15:00:00Z",
  updated_at: "2026-09-28T15:40:00Z",
  state: "completed",
  tags: [{ id: "t1", name: "Sales", color: "#f00" }],
  transcript: {
    segments: [
      { text: "Thanks for jumping on.", start: 0, end: 2.1, speaker: "Joseph" },
      { text: "Happy to. Our leads go cold.", start: 2.4, end: 5, speaker: "Dana" },
    ],
  },
  summarizations: {
    s_old: {
      created_at: "2026-09-28T15:10:00Z",
      v2: { summary: { markdown: "old" } },
    },
    s_new: {
      created_at: "2026-09-28T15:35:00Z",
      v2: {
        summary: { markdown: "## Overview\n- Leads go cold after 24h" },
        actionItems: {
          items: [
            { title: "Send proposal", assignee: "Joseph", due_date: "2026-10-01" },
            "Book follow-up",
            { nothing: true },
          ],
        },
      },
    },
  },
  transcript_error: "",
  summarizations_errors: [],
};

test("parsePocketRecording maps the documented envelope", () => {
  const p = parsePocketRecording(recording);
  assert.ok(p);
  assert.equal(p.pocketId, "rec_123");
  assert.equal(p.title, "Discovery call");
  assert.equal(p.durationSeconds, 1834.2);
  assert.equal(p.recordedAt, "2026-09-28T15:00:00Z");
  assert.deepEqual(p.tags, ["Sales"]);
  assert.equal(p.segments.length, 2);
  assert.equal(p.transcript, "Joseph: Thanks for jumping on.\nDana: Happy to. Our leads go cold.");
  // Newest summarization wins; object action items are flattened with owner/due.
  assert.equal(p.summary, "## Overview\n- Leads go cold after 24h");
  assert.deepEqual(p.actionItems, [
    "Send proposal (owner: Joseph, due: 2026-10-01)",
    "Book follow-up",
  ]);
  assert.equal(pocketStatus(p), "ready");
});

test("extractTranscript handles string, nested app shape and bare arrays", () => {
  assert.equal(extractTranscript({ transcript: "  hello  " }).text, "hello");
  assert.equal(
    extractTranscript({ transcription: { transcription: { text: "from app api" } } }).text,
    "from app api",
  );
  const arr = extractTranscript({ transcript: [{ text: "a" }, { content: "b", speaker_name: "S" }] });
  assert.equal(arr.text, "a\nS: b");
  assert.deepEqual(extractTranscript({ transcript: null }), { text: "", segments: [] });
});

test("extractSummary handles arrays, plain strings and missing data", () => {
  assert.deepEqual(
    extractSummary({ summarizations: [{ summary: "Plain", action_items: ["Do it"] }] }),
    { summary: "Plain", actionItems: ["Do it"] },
  );
  assert.deepEqual(extractSummary({ summarizations: null }), { summary: "", actionItems: [] });
  assert.deepEqual(extractSummary({ summary: { markdown: "md" } }), { summary: "md", actionItems: [] });
});

test("pocketStatus: processing until a transcript, failed on errors", () => {
  assert.equal(pocketStatus({ transcript: "", state: "processing", error: "" }), "processing");
  assert.equal(pocketStatus({ transcript: "", state: "failed", error: "" }), "failed");
  assert.equal(pocketStatus({ transcript: "", state: "", error: "ASR error" }), "failed");
  assert.equal(pocketStatus({ transcript: "x", state: "failed", error: "" }), "ready");
});

test("parsePocketRecording rejects objects without an id", () => {
  assert.equal(parsePocketRecording({ title: "x" }), null);
  assert.equal(parsePocketRecording(null), null);
  assert.equal(parsePocketRecording({ id: 42 })?.pocketId, "42");
});

test("list page, audio url and webhook id parsing", () => {
  assert.deepEqual(parseListPage({ data: [{ id: "a" }], pagination: { has_more: true } }), {
    items: [{ id: "a" }],
    hasMore: true,
  });
  assert.deepEqual(parseListPage({}), { items: [], hasMore: false });
  assert.equal(parseAudioUrl({ data: { url: "https://s3.amazonaws.com/x" } }), "https://s3.amazonaws.com/x");
  assert.equal(parseAudioUrl({ data: "https://s3.amazonaws.com/y" }), "https://s3.amazonaws.com/y");
  assert.equal(parseAudioUrl({ data: { url: "javascript:alert(1)" } }), "");
  assert.equal(webhookRecordingId({ event: "summary.completed", recording: { id: "rec_9" } }), "rec_9");
  assert.equal(webhookRecordingId({ event: "x" }), "");
});

test("verifyPocketSignature: HMAC over timestamp.body, hex or base64, fresh only", () => {
  const secret = "whsec_test";
  const rawBody = JSON.stringify({ event: "summary.completed", recording: { id: "r1" } });
  const now = Date.parse("2026-09-29T12:00:00Z");
  const ts = String(Math.floor(now / 1000));
  const mac = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest();

  const ok = (signature: string, timestamp = ts, body = rawBody) =>
    verifyPocketSignature({ secret, rawBody: body, signature, timestamp, now });

  assert.equal(ok(mac.toString("hex")), true);
  assert.equal(ok(`sha256=${mac.toString("hex")}`), true);
  assert.equal(ok(mac.toString("base64")), true);
  assert.equal(ok(mac.toString("hex"), ts, rawBody + " "), false, "tampered body");
  assert.equal(ok("00".repeat(32)), false, "wrong signature");
  const old = String(Math.floor(now / 1000) - 3600);
  const oldMac = createHmac("sha256", secret).update(`${old}.${rawBody}`).digest("hex");
  assert.equal(ok(oldMac, old), false, "stale timestamp");
  assert.equal(
    verifyPocketSignature({ secret: "", rawBody, signature: mac.toString("hex"), timestamp: ts, now }),
    false,
  );
});

test("pocketTimestamp prefers the header, falls back to the payload", () => {
  const h = new Headers({ "x-heypocket-timestamp": "1700000000" });
  assert.equal(pocketTimestamp(h, { timestamp: "ignored" }), "1700000000");
  assert.equal(pocketTimestamp(new Headers(), { timestamp: "2026-09-29T12:00:00Z" }), "2026-09-29T12:00:00Z");
  assert.equal(pocketTimestamp(new Headers(), {}), null);
});
