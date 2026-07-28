/**
 * Plan recommendation engine.
 *
 * Turns the booking funnel's ongoing-support answers into a consultative
 * plan recommendation. The result is stored on the lead and is always
 * editable by an RSG administrator — this is a starting point for the
 * conversation, never a binding quote.
 */

import type {
  PlanRecommendation,
  ServicePlanAnswers,
  StandardPlanKey,
} from "./types";

const TIER_ORDER: StandardPlanKey[] = [
  "maintain",
  "optimize",
  "scale",
  "managed_infrastructure",
];

function tierAtLeast(a: StandardPlanKey, b: StandardPlanKey): StandardPlanKey {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

/**
 * Recommend a plan from qualification answers. Returns null when no
 * ongoing-support answers were provided at all.
 */
export function recommendPlan(
  answers: ServicePlanAnswers | null | undefined
): PlanRecommendation | null {
  if (!answers) return null;
  const answered = Object.values(answers).some(
    (v) => typeof v === "string" && v.length > 0
  );
  if (!answered) return null;

  let plan: StandardPlanKey = "maintain";
  const reasons: string[] = [];

  // Ongoing needs are the primary signal.
  if (answers.ongoingNeeds === "ongoing_improvements") {
    plan = tierAtLeast(plan, "optimize");
    reasons.push("you want your systems actively improved, not just kept online");
  } else if (answers.ongoingNeeds === "occasional_changes") {
    plan = tierAtLeast(plan, "optimize");
    reasons.push("you expect regular changes beyond basic maintenance");
  } else if (answers.ongoingNeeds === "maintenance_only") {
    reasons.push("you primarily need reliable maintenance and monitoring");
  }

  // Automation development pushes to Scale.
  if (answers.automationInterest === "yes") {
    plan = tierAtLeast(plan, "scale");
    reasons.push("you're interested in ongoing automation development");
  } else if (answers.automationInterest === "maybe" && plan === "maintain") {
    plan = "optimize";
  }

  // Same-day support expectations exceed Maintain/Optimize targets.
  if (answers.supportSpeed === "same_day") {
    plan = tierAtLeast(plan, "scale");
    reasons.push("you need same-day support response");
  }

  // AI systems under management, or sensitive data, point to
  // Managed Infrastructure.
  if (answers.aiManagement === "yes") {
    plan = "managed_infrastructure";
    reasons.push("you run AI systems that require professional management");
  } else if (answers.aiManagement === "planning_to") {
    plan = tierAtLeast(plan, "scale");
    reasons.push("you're planning AI systems that will need management");
  }

  if (answers.sensitiveData === "yes") {
    plan = "managed_infrastructure";
    reasons.push("you handle confidential or sensitive business data");
  }

  // No current maintainer strengthens the case but doesn't change tier.
  if (answers.hasMaintainer === "no") {
    reasons.push("nobody currently maintains your website and systems");
  }

  const alternative = alternativeFor(plan);
  const reason = reasons.length
    ? `Based on your answers — ${dedupe(reasons).slice(0, 3).join("; ")}.`
    : "Based on your answers.";

  return { planKey: plan, alternativeKey: alternative, reason };
}

function alternativeFor(plan: StandardPlanKey): StandardPlanKey | null {
  switch (plan) {
    case "maintain":
      return "optimize";
    case "optimize":
      return "scale";
    case "scale":
      return "optimize";
    case "managed_infrastructure":
      return "scale";
    default:
      return null;
  }
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/** Validate an arbitrary value into ServicePlanAnswers (server-side). */
export function sanitizeServicePlanAnswers(
  value: unknown
): ServicePlanAnswers | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const pick = <T extends string>(key: string, allowed: T[]): T | undefined => {
    const raw = v[key];
    return typeof raw === "string" && (allowed as string[]).includes(raw)
      ? (raw as T)
      : undefined;
  };
  const answers: ServicePlanAnswers = {
    hasMaintainer: pick("hasMaintainer", ["yes", "no", "partially"]),
    ongoingNeeds: pick("ongoingNeeds", [
      "maintenance_only",
      "occasional_changes",
      "ongoing_improvements",
    ]),
    automationInterest: pick("automationInterest", ["yes", "maybe", "no"]),
    aiManagement: pick("aiManagement", ["yes", "planning_to", "no"]),
    sensitiveData: pick("sensitiveData", ["yes", "no", "unsure"]),
    supportSpeed: pick("supportSpeed", ["same_day", "next_day", "within_days"]),
    billingPreference: pick("billingPreference", [
      "monthly",
      "annual",
      "undecided",
    ]),
  };
  const hasAny = Object.values(answers).some((x) => x !== undefined);
  return hasAny ? answers : null;
}
