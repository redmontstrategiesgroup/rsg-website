/**
 * Pure qualification engine tests (no I/O).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeQualification,
  validateAnswers,
} from "../lib/scheduling/qualification.ts";
import type {
  QualificationQuestion,
  QualificationRuleSet,
} from "../lib/scheduling/types.ts";

const questions: QualificationQuestion[] = [
  {
    id: "1",
    form_id: "f",
    key: "budget",
    label: "Budget",
    question_type: "dropdown",
    options: ["Under $5,000", "$15,000 – $40,000"],
    required: true,
    sort_order: 1,
    point_map: { "Under $5,000": 0, "$15,000 – $40,000": 25 },
    max_points: 25,
    active: true,
  },
  {
    id: "2",
    form_id: "f",
    key: "ready_to_invest",
    label: "Ready",
    question_type: "yes_no",
    options: ["Yes", "No"],
    required: true,
    sort_order: 2,
    point_map: { Yes: 25, No: 0 },
    max_points: 25,
    active: true,
  },
  {
    id: "3",
    form_id: "f",
    key: "timeline",
    label: "Timeline",
    question_type: "dropdown",
    options: ["Immediately", "Exploring / no timeline"],
    required: true,
    sort_order: 3,
    point_map: { Immediately: 25, "Exploring / no timeline": 0 },
    max_points: 25,
    active: true,
  },
];

const ruleSet: QualificationRuleSet = {
  id: "r",
  form_id: "f",
  name: "Test",
  status: "published",
  min_qualifying_score: 55,
  manual_review_min_score: 35,
  manual_review_max_score: 54,
  allow_calendar_on_manual_review: false,
  outcome_messages: {
    qualified: "You qualify",
    manual_review: "Review",
    not_eligible: "Not now",
  },
  hard_rules: [
    {
      id: "dq_budget",
      field: "budget",
      op: "eq",
      value: "Under $5,000",
      outcome: "not_eligible",
      label: "Budget too low",
    },
    {
      id: "dq_invest",
      field: "ready_to_invest",
      op: "eq",
      value: "No",
      outcome: "not_eligible",
      label: "Not investing",
    },
  ],
  service_rules: [],
  priority_thresholds: { high: 80, medium: 55, low: 0 },
};

describe("computeQualification", () => {
  it("qualifies strong answers", () => {
    const result = computeQualification({
      questions,
      ruleSet,
      answers: {
        budget: "$15,000 – $40,000",
        ready_to_invest: "Yes",
        timeline: "Immediately",
      },
    });
    assert.equal(result.outcome, "qualified");
    assert.equal(result.allowCalendar, true);
    assert.ok(result.totalScore >= 55);
  });

  it("hard-disqualifies low budget", () => {
    const result = computeQualification({
      questions,
      ruleSet,
      answers: {
        budget: "Under $5,000",
        ready_to_invest: "Yes",
        timeline: "Immediately",
      },
    });
    assert.equal(result.outcome, "not_eligible");
    assert.equal(result.allowCalendar, false);
    assert.ok(result.ruleHits.some((h) => h.id === "dq_budget"));
  });

  it("validates required answers", () => {
    const missing = validateAnswers(questions, { budget: "Under $5,000" });
    assert.ok(missing.includes("ready_to_invest"));
    assert.ok(missing.includes("timeline"));
  });
});
