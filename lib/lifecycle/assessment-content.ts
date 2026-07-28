/**
 * Business Systems Assessment — questions, scoring, and summary rules.
 *
 * Written for a non-technical business owner: plain language everywhere,
 * tooltips for any technical term, and conditional questions so nobody is
 * asked about things that don't apply to them.
 *
 * Scoring: each scored question has a `points` map where a HIGHER value means
 * a BIGGER gap / opportunity and 0 means healthy. The overall score is 0–100
 * where higher = more systems opportunity.
 *
 * Pure content + pure functions only — no data access in this file.
 */

import {
  SERVICE_CATEGORY_LABELS,
  type AssessmentSummary,
  type FormQuestion,
  type FormSection,
  type ServiceCategory,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export const ASSESSMENT_SECTIONS: FormSection[] = [
  {
    key: "about",
    label: "About your business",
    description:
      "A few basics so the rest of the assessment only asks about things that apply to you.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "business_type",
        label: "What kind of business do you run?",
        type: "select",
        required: true,
        options: [
          { value: "home_services", label: "Home services (HVAC, plumbing, electrical, cleaning…)" },
          { value: "construction_trades", label: "Construction or trades" },
          { value: "health_wellness", label: "Health & wellness (dental, med spa, gym, clinic…)" },
          { value: "professional_services", label: "Professional services (legal, accounting, consulting…)" },
          { value: "retail_ecommerce", label: "Retail or e-commerce" },
          { value: "restaurant_food", label: "Restaurant or food service" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        key: "customer_type",
        label: "Who do you mainly serve?",
        type: "select",
        required: true,
        options: [
          { value: "consumers", label: "Homeowners / individual consumers" },
          { value: "businesses", label: "Other businesses" },
          { value: "both", label: "A mix of both" },
        ],
      },
      {
        key: "team_size",
        label: "How many people work in the business, including you?",
        type: "select",
        required: true,
        options: [
          { value: "solo", label: "Just me" },
          { value: "team_2_5", label: "2–5" },
          { value: "team_6_15", label: "6–15" },
          { value: "team_16_50", label: "16–50" },
          { value: "team_50_plus", label: "More than 50" },
        ],
      },
      {
        key: "years_in_business",
        label: "How long have you been in business?",
        type: "select",
        required: true,
        options: [
          { value: "under_2", label: "Less than 2 years" },
          { value: "years_2_5", label: "2–5 years" },
          { value: "years_6_15", label: "6–15 years" },
          { value: "over_15", label: "More than 15 years" },
        ],
      },
      {
        key: "sends_quotes",
        label: "Do you send quotes or estimates before winning a job or sale?",
        type: "boolean",
        required: true,
        help: "If yes, we'll ask a few questions about how quoting works for you.",
      },
      {
        key: "biggest_frustration",
        label: "What frustrates you most about how the business runs day to day?",
        type: "textarea",
        required: true,
        placeholder: "In your own words — there are no wrong answers here.",
      },
    ],
  },
  {
    key: "online_presence",
    label: "Website & online presence",
    description: "How easily new customers can find you and reach you online.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "has_website",
        label: "Does your business have a website?",
        type: "boolean",
        required: true,
        points: { true: 0, false: 8 },
      },
      {
        key: "website_age",
        label: "When was your website last rebuilt or seriously updated?",
        type: "select",
        required: true,
        showIf: { key: "has_website", anyOf: ["true"] },
        options: [
          { value: "under_1", label: "Within the last year" },
          { value: "years_1_3", label: "1–3 years ago" },
          { value: "years_3_5", label: "3–5 years ago" },
          { value: "over_5", label: "More than 5 years ago" },
          { value: "not_sure", label: "Honestly, not sure" },
        ],
        points: { under_1: 0, years_1_3: 1, years_3_5: 2, over_5: 4, not_sure: 2 },
      },
      {
        key: "website_leads",
        label: "How many new customer inquiries does your website bring in during a typical month?",
        type: "select",
        required: true,
        showIf: { key: "has_website", anyOf: ["true"] },
        options: [
          { value: "none", label: "None that I know of" },
          { value: "few", label: "A handful (1–5)" },
          { value: "some", label: "A steady trickle (6–20)" },
          { value: "plenty", label: "A real source of business (20+)" },
          { value: "not_tracked", label: "We don't track this" },
        ],
        points: { none: 6, few: 4, some: 2, plenty: 0, not_tracked: 5 },
      },
      {
        key: "website_editable",
        label: "Can you or someone on your team update the website yourselves?",
        type: "boolean",
        required: true,
        showIf: { key: "has_website", anyOf: ["true"] },
        help: "For example: changing prices, adding photos, or posting an announcement without paying someone.",
        points: { true: 0, false: 3 },
      },
      {
        key: "online_findability",
        label: "When someone in your area searches for what you do, how easily do they find you?",
        type: "scale",
        required: true,
        scaleLabels: ["Very hard to find us", "We come up everywhere"],
        points: { "1": 6, "2": 5, "3": 3, "4": 1, "5": 0 },
      },
    ],
  },
  {
    key: "lead_flow",
    label: "Getting new customers",
    description: "Where new business comes from and what happens the moment someone reaches out.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "lead_sources",
        label: "Where do new customers currently come from?",
        type: "chips",
        required: true,
        tooltip:
          "A lead is anyone who contacts you or leaves their details because they might buy from you.",
        options: [
          { value: "referrals", label: "Referrals & word of mouth" },
          { value: "google_search", label: "Google search" },
          { value: "social_media", label: "Social media" },
          { value: "paid_ads", label: "Paid ads" },
          { value: "repeat_customers", label: "Repeat customers" },
          { value: "lead_services", label: "Lead services (Angi, Thumbtack…)" },
          { value: "signage_local", label: "Signage / local presence" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "lead_volume",
        label: "How would you describe your flow of new leads?",
        type: "select",
        required: true,
        options: [
          { value: "more_than_we_handle", label: "More than we can handle" },
          { value: "steady", label: "Steady and predictable" },
          { value: "feast_famine", label: "Feast or famine — busy some weeks, dead others" },
          { value: "too_few", label: "Not enough coming in" },
          { value: "not_sure", label: "Hard to say — we don't really track it" },
        ],
        points: { more_than_we_handle: 1, steady: 0, feast_famine: 6, too_few: 8, not_sure: 5 },
      },
      {
        key: "lead_tracking",
        label: "When a new lead comes in, where does it get recorded?",
        type: "select",
        required: true,
        options: [
          { value: "software", label: "Logged automatically in software" },
          { value: "spreadsheet", label: "A spreadsheet someone updates" },
          { value: "inbox", label: "It sits in email or voicemail until someone gets to it" },
          { value: "paper", label: "Paper, whiteboard, or sticky notes" },
          { value: "memory", label: "It isn't — we rely on memory" },
        ],
        points: { software: 0, spreadsheet: 4, inbox: 5, paper: 6, memory: 8 },
      },
      {
        key: "response_time",
        label: "When a new inquiry comes in, how quickly does someone usually respond?",
        type: "select",
        required: true,
        help: "Responding within minutes dramatically increases the odds of winning the work — most customers go with whoever answers first.",
        options: [
          { value: "minutes", label: "Within minutes" },
          { value: "within_hour", label: "Within the hour" },
          { value: "same_day", label: "Sometime the same day" },
          { value: "next_day", label: "Usually the next day" },
          { value: "several_days", label: "A few days — or sometimes not at all" },
        ],
        points: { minutes: 0, within_hour: 1, same_day: 3, next_day: 6, several_days: 8 },
      },
      {
        key: "missed_calls",
        label: "What happens when you can't answer the phone?",
        type: "select",
        required: true,
        options: [
          { value: "auto_text", label: "They get an automatic text back right away" },
          { value: "voicemail_reliable", label: "Voicemail, and we reliably call back" },
          { value: "voicemail_slips", label: "Voicemail, but callbacks slip through" },
          { value: "nothing", label: "Nothing — a missed call is just missed" },
          { value: "not_sure", label: "Not sure, honestly" },
        ],
        points: { auto_text: 0, voicemail_reliable: 2, voicemail_slips: 6, nothing: 8, not_sure: 5 },
      },
      {
        key: "after_hours",
        label: "Can a new customer reach you or book with you outside business hours?",
        type: "boolean",
        required: true,
        help: "For example: online booking, a contact form that gets an instant reply, or an after-hours answering setup.",
        points: { true: 0, false: 5 },
      },
    ],
  },
  {
    key: "sales_followup",
    label: "Sales & follow-up",
    description: "How potential customers move from first contact to paying customer.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "pipeline_visibility",
        label:
          "Can you see, at a glance, every potential customer you're currently talking to and where each one stands?",
        type: "select",
        required: true,
        tooltip:
          "This is what businesses call a sales pipeline — a simple list of everyone who might buy, and what stage each conversation is at (new inquiry, quoted, ready to book…).",
        options: [
          { value: "one_system", label: "Yes — it's all in one system" },
          { value: "in_my_head", label: "Yes, but it mostly lives in my head" },
          { value: "partially", label: "Partially — some of it, in a few places" },
          { value: "no", label: "No — things fall through the cracks" },
        ],
        points: { one_system: 0, in_my_head: 6, partially: 4, no: 8 },
      },
      {
        key: "crm_usage",
        label: "Do you use a CRM to keep track of customers and conversations?",
        type: "select",
        required: true,
        tooltip:
          "A CRM (customer relationship management system) is software that keeps every customer's contact details, history, and conversations in one place, so nothing depends on anyone's memory.",
        options: [
          { value: "yes_consistent", label: "Yes, and we actually use it" },
          { value: "yes_unused", label: "We have one, but barely use it" },
          { value: "spreadsheets", label: "No — spreadsheets or paper" },
          { value: "nothing", label: "No — nothing formal" },
          { value: "not_sure", label: "Not sure what counts" },
        ],
        points: { yes_consistent: 0, yes_unused: 5, spreadsheets: 7, nothing: 8, not_sure: 6 },
      },
      {
        key: "followup_process",
        label: "When a lead doesn't buy right away, what usually happens?",
        type: "select",
        required: true,
        options: [
          { value: "automated", label: "They get automatic follow-up by email or text" },
          { value: "manual_consistent", label: "Someone follows up manually, consistently" },
          { value: "when_we_remember", label: "We follow up when we remember" },
          { value: "nothing", label: "Usually nothing — they just go cold" },
        ],
        points: { automated: 0, manual_consistent: 2, when_we_remember: 6, nothing: 8 },
      },
      {
        key: "followup_automation",
        label: "Do any of your follow-ups happen automatically, without a person having to remember?",
        type: "boolean",
        required: true,
        tooltip:
          "Automation means software does a repetitive task for you — like sending a reminder text or a follow-up email — without anyone having to think about it.",
        points: { true: 0, false: 6 },
      },
      {
        key: "lost_leads",
        label: "Do you ever re-contact old leads who never ended up buying?",
        type: "select",
        required: true,
        options: [
          { value: "regularly", label: "Yes, regularly" },
          { value: "occasionally", label: "Occasionally" },
          { value: "never", label: "Never — once they go quiet, that's it" },
        ],
        points: { regularly: 0, occasionally: 3, never: 6 },
      },
      {
        key: "close_rate_known",
        label: "Do you know roughly what percentage of your leads become paying customers?",
        type: "boolean",
        required: true,
        points: { true: 0, false: 5 },
      },
    ],
  },
  {
    key: "operations",
    label: "Booking, quoting & getting paid",
    description: "The day-to-day machinery: scheduling work, sending quotes, and collecting money.",
    estimatedMinutes: 3,
    questions: [
      {
        key: "scheduling_method",
        label: "How do customers get booked or scheduled?",
        type: "select",
        required: true,
        options: [
          { value: "online_self", label: "They book themselves online" },
          { value: "software_manual", label: "We enter appointments into scheduling software" },
          { value: "basic_calendar", label: "A paper calendar or basic phone calendar" },
          { value: "memory_texts", label: "Texts, calls, and memory" },
        ],
        points: { online_self: 0, software_manual: 2, basic_calendar: 6, memory_texts: 8 },
      },
      {
        key: "scheduling_pain",
        label: "How much time does scheduling (and rescheduling) eat up each week?",
        type: "scale",
        required: true,
        scaleLabels: ["Barely any", "It's a constant headache"],
        points: { "1": 0, "2": 1, "3": 3, "4": 5, "5": 7 },
      },
      {
        key: "no_shows",
        label: "How often do customers no-show or forget appointments?",
        type: "select",
        required: true,
        options: [
          { value: "rarely", label: "Rarely" },
          { value: "sometimes", label: "Sometimes" },
          { value: "often", label: "Often enough that it hurts" },
          { value: "no_appointments", label: "We don't really take appointments" },
        ],
        points: { rarely: 0, sometimes: 4, often: 7, no_appointments: 0 },
      },
      {
        key: "quote_speed",
        label: "After you have the details of a job, how long until the customer receives a quote?",
        type: "select",
        required: true,
        showIf: { key: "sends_quotes", anyOf: ["true"] },
        options: [
          { value: "same_day", label: "Same day" },
          { value: "couple_days", label: "Within a couple of days" },
          { value: "week", label: "Up to a week" },
          { value: "longer", label: "More than a week — quotes pile up" },
        ],
        points: { same_day: 0, couple_days: 3, week: 6, longer: 8 },
      },
      {
        key: "quote_method",
        label: "How do you build and send quotes?",
        type: "select",
        required: true,
        showIf: { key: "sends_quotes", anyOf: ["true"] },
        options: [
          { value: "software", label: "Quoting or estimating software" },
          { value: "templates", label: "Word or Excel templates" },
          { value: "scratch", label: "From scratch each time" },
          { value: "verbal", label: "Mostly verbal" },
        ],
        points: { software: 0, templates: 4, scratch: 7, verbal: 8 },
      },
      {
        key: "quote_followup",
        label: "Does anyone follow up on quotes that haven't been answered?",
        type: "boolean",
        required: true,
        showIf: { key: "sends_quotes", anyOf: ["true"] },
        points: { true: 0, false: 7 },
      },
      {
        key: "invoicing_method",
        label: "How do you invoice customers?",
        type: "select",
        required: true,
        options: [
          { value: "software_auto", label: "Software — invoices go out automatically" },
          { value: "software_manual", label: "Software, but someone creates each one by hand" },
          { value: "manual_docs", label: "Word, Excel, or paper invoices" },
          { value: "inconsistent", label: "Honestly, invoicing sometimes slips through the cracks" },
        ],
        points: { software_auto: 0, software_manual: 2, manual_docs: 6, inconsistent: 8 },
      },
      {
        key: "payment_speed",
        label: "After the work is done, how long does it typically take to get paid?",
        type: "select",
        required: true,
        options: [
          { value: "immediately", label: "Immediately, or on the spot" },
          { value: "within_week", label: "Within a week" },
          { value: "weeks_2_4", label: "Two to four weeks" },
          { value: "month_plus", label: "Over a month — chasing payments is normal" },
        ],
        points: { immediately: 0, within_week: 1, weeks_2_4: 4, month_plus: 7 },
      },
      {
        key: "online_payments",
        label: "Can customers pay you online — by card, bank transfer, or a payment link?",
        type: "boolean",
        required: true,
        points: { true: 0, false: 5 },
      },
    ],
  },
  {
    key: "customers",
    label: "Customer communication & loyalty",
    description: "How customers hear from you, talk about you, and come back.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "comms_channels",
        label: "How do you communicate with customers today?",
        type: "chips",
        required: true,
        options: [
          { value: "phone", label: "Phone calls" },
          { value: "text", label: "Text messages" },
          { value: "email", label: "Email" },
          { value: "social_dm", label: "Social media messages" },
          { value: "messaging_software", label: "A customer messaging system" },
        ],
      },
      {
        key: "comms_consistency",
        label:
          "Do customers get consistent updates — confirmations, reminders, \"on our way\" messages?",
        type: "select",
        required: true,
        options: [
          { value: "automated", label: "Yes — most of it happens automatically" },
          { value: "manual_consistent", label: "Yes, but someone sends each one by hand" },
          { value: "sometimes", label: "Sometimes — it depends who's handling it" },
          { value: "rarely", label: "Rarely — customers have to chase us for updates" },
        ],
        points: { automated: 0, manual_consistent: 2, sometimes: 5, rarely: 7 },
      },
      {
        key: "review_asking",
        label: "How do you collect online reviews?",
        type: "select",
        required: true,
        showIf: { key: "customer_type", anyOf: ["consumers", "both"] },
        options: [
          { value: "automated", label: "Every customer automatically gets a review request" },
          { value: "manual_consistent", label: "We ask personally, and pretty consistently" },
          { value: "when_we_remember", label: "We ask when we remember" },
          { value: "never", label: "We don't ask" },
        ],
        points: { automated: 0, manual_consistent: 2, when_we_remember: 5, never: 8 },
      },
      {
        key: "review_count",
        label: "Roughly how many Google reviews does your business have?",
        type: "select",
        required: true,
        showIf: { key: "customer_type", anyOf: ["consumers", "both"] },
        options: [
          { value: "over_100", label: "More than 100" },
          { value: "reviews_25_100", label: "25–100" },
          { value: "under_25", label: "Fewer than 25" },
          { value: "almost_none", label: "Almost none" },
          { value: "not_sure", label: "Not sure" },
        ],
        points: { over_100: 0, reviews_25_100: 2, under_25: 5, almost_none: 7, not_sure: 5 },
      },
      {
        key: "repeat_rate",
        label: "How much of your business comes from repeat customers or referrals?",
        type: "select",
        required: true,
        options: [
          { value: "most", label: "Most of it" },
          { value: "about_half", label: "About half" },
          { value: "some", label: "Some" },
          { value: "little", label: "Very little — almost every sale is a brand-new customer" },
          { value: "not_sure", label: "Not sure" },
        ],
        points: { most: 0, about_half: 2, some: 4, little: 6, not_sure: 5 },
      },
      {
        key: "retention_outreach",
        label:
          "Do you stay in touch with past customers — check-ins, seasonal reminders, or a newsletter?",
        type: "boolean",
        required: true,
        points: { true: 0, false: 6 },
      },
    ],
  },
  {
    key: "team_data",
    label: "Your team, your numbers & your data",
    description: "Whether the business can run without heroics — and whether its information is safe.",
    estimatedMinutes: 3,
    questions: [
      {
        key: "workflow_docs",
        label:
          "If your most important person (maybe you) were out for a month, could someone else follow written steps to keep things running?",
        type: "select",
        required: true,
        options: [
          { value: "documented", label: "Yes — our processes are written down" },
          { value: "partially", label: "Partially — some things are documented" },
          { value: "in_heads", label: "No — it all lives in people's heads" },
        ],
        points: { documented: 0, partially: 4, in_heads: 8 },
      },
      {
        key: "team_tools",
        label: "How does your team share job details and updates internally?",
        type: "select",
        required: true,
        showIf: { key: "team_size", anyOf: ["team_2_5", "team_6_15", "team_16_50", "team_50_plus"] },
        options: [
          { value: "software", label: "Shared software everyone can see" },
          { value: "group_texts", label: "Group texts and calls" },
          { value: "verbal", label: "Mostly verbal" },
        ],
        points: { software: 0, group_texts: 5, verbal: 7 },
      },
      {
        key: "reporting",
        label: "How do you know how the business is actually performing — revenue, jobs, marketing?",
        type: "select",
        required: true,
        options: [
          { value: "dashboard", label: "Reports or a dashboard I check regularly" },
          { value: "spreadsheets", label: "Spreadsheets I pull together myself" },
          { value: "accountant", label: "I find out from my accountant, after the fact" },
          { value: "gut", label: "Gut feel and the bank balance" },
        ],
        points: { dashboard: 0, spreadsheets: 3, accountant: 5, gut: 8 },
      },
      {
        key: "kpis_known",
        label:
          "Could you pull up last month's numbers — revenue, new customers — within a few minutes?",
        type: "boolean",
        required: true,
        points: { true: 0, false: 5 },
      },
      {
        key: "data_backup",
        label: "If your computer or phone died today, would you lose important business information?",
        type: "select",
        required: true,
        options: [
          { value: "nothing", label: "No — everything important is backed up in the cloud" },
          { value: "some", label: "We'd lose some things" },
          { value: "lots", label: "Yes — a lot lives on one device or in one person's phone" },
          { value: "not_sure", label: "Not sure" },
        ],
        points: { nothing: 0, some: 5, lots: 8, not_sure: 6 },
      },
      {
        key: "password_practice",
        label: "How does your business handle passwords for its important accounts?",
        type: "select",
        required: true,
        options: [
          { value: "manager", label: "A password manager" },
          { value: "individual", label: "Each person keeps track of their own" },
          { value: "shared_doc", label: "A shared document or spreadsheet" },
          { value: "reused", label: "The same few passwords, reused everywhere" },
        ],
        points: { manager: 0, individual: 4, shared_doc: 6, reused: 8 },
      },
      {
        key: "sensitive_data",
        label:
          "Do you handle sensitive customer information — health, financial, legal, or personal records?",
        type: "boolean",
        required: true,
        help: "This affects which kinds of tools and safeguards make sense for you.",
        points: { true: 2, false: 0 },
      },
    ],
  },
  {
    key: "growth_ai",
    label: "Growth plans & AI readiness",
    description: "Where you want to take the business, and how ready your systems are to get there.",
    estimatedMinutes: 2,
    questions: [
      {
        key: "growth_goal",
        label: "Where do you want the business to be in 2–3 years?",
        type: "select",
        required: true,
        options: [
          { value: "double_plus", label: "Significantly bigger — double or more" },
          { value: "steady_growth", label: "Growing steadily" },
          { value: "smoother", label: "About the same size, but running much smoother" },
          { value: "sellable", label: "Positioned to sell or step back" },
        ],
      },
      {
        key: "growth_blocker",
        label: "What's the biggest thing holding growth back right now?",
        type: "select",
        required: true,
        options: [
          { value: "not_enough_leads", label: "Not enough leads coming in" },
          { value: "cant_keep_up", label: "We can't keep up with the work we already have" },
          { value: "systems", label: "Our systems and processes can't handle more volume" },
          { value: "owner_bottleneck", label: "Everything runs through me" },
          { value: "hiring", label: "Finding and keeping good people" },
          { value: "not_sure", label: "Not sure" },
        ],
        points: {
          not_enough_leads: 4,
          cant_keep_up: 4,
          systems: 5,
          owner_bottleneck: 5,
          hiring: 3,
          not_sure: 2,
        },
      },
      {
        key: "capacity_scale",
        label: "If your leads doubled next month, how well would your current setup handle it?",
        type: "scale",
        required: true,
        scaleLabels: ["We'd fall apart", "We'd handle it easily"],
        points: { "1": 8, "2": 6, "3": 4, "4": 1, "5": 0 },
      },
      {
        key: "manual_hours",
        label:
          "How many hours a week does your business spend on repetitive admin — data entry, copying info between systems, chasing paperwork?",
        type: "select",
        required: true,
        options: [
          { value: "under_2", label: "Under 2 hours" },
          { value: "hours_2_5", label: "2–5 hours" },
          { value: "hours_5_15", label: "5–15 hours" },
          { value: "hours_15_plus", label: "More than 15 hours" },
          { value: "not_sure", label: "Not sure" },
        ],
        points: { under_2: 0, hours_2_5: 3, hours_5_15: 6, hours_15_plus: 8, not_sure: 4 },
      },
      {
        key: "ai_familiarity",
        label: "How familiar are you with AI tools (like ChatGPT) for business?",
        type: "select",
        required: true,
        tooltip:
          "AI tools are software that can read, write, answer questions, and handle routine communication — increasingly used for things like answering inquiries and drafting follow-ups.",
        options: [
          { value: "already_using", label: "We already use them" },
          { value: "tried_some", label: "I've tried them a bit" },
          { value: "heard_only", label: "Heard of them, never tried" },
          { value: "unfamiliar", label: "Not familiar at all" },
        ],
        points: { already_using: 0, tried_some: 1, heard_only: 3, unfamiliar: 3 },
      },
      {
        key: "ai_interest",
        label: "How interested are you in putting AI to work in your business?",
        type: "select",
        required: true,
        options: [
          { value: "very_interested", label: "Very — I want to move on this" },
          { value: "curious", label: "Curious, if it's practical" },
          { value: "privacy_concerned", label: "Interested, but worried about privacy and security" },
          { value: "not_now", label: "Not right now" },
        ],
        points: { very_interested: 4, curious: 3, privacy_concerned: 3, not_now: 0 },
      },
      {
        key: "anything_else",
        label: "Anything else you'd like us to know before we review your assessment?",
        type: "textarea",
        placeholder: "Optional — context, plans, worries, anything.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Answer helpers
// ---------------------------------------------------------------------------

/** Normalize an answer (string, number, boolean, or array) to string values. */
function answerValues(answer: unknown): string[] {
  if (answer === null || answer === undefined) return [];
  if (Array.isArray(answer)) return answer.map((v) => String(v));
  if (typeof answer === "boolean") return [answer ? "true" : "false"];
  return [String(answer)];
}

function firstValue(answers: Record<string, unknown>, key: string): string {
  return answerValues(answers[key])[0] ?? "";
}

function matchesShowIf(
  showIf: { key: string; anyOf: string[] } | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!showIf) return true;
  const values = answerValues(answers[showIf.key]);
  return values.some((v) => showIf.anyOf.includes(v));
}

function isAnswered(answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  return true;
}

function earnedPoints(question: FormQuestion, answer: unknown): number {
  if (!question.points) return 0;
  const points = question.points;
  return answerValues(answer).reduce((sum, v) => sum + (points[v] ?? 0), 0);
}

function maxPoints(question: FormQuestion): number {
  if (!question.points) return 0;
  const values = Object.values(question.points);
  if (values.length === 0) return 0;
  if (question.type === "chips" || question.type === "multiselect") {
    return values.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
  }
  return Math.max(...values);
}

function visibleSectionList(answers: Record<string, unknown>): FormSection[] {
  return ASSESSMENT_SECTIONS.filter((section) => matchesShowIf(section.showIf, answers));
}

// ---------------------------------------------------------------------------
// Visibility & completion
// ---------------------------------------------------------------------------

/** All questions currently visible given the answers so far (showIf respected). */
export function visibleQuestions(answers: Record<string, unknown>): FormQuestion[] {
  const questions: FormQuestion[] = [];
  for (const section of visibleSectionList(answers)) {
    for (const question of section.questions) {
      if (matchesShowIf(question.showIf, answers)) questions.push(question);
    }
  }
  return questions;
}

/** True when every visible required question has a non-empty answer. */
export function isComplete(answers: Record<string, unknown>): boolean {
  return visibleQuestions(answers).every(
    (question) => !question.required || isAnswered(answers[question.key]),
  );
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score 0–100 where higher = more systems opportunity. Only questions visible
 * for the given answers count toward each section's maximum, so conditional
 * paths are scored fairly.
 */
export function computeAssessmentScore(answers: Record<string, unknown>): {
  score: number;
  sectionScores: { section_key: string; label: string; score: number; max: number }[];
} {
  const sectionScores: { section_key: string; label: string; score: number; max: number }[] = [];
  let totalEarned = 0;
  let totalMax = 0;

  for (const section of visibleSectionList(answers)) {
    let earned = 0;
    let max = 0;
    for (const question of section.questions) {
      if (!matchesShowIf(question.showIf, answers)) continue;
      const questionMax = maxPoints(question);
      if (questionMax <= 0) continue;
      max += questionMax;
      earned += Math.min(earnedPoints(question, answers[question.key]), questionMax);
    }
    sectionScores.push({ section_key: section.key, label: section.label, score: earned, max });
    totalEarned += earned;
    totalMax += max;
  }

  const score = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  return { score, sectionScores };
}

// ---------------------------------------------------------------------------
// Service-category recommendation
// ---------------------------------------------------------------------------

/**
 * Rule-based routing: lead-generation pain → growth_systems, operational pain
 * → operations_systems, AI interest / data sensitivity → private_ai, website
 * pain → website_platform, broad pain → business_systems.
 */
export function recommendServiceCategory(answers: Record<string, unknown>): ServiceCategory {
  const first = (key: string) => firstValue(answers, key);

  // Private AI: strong interest, or interest combined with sensitive data.
  const aiInterest = first("ai_interest");
  const sensitive = first("sensitive_data") === "true";
  if (aiInterest === "very_interested" && (sensitive || first("ai_familiarity") === "already_using")) {
    return "private_ai";
  }
  if (sensitive && (aiInterest === "very_interested" || aiInterest === "privacy_concerned")) {
    return "private_ai";
  }

  // No website at all is a foundational gap before anything else compounds.
  if (first("has_website") === "false") return "website_platform";

  const { sectionScores } = computeAssessmentScore(answers);
  const ratio = (sectionKey: string): number => {
    const entry = sectionScores.find((s) => s.section_key === sectionKey);
    return entry && entry.max > 0 ? entry.score / entry.max : 0;
  };

  const websitePain = ratio("online_presence");
  const growthPain = (ratio("lead_flow") + ratio("sales_followup")) / 2;
  const opsPain = (ratio("operations") + ratio("team_data")) / 2;

  if (websitePain >= 0.6 && websitePain >= growthPain && websitePain >= opsPain) {
    return "website_platform";
  }

  const blocker = first("growth_blocker");
  if (blocker === "not_enough_leads" && growthPain >= 0.3) return "growth_systems";
  if (
    (blocker === "cant_keep_up" || blocker === "systems" || blocker === "owner_bottleneck") &&
    opsPain >= 0.3
  ) {
    return "operations_systems";
  }

  if (growthPain >= 0.5 && opsPain >= 0.5) return "business_systems";
  if (growthPain > opsPain + 0.15) return "growth_systems";
  if (opsPain > growthPain + 0.15) return "operations_systems";
  return "business_systems";
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const TEAM_SIZE_PHRASES: Record<string, string> = {
  solo: "You run a solo operation",
  team_2_5: "You run a business with a team of 2–5",
  team_6_15: "You run a business with a team of 6–15",
  team_16_50: "You run a business with a team of 16–50",
  team_50_plus: "You run a business with a team of more than 50",
};

const YEARS_PHRASES: Record<string, string> = {
  under_2: "that's less than two years old",
  years_2_5: "that's been operating for 2–5 years",
  years_6_15: "that's been operating for 6–15 years",
  over_15: "with more than 15 years behind it",
};

/**
 * Honest, rule-based summary built ONLY from the answers given. Insightful —
 * names the real problems — but stops short of an implementation plan; the
 * next steps point to the consultation.
 */
export function buildAssessmentSummary(
  answers: Record<string, unknown>,
  score: number,
  sectionScores: { section_key: string; label: string; score: number; max: number }[],
): AssessmentSummary {
  const first = (key: string) => firstValue(answers, key);
  const isConsumer = ["consumers", "both"].includes(first("customer_type"));
  const sendsQuotes = first("sends_quotes") === "true";

  // -- Overview ------------------------------------------------------------
  const sizePhrase = TEAM_SIZE_PHRASES[first("team_size")] ?? "You run a business";
  const yearsPhrase = YEARS_PHRASES[first("years_in_business")] ?? "";
  const gapLabels = sectionScores
    .filter((s) => s.max > 0 && s.score / s.max >= 0.5)
    .map((s) => s.label.toLowerCase());
  const strongLabels = sectionScores
    .filter((s) => s.max > 0 && s.score / s.max <= 0.25)
    .map((s) => s.label.toLowerCase());

  const band =
    score >= 65
      ? "there is significant room for systems to take work off your plate"
      : score >= 40
        ? "there are clear opportunities in specific areas, with solid ground elsewhere"
        : "your setup is fundamentally solid, with a few targeted gaps worth closing";

  const overviewParts = [
    `${sizePhrase}${yearsPhrase ? ` ${yearsPhrase}` : ""}.`,
    `Your overall systems score is ${score}/100 — higher means more room for better systems to help — which tells us ${band}.`,
  ];
  if (gapLabels.length > 0) {
    overviewParts.push(`The biggest room for improvement is in ${joinList(gapLabels)}.`);
  }
  if (strongLabels.length > 0) {
    overviewParts.push(`You're in comparatively good shape on ${joinList(strongLabels)}.`);
  }
  const overview = overviewParts.join(" ");

  // -- Priority problems (top 3–5 by weight) --------------------------------
  const problems: { weight: number; text: string }[] = [];
  const problem = (condition: boolean, weight: number, text: string) => {
    if (condition) problems.push({ weight, text });
  };

  problem(
    ["next_day", "several_days"].includes(first("response_time")),
    9,
    "New inquiries can wait a day or more for a response. In most markets the first business to respond wins the work, so slow response time is directly costing you jobs you never see.",
  );
  problem(
    first("missed_calls") === "nothing",
    9,
    "Missed calls simply vanish — there's no voicemail follow-through or automatic text-back, so a portion of your inbound demand disappears without a trace.",
  );
  problem(
    first("missed_calls") === "voicemail_slips",
    6,
    "Callbacks on missed calls slip through the cracks, which means some ready-to-buy customers never hear back from you.",
  );
  problem(
    first("followup_process") === "nothing",
    9,
    "Leads that don't buy immediately get no follow-up at all — they go cold by default, and most buyers need more than one touch before they commit.",
  );
  problem(
    first("followup_process") === "when_we_remember",
    6,
    "Follow-up only happens when someone remembers, so whether a lead converts depends on how busy your week was.",
  );
  problem(
    first("pipeline_visibility") === "no",
    8,
    "You told us things fall through the cracks between first contact and closed sale — there's no single view of every open opportunity and what it's waiting on.",
  );
  problem(
    first("pipeline_visibility") === "in_my_head",
    6,
    "Your open opportunities live in your head. That works until volume rises — then it becomes the ceiling on how much the business can handle.",
  );
  problem(
    ["spreadsheets", "nothing"].includes(first("crm_usage")),
    7,
    "Customer details and history live in spreadsheets, inboxes, or memory rather than one system, so context gets lost and nothing can be automated on top of it.",
  );
  problem(
    sendsQuotes && first("quote_followup") === "false",
    8,
    "Quotes go out and nobody follows up on the unanswered ones. Quote follow-up is usually the fastest revenue lever a quoting business has — this money is currently left on the table.",
  );
  problem(
    sendsQuotes && ["week", "longer"].includes(first("quote_speed")),
    7,
    "Quotes take a week or more to reach the customer. Every day a quote sits unsent, the odds the customer has hired someone else go up.",
  );
  problem(
    first("invoicing_method") === "inconsistent",
    8,
    "By your own account, invoicing sometimes slips through the cracks — meaning work is occasionally done without ever being billed for.",
  );
  problem(
    first("payment_speed") === "month_plus",
    7,
    "Getting paid routinely takes more than a month, which turns your business into an unpaid lender and squeezes cash flow.",
  );
  problem(
    ["too_few", "feast_famine"].includes(first("lead_volume")),
    first("lead_volume") === "too_few" ? 8 : 6,
    first("lead_volume") === "too_few"
      ? "Lead volume is the core constraint — there simply aren't enough new inquiries coming in to grow on."
      : "Lead flow is feast-or-famine, which makes staffing, scheduling, and cash flow harder than they need to be.",
  );
  problem(
    ["memory_texts", "basic_calendar"].includes(first("scheduling_method")),
    first("scheduling_method") === "memory_texts" ? 7 : 5,
    "Scheduling runs on calls, texts, and a basic calendar — a manual process that consumes time and creates double-bookings and misses as volume grows.",
  );
  problem(
    isConsumer && first("review_asking") === "never",
    7,
    "You don't ask customers for reviews. For a consumer-facing business, review count and recency are among the strongest drivers of whether new customers choose you.",
  );
  problem(
    ["hours_15_plus", "hours_5_15"].includes(first("manual_hours")),
    first("manual_hours") === "hours_15_plus" ? 7 : 5,
    "A meaningful chunk of every week goes to repetitive admin — data entry, copying information between systems, chasing paperwork — that software should be doing.",
  );
  problem(
    first("workflow_docs") === "in_heads",
    6,
    "How the business runs lives entirely in people's heads. Nothing is written down, which makes hiring, delegating, and taking a vacation all harder than they should be.",
  );
  problem(
    ["1", "2"].includes(first("capacity_scale")),
    6,
    "By your own assessment, your current systems couldn't absorb a doubling of demand — which means growth would break things before it builds them.",
  );

  problems.sort((a, b) => b.weight - a.weight);
  const priority_problems = problems.slice(0, 5).map((p) => p.text);
  if (priority_problems.length === 0) {
    priority_problems.push(
      "No single urgent gap stood out in your answers. The opportunity for a business in your position is consolidation — connecting the tools you already use so information flows between them without manual effort.",
    );
  }

  // -- Revenue opportunities -------------------------------------------------
  const revenue_opportunities: string[] = [];
  const opportunity = (condition: boolean, text: string) => {
    if (condition && revenue_opportunities.length < 5) revenue_opportunities.push(text);
  };

  opportunity(
    ["same_day", "next_day", "several_days"].includes(first("response_time")),
    "Faster lead response: getting every inquiry a reply within minutes — automatically — typically lifts close rates meaningfully, because most customers stop shopping once someone competent answers.",
  );
  opportunity(
    sendsQuotes && first("quote_followup") === "false",
    "Quote follow-up: a simple, consistent follow-up sequence on outstanding quotes recovers sales you've already done the work to earn.",
  );
  opportunity(
    ["nothing", "voicemail_slips", "not_sure"].includes(first("missed_calls")),
    "Missed-call recovery: an instant text-back to every missed call keeps those customers engaged instead of dialing the next business on the list.",
  );
  opportunity(
    isConsumer && ["never", "when_we_remember"].includes(first("review_asking")),
    "Review generation: systematically asking every happy customer for a review compounds — more reviews mean more visibility, which means more inbound leads at no ad cost.",
  );
  opportunity(
    ["never", "occasionally"].includes(first("lost_leads")),
    "Reactivating old leads: the people who inquired but never bought are the cheapest sales you'll ever make — a periodic re-engagement touch turns a dormant list into booked work.",
  );
  opportunity(
    first("retention_outreach") === "false",
    "Staying in touch with past customers: seasonal reminders and check-ins bring repeat business from people who already trust you.",
  );
  opportunity(
    first("after_hours") === "false",
    "After-hours capture: letting customers book or reach you outside business hours captures the demand that currently goes to whoever answers at 8pm.",
  );
  opportunity(
    first("has_website") === "true" && ["none", "few", "not_tracked"].includes(first("website_leads")),
    "Your website as a lead source: right now it produces little measurable business — turned into a proper lead-capture asset, it becomes a salesperson that never sleeps.",
  );
  if (revenue_opportunities.length === 0) {
    revenue_opportunities.push(
      "Your revenue engine looks comparatively healthy. Gains here would come from compounding small improvements — tightening each step of an already-working funnel — rather than fixing one broken link.",
    );
  }

  // -- Operational risks -------------------------------------------------------
  const operational_risks: string[] = [];
  const risk = (condition: boolean, text: string) => {
    if (condition && operational_risks.length < 5) operational_risks.push(text);
  };

  risk(
    first("workflow_docs") === "in_heads",
    "Key-person dependency: with nothing documented, the business is one illness, resignation, or vacation away from serious disruption.",
  );
  risk(
    ["lots", "not_sure"].includes(first("data_backup")),
    "Data loss exposure: important business information lives on individual devices without reliable backup — a lost phone or dead laptop could take real business history with it.",
  );
  risk(
    ["shared_doc", "reused"].includes(first("password_practice")),
    "Credential risk: passwords kept in shared documents or reused across accounts are the most common way small businesses get compromised.",
  );
  risk(
    first("sensitive_data") === "true" &&
      (["shared_doc", "reused"].includes(first("password_practice")) ||
        ["lots", "not_sure"].includes(first("data_backup"))),
    "You handle sensitive customer information without the safeguards that kind of data calls for — a breach would carry real legal and reputational consequences.",
  );
  risk(
    first("kpis_known") === "false" || first("reporting") === "gut",
    "Flying without instruments: decisions are being made without current numbers, so problems show up in the bank balance weeks after they started.",
  );
  risk(
    ["group_texts", "verbal"].includes(first("team_tools")),
    "Internal communication runs on group texts and verbal handoffs — details get lost between the person who took the call and the person doing the work.",
  );
  risk(
    first("no_shows") === "often",
    "No-shows are frequent enough to hurt, and every empty slot is paid-for capacity producing nothing.",
  );
  risk(
    first("invoicing_method") === "inconsistent",
    "Revenue leakage: when invoicing slips through the cracks, completed work goes unbilled — a direct, silent loss.",
  );
  if (operational_risks.length === 0) {
    operational_risks.push(
      "No acute operational risks stood out in your answers — your exposure is mainly the opportunity cost of manual work, not a looming failure point.",
    );
  }

  // -- Recommendation & next steps -----------------------------------------
  const recommended_category = recommendServiceCategory(answers);

  const next_steps = [
    "Book your consultation. We'll walk through these findings together, pressure-test them against how your business actually runs, and show you what closing the biggest gaps would look like — in plain terms, with real numbers.",
    "If you can, have two figures handy for the call: roughly how many new leads you get per month, and your average job or sale value. They turn this assessment into a concrete revenue conversation.",
    "If someone else owns one of these areas — an office manager, a sales lead — consider having them join the consultation.",
  ];

  return {
    overview,
    priority_problems,
    revenue_opportunities,
    operational_risks,
    recommended_category,
    recommended_category_label: SERVICE_CATEGORY_LABELS[recommended_category],
    next_steps,
    section_scores: sectionScores,
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
