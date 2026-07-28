/**
 * Managed-services content: comparison categories, FAQs, process copy, and
 * per-service plan recommendations. Also carries the default plan definitions
 * used as a read-only fallback when Supabase is not configured (local dev) —
 * the database row, editable in the admin portal, is always the source of
 * truth for pricing in production.
 *
 * Safe to import from client & server components.
 */

import type {
  ComparisonValue,
  ManagedServicePlan,
  StandardPlanKey,
} from "./types";

// ---------------------------------------------------------------------------
// Comparison table
// ---------------------------------------------------------------------------

export type ComparisonCategory = {
  key: string;
  label: string;
  /** Optional clarifier shown under the label. */
  hint?: string;
};

export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  { key: "hosting", label: "Hosting", hint: "Website & application hosting" },
  { key: "backups", label: "Backups", hint: "Automated, with restore capability" },
  { key: "updates", label: "Updates", hint: "Software & dependency updates" },
  { key: "monitoring", label: "Monitoring", hint: "Uptime, forms & integrations" },
  { key: "security", label: "Security", hint: "Monitoring & hardening" },
  { key: "reporting", label: "Reporting", hint: "Delivered to your portal" },
  { key: "conversion_improvements", label: "Conversion improvements" },
  { key: "monthly_system_changes", label: "Monthly system changes" },
  { key: "automation_development", label: "Automation development" },
  { key: "ai_improvements", label: "AI improvements" },
  { key: "strategy_consulting", label: "Strategy consulting" },
  { key: "private_ai_management", label: "Private AI management" },
  { key: "knowledge_base_updates", label: "Knowledge-base updates" },
  { key: "incident_response", label: "Incident response" },
  { key: "support_priority", label: "Support priority" },
];

// ---------------------------------------------------------------------------
// Default plan definitions (fallback when Supabase is unconfigured)
// ---------------------------------------------------------------------------

type DefaultPlan = Omit<ManagedServicePlan, "id" | "createdAt" | "updatedAt">;

const now = "2026-07-16T00:00:00.000Z";

function definePlan(plan: DefaultPlan & { id: string }): ManagedServicePlan {
  return { ...plan, createdAt: now, updatedAt: now };
}

