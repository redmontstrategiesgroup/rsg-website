/**
 * Post-booking preparation questionnaire content.
 *
 * Templates are keyed by service category (plus a "general" fallback) and are
 * built from the shared form model in @/lib/lifecycle/types. Every question a
 * client can reasonably skip is marked `required: false`.
 *
 * IMPORTANT: this form never collects passwords or credentials. Access
 * questions only ask WHETHER the client can provide access; credentials are
 * exchanged later through a secure channel.
 *
 * This file is intentionally dependency-free (type-only imports) so the form
 * definitions can be rendered anywhere.
 */

import type { FormQuestion, FormSection, PrepBrief } from "./types.ts";

// ---------------------------------------------------------------------------
// Shared option sets & copy
// ---------------------------------------------------------------------------

const ACCESS_HELP =
  "Never type passwords or login details into this form. Just tell us whether access is something you could provide — if we work together, credentials are exchanged later through a secure channel.";

const ACCESS_OPTIONS = [
  { value: "can_provide", label: "Yes — I can provide access" },
  { value: "partial", label: "Some of it — not everything" },
  { value: "no_access", label: "No — I don't have access myself" },
  { value: "not_applicable", label: "Doesn't apply to us" },
];

const BUDGET_OPTIONS = [
  { value: "under_5k", label: "Under $5,000" },
  { value: "5k_15k", label: "$5,000 – $15,000" },
  { value: "15k_50k", label: "$15,000 – $50,000" },
  { value: "over_50k", label: "Over $50,000" },
  { value: "not_sure", label: "Not sure yet" },
];

const DECISION_COUNT_OPTIONS = [
  { value: "1", label: "Just me" },
  { value: "2_3", label: "2–3 people" },
  { value: "4_5", label: "4–5 people" },
  { value: "6_plus", label: "6 or more" },
];

const BRAND_ASSETS_OPTIONS = [
  { value: "ready", label: "Yes — logo, colors, and fonts are ready to share" },
  { value: "partial", label: "Some of it exists" },
  { value: "none", label: "No brand assets yet" },
  { value: "not_sure", label: "Not sure" },
];

const TIMING_OPTIONS = [
  { value: "asap", label: "As soon as possible" },
  { value: "1_3_months", label: "Within 1–3 months" },
  { value: "3_6_months", label: "Within 3–6 months" },
  { value: "exploring", label: "No rush — still exploring" },
];

// ---------------------------------------------------------------------------
// Shared question builders
// ---------------------------------------------------------------------------

function successMetricsQuestion(): FormQuestion {
  return {
    key: "success_metrics",
    label: "Six months from now, how will you measure whether this worked?",
    type: "textarea",
    required: false,
    placeholder:
      "e.g. response time under 5 minutes, 10 more booked jobs a month, my evenings back",
    help: "Numbers are great, but “I stopped doing paperwork at 9pm” counts too. Skip if you're not sure yet.",
  };
}

function currentSoftwareQuestion(placeholder: string): FormQuestion {
  return {
    key: "current_software",
    label: "What software and tools does the business run on today?",
    type: "textarea",
    required: false,
    placeholder,
    help: "List whatever comes to mind — spreadsheets, group texts, and paper systems all count.",
  };
}

function existingVendorsQuestion(): FormQuestion {
  return {
    key: "existing_vendors",
    label: "Do you work with any outside vendors or agencies we should know about?",
    type: "textarea",
    required: false,
    placeholder: "e.g. a marketing agency, bookkeeper, IT support, answering service",
    help: "This helps us avoid stepping on work that's already being done well.",
  };
}

function teamStructureQuestion(): FormQuestion {
  return {
    key: "team_structure",
    label: "Who's on the team, and what does each person handle?",
    type: "textarea",
    required: false,
    placeholder: "A rough sketch is fine — roles matter more than names.",
  };
}

function decisionMakersQuestion(): FormQuestion {
  return {
    key: "decision_makers",
    label: "Who, besides you, will weigh in on this decision?",
    type: "textarea",
    required: false,
    placeholder: "Names and roles — e.g. co-owner, office manager, business partner",
    help: "If it's just you, feel free to say so or skip this.",
  };
}

