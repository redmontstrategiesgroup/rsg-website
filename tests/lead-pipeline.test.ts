import test from "node:test";
import assert from "node:assert/strict";
import { scoreLead, DEFAULT_CONTACT_TO_EMAIL } from "../lib/lead-score.ts";
import {
  deriveLeadStorageMetadata,
  leadToRow,
  n8nLeadWebhookUrl,
} from "../lib/leads.ts";
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

test("deriveLeadStorageMetadata keeps scoring state separate from status", () => {
  const metadata = deriveLeadStorageMetadata(
    baseLead({
      score: 82,
      status: "new",
      source: "website_contact_form",
    })
  );

  assert.equal(metadata.status, "new");
  assert.equal(metadata.score, 82);
  assert.equal(metadata.scoreBucket, "hot");
  assert.equal(metadata.routingLabel, "priority_follow_up");
  assert.ok(metadata.storagePayload.lead_score === 82);
  assert.ok(metadata.storagePayload.status === "new");
});

/*
 * The admin console renders whatever is in public.leads. A submission that
 * skips this mapping is invisible there no matter how many notification emails
 * went out, which is exactly the failure these two tests exist to catch.
 */

test("leadToRow fills every column the admin console reads back", () => {
  const row = leadToRow(
    baseLead({
      id: "11111111-1111-1111-1111-111111111111",
      score: 71,
      status: "new",
      notes: "",
      owner: "",
      pageUrl: "https://redmontstrategiesgroup.com/contact",
      referrer: "https://google.com",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      utmContent: "hero",
      utmTerm: "consulting",
    })
  );

  // Column names, not property names: store.ts rowToLead reads these exact keys.
  for (const column of [
    "id",
    "name",
    "business_name",
    "website",
    "email",
    "phone",
    "industry",
    "biggest_problem",
    "improvement_goal",
    "preferred_contact",
    "best_time",
    "timeline",
    "page_url",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "lead_score",
    "source",
    "status",
    "created_at",
  ]) {
    assert.ok(column in row, `missing column: ${column}`);
  }

  assert.equal(row.business_name, "South Shore Clinic");
  assert.equal(row.biggest_problem, baseLead().problem);
  assert.equal(row.lead_score, 71);
  assert.equal(row.status, "new");
  // business_name is NOT NULL in the schema: never send an empty string for it.
  assert.equal(leadToRow(baseLead({ company: "" })).business_name, "Jordan Lee");
});

test("leadToRow carries demo and plan context into the snapshot columns", () => {
  const row = leadToRow(
    baseLead({
      source: "interactive_demo",
      demo: {
        slug: "healthwellness",
        system: "AI Receptionist",
        businessCategory: "Med spa",
        featuresExplored: ["missed-call-text-back"],
        featuresRequested: ["booking"],
        businessSize: "5-10",
      },
      recommendedPlan: "growth",
      servicePlanAnswers: { budget: "2-5k" },
    })
  );

  assert.deepEqual(row.qualification_snapshot, {
    demoRequest: {
      slug: "healthwellness",
      system: "AI Receptionist",
      businessCategory: "Med spa",
      featuresExplored: ["missed-call-text-back"],
      featuresRequested: ["booking"],
      businessSize: "5-10",
    },
  });
  assert.equal(row.service_requested, "AI Receptionist");
  assert.equal(row.employee_count, "5-10");
  assert.equal(row.recommended_plan, "growth");
  assert.deepEqual(row.service_plan_answers, { budget: "2-5k" });

  // Absent context must not write empty JSONB over a real row's fields.
  const plain = leadToRow(baseLead());
  assert.ok(!("qualification_snapshot" in plain));
  assert.ok(!("recommended_plan" in plain));
  assert.ok(!("service_plan_answers" in plain));
});

test("n8nLeadWebhookUrl does not double the webhook path", () => {
  const full = "https://x.app.n8n.cloud/webhook/rsg-lead-capture";
  // The configured value is the full webhook URL, not a base.
  assert.equal(n8nLeadWebhookUrl(full), full);
  assert.equal(n8nLeadWebhookUrl(`${full}/`), full);
  assert.equal(n8nLeadWebhookUrl("https://x.app.n8n.cloud"), full);
  assert.equal(n8nLeadWebhookUrl("https://x.app.n8n.cloud/"), full);
});

test("scoreLead weights source intent and revenue as smaller modifiers", () => {
  const premium = scoreLead(
    baseLead({
      timeline: "Immediately",
      industry: "Med spa",
      problem:
        "Missed call revenue is high because after-hours leads never get a follow-up and bookings stall.",
      phone: "7815550100",
      website: "https://example.com",
      preferredContact: "Call",
      source: "website_connect_page",
      yearlyRevenue: "$2M+",
    })
  );
  const standard = scoreLead(
    baseLead({
      timeline: "Immediately",
      industry: "Med spa",
      problem:
        "Missed call revenue is high because after-hours leads never get a follow-up and bookings stall.",
      phone: "7815550100",
      website: "https://example.com",
      preferredContact: "Call",
      source: "website_contact_form",
      yearlyRevenue: "$50k",
    })
  );

  assert.ok(premium > standard);
  assert.ok(premium - standard < 20);
});
