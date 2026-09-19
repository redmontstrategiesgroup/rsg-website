import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

let paused = false; let flow: Record<string, unknown> = { ok: true, bookingId: "b1", manageToken: "t", confirmedUrl: "/booking/confirmed?token=t" };
mock.module("@/lib/scheduling/book-flow", { namedExports: { completeBooking: async () => flow, startPublicSession: async () => ({ token: "sess" }) } });
mock.module("@/lib/scheduling/slots", { namedExports: { getAvailableSlots: async () => [{ start: "a", end: "b", label: "l" }] } });
mock.module("@/lib/scheduling/notifications", { namedExports: { getSettings: async () => ({ bookings_paused: paused }) } });

const { listSlots, createBookingHandler } = await import("../lib/apiv1/resources/public-booking.ts");
const args = (query: Record<string, unknown>, body?: unknown) => ({ principal: null, body, query, params: {}, request: new Request("http://x/api/v1/public/booking", { headers: { "idempotency-key": "pub-00001" } }), correlationId: "c" }) as never;
const q = { appointment_type_id: "11111111-1111-4111-8111-111111111111", timezone: "America/New_York" };

describe("public booking", () => {
  it("slots: paused → empty; window cap", async () => {
    paused = true; assert.deepEqual((await listSlots(args(q))).data, { slots: [], paused: true }); paused = false;
    assert.equal(((await listSlots(args(q))).data as { slots: unknown[] }).slots.length, 1);
    await assert.rejects(listSlots(args({ ...q, from: "2026-01-01", to: "2026-03-01" })), (e: { code: string }) => e.code === "validation_failed");
  });
  it("create: 409 → conflict; success → 201 snake_case", async () => {
    flow = { ok: false, status: 409, error: "Taken.", code: "conflict" };
    await assert.rejects(createBookingHandler(args({}, {})), (e: { code: string; status: number }) => e.code === "conflict" && e.status === 409);
    flow = { ok: true, bookingId: "b1", manageToken: "t", confirmedUrl: "/c?token=t" };
    const r = await createBookingHandler(args({}, {}));
    assert.equal(r.status, 201); assert.deepEqual(Object.keys(r.data as object).sort(), ["booking_id", "confirmed_url", "manage_token", "recommended_plan_key", "recommended_plan_name"]);
  });
});