export const DEFAULT_PLANS: ManagedServicePlan[] = [
  definePlan({
    id: "d0000000-0000-4000-8000-000000000001",
    key: "maintain",
    name: "Maintain",
    tagline: "Keep your systems secure, updated, backed up, and working properly.",
    bestFit: "Businesses that need their systems kept secure, functional, and reliable.",
    description:
      "Your website and systems stay fast, protected, and dependable — without you thinking about them.",
    monthlyPriceCents: 39500,
    annualPriceCents: null,
    annualDiscountPct: 10,
    setupFeeCents: 0,
    customPricing: false,
    includedHours: 2,
    additionalHourlyRateCents: 13500,
    supportLevel: "Standard support",
    responseTime: "Response within 2 business days",
    minimumCommitmentMonths: 3,
    cancellationTerms: "30-day written notice after the initial commitment.",
    features: [
      "Website and application hosting",
      "Automated backups",
      "Software and dependency updates",
      "Uptime monitoring",
      "Basic security monitoring",
      "Form and integration monitoring",
      "Performance checks",
      "Minor technical fixes",
      "Monthly system health review",
      "Standard support response time",
    ],
    detailedScope: [
      "Managed hosting for your website and business applications",
      "Automated daily backups with restore capability",
      "Software, plugin, and dependency updates applied and verified",
      "24/7 uptime monitoring with alerting",
      "Baseline security monitoring and patching",
      "Monitoring of forms, booking flows, and connected integrations",
      "Monthly performance checks (speed, availability, errors)",
      "Minor technical fixes and corrections included",
      "A monthly system health review delivered to your portal",
      "Standard support with a 2-business-day response target",
    ],
    addons: [],
    comparison: {
      hosting: "Included",
      backups: "Automated daily",
      updates: "Software & dependencies",
      monitoring: "Uptime, forms & integrations",
      security: "Baseline monitoring",
      reporting: "Monthly health review",
      conversion_improvements: false,
      monthly_system_changes: false,
      automation_development: false,
      ai_improvements: false,
      strategy_consulting: false,
      private_ai_management: false,
      knowledge_base_updates: false,
      incident_response: "Standard",
      support_priority: "Standard — 2 business days",
    },
    recommended: false,
    businessCritical: false,
    tierRank: 1,
    basePlanKey: null,
    clientId: null,
    active: true,
    sortOrder: 10,
  }),
  definePlan({
    id: "d0000000-0000-4000-8000-000000000002",
    key: "optimize",
    name: "Optimize",
    tagline:
      "Continuously improve how your systems perform, convert, and support your team.",
    bestFit:
      "Established businesses that want their website, funnels, and workflows actively improved every month.",
    description:
      "Everything in Maintain, plus ongoing conversion, performance, and workflow improvements backed by monthly analytics.",
    monthlyPriceCents: 89500,
    annualPriceCents: null,
    annualDiscountPct: 10,
    setupFeeCents: 0,
    customPricing: false,
    includedHours: 6,
    additionalHourlyRateCents: 12500,
    supportLevel: "Priority support",
    responseTime: "Response within 1 business day",
    minimumCommitmentMonths: 3,
    cancellationTerms: "30-day written notice after the initial commitment.",
    features: [
      "Everything in Maintain",
      "Conversion-rate improvements",
      "Website and funnel optimization",
      "Monthly analytics reporting",
      "CRM and workflow adjustments",
      "Form and booking-flow improvements",
      "Speed and usability improvements",
      "Lead-tracking verification",
      "Monthly system changes",
      "Performance recommendations",
      "Priority support",
    ],
    detailedScope: [
      "Full Maintain scope: hosting, backups, updates, monitoring, and fixes",
      "Ongoing conversion-rate improvements across pages and funnels",
      "Website and funnel optimization informed by real traffic data",
      "A professional monthly analytics and performance report",
      "CRM and workflow adjustments as your process evolves",
      "Form and booking-flow improvements to reduce drop-off",
      "Speed and usability improvements",
      "Lead-tracking verification so attribution stays accurate",
      "Monthly system changes included within your service hours",
      "Prioritized performance recommendations each month",
      "Priority support with a 1-business-day response target",
    ],
    addons: [],
    comparison: {
      hosting: "Included",
      backups: "Automated daily",
      updates: "Software & dependencies",
      monitoring: "Uptime, funnels & lead tracking",
      security: "Baseline monitoring",
      reporting: "Monthly analytics report",
      conversion_improvements: true,
      monthly_system_changes: "Included",
      automation_development: false,
      ai_improvements: false,
      strategy_consulting: false,
      private_ai_management: false,
      knowledge_base_updates: false,
      incident_response: "Priority",
      support_priority: "Priority — 1 business day",
    },
    recommended: true,
    businessCritical: false,
    tierRank: 2,
    basePlanKey: null,
    clientId: null,
    active: true,
    sortOrder: 20,
  }),
  definePlan({
    id: "d0000000-0000-4000-8000-000000000003",
    key: "scale",
    name: "Scale",
    tagline:
      "Expand your technology, automation, and growth systems as your business evolves.",
    bestFit:
      "Growing businesses that want new automation, AI improvements, and strategic development every month.",
    description:
      "Everything in Optimize, plus active development: new automations, AI assistant improvements, integrations, and monthly strategy consulting.",
    monthlyPriceCents: 179500,
    annualPriceCents: null,
    annualDiscountPct: 10,
    setupFeeCents: 0,
    customPricing: false,
    includedHours: 14,
    additionalHourlyRateCents: 11500,
    supportLevel: "High-priority support",
    responseTime: "Response same business day",
    minimumCommitmentMonths: 6,
    cancellationTerms: "30-day written notice after the initial commitment.",
    features: [
      "Everything in Optimize",
      "New automation development",
      "AI assistant improvements",
      "Workflow expansion",
      "Campaign-system development",
      "Lead-nurturing improvements",
      "Sales-pipeline optimization",
      "Internal operational systems",
      "New integrations",
      "Monthly strategy consulting",
      "Growth experiments",
      "Quarterly technology roadmap",
      "Higher-priority support",
    ],
    detailedScope: [
      "Full Optimize scope: maintenance, monitoring, and monthly improvements",
      "New automation development scoped and shipped each month",
      "AI assistant improvements, training, and knowledge updates",
      "Workflow expansion across sales, operations, and delivery",
      "Campaign-system development for launches and promotions",
      "Lead-nurturing sequence improvements",
      "Sales-pipeline optimization and reporting",
      "Internal operational systems built as you grow",
      "New integrations connected and monitored",
      "A monthly strategy consulting session with your RSG consultant",
      "Structured growth experiments with measured results",
      "A quarterly technology roadmap reviewed and approved together",
      "High-priority support with same-business-day response",
    ],
    addons: [],
    comparison: {
      hosting: "Included",
      backups: "Automated daily",
      updates: "Software & dependencies",
      monitoring: "Full-stack monitoring",
      security: "Enhanced monitoring",
      reporting: "Monthly analytics + strategy report",
      conversion_improvements: true,
      monthly_system_changes: "Expanded",
      automation_development: true,
      ai_improvements: "AI assistant improvements",
      strategy_consulting: "Monthly",
      private_ai_management: false,
      knowledge_base_updates: "With AI improvements",
      incident_response: "Priority",
      support_priority: "High priority — same business day",
    },
    recommended: false,
    businessCritical: false,
    tierRank: 3,
    basePlanKey: null,
    clientId: null,
    active: true,
    sortOrder: 30,
  }),
  definePlan({
    id: "d0000000-0000-4000-8000-000000000004",
    key: "managed_infrastructure",
    name: "Managed Infrastructure",
    tagline:
      "Fully managed private AI, security, hosting, and infrastructure for business-critical systems.",
    bestFit:
      "Organizations running private AI, sensitive data, advanced integrations, or business-critical infrastructure.",
    description:
      "RSG operates your private AI and infrastructure end to end — deployment, security, model management, testing, and priority incident response.",
    monthlyPriceCents: null,
    annualPriceCents: null,
    annualDiscountPct: 0,
    setupFeeCents: 0,
    customPricing: true,
    includedHours: null,
    additionalHourlyRateCents: null,
    supportLevel: "Business-critical support",
    responseTime: "Priority incident response — 4 business hours",
    minimumCommitmentMonths: 6,
    cancellationTerms: "60-day written notice with a managed transition plan.",
    features: [
      "Private AI hosting",
      "Private-cloud or local deployment management",
      "Security monitoring",
      "Model management",
      "AI performance monitoring",
      "Knowledge-base updates",
      "Permission and access management",
      "Audit-log review",
      "Backup and recovery management",
      "Infrastructure monitoring",
      "Vendor and API monitoring",
      "Prompt-injection and data-leakage testing",
      "Human-approval controls for sensitive AI actions",
      "Priority incident response",
      "Priority technical support",
      "Regular infrastructure reviews",
    ],
    detailedScope: [
      "Private AI hosting on infrastructure you control",
      "Private-cloud or fully local deployment management",
      "Continuous security monitoring and hardening",
      "Model management: versioning, evaluation, and upgrades",
      "AI performance monitoring with quality benchmarks",
      "Knowledge-base updates so answers stay accurate",
      "Permission and access management across your team",
      "Regular audit-log review with findings reported",
      "Backup and recovery management, tested restores included",
      "Infrastructure monitoring across servers, storage, and network",
      "Vendor and API monitoring for every connected service",
      "Scheduled prompt-injection and data-leakage testing",
      "Human-approval controls for sensitive AI actions",
      "Priority incident response within 4 business hours",
      "Priority technical support for your whole team",
      "Regular infrastructure reviews with your RSG engineer",
    ],
    addons: [],
    comparison: {
      hosting: "Private / dedicated infrastructure",
      backups: "Managed backup & recovery",
      updates: "Full stack, including models",
      monitoring: "Infrastructure, vendor & API",
      security: "Continuous + AI security testing",
      reporting: "Full infrastructure reporting",
      conversion_improvements: "Where applicable",
      monthly_system_changes: "Included",
      automation_development: "Scoped per agreement",
      ai_improvements: "Full model & AI management",
      strategy_consulting: "Regular infrastructure reviews",
      private_ai_management: true,
      knowledge_base_updates: "Included",
      incident_response: "Priority — 4 business hours",
      support_priority: "Business-critical",
    },
    recommended: false,
    businessCritical: true,
    tierRank: 4,
    basePlanKey: null,
    clientId: null,
    active: true,
    sortOrder: 40,
  }),
];

