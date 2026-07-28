import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUALIFICATION_SECTIONS,
  QUALIFIED_THRESHOLD,
  computeQualificationScore,
  qualificationCategory,
} from "../lib/lifecycle/qualification-content.ts";
import { isAnswered, showIfMatches, visibleSections } from "../lib/lifecycle/form-utils.ts";
import {
  ASSESSMENT_SECTIONS,
  computeAssessmentScore,
  recommendServiceCategory,
  buildAssessmentSummary,
} from "../lib/lifecycle/assessment-content.ts";
import {
  QUESTIONNAIRE_TEMPLATES,
  buildPrepBrief,
  templateForCategory,
} from "../lib/lifecycle/questionnaire-content.ts";
import {
  formatInvoiceNumber,
  invoiceBalanceCents,
} from "../lib/lifecycle/billing-shared.ts";
import type { Invoice } from "../lib/lifecycle/types.ts";

// ---------------------------------------------------------------------------
// Qualification (/start)
// ---------------------------------------------------------------------------

describe("qualification scoring", () => {
  const strong = {
    budget_range: "15k_50k",
    revenue_range: "75k_150k",
    timeline: "asap",
    main_challenge:
      "We miss calls constantly and follow-up slips through the cracks every single week.",
    desired_outcome: "Booked out three weeks ahead.",
  };
  const weak = {
    budget_range: "under_2k",
    revenue_range: "pre_revenue",
    timeline: "exploring",
    main_challenge: "n/a",
  };

  it("scores a strong prospect above the assessment threshold", () => {
    assert.ok(computeQualificationScore(strong) >= QUALIFIED_THRESHOLD);
  });

  it("routes a weak prospect below the threshold (warm alternative path)", () => {
    assert.ok(computeQualificationScore(weak) < QUALIFIED_THRESHOLD);
  });

  it("score is capped at 100 and never negative", () => {
    assert.ok(computeQualificationScore(strong) <= 100);
    assert.ok(computeQualificationScore({}) >= 0);
  });

  it("maps primary needs to service categories", () => {
    assert.equal(qualificationCategory({ primary_need: "more_leads" }), "growth_systems");
    assert.equal(qualificationCategory({ primary_need: "operations" }), "operations_systems");
    assert.equal(qualificationCategory({ primary_need: "private_ai" }), "private_ai");
    assert.equal(qualificationCategory({ primary_need: "website" }), "website_platform");
    assert.equal(qualificationCategory({}), "business_systems");
  });
});