function decisionCountQuestion(): FormQuestion {
  return {
    key: "decision_maker_count",
    label: "How many people will be involved in the final decision?",
    type: "select",
    required: false,
    options: DECISION_COUNT_OPTIONS,
  };
}

function budgetQuestion(): FormQuestion {
  return {
    key: "budget_range",
    label: "Have you set aside a budget range for this project?",
    type: "select",
    required: false,
    options: BUDGET_OPTIONS,
    help: "This helps us recommend a right-sized solution. There's no wrong answer, and “not sure yet” is completely fine.",
  };
}

function integrationsQuestion(): FormQuestion {
  return {
    key: "required_integrations",
    label: "Are there tools this solution absolutely must connect with?",
    type: "textarea",
    required: false,
    placeholder: "e.g. QuickBooks, Google Calendar, our phone system",
    tooltip:
      "An integration means two software tools passing information back and forth automatically — like your booking calendar creating invoices in QuickBooks.",
  };
}

function securityQuestion(help?: string): FormQuestion {
  return {
    key: "security_requirements",
    label: "Any security, privacy, or compliance requirements we should design around?",
    type: "textarea",
    required: false,
    placeholder: "e.g. HIPAA, customer data rules, insurance requirements — or “none I know of”",
    tooltip:
      "Compliance means rules your industry requires you to follow when handling information — like HIPAA for health data or PCI for card payments.",
    help,
  };
}

function brandAssetsQuestion(): FormQuestion {
  return {
    key: "brand_assets",
    label: "Do you have brand assets ready to use (logo, colors, fonts)?",
    type: "select",
    required: false,
    options: BRAND_ASSETS_OPTIONS,
    help: "If some of it exists but you're not sure where, choose “some of it exists”.",
  };
}

function documentsQuestion(): FormQuestion {
  return {
    key: "process_documents",
    label: "Have documents that show how things work today? Upload them here.",
    type: "file",
    required: false,
    help: "File upload is available — process maps, org charts, price sheets, screenshots, or anything else useful. Skip this if nothing comes to mind.",
  };
}

function constraintsQuestion(): FormQuestion {
  return {
    key: "project_constraints",
    label: "Is there anything that could constrain this project we should know upfront?",
    type: "textarea",
    required: false,
    placeholder: "e.g. busy season timing, staff changes, other projects in flight, a hard deadline",
  };
}

function timingQuestion(): FormQuestion {
  return {
    key: "launch_timing",
    label: "When would you ideally like this up and running?",
    type: "select",
    required: false,
    options: TIMING_OPTIONS,
  };
}

function accessQuestion(key: string, label: string, tooltip?: string): FormQuestion {
  return {
    key,
    label,
    type: "select",
    required: false,
    options: ACCESS_OPTIONS,
    help: ACCESS_HELP,
    tooltip,
  };
}

// ---------------------------------------------------------------------------
// Template assembly
// ---------------------------------------------------------------------------

type TemplateCopy = {
  key: string;
  label: string;
  goalsDescription: string;
  goalsLabel: string;
  goalsPlaceholder: string;
  workflowLabel: string;
  workflowPlaceholder: string;
  softwarePlaceholder: string;
  /** Template-specific questions appended to "How things run today". */
  currentExtras?: FormQuestion[];
  /** Template-specific questions appended to the requirements section. */
  projectExtras?: FormQuestion[];
  /** Which access-readiness questions this template asks. */
  accessQuestions: FormQuestion[];
  includeBrandAssets: boolean;
};

