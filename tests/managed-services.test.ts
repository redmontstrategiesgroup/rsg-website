/**
 * Managed-services domain tests: plan recommendation engine, default plan
 * integrity, request inclusion / SLA rules, and upgrade recommendations.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

import {
  recommendPlan,
  sanitizeServicePlanAnswers,
} from "../lib/managed-services/recommend.ts";
import {
  COMPARISON_CATEGORIES,
  DEFAULT_PLANS,
} from "../lib/managed-services/content.ts";
import { STANDARD_PLAN_KEYS } from "../lib/managed-services/types.ts";
import type {
  HoursUsage,
  ServiceRequest,
  ServiceRequestType,
} from "../lib/managed-services/types.ts";

// ---------------------------------------------------------------------------
// store.ts uses the "@/…" tsconfig path alias, which plain `node --test`
// cannot resolve. Register a resolve hook that maps "@/x" → "<repo>/x(.ts)".
// ---------------------------------------------------------------------------

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context?: unknown) => unknown
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(path.join(repoRoot, spec.slice(2))).href;
    }
    try {
      return nextResolve(spec, context);
    } catch (err) {
      // Source files import extensionless TS specifiers (bundler resolution);
      // retry with the extensions Node's type-stripping loader accepts.
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try {
          return nextResolve(`${spec}${suffix}`, context);
        } catch {
          /* try the next candidate */
        }
      }
      throw err;
    }
  },
});

const { requestInclusionFor, responseSlaHours, computeUpgradeRecommendations } =
  await import("../lib/managed-services/store.ts");

// ---------------------------------------------------------------------------
// recommendPlan
// ---------------------------------------------------------------------------

describe("recommendPlan", () => {
  it("maintenance_only recommends Maintain", () => {
    const rec = recommendPlan({ ongoingNeeds: "maintenance_only" });
    assert.equal(rec?.planKey, "maintain");
  });

  it("ongoing_improvements recommends Optimize", () => {
    const rec = recommendPlan({ ongoingNeeds: "ongoing_improvements" });
    assert.equal(rec?.planKey, "optimize");
  });

  it("automation interest recommends Scale", () => {
    const rec = recommendPlan({
      ongoingNeeds: "maintenance_only",
      automationInterest: "yes",
    });
    assert.equal(rec?.planKey, "scale");
  });

  it("AI systems under management recommend Managed Infrastructure", () => {
    const rec = recommendPlan({ aiManagement: "yes" });
    assert.equal(rec?.planKey, "managed_infrastructure");
  });

  it("sensitive data recommends Managed Infrastructure", () => {
    const rec = recommendPlan({ sensitiveData: "yes" });
    assert.equal(rec?.planKey, "managed_infrastructure");
  });

  it("same-day support lands on at least Scale", () => {
    const rec = recommendPlan({ supportSpeed: "same_day" });
    assert.ok(rec);
    assert.ok(
      ["scale", "managed_infrastructure"].includes(rec.planKey),
      `expected at least scale, got ${rec.planKey}`
    );
  });

  it("returns null when no answers were provided", () => {
    assert.equal(recommendPlan({}), null);
    assert.equal(recommendPlan(null), null);
    assert.equal(recommendPlan(undefined), null);
  });

  it("always includes a consultative reason", () => {
    const rec = recommendPlan({ ongoingNeeds: "ongoing_improvements" });
    assert.ok(rec && rec.reason.length > 0);
  });
});

// ---------------------------------------------------------------------------
// sanitizeServicePlanAnswers
// ---------------------------------------------------------------------------