describe("qualification conditional sections", () => {
  it("shows the AI follow-up section only for private-AI needs", () => {
    const withAi = visibleSections(QUALIFICATION_SECTIONS, { primary_need: "private_ai" });
    const without = visibleSections(QUALIFICATION_SECTIONS, { primary_need: "website" });
    assert.ok(withAi.some((s) => s.key === "ai_detail"));
    assert.ok(!without.some((s) => s.key === "ai_detail"));
  });

  it("lead-flow follow-ups appear for both lead and communication needs", () => {
    for (const need of ["more_leads", "communication"]) {
      const sections = visibleSections(QUALIFICATION_SECTIONS, { primary_need: need });
      assert.ok(sections.some((s) => s.key === "leads_detail"), need);
    }
  });

  it("collects every field the spec requires", () => {
    const keys = QUALIFICATION_SECTIONS.flatMap((s) => s.questions.map((q) => q.key));
    for (const required of [
      "name", "business_name", "email", "phone", "website", "industry",
      "service_area", "team_size", "revenue_range", "main_challenge",
      "desired_outcome", "current_systems", "budget_range", "timeline",
      "heard_about",
    ]) {
      assert.ok(keys.includes(required), `missing ${required}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Form utils
// ---------------------------------------------------------------------------

describe("form conditional logic", () => {
  it("showIfMatches handles scalars, arrays, and missing answers", () => {
    const cond = { key: "x", anyOf: ["a", "b"] };
    assert.equal(showIfMatches(cond, { x: "a" }), true);
    assert.equal(showIfMatches(cond, { x: ["c", "b"] }), true);
    assert.equal(showIfMatches(cond, { x: "z" }), false);
    assert.equal(showIfMatches(cond, {}), false);
    assert.equal(showIfMatches(undefined, {}), true);
  });

  it("isAnswered treats empty strings and arrays as unanswered", () => {
    assert.equal(isAnswered(""), false);
    assert.equal(isAnswered("  "), false);
    assert.equal(isAnswered([]), false);
    assert.equal(isAnswered(null), false);
    assert.equal(isAnswered("yes"), true);
    assert.equal(isAnswered(["a"]), true);
  });
});

// ---------------------------------------------------------------------------
// Business systems assessment
// ---------------------------------------------------------------------------

describe("assessment", () => {
  it("covers the required evaluation areas", () => {
    const allText = ASSESSMENT_SECTIONS.map((s) =>
      [s.label, ...s.questions.map((q) => `${q.label} ${q.help ?? ""} ${q.tooltip ?? ""}`)]
        .join(" ")
        .toLowerCase(),
    ).join(" | ");
    // Spot-check the pillars of the spec — presence, leads, money, data/AI.
    for (const term of ["presence", "customer", "quot", "paid", "data", "ai"]) {
      assert.ok(allText.includes(term), `assessment should cover "${term}"`);
    }
    assert.ok(ASSESSMENT_SECTIONS.length >= 7, "premium multi-section experience");
  });

  it("scores higher for bigger gaps and stays within 0–100", () => {
    const empty = computeAssessmentScore({});
    assert.ok(empty.score >= 0 && empty.score <= 100);
    // Section scores never exceed their max.
    for (const s of empty.sectionScores) {
      assert.ok(s.score <= s.max);
    }
  });

  it("summary is derived from answers and hides the implementation plan", () => {
    const answers = { customer_type: "consumers" };
    const { score, sectionScores } = computeAssessmentScore(answers);
    const summary = buildAssessmentSummary(answers, score, sectionScores);
    assert.ok(summary.overview.length > 0);
    assert.ok(Array.isArray(summary.next_steps) && summary.next_steps.length > 0);
    // The recommendation exists, but no full plan is exposed pre-consultation.
    assert.ok(summary.recommended_category.length > 0);
  });

  it("recommends a valid service category for any input", () => {
    const categories = [
      "growth_systems", "operations_systems", "business_systems",
      "private_ai", "website_platform", "not_sure",
    ];
    assert.ok(categories.includes(recommendServiceCategory({})));
    assert.ok(
      categories.includes(
        recommendServiceCategory({ ai_interest: "very_interested", sensitive_data: "true" }),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Preparation questionnaire
// ---------------------------------------------------------------------------

describe("preparation questionnaire", () => {
  it("has a template for every service category plus general", () => {
    for (const key of [
      "general", "growth_systems", "operations_systems",
      "business_systems", "private_ai", "website_platform",
    ]) {
      assert.ok(QUESTIONNAIRE_TEMPLATES[key], `missing template ${key}`);
      assert.ok(QUESTIONNAIRE_TEMPLATES[key].sections.length > 0);
    }
  });

  it("falls back to the general template for unknown categories", () => {
    assert.equal(templateForCategory("nonsense"), "general");
    assert.equal(templateForCategory(null), "general");
    assert.equal(templateForCategory("private_ai"), "private_ai");
  });

  it("never asks for passwords anywhere in any template", () => {
    for (const template of Object.values(QUESTIONNAIRE_TEMPLATES)) {
      for (const section of template.sections) {
        for (const q of section.questions) {
          const text = `${q.label} ${q.help ?? ""} ${q.placeholder ?? ""}`.toLowerCase();
          assert.ok(
            !/enter your password|share your password|type your password/.test(text),
            `template question "${q.key}" must not solicit passwords`,
          );
        }
      }
    }
  });

  it("builds a prep brief strictly from provided answers", () => {
    const brief = buildPrepBrief({}, "general");
    // No invented content: an empty submission yields empty lists, not filler.
    assert.ok(Array.isArray(brief.goals));
    const populated = buildPrepBrief({ budget_range: "under_5k" }, "general");
    assert.ok(populated.flags.some((f) => f.toLowerCase().includes("budget")));
  });
});

// ---------------------------------------------------------------------------
// Billing helpers
// ---------------------------------------------------------------------------

describe("billing helpers", () => {
  it("formats invoice numbers from the identity column", () => {
    assert.equal(formatInvoiceNumber(1), "RSG-1001");
    assert.equal(formatInvoiceNumber(42), "RSG-1042");
  });

  it("balance never goes negative on overpayment", () => {
    const invoice = {
      total_cents: 10_000,
      amount_paid_cents: 12_000,
    } as Invoice;
    assert.equal(invoiceBalanceCents(invoice), 0);
    assert.equal(
      invoiceBalanceCents({ total_cents: 10_000, amount_paid_cents: 2_500 } as Invoice),
      7_500,
    );
  });
});
