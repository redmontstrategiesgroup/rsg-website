import test from "node:test";
import assert from "node:assert/strict";
import { scoreLead, DEFAULT_CONTACT_TO_EMAIL } from "../lib/lead-score.ts";
import { LEAD_STATUSES } from "../lib/types.ts";
import type { Lead } from "../lib/types.ts";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    name: "Jordan Lee",
    company: "South Shore Clinic",
    email: "jordan@example.com",
    phone: "7815550100",
    website: "https://example.com",
    industry: "Med spa",
    problem: "We lose leads after the first consultation call and follow-up is manual.",
    improve: "Faster lead follow-up and fewer no-shows",
    timeline: "This month",
    preferredContact: "Call",
    submittedAt: new Date().toISOString(),
    source: "website_contact_form",
    ...overrides,
  };
}

test("DEFAULT_CONTACT_TO_EMAIL targets the RSG inbox", () => {
  assert.equal(DEFAULT_CONTACT_TO_EMAIL, "contact@redmontstrategiesgroup.com");
});

test("scoreLead rewards urgency, industry fit, and concrete problems", () => {
  const hot = scoreLead(
    baseLead({
      timeline: "Immediately",
      industry: "Med spa",
      problem:
        "Missed call revenue is high because after-hours leads never get a follow-up and bookings stall.",
      phone: "7815550100",
      website: "https://example.com",
      preferredContact: "Call",
      utmSource: "google",
    })
  );
  const cold = scoreLead(
    baseLead({
      timeline: "Just exploring",
      industry: "Other",
      problem: "Unsure",
      improve: "",
      phone: "",
      website: "",
      preferredContact: "Email",
      utmSource: "",
    })
  );
  assert.ok(hot >= 60);
  assert.ok(hot > cold);
});

test("LEAD_STATUSES covers the admin pipeline", () => {
  assert.ok(LEAD_STATUSES.includes("new"));
  assert.ok(LEAD_STATUSES.includes("meeting_scheduled"));
  assert.ok(LEAD_STATUSES.includes("appointment_booked"));
  assert.ok(LEAD_STATUSES.includes("qualified_not_booked"));
  assert.ok(LEAD_STATUSES.includes("manual_review"));
  assert.ok(LEAD_STATUSES.includes("not_eligible"));
  assert.ok(LEAD_STATUSES.includes("archived"));
  assert.ok(LEAD_STATUSES.length >= 8);
});
