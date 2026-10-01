import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyCalSignature, verifySvixSignature, SVIX_TOLERANCE_MS } from "../lib/webhooks/inbound/verify.ts";
import { calEvent, resendAction } from "../lib/webhooks/inbound/parse.ts";

// ---------------------------------------------------------------- Svix / Resend

const KEY = Buffer.from("test-signing-key-0123456789abcdef");
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = Date.parse("2026-10-01T12:00:00Z");
const TS = String(Math.floor(NOW / 1000));

function svixSign(id: string, ts: string, body: string, key = KEY): string {
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

test("verifySvixSignature accepts a valid Resend signature", () => {
  const body = '{"type":"email.bounced"}';
  assert.equal(
    verifySvixSignature({ secret: SECRET, rawBody: body, id: "msg_1", timestamp: TS, signature: svixSign("msg_1", TS, body), now: NOW }),
    true,
  );
});

test("verifySvixSignature accepts any matching signature during rotation", () => {
  const body = "{}";
  const stale = svixSign("msg_1", TS, body, Buffer.from("old-key"));
  const sig = `${stale} ${svixSign("msg_1", TS, body)}`;
  assert.equal(verifySvixSignature({ secret: SECRET, rawBody: body, id: "msg_1", timestamp: TS, signature: sig, now: NOW }), true);
});

test("verifySvixSignature rejects tampering, wrong id, stale timestamps and missing parts", () => {
  const body = '{"a":1}';
  const sig = svixSign("msg_1", TS, body);
  const base = { secret: SECRET, rawBody: body, id: "msg_1", timestamp: TS, signature: sig, now: NOW };
  assert.equal(verifySvixSignature({ ...base, rawBody: '{"a":2}' }), false);
  assert.equal(verifySvixSignature({ ...base, id: "msg_2" }), false);
  assert.equal(verifySvixSignature({ ...base, now: NOW + SVIX_TOLERANCE_MS + 1000 }), false);
  assert.equal(verifySvixSignature({ ...base, signature: null }), false);
  assert.equal(verifySvixSignature({ ...base, timestamp: "not-a-number" }), false);
  assert.equal(verifySvixSignature({ ...base, secret: "" }), false);
  assert.equal(verifySvixSignature({ ...base, signature: sig.replace("v1,", "v2,") }), false);
});

// ---------------------------------------------------------------- Cal.com

test("verifyCalSignature checks hex HMAC over the raw body", () => {
  const body = '{"triggerEvent":"PING"}';
  const sig = createHmac("sha256", "cal-secret-value-123").update(body).digest("hex");
  assert.equal(verifyCalSignature({ secret: "cal-secret-value-123", rawBody: body, signature: sig }), true);
  assert.equal(verifyCalSignature({ secret: "cal-secret-value-123", rawBody: body, signature: sig.toUpperCase() }), true);
  assert.equal(verifyCalSignature({ secret: "other-secret", rawBody: body, signature: sig }), false);
  assert.equal(verifyCalSignature({ secret: "cal-secret-value-123", rawBody: body + " ", signature: sig }), false);
  assert.equal(verifyCalSignature({ secret: "cal-secret-value-123", rawBody: body, signature: null }), false);
});

// ---------------------------------------------------------------- resendAction

test("resendAction suppresses hard bounces, complaints and provider suppressions", () => {
  assert.deepEqual(
    resendAction({ type: "email.bounced", data: { to: ["A@Example.com"], bounce: { type: "Permanent" } } }),
    { kind: "suppress", emails: ["a@example.com"], reason: "hard_bounce" },
  );
  assert.deepEqual(resendAction({ type: "email.complained", data: { to: ["x@y.co"] } }), {
    kind: "suppress",
    emails: ["x@y.co"],
    reason: "complaint",
  });
  assert.equal(resendAction({ type: "email.suppressed", data: { to: "x@y.co" } }).kind, "suppress");
});

test("resendAction only logs soft bounces and failures, ignores the rest", () => {
  assert.deepEqual(resendAction({ type: "email.bounced", data: { to: ["a@b.co"], bounce: { type: "Transient" } } }), {
    kind: "log",
    reason: "bounce:transient",
  });
  assert.equal(resendAction({ type: "email.failed", data: { to: ["a@b.co"] } }).kind, "log");
  assert.equal(resendAction({ type: "email.delivered", data: { to: ["a@b.co"] } }).kind, "ignore");
  assert.equal(resendAction({ type: "email.complained", data: { to: ["not-an-email"] } }).kind, "ignore");
  assert.equal(resendAction(null).kind, "ignore");
  assert.equal(resendAction("junk").kind, "ignore");
});

// ---------------------------------------------------------------- calEvent

const booking = {
  triggerEvent: "BOOKING_CREATED",
  payload: {
    uid: "bk_123",
    title: "Discovery call",
    startTime: "2026-10-08T14:00:00Z",
    additionalNotes: "Need help with scheduling",
    attendees: [{ name: "Pat Lee", email: "Pat@Example.com" }],
    responses: { company: { value: "Lee Plumbing" }, attendeePhoneNumber: { value: "+15555550100" } },
  },
};

test("calEvent turns a new booking into a lead keyed by booking uid", () => {
  const ev = calEvent(booking, "2026-10-01T12:00:00.000Z");
  assert.equal(ev.kind, "booking_created");
  if (ev.kind !== "booking_created") return;
  assert.equal(ev.eventId, "BOOKING_CREATED:bk_123");
  assert.equal(ev.lead.email, "pat@example.com");
  assert.equal(ev.lead.name, "Pat Lee");
  assert.equal(ev.lead.company, "Lee Plumbing");
  assert.equal(ev.lead.phone, "+15555550100");
  assert.equal(ev.lead.problem, "Need help with scheduling");
  assert.equal(ev.lead.source, "cal_com_booking");
  assert.match(ev.lead.bestTime ?? "", /Discovery call/);
});

test("calEvent distinguishes repeat reschedules by start time", () => {
  const a = calEvent({ triggerEvent: "BOOKING_RESCHEDULED", payload: { uid: "bk_1", startTime: "2026-10-08T14:00:00Z" } });
  const b = calEvent({ triggerEvent: "BOOKING_RESCHEDULED", payload: { uid: "bk_1", startTime: "2026-10-09T14:00:00Z" } });
  assert.equal(a.kind, "booking_changed");
  assert.notEqual(a.kind === "booking_changed" && a.eventId, b.kind === "booking_changed" && b.eventId);
});

test("calEvent handles ping and malformed payloads", () => {
  assert.deepEqual(calEvent({ triggerEvent: "PING" }), { kind: "ping" });
  assert.equal(calEvent({ triggerEvent: "BOOKING_CREATED", payload: { uid: "x", attendees: [{ email: "bad" }] } }).kind, "ignore");
  assert.equal(calEvent({ triggerEvent: "BOOKING_CREATED", payload: {} }).kind, "ignore");
  assert.equal(calEvent({ triggerEvent: "MEETING_ENDED", payload: { uid: "x" } }).kind, "ignore");
  assert.equal(calEvent(null).kind, "ignore");
});
