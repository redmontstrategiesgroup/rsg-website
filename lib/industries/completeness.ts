/**
 * Content-completeness rules for primary industry pages.
 *
 * A primary vertical may not publish until every critical section carries
 * real, specialized content. The admin console shows this report as a
 * checklist, and the admin API refuses to set status "published" while any
 * check fails. Pure — safe on server and client.
 */

import type {
  CompletenessCheck,
  CompletenessReport,
  IndustryVertical,
} from "./types";

const GENERIC_CTA = /^book a call$/i;

function filled(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

export function checkCompleteness(v: IndustryVertical): CompletenessReport {
  const checks: CompletenessCheck[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) =>
    checks.push({ id, label, ok, detail });

  add(
    "hero",
    "Outcome-driven hero",
    filled(v.hero?.headline) &&
      filled(v.hero?.subheadline) &&
      filled(v.hero?.designedFor) &&
      filled(v.hero?.primaryCta?.label) &&
      filled(v.hero?.demoCta?.href),
    "Headline, subheadline, designed-for statement, primary CTA, and demo CTA."
  );

  const problems = v.problems ?? [];
  add(
    "problems",
    "Unique operational problems",
    problems.length >= 8 && problems.every((p) => filled(p.title) && filled(p.detail)),
    `${problems.length}/8+ problems with title and detail.`
  );

  const stages = v.workflow?.stages ?? [];
  const stagesComplete = stages.every(
    (s) =>
      filled(s.label) &&
      filled(s.happens) &&
      filled(s.system) &&
      s.failures.length > 0 &&
      s.automations.length > 0 &&
      s.kpis.length > 0 &&
      s.integrations.length > 0
  );
  add(
    "workflow",
    "Interactive workflow map",
    stages.length >= 9 && stagesComplete,
    `${stages.length}/9+ stages, each with failures, system, automations, KPIs, and integrations.`
  );

  add(
    "demo",
    "Specialized interactive demo",
    filled(v.demoSlug) &&
      filled(v.demo?.disclaimer) &&
      (v.demo?.highlights?.length ?? 0) >= 6 &&
      (v.demo?.simulations?.length ?? 0) >= 5,
    "Demo slug, simulation list, highlights, and a 'simulated system' disclaimer."
  );

  const systems = v.systems ?? [];
  add(
    "systems",
    "Recommended RSG systems",
    systems.length >= 5 &&
      systems.every(
        (s) =>
          filled(s.name) &&
          filled(s.outcome) &&
          filled(s.timeline) &&
          filled(s.pricing) &&
          s.capabilities.length >= 3
      ),
    `${systems.length}/5+ named systems with outcome, capabilities, timeline, and pricing.`
  );

  const integrations = v.integrations?.items ?? [];
  add(
    "integrations",
    "Relevant integrations",
    integrations.length >= 10 &&
      integrations.every((i) => filled(i.name) && filled(i.connects)) &&
      filled(v.integrations?.disclaimer),
    `${integrations.length}/10+ integrations, each explaining what it connects, plus the availability disclaimer.`
  );

  add(
    "roi",
    "ROI calculator",
    (v.roi?.inputs?.length ?? 0) >= 6 &&
      (v.roi?.assumptions?.length ?? 0) >= 3 &&
      filled(v.roi?.disclaimer) &&
      filled(v.roi?.recommendedSystemId),
    "6+ inputs, tunable assumptions, an estimates-only disclaimer, and a recommended system."
  );

  const compliance = v.compliance?.items ?? [];
  add(
    "compliance",
    "Compliance & risk section",
    compliance.length >= 6 &&
      compliance.every((c) => filled(c.title) && filled(c.detail)) &&
      filled(v.compliance?.disclaimer),
    `${compliance.length}/6+ items plus the no-legal-advice disclaimer.`
  );

  const cs = v.caseStudy;
  add(
    "case-study",
    "Labeled case study",
    Boolean(cs) &&
      (cs.verified === true || filled(cs.label)) &&
      filled(cs.businessType) &&
      filled(cs.problem) &&
      cs.beforeWorkflow.length >= 3 &&
      cs.afterWorkflow.length >= 3 &&
      cs.kpis.length >= 3 &&
      filled(cs.projectionNote),
    "Business profile, before/after workflows, KPIs, and an illustrative label (or verified flag)."
  );

  const ctaOk =
    filled(v.ctas?.primary?.label) &&
    !GENERIC_CTA.test(v.ctas?.primary?.label ?? "") &&
    (v.ctas?.secondary?.length ?? 0) >= 2;
  add(
    "ctas",
    "Specialized calls to action",
    ctaOk,
    'A vertical-specific primary CTA (not just "Book a Call") and 2+ secondary options.'
  );

  add(
    "assessment",
    "Industry assessment form",
    (v.assessment?.questions?.length ?? 0) >= 8 &&
      (v.assessment?.recommendations?.length ?? 0) >= 2 &&
      filled(v.assessment?.fallbackSystemId),
    "8+ vertical-specific questions and answer-driven system recommendations."
  );

  add(
    "seo",
    "SEO metadata & FAQs",
    filled(v.seo?.title) && filled(v.seo?.description) && (v.faqs?.length ?? 0) >= 3,
    "Unique title, description, and 3+ FAQs (rendered and in structured data)."
  );

  return { checks, complete: checks.every((c) => c.ok) };
}
