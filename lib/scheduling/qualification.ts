import type {
  HardRule,
  QualificationComputeResult,
  QualificationOutcome,
  QualificationQuestion,
  QualificationRuleSet,
} from "./types";

function answerAsString(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matchRule(rule: HardRule, answers: Record<string, unknown>): boolean {
  const raw = answers[rule.field];
  const str = answerAsString(raw);
  switch (rule.op) {
    case "eq":
      return str === String(rule.value);
    case "neq":
      return str !== String(rule.value);
    case "in":
      return Array.isArray(rule.value)
        ? rule.value.map(String).includes(str)
        : str === String(rule.value);
    case "not_in":
      return Array.isArray(rule.value)
        ? !rule.value.map(String).includes(str)
        : str !== String(rule.value);
    case "lt":
      return Number(str) < Number(rule.value);
    case "gt":
      return Number(str) > Number(rule.value);
    case "contains":
      return str.toLowerCase().includes(String(rule.value).toLowerCase());
    default:
      return false;
  }
}

function pointsForAnswer(
  question: QualificationQuestion,
  answer: unknown
): number {
  if (answer == null || answer === "") return 0;
  const map = question.point_map ?? {};

  if (question.question_type === "checkboxes" && Array.isArray(answer)) {
    return answer.reduce((sum, a) => sum + (map[String(a)] ?? 0), 0);
  }

  if (question.question_type === "long_text" || question.question_type === "short_text") {
    const len = String(answer).trim().length;
    if (len >= 120) return Math.min(question.max_points || 10, 10);
    if (len >= 40) return Math.min(question.max_points || 10, 6);
    if (len >= 10) return Math.min(question.max_points || 10, 3);
    return 0;
  }

  if (question.question_type === "rating" || question.question_type === "number") {
    const n = Number(answer);
    if (Number.isFinite(n) && map[String(n)] != null) return map[String(n)];
    if (Number.isFinite(n) && question.max_points) {
      return Math.min(question.max_points, Math.max(0, Math.round(n)));
    }
  }

  const key = String(answer);
  if (map[key] != null) return map[key];
  return 0;
}

function isQuestionVisible(
  q: QualificationQuestion,
  answers: Record<string, unknown>,
  byId: Map<string, QualificationQuestion>
): boolean {
  if (!q.active) return false;
  if (!q.parent_question_id && !q.show_when) return true;
  const when = q.show_when;
  if (when?.parent_key) {
    const parentVal = answerAsString(answers[when.parent_key]);
    if (when.equals == null) return Boolean(parentVal);
    if (Array.isArray(when.equals)) return when.equals.map(String).includes(parentVal);
    return parentVal === String(when.equals);
  }
  if (q.parent_question_id) {
    const parent = byId.get(q.parent_question_id);
    if (!parent) return true;
    return Boolean(answerAsString(answers[parent.key]));
  }
  return true;
}

/**
 * Server-side qualification engine. Never expose thresholds to the client
 * beyond the final outcome + public message.
 */
export function computeQualification(input: {
  questions: QualificationQuestion[];
  ruleSet: QualificationRuleSet;
  answers: Record<string, unknown>;
  serviceId?: string | null;
}): QualificationComputeResult {
  const { questions, ruleSet, answers, serviceId } = input;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const scoreBreakdown: Record<string, number> = {};
  let totalScore = 0;
  let maxScore = 0;

  const visible = questions
    .filter((q) => {
      if (!isQuestionVisible(q, answers, byId)) return false;
      if (q.service_ids?.length && serviceId) {
        return q.service_ids.includes(serviceId);
      }
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const q of visible) {
    const pts = pointsForAnswer(q, answers[q.key]);
    scoreBreakdown[q.key] = pts;
    totalScore += pts;
    maxScore += q.max_points || 0;
  }

  const ruleHits: { id: string; label: string; outcome: string }[] = [];
  let forced: QualificationOutcome | null = null;

  for (const rule of ruleSet.hard_rules ?? []) {
    if (matchRule(rule, answers)) {
      ruleHits.push({ id: rule.id, label: rule.label, outcome: rule.outcome });
      // Hardest outcome wins: not_eligible > manual_review
      if (rule.outcome === "not_eligible") forced = "not_eligible";
      else if (rule.outcome === "manual_review" && forced !== "not_eligible") {
        forced = "manual_review";
      }
    }
  }

  let outcome: QualificationOutcome;
  if (forced === "not_eligible") {
    outcome = "not_eligible";
  } else if (forced === "manual_review") {
    outcome = "manual_review";
  } else if (totalScore >= ruleSet.min_qualifying_score) {
    outcome = "qualified";
  } else if (
    ruleSet.manual_review_min_score != null &&
    ruleSet.manual_review_max_score != null &&
    totalScore >= ruleSet.manual_review_min_score &&
    totalScore <= ruleSet.manual_review_max_score
  ) {
    outcome = "manual_review";
  } else if (
    ruleSet.manual_review_min_score != null &&
    totalScore >= ruleSet.manual_review_min_score &&
    totalScore < ruleSet.min_qualifying_score
  ) {
    outcome = "manual_review";
  } else {
    outcome = "not_eligible";
  }

  const thresholds = ruleSet.priority_thresholds ?? { high: 80, medium: 50, low: 0 };
  let priority: "high" | "medium" | "low" = "low";
  if (totalScore >= thresholds.high) priority = "high";
  else if (totalScore >= thresholds.medium) priority = "medium";

  const message =
    ruleSet.outcome_messages?.[outcome] ||
    (outcome === "qualified"
      ? "Based on your responses, your business appears to be a strong fit. Select a time below to continue."
      : outcome === "manual_review"
        ? "Thank you for submitting your information. Our team will review your request and contact you regarding the best next step."
        : "Thank you for your interest. Based on the information provided, a direct strategy consultation may not be the best next step at this time.");

  const allowCalendar =
    outcome === "qualified" ||
    (outcome === "manual_review" && ruleSet.allow_calendar_on_manual_review);

  return {
    totalScore,
    maxScore,
    outcome,
    priority,
    ruleHits,
    scoreBreakdown,
    message,
    allowCalendar,
  };
}

/** Validate required answers for visible questions. */
export function validateAnswers(
  questions: QualificationQuestion[],
  answers: Record<string, unknown>,
  serviceId?: string | null
): string[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const errors: string[] = [];
  for (const q of questions) {
    if (!isQuestionVisible(q, answers, byId)) continue;
    if (q.service_ids?.length && serviceId && !q.service_ids.includes(serviceId)) {
      continue;
    }
    if (!q.required) continue;
    const val = answers[q.key];
    if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) {
      errors.push(q.key);
    }
  }
  return errors;
}