export function defaultPlanByKey(key: string): ManagedServicePlan | null {
  return DEFAULT_PLANS.find((p) => p.key === key) ?? null;
}

// ---------------------------------------------------------------------------
// Pricing display helpers (client-safe)
// ---------------------------------------------------------------------------

export function formatMonthlyPrice(plan: {
  monthlyPriceCents: number | null;
  customPricing: boolean;
}): string {
  if (plan.customPricing || plan.monthlyPriceCents == null) {
    return "Custom Monthly Pricing";
  }
  return `${formatCents(plan.monthlyPriceCents)}/mo`;
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Effective annual price in cents (explicit, or monthly × 12 less discount). */
export function annualPriceCents(plan: {
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  annualDiscountPct: number;
  customPricing: boolean;
}): number | null {
  if (plan.customPricing) return null;
  if (plan.annualPriceCents != null) return plan.annualPriceCents;
  if (plan.monthlyPriceCents == null) return null;
  const gross = plan.monthlyPriceCents * 12;
  return Math.round(gross * (1 - plan.annualDiscountPct / 100));
}

export function comparisonCell(value: ComparisonValue | undefined): {
  included: boolean;
  label: string | null;
} {
  if (value === true) return { included: true, label: null };
  if (value === false || value === undefined || value === "")
    return { included: false, label: null };
  return { included: true, label: String(value) };
}

// ---------------------------------------------------------------------------
// Page copy: why ongoing management, how it works, FAQs
// ---------------------------------------------------------------------------

export const MANAGED_SERVICES_HEADLINE = "Your Systems Should Improve After Launch";

export const MANAGED_SERVICES_SUBHEAD =
  "RSG provides ongoing hosting, maintenance, optimization, automation development, AI management, security, and strategic support. Instead of launching a system and leaving you to manage it alone, we continue improving the technology behind your business.";

export const PARTNERSHIP_LINE =
  "Your initial implementation creates cash flow. Ongoing management creates lasting business value.";

export const WHY_ONGOING: { title: string; body: string }[] = [
  {
    title: "Software doesn't stand still",
    body: "Dependencies age, integrations change their APIs, and browsers update. A system that is never maintained gets slower, less secure, and less reliable every month it runs untouched.",
  },
  {
    title: "Security is a process, not a feature",
    body: "New vulnerabilities are disclosed constantly. Patching, monitoring, backups, and access reviews are ongoing work — the cost of skipping them shows up at the worst possible time.",
  },
  {
    title: "Performance compounds",
    body: "Small monthly improvements to conversion, speed, and follow-up compound into meaningful revenue. The businesses that win treat their systems as assets under active management.",
  },
  {
    title: "AI needs an operator",
    body: "AI assistants and automations drift as your business changes. Knowledge bases go stale, models improve, and new risks emerge. Managed AI keeps quality, safety, and accuracy on track.",
  },
];

export const HOW_IT_WORKS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "Systems review",
    body: "We start with a review of everything you run — website, funnels, CRM, automations, AI — and establish a baseline for health, security, and performance.",
  },
  {
    step: "02",
    title: "Choose your plan",
    body: "Based on what you run and where you're headed, we recommend a management plan. Every agreement states exactly what's included, response targets, and terms.",
  },
  {
    step: "03",
    title: "Onboarding & baseline report",
    body: "We take over hosting, monitoring, backups, and access, then deliver an initial baseline report so you can see the starting point we'll improve from.",
  },
  {
    step: "04",
    title: "Ongoing management",
    body: "Work happens every month — maintenance, improvements, development — logged in your client portal with hours tracked against your plan.",
  },
  {
    step: "05",
    title: "Reporting & reviews",
    body: "You receive a professional monthly report, and on Scale and Managed Infrastructure we run quarterly roadmap reviews to approve the next phase of improvements.",
  },
];