describe("sanitizeServicePlanAnswers", () => {
  it("drops invalid values but keeps valid ones", () => {
    const sanitized = sanitizeServicePlanAnswers({
      hasMaintainer: "nope",
      ongoingNeeds: "maintenance_only",
      supportSpeed: 42,
      billingPreference: "monthly",
    });
    assert.ok(sanitized);
    assert.equal(sanitized.hasMaintainer, undefined);
    assert.equal(sanitized.supportSpeed, undefined);
    assert.equal(sanitized.ongoingNeeds, "maintenance_only");
    assert.equal(sanitized.billingPreference, "monthly");
  });

  it("returns null for an empty object", () => {
    assert.equal(sanitizeServicePlanAnswers({}), null);
  });

  it("returns null for non-object values", () => {
    assert.equal(sanitizeServicePlanAnswers(null), null);
    assert.equal(sanitizeServicePlanAnswers("maintain"), null);
    assert.equal(sanitizeServicePlanAnswers(undefined), null);
  });

  it("returns null when every value is invalid", () => {
    assert.equal(
      sanitizeServicePlanAnswers({ hasMaintainer: "banana", supportSpeed: "asap" }),
      null
    );
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PLANS integrity
// ---------------------------------------------------------------------------

describe("DEFAULT_PLANS integrity", () => {
  it("defines exactly the four standard plans", () => {
    assert.equal(DEFAULT_PLANS.length, 4);
    assert.deepEqual(
      new Set(DEFAULT_PLANS.map((p) => p.key)),
      new Set(STANDARD_PLAN_KEYS)
    );
  });

  it("every comparison category is present in each plan's comparison", () => {
    for (const plan of DEFAULT_PLANS) {
      for (const category of COMPARISON_CATEGORIES) {
        assert.ok(
          category.key in plan.comparison,
          `${plan.key} is missing comparison "${category.key}"`
        );
      }
    }
  });

  it("exactly one plan is marked recommended", () => {
    assert.equal(DEFAULT_PLANS.filter((p) => p.recommended).length, 1);
  });

  it("managed_infrastructure is business-critical with custom pricing", () => {
    const infra = DEFAULT_PLANS.find((p) => p.key === "managed_infrastructure");
    assert.ok(infra);
    assert.equal(infra.businessCritical, true);
    assert.equal(infra.customPricing, true);
    assert.equal(infra.monthlyPriceCents, null);
  });
});

// ---------------------------------------------------------------------------
// requestInclusionFor / responseSlaHours
// ---------------------------------------------------------------------------

describe("requestInclusionFor / responseSlaHours", () => {
  it("managed_infrastructure includes substantive request types with a 4h SLA", () => {
    const substantive: ServiceRequestType[] = [
      "technical_issue",
      "website_change",
      "crm_change",
      "automation_request",
      "ai_knowledge_update",
      "new_integration",
      "reporting_request",
      "security_concern",
      "infrastructure_issue",
      "strategy_request",
    ];
    for (const type of substantive) {
      assert.equal(
        requestInclusionFor(type, "managed_infrastructure"),
        "included",
        `expected ${type} included on managed_infrastructure`
      );
    }
    assert.equal(responseSlaHours("managed_infrastructure"), 4);
  });

  it("maintain includes technical issues", () => {
    assert.equal(requestInclusionFor("technical_issue", "maintain"), "included");
  });

  it("maintain treats automation requests as extra charge", () => {
    assert.equal(
      requestInclusionFor("automation_request", "maintain"),
      "extra_charge"
    );
  });

  it("SLA hours tighten as tiers rise", () => {
    assert.equal(responseSlaHours("maintain"), 48);
    assert.equal(responseSlaHours("optimize"), 24);
    assert.equal(responseSlaHours("scale"), 8);
    assert.ok(responseSlaHours(null) > responseSlaHours("maintain"));
  });
});

// ---------------------------------------------------------------------------
// computeUpgradeRecommendations
// ---------------------------------------------------------------------------

function makeRequest(type: ServiceRequestType): ServiceRequest {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    clientId: "client-1",
    subscriptionId: null,
    type,
    title: "Test request",
    details: "",
    status: "new",
    priority: "standard",
    inclusion: "pending_assessment",
    acknowledgedConsequences: false,
    estimatedHours: null,
    actualHours: null,
    extraChargeCents: null,
    responseDueAt: null,
    resolvedAt: null,
    adminNotes: "",
    activity: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeUsage(overrides?: Partial<HoursUsage>): HoursUsage {
  return {
    includedHours: 2,
    usedHours: 1.8,
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    approachingLimit: true,
    overLimit: false,
    ...overrides,
  };
}

describe("computeUpgradeRecommendations", () => {
  it("maintain + 3 website changes recommends Optimize", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "maintain",
      requestsLast90Days: [
        makeRequest("website_change"),
        makeRequest("website_change"),
        makeRequest("website_change"),
      ],
      usage: null,
    });
    assert.ok(recs.some((r) => r.targetPlanKey === "optimize"));
  });

  it("optimize + an automation request recommends Scale", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "optimize",
      requestsLast90Days: [makeRequest("automation_request")],
      usage: null,
    });
    assert.ok(recs.some((r) => r.targetPlanKey === "scale"));
  });

  it("approaching the included-hours limit produces a recommendation", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "maintain",
      requestsLast90Days: [],
      usage: makeUsage(),
    });
    assert.ok(recs.length > 0);
    assert.equal(recs[0]!.targetPlanKey, "optimize");
  });

  it("3 technical issues triggers a systems-review recommendation", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "maintain",
      requestsLast90Days: [
        makeRequest("technical_issue"),
        makeRequest("technical_issue"),
        makeRequest("technical_issue"),
      ],
      usage: null,
    });
    assert.ok(recs.length > 0);
    assert.ok(
      recs.some((r) => /systems review/i.test(r.headline)),
      "expected a review-style recommendation"
    );
  });

  it("returns no recommendations for a quiet account", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "scale",
      requestsLast90Days: [],
      usage: makeUsage({ approachingLimit: false, usedHours: 1 }),
    });
    assert.equal(recs.length, 0);
  });

  it("deduplicates recommendations by target plan", () => {
    const recs = computeUpgradeRecommendations({
      planKey: "maintain",
      requestsLast90Days: [
        makeRequest("website_change"),
        makeRequest("website_change"),
        makeRequest("website_change"),
        makeRequest("technical_issue"),
        makeRequest("technical_issue"),
        makeRequest("technical_issue"),
      ],
      usage: makeUsage(),
    });
    const targets = recs.map((r) => r.targetPlanKey);
    assert.equal(new Set(targets).size, targets.length);
  });
});
