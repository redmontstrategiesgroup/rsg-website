import "./_alias-hook.ts";
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { intakeAnswersSchema, intakeContactSchema } from "../lib/scheduling/intake-schema.ts";

let session: Record<string, unknown> | null = { id: "s1", contact: { name: "Ann", email: "a@b.c", businessName: "Acme" }, service_id: null, lead_id: null, is_test: false };
let intakeOk = true; let bookingResult: Record<string, unknown> = { ok: true, bookingId: "b1", manageToken: "tok-123" };
const hooks: string[] = [];
mock.module("@/lib/scheduling/sessions", { namedExports: { getSessionByToken: async () => session } });
mock.module("@/lib/scheduling/intake", { namedExports: { intakeAnswersSchema, intakeContactSchema, submitIntake: async () => (intakeOk ? { ok: true, leadId: "l1" } : { ok: false, error: "Consent required.", code: "consent" }) } });
mock.module("@/lib/scheduling/booking", { namedExports: { createBooking: async () => bookingResult } });
mock.module("@/lib/lifecycle/orchestrate", { namedExports: { onBookingCreated: async () => { hooks.push("created"); } } });
mock.module("@/lib/lifecycle/category-map", { namedExports: { serviceCategoryForSlug: () => "general" } });
mock.module("@/lib/supabase", { namedExports: { getSupabase: () => null, isSupabaseConfigured: () => true } });
mock.module("@/lib/managed-services/recommend", { namedExports: { recommendPlan: () => null, sanitizeServicePlanAnswers: () => ({}) } });
mock.module("@/lib/managed-services/content", { namedExports: { defaultPlanByKey: () => null } });

const { completeBooking } = await import("../lib/scheduling/book-flow.ts");
const base = { sessionToken: "x".repeat(24), appointmentTypeId: "11111111-1111-4111-8111-111111111111", startsAt: "2026-10-01T15:00:00.000Z", meetingFormat: "phone" as const, visitorTimezone: "America/New_York" };

describe("completeBooking", () => {
  it("missing session → 401", async () => { session = null; assert.deepEqual(await completeBooking(base), { ok: false, status: 401, error: "Session expired." }); session = { id: "s1", contact: { email: "a@b.c" } }; });
  it("intake failure → 400 with code", async () => {
    intakeOk = false;
    const r = await completeBooking({ ...base, intake: { contact: { fullName: "Ann Lee", businessName: "Acme", email: "a@b.c", phone: "7815550100" }, answers: {}, consent: false } });
    assert.equal(r.ok, false); if (!r.ok) { assert.equal(r.status, 400); assert.equal(r.code, "consent"); }
    intakeOk = true;
  });
  it("booking conflict → 409", async () => {
    bookingResult = { ok: false, error: "Taken.", code: "conflict" };
    const r = await completeBooking(base); assert.equal(r.ok, false); if (!r.ok) assert.equal(r.status, 409);
    bookingResult = { ok: true, bookingId: "b1", manageToken: "tok-123" };
  });
  it("happy path runs the lifecycle hook once", async () => {
    const r = await completeBooking(base);
    assert.equal(r.ok, true); if (r.ok) assert.ok(r.confirmedUrl.includes("tok-123"));
    assert.deepEqual(hooks, ["created"]);
  });
});
