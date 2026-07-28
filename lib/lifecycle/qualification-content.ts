import type { FormSection, ServiceCategory } from "./types.ts";

/**
 * /start — conversational qualification flow. Plain language, no technical
 * questions up front, conditional follow-ups per primary need. Estimated
 * completion: 3–4 minutes.
 */

export const QUALIFICATION_ESTIMATED_MINUTES = 4;

export const QUALIFICATION_SECTIONS: FormSection[] = [
  {
    key: "about",
    label: "About your business",
    description: "The basics — so we know who we're talking to.",
    estimatedMinutes: 1,
    questions: [
      { key: "name", label: "Your name", type: "text", required: true, placeholder: "First and last name" },
      { key: "business_name", label: "Business name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "you@company.com" },
      { key: "phone", label: "Phone", type: "phone", required: true, placeholder: "(555) 555-0100" },
      { key: "website", label: "Website", type: "url", required: false, placeholder: "yourcompany.com", help: "No website yet? Leave this blank." },
      {
        key: "industry", label: "Industry", type: "select", required: true,
        options: [
          { value: "home_services", label: "Home services / trades" },
          { value: "health_wellness", label: "Health & wellness" },
          { value: "fitness", label: "Fitness" },
          { value: "professional_services", label: "Professional services" },
          { value: "retail", label: "Retail / e-commerce" },
          { value: "hospitality", label: "Hospitality / food" },
          { value: "real_estate", label: "Real estate" },
          { value: "other", label: "Something else" },
        ],
      },
      { key: "service_area", label: "Where do you serve customers?", type: "text", required: false, placeholder: "e.g. Plymouth County & the South Shore", help: "A town, region, or “online / nationwide.”" },
      {
        key: "team_size", label: "How many people work in the business?", type: "chips", required: true,
        options: [
          { value: "solo", label: "Just me" },
          { value: "2_5", label: "2–5" },
          { value: "6_15", label: "6–15" },
          { value: "16_50", label: "16–50" },
          { value: "50_plus", label: "50+" },
        ],
      },
    ],
  },
  {
    key: "situation",
    label: "Where you are today",
    description: "What's working, what isn't, and what you want instead.",
    estimatedMinutes: 1,
    questions: [
      {
        key: "revenue_range", label: "Approximate monthly revenue", type: "chips", required: true,
        help: "This stays private — it helps us recommend solutions that actually fit your size.",
        options: [
          { value: "pre_revenue", label: "Pre-revenue" },
          { value: "under_10k", label: "Under $10k" },
          { value: "10k_30k", label: "$10k–$30k" },
          { value: "30k_75k", label: "$30k–$75k" },
          { value: "75k_150k", label: "$75k–$150k" },
          { value: "150k_plus", label: "$150k+" },
        ],
      },
      {
        key: "primary_need", label: "What would help your business most right now?", type: "select", required: true,
        options: [
          { value: "more_leads", label: "More leads and customers" },
          { value: "operations", label: "Smoother day-to-day operations" },
          { value: "website", label: "A better website or online presence" },
          { value: "private_ai", label: "Private AI built around our data" },
          { value: "communication", label: "Better customer communication & follow-up" },
          { value: "not_sure", label: "Not sure — I want expert eyes on it" },
        ],
      },
      { key: "main_challenge", label: "What's the main challenge behind that?", type: "textarea", required: true, placeholder: "In your own words — a sentence or two is plenty." },
      { key: "desired_outcome", label: "If we work together, what should be different a year from now?", type: "textarea", required: false, placeholder: "e.g. “Booked out 3 weeks ahead without me chasing every inquiry.”" },
      { key: "current_systems", label: "What tools or software run the business today?", type: "textarea", required: false, placeholder: "e.g. QuickBooks, Google Calendar, a spreadsheet, pen & paper — all honest answers welcome." },
    ],
  },
  {
    key: "leads_detail",
    label: "About your lead flow",
    showIf: { key: "primary_need", anyOf: ["more_leads", "communication"] },
    estimatedMinutes: 1,
    questions: [
      {
        key: "lead_sources", label: "Where do new customers come from today?", type: "multiselect", required: false,
        options: [
          { value: "referrals", label: "Referrals / word of mouth" },
          { value: "google", label: "Google search" },
          { value: "social", label: "Social media" },
          { value: "ads", label: "Paid ads" },
          { value: "repeat", label: "Repeat customers" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "follow_up_process", label: "What happens after someone reaches out?", type: "select", required: false,
        options: [
          { value: "instant", label: "They hear back within minutes" },
          { value: "same_day", label: "Usually the same day" },
          { value: "days", label: "It can take a few days" },
          { value: "slips", label: "Honestly, some slip through" },
        ],
      },
    ],
  },
  {
    key: "operations_detail",
    label: "About your operations",
    showIf: { key: "primary_need", anyOf: ["operations", "not_sure"] },
    estimatedMinutes: 1,
    questions: [
      {
        key: "ops_pain_points", label: "Which of these eat the most time?", type: "multiselect", required: false,
        options: [
          { value: "scheduling", label: "Scheduling & calendars" },
          { value: "quoting", label: "Quotes & estimates" },
          { value: "invoicing", label: "Invoicing & payments" },
          { value: "internal_comms", label: "Team communication" },
          { value: "admin", label: "Paperwork & data entry" },
          { value: "tracking", label: "Knowing where every job stands" },
        ],
      },
    ],
  },
  {
    key: "ai_detail",
    label: "About your AI needs",
    showIf: { key: "primary_need", anyOf: ["private_ai"] },
    estimatedMinutes: 1,
    questions: [
      {
        key: "data_sensitivity", label: "How sensitive is the data involved?", type: "select", required: false,
        tooltip: "Examples: customer records, health information, financials, contracts.",
        options: [
          { value: "high", label: "Highly sensitive (health, legal, financial)" },
          { value: "moderate", label: "Business-confidential" },
          { value: "low", label: "Mostly public or low-risk" },
        ],
      },
      {
        key: "hosting_preference", label: "Where should it run?", type: "select", required: false,
        options: [
          { value: "private_cloud", label: "Private cloud we control" },
          { value: "on_premise", label: "On our own hardware" },
          { value: "unsure", label: "Not sure — advise us" },
        ],
      },
      {
        key: "ai_users", label: "Roughly how many people would use it?", type: "chips", required: false,
        options: [
          { value: "1_5", label: "1–5" },
          { value: "6_20", label: "6–20" },
          { value: "21_plus", label: "21+" },
        ],
      },
      {
        key: "document_volume", label: "How much material should it know?", type: "select", required: false,
        options: [
          { value: "small", label: "A handful of documents" },
          { value: "medium", label: "Hundreds of documents" },
          { value: "large", label: "Thousands+ (archives, systems, databases)" },
        ],
      },
    ],
  },
  {
    key: "website_detail",
    label: "About your website needs",
    showIf: { key: "primary_need", anyOf: ["website"] },
    estimatedMinutes: 1,
    questions: [
      {
        key: "website_features", label: "What should the new website do?", type: "multiselect", required: false,
        options: [
          { value: "booking", label: "Take bookings" },
          { value: "payments", label: "Take payments" },
          { value: "crm", label: "Feed a CRM automatically" },
          { value: "portal", label: "Customer portal / login" },
          { value: "custom", label: "Custom functionality" },
          { value: "presence", label: "Mostly look professional & rank well" },
        ],
      },
    ],
  },
  {
    key: "fit",
    label: "Project fit",
    description: "Last step — helps us come back with realistic recommendations.",
    estimatedMinutes: 1,
    questions: [
      {
        key: "budget_range", label: "Estimated project budget", type: "chips", required: true,
        help: "A range is fine — this shapes what we recommend, not what we charge.",
        options: [
          { value: "under_2k", label: "Under $2,000" },
          { value: "2k_5k", label: "$2,000–$5,000" },
          { value: "5k_15k", label: "$5,000–$15,000" },
          { value: "15k_50k", label: "$15,000–$50,000" },
          { value: "50k_plus", label: "$50,000+" },
          { value: "unsure", label: "Not sure yet" },
        ],
      },
      {
        key: "timeline", label: "When would you want to start?", type: "chips", required: true,
        options: [
          { value: "asap", label: "As soon as possible" },
          { value: "month", label: "Within a month" },
          { value: "quarter", label: "This quarter" },
          { value: "exploring", label: "Just exploring" },
        ],
      },
      {
        key: "heard_about", label: "How did you hear about Redmont?", type: "select", required: false,
        options: [
          { value: "referral", label: "Referral" },
          { value: "google", label: "Google search" },
          { value: "social", label: "Social media" },
          { value: "event", label: "Event or networking" },
          { value: "other", label: "Other" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Scoring & routing
// ---------------------------------------------------------------------------

const BUDGET_POINTS: Record<string, number> = {
  under_2k: 5, "2k_5k": 15, "5k_15k": 25, "15k_50k": 35, "50k_plus": 40, unsure: 12,
};
const REVENUE_POINTS: Record<string, number> = {
  pre_revenue: 2, under_10k: 6, "10k_30k": 12, "30k_75k": 18, "75k_150k": 22, "150k_plus": 25,
};
const TIMELINE_POINTS: Record<string, number> = {
  asap: 20, month: 16, quarter: 10, exploring: 4,
};

export function computeQualificationScore(answers: Record<string, unknown>): number {
  const str = (k: string) => (typeof answers[k] === "string" ? (answers[k] as string) : "");
  let score = 0;
  score += BUDGET_POINTS[str("budget_range")] ?? 0;
  score += REVENUE_POINTS[str("revenue_range")] ?? 0;
  score += TIMELINE_POINTS[str("timeline")] ?? 0;
  // Engagement signals: a real challenge description and a desired outcome.
  if (str("main_challenge").trim().length >= 30) score += 10;
  else if (str("main_challenge").trim().length > 0) score += 5;
  if (str("desired_outcome").trim().length > 0) score += 5;
  return Math.min(100, score);
}

/** Assessment invite threshold — below it, prospects get the warm alt path. */
export const QUALIFIED_THRESHOLD = 35;

export function qualificationCategory(
  answers: Record<string, unknown>,
): ServiceCategory {
  const need = typeof answers.primary_need === "string" ? answers.primary_need : "";
  switch (need) {
    case "more_leads":
    case "communication":
      return "growth_systems";
    case "operations":
      return "operations_systems";
    case "website":
      return "website_platform";
    case "private_ai":
      return "private_ai";
    default:
      return "business_systems";
  }
}
