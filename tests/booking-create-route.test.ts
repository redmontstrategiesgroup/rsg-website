import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

let flow: Record<string, unknown> = { ok: true, bookingId: "b1", manageToken: "tok-123", confirmedUrl: "/booking/confirmed?token=tok-123" };

mock.module("@/lib/supabase", { namedExports: { isSupabaseConfigured: () => true } });
mock.module("@/lib/scheduling/book-flow", { namedExports: { completeBooking: async () => flow } });

const { POST } = await import("../app/api/booking/create/route.ts");

const validBody = {
  sessionToken: "x".repeat(24),
  appointmentTypeId: "11111111-1111-4111-8111-111111111111",
  startsAt: "2026-10-01T15:00:00.000Z",
  meetingFormat: "phone" as const,
  visitorTimezone: "America/New_York",
};

const post = (body: unknown) =>
  POST(
    new Request("http://x/api/booking/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/booking/create (cookie route → completeBooking mapping)", () => {
  it("success with a plan recommendation: keys, status, and the &plan= confirmedUrl suffix are preserved", async () => {
    flow = {
      ok: true,
      bookingId: "b1",
      manageToken: "tok-123",
      confirmedUrl: "/booking/confirmed?token=tok-123&plan=growth",
      recommendedPlanKey: "growth",
      recommendedPlanName: "Growth Plan",
    };
    const res = await post(validBody);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json, {
      ok: true,
      bookingId: "b1",
      manageToken: "tok-123",
      confirmedUrl: "/booking/confirmed?token=tok-123&plan=growth",
      recommendedPlanKey: "growth",
      recommendedPlanName: "Growth Plan",
    });
    assert.ok(String(json.confirmedUrl).includes("&plan="));
  });

  it("not_eligible → 403 with the code passed through", async () => {
    flow = { ok: false, status: 403, error: "Not eligible to book at this time.", code: "not_eligible" };
    const res = await post(validBody);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: "Not eligible to book at this time.", code: "not_eligible" });
  });
});