export const MANAGED_SERVICES_FAQS: { q: string; a: string }[] = [
  {
    q: "What's the difference between the four plans?",
    a: "Maintain keeps your systems secure, updated, backed up, and working. Optimize adds active monthly improvement — conversion, speed, funnels, and analytics reporting. Scale adds new development every month: automations, AI improvements, integrations, and strategy consulting. Managed Infrastructure is our enterprise tier for private AI, sensitive data, and business-critical systems, fully operated by RSG.",
  },
  {
    q: "Do I have to be an existing RSG client?",
    a: "No. Most clients start with an implementation and continue into a management plan, but we also take over systems other teams built. Every engagement starts with a systems review so we know exactly what we're taking responsibility for.",
  },
  {
    q: "What happens if I don't choose a management plan?",
    a: "You own everything we build, and you're free to manage it yourself or with another provider. We'll hand over credentials, documentation, and a transition checklist. Without ongoing management, though, updates, backups, monitoring, and improvements become your responsibility.",
  },
  {
    q: "What are 'included service hours'?",
    a: "Each plan includes a monthly allocation of hands-on work — changes, fixes, and improvements. Routine monitoring, backups, and updates don't consume your hours. If a request exceeds your remaining hours we'll tell you before any work starts, and unused monitoring never rolls into surprise invoices.",
  },
  {
    q: "How does billing work?",
    a: "Plans bill monthly or annually — annual billing carries a discount. Payment runs on secure card billing with automatic invoices, and your billing history and invoices are always available in your client portal.",
  },
  {
    q: "Can I upgrade or downgrade?",
    a: "You can upgrade at any time and the change takes effect immediately, prorated. Downgrades take effect at your next renewal. Managed Infrastructure changes go through a request-and-review process because those systems are business-critical.",
  },
  {
    q: "What if I want to cancel?",
    a: "Standard plans require 30-day written notice after the initial commitment. Managed Infrastructure requires 60 days with a managed transition plan — we never leave a business-critical system unattended. You keep everything: code, content, data, and documentation.",
  },
  {
    q: "Is there a minimum commitment?",
    a: "Maintain and Optimize carry a 3-month initial commitment; Scale and Managed Infrastructure carry 6 months. Meaningful improvement takes more than one billing cycle, and the commitment lets us plan real work rather than month-to-month firefighting.",
  },
  {
    q: "Who does the work?",
    a: "RSG — the same team that designs and builds these systems. Nothing is outsourced. Every managed client has a named account manager and a technical owner responsible for their systems.",
  },
  {
    q: "What does 'business-critical support' mean on Managed Infrastructure?",
    a: "A 4-business-hour incident response target, priority access to our engineers, human-approval controls on sensitive AI actions, and scheduled security testing including prompt-injection and data-leakage checks. It's the tier we recommend whenever downtime or a data mistake would materially hurt the business.",
  },
];

