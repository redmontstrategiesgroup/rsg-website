import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

let paused = false;
let flow: Record<string, unknown> = { ok: true, bookingId: "b1", manageToken: "t", confirmedUrl: "/booking/confirmed?token=t" };
let turnstileConfigured = false;
let turnstileValid = true;
const startSessionCalls: unknown[] = [];
const completeBookingCalls: Array<{ idempotencyKey?: string }> = [];

mock.module("@/lib/scheduling/book-flow", {
  namedExports: {
    completeBooking: async (input: { idempotencyKey?: string }) => {
      completeBookingCalls.push({ idempotencyKey: input.idempotencyKey });
      return flow;
    },
    startPublicSession: async (input: unknown) => {
      startSessionCalls.push(input);
      return { token: "sess" };
    },
  },
});
mock.module("@/lib/scheduling/slots", { namedExports: { getAvailableSlots: async () => [{ start: "a", end: "b", label: "l" }] } });
mock.module("@/lib/scheduling/notifications", { namedExports: { getSettings: async () => ({ bookings_paused: paused }) } });
mock.module("@/lib/scheduling/turnstile", {
  namedExports: {
    isTurnstileConfigured: () => turnstileConfigured,
    verifyTurnstile: async () => turnstileValid,
  },
});

const { listSlots, createBookingHandler, createBody } = await import("../lib/apiv1/resources/public-booking.ts");

const args = (query: Record<string, unknown>, body?: unknown, headers?: Record<string, string>) =>
  ({
    principal: null,
    body,
    query,
    params: {},
    request: new Request("http://x/api/v1/public/booking", {
      headers: { "idempotency-key": "pub-00001", ...headers },
    }),
    correlationId: "c",
  }) as never;

const q = { appointment_type_id: "11111111-1111-4111-8111-111111111111", timezone: "America/New_York" };

const validBody = () =>
  createBody.parse({
    appointmentTypeId: "11111111-1111-4111-8111-111111111111",
    startsAt: "2026-10-01T15:00:00.000Z",
    meetingFormat: "phone",
    visitorTimezone: "America/New_York",
    intake: {
      contact: { fullName: "Ann Lee", businessName: "Acme", email: "ann@example.com", phone: "7815550100" },
      answers: {},
      consent: true,
    },
  });

describe("public booking", () => {
  it("slots: paused → empty; window cap", async () => {
    paused = true;
    assert.deepEqual((await listSlots(args(q))).data, { slots: [], paused: true });
    paused = false;
    assert.equal(((await listSlots(args(q))).data as { slots: unknown[] }).slots.length, 1);
    await assert.rejects(listSlots(args({ ...q, from: "2026-01-01", to: "2026-03-01" })), (e: { code: string }) => e.code === "validation_failed");
  });

  it("slots: invalid timezone → 422", async () => {
    await assert.rejects(
      listSlots(args({ ...q, timezone: "Not/AZone" })),
      (e: { code: string; status: number }) => e.code === "validation_failed" && e.status === 422
    );
  });

  it("create: 409 → conflict; success → 201 snake_case with real values", async () => {
    flow = { ok: false, status: 409, error: "Taken.", code: "conflict" };
    await assert.rejects(createBookingHandler(args({}, validBody())), (e: { code: string; status: number }) => e.code === "conflict" && e.status === 409);

    flow = { ok: true, bookingId: "b1", manageToken: "t", confirmedUrl: "/c?token=t", recommendedPlanKey: "growth", recommendedPlanName: "Growth Plan" };
    const r = await createBookingHandler(args({}, validBody()));
    assert.equal(r.status, 201);
    assert.deepEqual(r.data, {
      booking_id: "b1",
      manage_token: "t",
      confirmed_url: "/c?token=t",
      recommended_plan_key: "growth",
      recommended_plan_name: "Growth Plan",
    });
  });

  it("create: paused → 503 unavailable", async () => {
    flow = { ok: false, status: 400, error: "Bookings are temporarily paused.", code: "paused" };
    await assert.rejects(createBookingHandler(args({}, validBody())), (e: { code: string; status: number }) => e.code === "unavailable" && e.status === 503);
    flow = { ok: true, bookingId: "b1", manageToken: "t", confirmedUrl: "/c?token=t" };
  });

  it("create: captcha configured + invalid token → 403, no session minted", async () => {
    turnstileConfigured = true;
    turnstileValid = false;
    startSessionCalls.length = 0;
    await assert.rejects(
      createBookingHandler(args({}, validBody())),
      (e: { code: string; status: number }) => e.code === "insufficient_scope" && e.status === 403
    );
    assert.equal(startSessionCalls.length, 0);
    turnstileConfigured = false;
    turnstileValid = true;
  });

  it("create: captcha not configured → proceeds without a token", async () => {
    turnstileConfigured = false;
    startSessionCalls.length = 0;
    const r = await createBookingHandler(args({}, validBody()));
    assert.equal(r.status, 201);
    assert.equal(startSessionCalls.length, 1);
  });

  it("create: captcha configured + valid token → proceeds", async () => {
    turnstileConfigured = true;
    turnstileValid = true;
    startSessionCalls.length = 0;
    const r = await createBookingHandler(args({}, validBody()));
    assert.equal(r.status, 201);
    assert.equal(startSessionCalls.length, 1);
    turnstileConfigured = false;
  });

  it("create: namespaces the forwarded idempotency key by IP — stable per IP+key, distinct across IPs", async () => {
    completeBookingCalls.length = 0;
    await createBookingHandler(args({}, validBody(), { "idempotency-key": "order-1001", "x-real-ip": "1.1.1.1" }));
    await createBookingHandler(args({}, validBody(), { "idempotency-key": "order-1001", "x-real-ip": "1.1.1.1" }));
    await createBookingHandler(args({}, validBody(), { "idempotency-key": "order-1001", "x-real-ip": "2.2.2.2" }));

    const [callA, callB, callC] = completeBookingCalls;
    assert.ok(callA.idempotencyKey);
    assert.notEqual(callA.idempotencyKey, "order-1001"); // namespaced, not the raw header value
    assert.equal(callA.idempotencyKey, callB.idempotencyKey); // same IP + key → stable
    assert.notEqual(callA.idempotencyKey, callC.idempotencyKey); // different IP, same key → distinct
  });
});
