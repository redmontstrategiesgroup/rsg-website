/**
 * Data model for RSG's industry verticals.
 *
 * Three primary verticals (home services, dental & specialty healthcare,
 * retail & multi-location) each carry deeply industry-specific content:
 * problems, workflow stages, named systems, integrations, compliance
 * items, an illustrative case study, CTAs, and an assessment.
 *
 * Defaults live in lib/industries/content/*. Admins can override any
 * vertical from the admin console; overrides persist via Supabase with a
 * dev file fallback (lib/industries/store.ts). One typed object drives the
 * page, the JSON-LD, and the assessment form, so none of them can drift
 * apart.
 *
 * Systems quote "Custom quote" rather than a number — every engagement is
 * scoped and priced individually, and no page projects a dollar outcome.
 */

export type VerticalSlug = "home-services" | "dental-practices" | "retail";

export const VERTICAL_SLUGS: VerticalSlug[] = [
  "home-services",
  "dental-practices",
  "retail",
];

export type VerticalStatus = "draft" | "published";

export type VerticalCta = { label: string; href: string };

export type VerticalHero = {
  eyebrow: string;
  /** Outcome-driven — never "AI Solutions for X". */
  headline: string;
  subheadline: string;
  primaryCta: VerticalCta;
  /** Always points at the vertical's interactive demo. */
  demoCta: VerticalCta;
  /** Plain statement of who the system is designed for. */
  designedFor: string;
};

export type VerticalProblem = {
  id: string;
  title: string;
  detail: string;
  /** Optional one-line consequence, e.g. "One missed call can be a $9,000 job." */
  cost?: string;
};

export type WorkflowStage = {
  id: string;
  label: string;
  /** What happens during this stage. */
  happens: string;
  /** Common operational failures at this stage. */
  failures: string[];
  /** The RSG system responsible for improving it. */
  system: string;
  /** Relevant automation opportunities. */
  automations: string[];
  /** Key performance indicators worth watching. */
  kpis: string[];
  /** Recommended integrations at this stage. */
  integrations: string[];
};

export type RsgSystem = {
  id: string;
  name: string;
  /** Intended outcome, one sentence. */
  outcome: string;
  capabilities: string[];
  /** Typical implementation timeline, e.g. "2–4 weeks". */
  timeline: string;
  /** Starting price or "Custom quote". Never a guarantee. */
  pricing: string;
  /** Names from the vertical's integration list this system works with. */
  integrations: string[];
  /** Featured at the top of the systems grid when set. */
  flagship?: boolean;
};

export type VerticalIntegration = {
  name: string;
  category: string;
  /** What information or workflow it connects — never a bare logo. */
  connects: string;
};

export type ComplianceItem = {
  title: string;
  detail: string;
};

export type CaseStudy = {
  /** Required honesty label, e.g. "Illustrative scenario". */
  label: string;
  businessType: string;
  size: string;
  problem: string;
  /** Current disconnected systems. */
  currentStack: string[];
  /** Proposed RSG implementation. */
  implementation: string[];
  beforeWorkflow: string[];
  afterWorkflow: string[];
  timeline: string;
  /** KPIs that would be monitored. */
  kpis: string[];
  /** Clearly-labeled projected results. Never presented as verified. */
  projections: { label: string; value: string }[];
  /** Disclaimer rendered with the projections. */
  projectionNote: string;
  /**
   * Set by an admin once real, approved client results exist. Until then the
   * scenario renders with its illustrative label.
   */
  verified?: boolean;
};

export type AssessmentQuestionType = "select" | "text" | "number";

export type AssessmentQuestion = {
  id: string;
  label: string;
  type: AssessmentQuestionType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  helper?: string;
};

export type AssessmentRecommendation = {
  /** Case-insensitive keywords matched against the visitor's answers. */
  keywords: string[];
  systemId: string;
};

export type VerticalAssessment = {
  title: string;
  intro: string;
  questions: AssessmentQuestion[];
  /** Keyword → system mapping used to recommend before booking. */
  recommendations: AssessmentRecommendation[];
  fallbackSystemId: string;
};

export type VerticalFaq = { q: string; a: string };

export type VerticalSeo = {
  title: string;
  description: string;
};

export type IndustryVertical = {
  slug: VerticalSlug;
  status: VerticalStatus;
  /** Full name, e.g. "Home Service & Trade Businesses". */
  name: string;
  /** Short name for nav/breadcrumbs, e.g. "Home Services". */
  shortName: string;
  /** Sub-segments served, e.g. HVAC, plumbing, electrical… */
  audience: string[];
  /** Micro-copy dictionary so page copy uses the industry's own words. */
  terminology: {
    customer: string;
    customers: string;
    job: string;
    jobs: string;
    team: string;
  };
  hero: VerticalHero;
  problemsIntro: string;
  problems: VerticalProblem[];
  workflow: {
    title: string;
    intro: string;
    stages: WorkflowStage[];
  };
  /** Slug of this vertical's demo in components/demos/data. */
  demoSlug: string;
  demo: {
    title: string;
    description: string;
    /** What the simulated system contains. */
    highlights: string[];
    /** What visitors can simulate. */
    simulations: string[];
    disclaimer: string;
  };
  systemsIntro: string;
  systems: RsgSystem[];
  integrations: {
    intro: string;
    /** Required honesty note about integration availability. */
    disclaimer: string;
    items: VerticalIntegration[];
  };
  compliance: {
    title: string;
    intro: string;
    /** "Not legal/medical advice" disclaimer. */
    disclaimer: string;
    items: ComplianceItem[];
  };
  caseStudy: CaseStudy;
  ctas: {
    primary: VerticalCta;
    secondary: VerticalCta[];
  };
  assessment: VerticalAssessment;
  faqs: VerticalFaq[];
  seo: VerticalSeo;
};

export type CompletenessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type CompletenessReport = {
  checks: CompletenessCheck[];
  complete: boolean;
};