// ---------------------------------------------------------------------------
// Per-service recommendations ("What Happens After Launch?" sections)
// ---------------------------------------------------------------------------

export type ServiceRecommendation = {
  /** Primary recommended plan. */
  primary: StandardPlanKey;
  /** Optional secondary plan. */
  secondary: StandardPlanKey | null;
  /** True when the plan is effectively required (private AI). */
  required: boolean;
  /** One consultative sentence tailored to the service. */
  note: string;
};

export const SERVICE_PLAN_RECOMMENDATIONS: Record<string, ServiceRecommendation> = {
  website: {
    primary: "maintain",
    secondary: "optimize",
    required: false,
    note: "A new website needs hosting, updates, backups, and monitoring from day one — and converts better when it's improved monthly.",
  },
  growth_system: {
    primary: "optimize",
    secondary: "scale",
    required: false,
    note: "Lead-generation systems earn their keep when funnels, tracking, and follow-up are tuned every month.",
  },
  operations_system: {
    primary: "optimize",
    secondary: "scale",
    required: false,
    note: "Operational systems evolve with your process — ongoing workflow adjustments keep them matched to how your team actually works.",
  },
  crm_automation: {
    primary: "optimize",
    secondary: "scale",
    required: false,
    note: "CRMs and automations drift as your business changes. Managed adjustments keep pipelines, sequences, and integrations accurate.",
  },
  private_ai: {
    primary: "managed_infrastructure",
    secondary: null,
    required: true,
    note: "Private AI is business-critical infrastructure. We strongly recommend Managed Infrastructure: model management, security testing, knowledge-base updates, and priority incident response.",
  },
  consulting: {
    primary: "optimize",
    secondary: "scale",
    required: false,
    note: "Strategy is only as good as the systems that execute it. Ongoing management turns recommendations into compounding results.",
  },
};

/** Approved recurring-service language (see brand guidance). */
export const PREFERRED_LANGUAGE = [
  "Managed services",
  "Ongoing system management",
  "Continuous improvement",
  "Managed infrastructure",
  "Technology partnership",
  "Performance optimization",
  "Strategic system development",
  "Business-critical support",
] as const;