function buildTemplate(copy: TemplateCopy): { key: string; label: string; sections: FormSection[] } {
  return {
    key: copy.key,
    label: copy.label,
    sections: [
      {
        key: "goals",
        label: "Goals & success",
        description: copy.goalsDescription,
        estimatedMinutes: 3,
        questions: [
          {
            key: "business_goals",
            label: copy.goalsLabel,
            type: "textarea",
            required: true,
            placeholder: copy.goalsPlaceholder,
            help: "Two or three sentences is plenty — this shapes the whole conversation.",
          },
          successMetricsQuestion(),
        ],
      },
      {
        key: "current_state",
        label: "How things run today",
        description:
          "No need to polish anything here — the honest, messy version is the most useful one.",
        estimatedMinutes: 4,
        questions: [
          {
            key: "current_workflow",
            label: copy.workflowLabel,
            type: "textarea",
            required: true,
            placeholder: copy.workflowPlaceholder,
          },
          currentSoftwareQuestion(copy.softwarePlaceholder),
          existingVendorsQuestion(),
          ...(copy.currentExtras ?? []),
        ],
      },
      {
        key: "team",
        label: "Team & decision-makers",
        description: "Understanding who does what helps us design around real people, not org charts.",
        estimatedMinutes: 2,
        questions: [teamStructureQuestion(), decisionMakersQuestion(), decisionCountQuestion()],
      },
      {
        key: "project",
        label: "Budget & requirements",
        description:
          "These answers keep our recommendations realistic — every one of them is optional.",
        estimatedMinutes: 3,
        questions: [
          budgetQuestion(),
          integrationsQuestion(),
          securityQuestion(),
          ...(copy.projectExtras ?? []),
        ],
      },
      {
        key: "access",
        label: "Access & documents",
        description:
          "We never ask for passwords in this form. These questions only ask whether access is something you could provide — credentials are exchanged later through a secure channel.",
        estimatedMinutes: 2,
        questions: [
          ...copy.accessQuestions,
          ...(copy.includeBrandAssets ? [brandAssetsQuestion()] : []),
          documentsQuestion(),
        ],
      },
      {
        key: "constraints",
        label: "Timing & constraints",
        description: "Last section — timing, constraints, and anything else we should know.",
        estimatedMinutes: 2,
        questions: [timingQuestion(), constraintsQuestion()],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The six templates
// ---------------------------------------------------------------------------

const WEBSITE_ACCESS = accessQuestion(
  "website_access",
  "If needed, could you provide access to your current website?",
  "Website access usually means the account where your site is edited — e.g. WordPress, Squarespace, or Wix."
);

const CRM_ACCESS = accessQuestion(
  "crm_access",
  "If needed, could you provide access to your CRM or customer list?",
  "A CRM (customer relationship manager) is the software where customer names, jobs, and conversations are tracked — spreadsheets count."
);

const ANALYTICS_ACCESS = accessQuestion(
  "analytics_access",
  "If needed, could you provide access to your website or marketing analytics?",
  "Analytics tools — like Google Analytics — show how many people visit your site and where they come from."
);

const HOSTING_ACCESS = accessQuestion(
  "hosting_access",
  "If needed, could you provide access to your domain or hosting account?",
  "Your domain is your web address (yourbusiness.com); hosting is the service that keeps the site online — often GoDaddy, Namecheap, or similar."
);

const DATA_SYSTEMS_ACCESS = accessQuestion(
  "data_systems_access",
  "If needed, could you provide access to the systems where this data lives?",
  "For example a CRM, shared drive, database, or document storage — wherever the information an AI system would rely on is kept."
);

export const QUESTIONNAIRE_TEMPLATES: Record<
  string,
  { key: string; label: string; sections: FormSection[] }
> = {
  general: buildTemplate({
    key: "general",
    label: "Consultation Preparation",
    goalsDescription:
      "A few minutes here means we spend your consultation on recommendations instead of basics.",
    goalsLabel: "What are the top 2–3 things you want your business to achieve in the next year?",
    goalsPlaceholder:
      "e.g. more consistent lead flow, less time on admin work, clearer visibility into the numbers",
    workflowLabel:
      "Walk us through how work flows through your business today — from a new inquiry to getting paid.",
    workflowPlaceholder:
      "A few sentences is plenty. Where do things start, who touches them, and where do they slow down?",
    softwarePlaceholder: "e.g. QuickBooks, Google Calendar, spreadsheets, Jobber, Mailchimp",
    currentExtras: [
      {
        key: "biggest_bottleneck",
        label: "If you could fix one bottleneck tomorrow, what would it be?",
        type: "textarea",
        required: false,
        placeholder: "The thing that costs you the most time, money, or sleep.",
      },
    ],
    accessQuestions: [WEBSITE_ACCESS, CRM_ACCESS, ANALYTICS_ACCESS],
    includeBrandAssets: true,
  }),

  growth_systems: buildTemplate({
    key: "growth_systems",
    label: "Growth Systems Preparation",
    goalsDescription:
      "This consultation is about lead flow, follow-up, and conversion — help us see where the growth should come from.",
    goalsLabel: "What would meaningful growth look like for you over the next 6–12 months?",
    goalsPlaceholder: "e.g. 20 more qualified leads per month, faster follow-up, a higher close rate",
    workflowLabel: "What happens today when a new lead comes in?",
    workflowPlaceholder:
      "Who responds, how quickly, and what happens if the lead doesn't answer the first time?",
    softwarePlaceholder: "e.g. a CRM, Mailchimp, Facebook Ads manager, spreadsheets, sticky notes",
    currentExtras: [
      {
        key: "lead_sources",
        label: "Where do most of your leads come from today?",
        type: "chips",
        required: false,
        options: [
          { value: "referrals", label: "Referrals / word of mouth" },
          { value: "google_search", label: "Google search" },
          { value: "website", label: "Our website" },
          { value: "social_media", label: "Social media" },
          { value: "paid_ads", label: "Paid ads" },
          { value: "repeat_customers", label: "Repeat customers" },
          { value: "lead_services", label: "Lead services (Angi, Thumbtack, etc.)" },
          { value: "other", label: "Somewhere else" },
        ],
        help: "Pick as many as apply.",
      },
      {
        key: "follow_up_process",
        label: "How do you follow up with leads who don't buy right away?",
        type: "textarea",
        required: false,
        placeholder: "e.g. we call twice then move on, an email sequence, honestly — we don't",
        help: "“We don't really” is a genuinely useful answer.",
      },
    ],
    accessQuestions: [WEBSITE_ACCESS, CRM_ACCESS, ANALYTICS_ACCESS],
    includeBrandAssets: false,
  }),

  operations_systems: buildTemplate({
    key: "operations_systems",
    label: "Operations Systems Preparation",
    goalsDescription:
      "This consultation is about the day-to-day: scheduling, quoting, invoicing, and communication.",
    goalsLabel: "Which parts of your day-to-day operations do you most want to run smoother?",
    goalsPlaceholder:
      "e.g. stop double-booking crews, get quotes out same-day, stop chasing invoices",
    workflowLabel: "Walk us through a typical job or order — from first contact to paid-in-full.",
    workflowPlaceholder:
      "Who schedules it, who does the work, how does billing happen, and where do things stall?",
    softwarePlaceholder: "e.g. QuickBooks, Jobber, Excel, a whiteboard, group texts",
    currentExtras: [
      {
        key: "operations_pain_points",
        label: "Which areas cause the most friction right now?",
        type: "chips",
        required: false,
        options: [
          { value: "scheduling", label: "Scheduling & dispatch" },
          { value: "quoting", label: "Quotes & estimates" },
          { value: "invoicing", label: "Invoicing & payments" },
          { value: "job_tracking", label: "Job / order tracking" },
          { value: "internal_comms", label: "Internal communication" },
          { value: "customer_comms", label: "Customer communication" },
          { value: "reporting", label: "Reporting & numbers" },
        ],
        help: "Pick as many as apply.",
      },
      {
        key: "biggest_bottleneck",
        label: "If you could fix one operational bottleneck tomorrow, what would it be?",
        type: "textarea",
        required: false,
        placeholder: "The thing that costs the most time, money, or sanity every week.",
      },
    ],
    accessQuestions: [CRM_ACCESS, WEBSITE_ACCESS],
    includeBrandAssets: false,
  }),

  business_systems: buildTemplate({
    key: "business_systems",
    label: "Business Systems Preparation",
    goalsDescription:
      "This consultation looks at how your business runs end-to-end — the more context, the better the recommendations.",
    goalsLabel:
      "If we rebuilt the way your business runs end-to-end, what has to be true a year from now?",
    goalsPlaceholder:
      "e.g. the business runs without me in every decision, one system instead of five, real numbers weekly",
    workflowLabel:
      "Walk us through how work flows through the business today — from a new inquiry to getting paid.",
    workflowPlaceholder:
      "A few sentences is plenty. Where do things start, who touches them, and where do they slow down?",
    softwarePlaceholder: "e.g. QuickBooks, a CRM, spreadsheets, email, paper files",
    currentExtras: [
      {
        key: "biggest_bottleneck",
        label: "If you could fix one bottleneck tomorrow, what would it be?",
        type: "textarea",
        required: false,
        placeholder: "The thing that costs you the most time, money, or sleep.",
      },
    ],
    accessQuestions: [WEBSITE_ACCESS, CRM_ACCESS, ANALYTICS_ACCESS],
    includeBrandAssets: false,
  }),

  private_ai: buildTemplate({
    key: "private_ai",
    label: "Private AI Preparation",
    goalsDescription:
      "This consultation is about a private, secure AI system built around your data — these answers shape the requirements.",
    goalsLabel: "What do you want a private AI system to do for your business?",
    goalsPlaceholder:
      "e.g. answer customer questions from our own documents, draft quotes, summarize job notes",
    workflowLabel: "Which day-to-day workflows would this AI system plug into?",
    workflowPlaceholder:
      "e.g. the front desk answering calls, estimators writing quotes, techs writing up jobs",
    softwarePlaceholder: "e.g. Microsoft 365, Google Workspace, a CRM, an industry-specific tool",
    currentExtras: [
      {
        key: "data_landscape",
        label: "Where does the knowledge or data this system would rely on live today?",
        type: "textarea",
        required: false,
        placeholder: "e.g. Google Drive folders, a CRM, spreadsheets, email history, paper files",
        help: "A rough inventory is fine — knowing where things live tells us a lot.",
      },
    ],
    projectExtras: [
      {
        key: "data_sensitivity",
        label: "How sensitive is the data this system would touch?",
        type: "select",
        required: false,
        options: [
          { value: "public", label: "Nothing sensitive — mostly public information" },
          { value: "internal", label: "Internal business information" },
          { value: "customer_pii", label: "Customer personal information" },
          { value: "regulated", label: "Regulated data (health, financial, legal)" },
        ],
        tooltip:
          "Customer personal information means details that identify a person — names, addresses, phone numbers, payment or health details.",
      },
      {
        key: "compliance_frameworks",
        label: "Do any of these compliance rules apply to your business?",
        type: "chips",
        required: false,
        options: [
          { value: "hipaa", label: "HIPAA (health information)" },
          { value: "pci", label: "PCI (card payments)" },
          { value: "gdpr_ccpa", label: "GDPR / CCPA (privacy laws)" },
          { value: "soc2", label: "SOC 2 (security standards)" },
          { value: "other", label: "Something else" },
          { value: "none", label: "None that I know of" },
        ],
        help: "Pick any that apply — “none that I know of” is a fine answer.",
      },
    ],
    accessQuestions: [DATA_SYSTEMS_ACCESS, CRM_ACCESS],
    includeBrandAssets: false,
  }),

  website_platform: buildTemplate({
    key: "website_platform",
    label: "Website & Platform Preparation",
    goalsDescription:
      "This consultation is about your website or platform — what it should accomplish and what exists today.",
    goalsLabel: "What should a new website or platform accomplish for your business?",
    goalsPlaceholder:
      "e.g. bring in leads instead of just existing, let customers book online, look like the business we actually are",
    workflowLabel: "What role does your website play in how customers find and choose you today?",
    workflowPlaceholder:
      "e.g. people find us on Google then call, referrals check the site first, honestly it does nothing",
    softwarePlaceholder: "e.g. WordPress, Squarespace, Google Analytics, Mailchimp, a booking tool",
    currentExtras: [
      {
        key: "current_site",
        label: "What's your current website address, if you have one?",
        type: "url",
        required: false,
        placeholder: "https://",
      },
      {
        key: "site_issues",
        label: "What's working about your current site — and what isn't?",
        type: "textarea",
        required: false,
        placeholder: "e.g. it looks dated, nobody can update it, it never brings in leads",
      },
    ],
    projectExtras: [
      {
        key: "content_readiness",
        label: "How ready is your content (photos, service descriptions, testimonials)?",
        type: "select",
        required: false,
        options: [
          { value: "ready", label: "Mostly ready to use" },
          { value: "needs_work", label: "Exists, but needs work" },
          { value: "starting_fresh", label: "Starting from scratch" },
          { value: "not_sure", label: "Not sure" },
        ],
      },
    ],
    accessQuestions: [WEBSITE_ACCESS, HOSTING_ACCESS, ANALYTICS_ACCESS],
    includeBrandAssets: true,
  }),
};

// ---------------------------------------------------------------------------
// Category → template routing
// ---------------------------------------------------------------------------

/** Maps a ServiceCategory (or anything else) to a questionnaire template key. */
export function templateForCategory(category: string | null | undefined): string {
  const key = (category || "").trim();
  return key && Object.prototype.hasOwnProperty.call(QUESTIONNAIRE_TEMPLATES, key)
    ? key
    : "general";
}

// ---------------------------------------------------------------------------
// Prep-brief assembly
// ---------------------------------------------------------------------------

const GOAL_KEYS = ["business_goals"];

const CURRENT_STATE_KEYS = [
  "current_workflow",
  "lead_sources",
  "follow_up_process",
  "operations_pain_points",
  "biggest_bottleneck",
  "data_landscape",
  "current_site",
  "site_issues",
];

const STACK_KEYS = ["current_software", "existing_vendors", "required_integrations"];

const DECISION_KEYS = ["decision_makers", "decision_maker_count", "team_structure"];

const CONSTRAINT_KEYS = [
  "budget_range",
  "launch_timing",
  "project_constraints",
  "security_requirements",
  "data_sensitivity",
  "compliance_frameworks",
  "content_readiness",
  "brand_assets",
  "website_access",
  "crm_access",
  "analytics_access",
  "hosting_access",
  "data_systems_access",
];

const SUCCESS_KEYS = ["success_metrics"];

/** Short prefixes for brief lines (question labels are full sentences). */
const BRIEF_LABELS: Record<string, string> = {
  business_goals: "Goals",
  success_metrics: "Success looks like",
  current_workflow: "Current workflow",
  lead_sources: "Lead sources",
  follow_up_process: "Follow-up today",
  operations_pain_points: "Friction areas",
  biggest_bottleneck: "Biggest bottleneck",
  data_landscape: "Data landscape",
  current_site: "Current website",
  site_issues: "Site working / not working",
  current_software: "Software in use",
  existing_vendors: "Existing vendors",
  required_integrations: "Must-keep integrations",
  team_structure: "Team",
  decision_makers: "Decision-makers",
  decision_maker_count: "People in the decision",
  budget_range: "Budget",
  launch_timing: "Desired timing",
  project_constraints: "Constraints",
  security_requirements: "Security requirements",
  data_sensitivity: "Data sensitivity",
  compliance_frameworks: "Compliance",
  content_readiness: "Content readiness",
  brand_assets: "Brand assets",
  website_access: "Website access",
  crm_access: "CRM access",
  analytics_access: "Analytics access",
  hosting_access: "Hosting access",
  data_systems_access: "Data systems access",
};

const ACCESS_ANSWER_KEYS: Record<string, string> = {
  website_access: "website",
  crm_access: "CRM",
  analytics_access: "analytics",
  hosting_access: "domain/hosting",
  data_systems_access: "data systems",
};

function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Renders a raw answer as plain text, mapping option values to their labels. */
function answerToText(value: unknown, question: FormQuestion | undefined): string | null {
  if (isEmptyAnswer(value)) return null;

  const optionLabel = (v: string): string => {
    const match = question?.options?.find((o) => o.value === v);
    return match ? match.label : v;
  };

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === "string" ? optionLabel(item.trim()) : answerToText(item, undefined)))
      .filter((p): p is string => Boolean(p && p.length));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return optionLabel(value.trim());
  if (typeof value === "object") {
    const named = value as { name?: unknown; label?: unknown; title?: unknown };
    for (const candidate of [named.name, named.label, named.title]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return JSON.stringify(value);
  }
  return null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Assembles the internal consultation prep brief strictly from provided
 * answers — empty answers are skipped, nothing is invented.
 */
export function buildPrepBrief(
  answers: Record<string, unknown>,
  templateKey: string
): PrepBrief {
  const template = Object.prototype.hasOwnProperty.call(QUESTIONNAIRE_TEMPLATES, templateKey)
    ? QUESTIONNAIRE_TEMPLATES[templateKey]
    : QUESTIONNAIRE_TEMPLATES.general;

  const questionIndex = new Map<string, FormQuestion>();
  for (const section of template.sections) {
    for (const question of section.questions) questionIndex.set(question.key, question);
  }

  const line = (key: string): string | null => {
    const text = answerToText(answers[key], questionIndex.get(key));
    if (!text) return null;
    const label = BRIEF_LABELS[key];
    return label ? `${label}: ${text}` : text;
  };
  const collect = (keys: string[]): string[] =>
    keys.map(line).filter((entry): entry is string => entry !== null);

  // Flags for notable risks — derived only from answers actually given.
  const flags: string[] = [];

  const budget = typeof answers.budget_range === "string" ? answers.budget_range : "";
  if (budget === "under_5k") {
    flags.push("Tight budget (under $5,000) — scope recommendations carefully.");
  }

  const securityText = answerToText(answers.security_requirements, questionIndex.get("security_requirements"));
  const complianceRaw = Array.isArray(answers.compliance_frameworks)
    ? (answers.compliance_frameworks as unknown[]).filter(
        (v): v is string => typeof v === "string" && v !== "none"
      )
    : [];
  const sensitivity = typeof answers.data_sensitivity === "string" ? answers.data_sensitivity : "";
  if (securityText || complianceRaw.length > 0 || sensitivity === "customer_pii" || sensitivity === "regulated") {
    flags.push("Security or compliance requirements stated — review before proposing an architecture.");
  }

  const dmCount = typeof answers.decision_maker_count === "string" ? answers.decision_maker_count : "";
  if (dmCount === "4_5" || dmCount === "6_plus") {
    const label = answerToText(dmCount, questionIndex.get("decision_maker_count")) ?? dmCount;
    flags.push(`Larger buying group (${label}) — plan for multiple stakeholders in the decision.`);
  }

  const noAccess = Object.keys(ACCESS_ANSWER_KEYS).filter((key) => answers[key] === "no_access");
  if (noAccess.length > 0) {
    flags.push(
      `No access to current systems yet (${noAccess
        .map((key) => ACCESS_ANSWER_KEYS[key])
        .join(", ")}) — budget extra onboarding time.`
    );
  }

  const primaryGoal = answerToText(answers.business_goals, questionIndex.get("business_goals"));
  const headline = primaryGoal
    ? `${template.label}: ${truncate(primaryGoal, 120)}`
    : `${template.label} — consultation brief`;

  return {
    headline,
    goals: collect(GOAL_KEYS),
    current_state: collect(CURRENT_STATE_KEYS),
    stack: collect(STACK_KEYS),
    decision_makers: collect(DECISION_KEYS),
    constraints: collect(CONSTRAINT_KEYS),
    success_metrics: collect(SUCCESS_KEYS),
    flags,
    generated_at: new Date().toISOString(),
  };
}
