import type { IndustryVertical } from "../types";

/**
 * Default content for the Health & Wellness Practices vertical.
 *
 * Covers appointment-based practices where a booked chair, room, or table is
 * the unit of production: med spas and aesthetic clinics, IV and recovery
 * studios, massage and bodywork, chiropractic and physical therapy, and
 * integrative or functional medicine.
 *
 * Every claim here is qualitative; no page projects a dollar outcome and
 * nothing is priced in advance. Demo copy describes the actual fictional
 * "Aura Health & Wellness" demo in components/demos/data/healthwellness.ts.
 */
export const healthWellnessVertical: IndustryVertical = {
  slug: "health-wellness",
  status: "published",
  name: "Health & Wellness Practices",
  shortName: "Health & Wellness",
  terminology: {
    customer: "client",
    customers: "clients",
    job: "appointment",
    jobs: "appointments",
    team: "front desk",
  },

  hero: {
    eyebrow: "Health & Wellness Practices",
    headline: "Fill More Appointments Without Burning Out the Front Desk",
    subheadline:
      "RSG builds booking and follow-up systems for health and wellness practices: an assistant that answers every call and message, including the ones that arrive at 7 PM, confirmations that cut no-shows, and structured follow-up that turns consultations into booked treatments and brings lapsed clients back. Your front desk approves; the system does the chasing.",
    demoCta: {
      label: "Explore the Health & Wellness Demo",
      href: "/demos/healthwellness",
    },
    designedFor:
      "Built for med spas and aesthetic clinics, IV and recovery studios, massage and bodywork practices, chiropractic and physical therapy clinics, and integrative or functional medicine practices. If your clients book by phone, text, DM, and web form and your schedule lives in a booking platform, this is designed for you.",
  },

  problemsIntro:
    "Most practices do not have a treatment problem; they have an administrative one. The phone, the follow-up after a consultation, and the clients who quietly stop coming are the failure points we see most often.",
  problems: [
    {
      id: "unanswered-calls",
      title: "Calls and DMs go unanswered while providers are with clients",
      detail:
        "One person cannot check in a client, take a payment, answer an Instagram DM, and hold two phone lines at once. Mid-day inquiries ring out during the busiest treatment hours, and anything after close lands on voicemail. Someone who reaches voicemail is usually messaging the next practice on their search results within minutes.",
      cost: "Ten missed inquiries a month is ten first-visit relationships that started somewhere else.",
    },
    {
      id: "no-shows",
      title: "No-shows and late cancellations leave rooms empty",
      detail:
        "A single reminder the day before is easy to ignore, and unconfirmed clients are rarely flagged until they simply do not arrive. Without a live waitlist, a 9 AM cancellation becomes a paid, empty hour instead of a backfilled slot.",
      cost: "An empty room still costs the provider's paid hour and the rent it sits in.",
    },
    {
      id: "consult-dropoff",
      title: "Consultations end without a booked treatment",
      detail:
        "A client hears the plan, says they want to think about it, and the case enters the system with no owner and no follow-up date. Most practices can describe this problem but cannot say how many consultations from last quarter are still sitting unbooked.",
      cost: "Every consultation that never converts still cost you the provider time to deliver it.",
    },
    {
      id: "membership-attrition",
      title: "Packages and memberships expire unused",
      detail:
        "Clients pre-pay for a series, come twice, and drift. Unused credits quietly become refund requests, chargebacks, or a bad review, and nobody is watching the expiry dates closely enough to reach out before it turns into a problem.",
      cost: "Unused credits are revenue you already collected and will spend the next quarter defending.",
    },
    {
      id: "manual-followup",
      title: "Rebooking, intake, and confirmations are still manual",
      detail:
        "Rebooking happens only if the client is asked at checkout and the front desk remembers. Confirmation calls consume staff hours every single day and still miss the clients who only answer text. Intake and consent forms get filled out in the waiting room while the appointment slot ticks away.",
      cost: "Two staff hours a day on confirmations is roughly a quarter of a full-time front-desk role.",
    },
  ],

  workflow: {
    title: "The Client Journey, Stage by Stage",
    intro:
      "Every practice runs the same underlying pipeline, whether anyone manages it or not: inquiry to consultation to booked treatment to follow-up to retention. Below is where each stage breaks, which RSG system owns it, and what gets automated; with your front desk approving every booking and every clinical question going to a human.",
    stages: [
      {
        id: "inquiry",
        label: "Client inquiry",
        happens:
          "A prospective or existing client calls, texts, sends a DM, or submits a web form. Most inquiries arrive while the front desk is mid-check-in or on the other line, and everything after close lands on voicemail.",
        failures: [
          "Calls ring out during treatment hours and never come back",
          "Instagram and Facebook DMs sit unread until someone has a free minute",
          "Voicemails get returned a day later, if at all",
          "Nobody records which channel the inquiry came from",
        ],
        system: "RSG Wellness Front Desk Assistant",
        automations: [
          "Missed-call text-back within a minute, with your after-hours protocol stated first",
          "DM and web-form inquiries answered with starting pricing and a qualifying question",
          "Every inquiry logged with its source channel before a human touches it",
        ],
        kpis: [
          "Missed-call recovery rate",
          "Average first-response time",
          "Inquiries per week by channel",
          "After-hours share of inquiries",
        ],
        integrations: ["Twilio", "Podium", "Boulevard"],
      },
      {
        id: "qualification",
        label: "Service & fit qualification",
        happens:
          "The practice works out what the client actually wants, whether you offer it, and which provider it belongs with. Handled entirely by phone, this stage eats front-desk minutes; handled loosely, it produces mismatched bookings and awkward day-of conversations.",
        failures: [
          "'How much is it?' ties up the phone lines all day",
          "Vague answers turn into day-of price surprises and cancelled treatments",
          "Clients get booked with the wrong provider for what they want",
          "Clinical questions get answered by whoever picked up, not by a clinician",
        ],
        system: "RSG Wellness Front Desk Assistant",
        automations: [
          "Pricing and service questions answered from a maintained practice playbook, not improvised",
          "Goals, timing, and budget captured in the conversation and attached to the record",
          "Anything clinical routed to the right provider with full context, never answered by the assistant",
        ],
        kpis: [
          "Qualification-to-consult rate",
          "Pricing questions resolved without staff time",
          "Provider match accuracy",
        ],
        integrations: ["Boulevard", "Vagaro", "Mindbody"],
      },
      {
        id: "booked",
        label: "Consultation booked",
        happens:
          "The client picks a time. Every round of phone tag between interest and a held slot is another chance to lose them, and any time offered that does not match the real schedule creates rework.",
        failures: [
          "Phone tag stretches a 60-second booking into a three-day exchange",
          "Times get offered that conflict with the actual provider schedule",
          "Requests sit in an inbox with no hold on the slot",
          "Double-bookings from schedules kept in two places",
        ],
        system: "RSG Consultation Booking System",
        automations: [
          "Real availability offered from the live schedule, with the slot held on reply",
          "Deposit link sent automatically where your policy requires one",
          "Confirmation, directions, and pre-visit instructions sent the moment it books",
        ],
        kpis: [
          "Inquiry-to-booking time",
          "Bookings completed without staff involvement",
          "Deposit collection rate",
        ],
        integrations: ["Boulevard", "Jane App", "Stripe", "Google Workspace"],
      },
      {
        id: "visit",
        label: "The visit",
        happens:
          "The client arrives, or doesn't. Either way the room, the provider, and the hour are already paid for. Intake and consent either happened in advance or they are happening now, in the appointment slot.",
        failures: [
          "Unconfirmed appointments are not flagged until the client fails to show",
          "Intake and consent forms get completed in the waiting room",
          "A cancellation leaves a hole nobody backfills",
          "No-shows get rebooked only if someone remembers to call",
        ],
        system: "RSG No-Show Prevention System",
        automations: [
          "Reminders at 48, 24, and 2 hours with a one-tap reschedule option",
          "Staff alerted when an appointment is still unconfirmed at T-24h",
          "Intake and consent links sent ahead, with completion tracked on the record",
          "Missed visits triggering a same-day recovery message and a call task",
        ],
        kpis: [
          "No-show rate",
          "Confirmation rate at T-24h",
          "Intake completed before arrival",
          "Cancellation backfill rate",
        ],
        integrations: ["Twilio", "Boulevard", "Jane App"],
      },
      {
        id: "followup",
        label: "Plan follow-up & rebooking",
        happens:
          "The provider recommends a plan or a series, and the client says they'll think about it. This is the single highest-value stage in the practice and the one most often left to memory.",
        failures: [
          "Recommended plans sit unbooked with no owner and no follow-up date",
          "Rebooking happens only if the client is asked at checkout",
          "Series clients drift after session two and nobody notices",
          "Follow-up is inconsistent between providers and between weeks",
        ],
        system: "RSG Treatment Plan Follow-up System",
        automations: [
          "Every unbooked recommendation queued with a scheduled, approved follow-up",
          "Series and package clients nudged when they fall behind their own cadence",
          "Front desk given a daily list of who to call and exactly why",
        ],
        kpis: [
          "Consult-to-treatment conversion",
          "Unbooked plans older than 30 days",
          "Rebook-at-checkout rate",
          "Series completion rate",
        ],
        integrations: ["Boulevard", "Aesthetic Record", "Twilio", "Stripe"],
      },
      {
        id: "retention",
        label: "Retention & reactivation",
        happens:
          "Clients lapse quietly. There is no cancellation event for someone who simply stops rebooking, so without a system nobody notices until the schedule is thin and it is too late to do anything about this month.",
        failures: [
          "Lapsed clients are invisible until someone runs a report nobody runs",
          "Memberships auto-renew into refund requests instead of conversations",
          "Reviews are requested inconsistently, and unhappy clients are the ones who post",
          "Reactivation campaigns get written, sent once, and never repeated",
        ],
        system: "RSG Client Reactivation System",
        automations: [
          "Lapsed clients segmented by service and value, contacted on a repeating monthly cadence",
          "Membership and package expiry reached out on before they lapse or auto-renew",
          "Post-visit feedback asked for first; happy clients routed to a review, concerns routed to staff",
        ],
        kpis: [
          "Reactivation reply and rebook rate",
          "Membership retention rate",
          "Unused credits nearing expiry",
          "Review volume and average rating",
        ],
        integrations: ["Boulevard", "Zenoti", "Podium", "Twilio"],
      },
    ],
  },

  demoSlug: "healthwellness",
  demo: {
    title: "Explore the Health & Wellness Front Desk System",
    description:
      "A fully working simulation built around Aura Health & Wellness, a fictional blended practice offering aesthetics, IV therapy, massage, and recovery. Nothing here is a video or a screenshot: the pipeline, the conversations, the AI receptionist, and the analytics all respond to what you do. Every name, number, and message is sample data.",
    highlights: [
      "A live client pipeline from inquiry to retention",
      "Conversations across SMS, Instagram, Facebook, and phone",
      "An AI receptionist you can call as the client",
      "Instant treatment quotes with follow-up attached",
      "Automations, campaigns, tasks, and reviews",
      "Analytics: response time, funnel, and source performance",
    ],
    simulations: [
      "Take a missed call as the caller and watch it become a booked consultation",
      "Run the Instagram inquiry scenario end to end",
      "Trigger the lapsed-client reactivation campaign",
      "Flag a no-show risk and see the task it creates for the front desk",
      "Price a service and send the quote",
    ],
    disclaimer:
      "The demo is a simulation. It sends no real messages, books no real appointments, and contains no real client data. Pricing shown is illustrative; real plans are quoted after a consultation.",
  },

  systemsIntro:
    "We build seven named systems for health and wellness practices. Most practices start with one, usually the front desk assistant, and add the others as the first one proves itself. Each is scoped and priced individually against your actual booking platform and your actual call volume.",
  systems: [
    {
      id: "sys-front-desk",
      name: "RSG Wellness Front Desk Assistant",
      outcome:
        "Every call, text, DM, and form gets an answer in under a minute, including nights and weekends, without adding a person to the front desk.",
      capabilities: [
        "Answers calls the team cannot get to, and texts back every missed call within a minute",
        "Handles hours, location, parking, pricing, and service questions from your written playbook",
        "Captures goals, timing, and contact details, then hands off to booking",
        "Refuses clinical questions and routes them to a provider with the context attached",
        "Logs every inquiry with its source channel and a written summary",
        "States your after-hours and urgent-care protocol before anything else",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Twilio", "Podium", "Boulevard", "Vagaro", "Google Workspace"],
      flagship: true,
    },
    {
      id: "sys-booking",
      name: "RSG Consultation Booking System",
      outcome:
        "An inquiry becomes a held slot on the right provider's schedule without phone tag and without double-booking.",
      capabilities: [
        "Offers real availability read from the live schedule, not a guess",
        "Holds the slot on reply and writes it back to your booking platform",
        "Collects deposits where your policy requires one",
        "Sends confirmation, directions, and pre-visit instructions immediately",
        "Routes to the correct provider based on the service requested",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Boulevard", "Jane App", "Mindbody", "Stripe", "Google Workspace"],
    },
    {
      id: "sys-noshow",
      name: "RSG No-Show Prevention System",
      outcome:
        "Fewer empty rooms: confirmations that actually reach people, and a flag on the ones who have not answered while there is still time to fill the slot.",
      capabilities: [
        "Reminder sequence at 48, 24, and 2 hours with one-tap confirm or reschedule",
        "Escalation to the front desk when an appointment is unconfirmed at T-24h",
        "Intake and consent forms sent ahead, with completion tracked",
        "Same-day recovery message and call task when someone misses",
        "Waitlist outreach when a slot opens up",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Twilio", "Boulevard", "Jane App", "Vagaro"],
    },
    {
      id: "sys-plan",
      name: "RSG Treatment Plan Follow-up System",
      outcome:
        "Recommended plans stop dying in the gap between the consultation and the booking, because every one of them has an owner and a date.",
      capabilities: [
        "Every unbooked recommendation queued with a scheduled follow-up",
        "Approved message sequences the front desk reviews before they send",
        "Series and package clients nudged when they fall behind their cadence",
        "A daily call list showing who to contact and exactly why",
        "Payment and financing links attached where relevant",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Boulevard", "Aesthetic Record", "Zenoti", "Stripe", "Twilio"],
    },
    {
      id: "sys-reactivation",
      name: "RSG Client Reactivation System",
      outcome:
        "The clients who quietly stopped coming get a real, personal reason to come back, on a repeating cadence instead of a one-off blast.",
      capabilities: [
        "Lapsed clients segmented by service, last visit, and estimated value",
        "Monthly repeating campaigns rather than a single send that gets forgotten",
        "Replies routed to the front desk inbox with the full history attached",
        "Responders tagged and handed to booking automatically",
        "Suppression rules so nobody gets contacted twice or after opting out",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Boulevard", "Vagaro", "Mindbody", "Twilio"],
    },
    {
      id: "sys-reviews",
      name: "RSG Reviews & Reputation System",
      outcome:
        "More reviews from the clients who had a good visit, and a private heads-up about the ones who didn't before they post.",
      capabilities: [
        "Feedback question sent a few hours after every completed visit",
        "Positive responses routed to your review platform of choice",
        "Concerns flagged for a personal call from a named person, not a form",
        "Review volume and rating tracked by provider and by service",
        "Nothing incentivized, gated, or written on the client's behalf",
      ],
      timeline: "2–3 weeks",
      pricing: "Custom quote",
      integrations: ["Podium", "Boulevard", "Google Workspace", "Twilio"],
    },
    {
      id: "sys-membership",
      name: "RSG Membership & Package Retention System",
      outcome:
        "Pre-paid credits get used and memberships get renewed on purpose, instead of lapsing into refund requests and chargebacks.",
      capabilities: [
        "Unused credits surfaced before they expire, with outreach attached",
        "Renewal conversations opened ahead of the auto-charge, not after it",
        "Members who have not visited this cycle flagged for the front desk",
        "Membership value and utilization reported per client",
        "Cancellation requests routed to a human immediately",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Boulevard", "Zenoti", "Mindbody", "Stripe"],
    },
  ],

  integrations: {
    intro:
      "The booking platform stays the source of truth. We connect to it rather than replacing it, because a practice mid-migration is a practice not taking bookings.",
    disclaimer:
      "Integration depth varies by platform and by what each vendor's API actually exposes. Some connections are read-and-write both ways, some are one-way, and a few need a sync layer in between. We confirm exactly what is possible on your specific setup before anything is scoped or quoted, and we will tell you when the honest answer is that a direct integration is not available.",
    items: [
      {
        name: "Boulevard",
        category: "Booking & practice management",
        connects:
          "Reads real availability and writes bookings back, so the times offered by text or DM are the times actually open on the provider's schedule.",
      },
      {
        name: "Vagaro",
        category: "Booking & practice management",
        connects:
          "Syncs the appointment schedule and client records so inquiries, reminders, and reactivation campaigns all reference the same history.",
      },
      {
        name: "Mindbody",
        category: "Booking & memberships",
        connects:
          "Pulls membership status, package balances, and visit history so retention outreach knows who has unused credits and who is lapsing.",
      },
      {
        name: "Jane App",
        category: "Clinical scheduling",
        connects:
          "Connects the treatment schedule and intake forms for chiropractic, physical therapy, and multi-provider clinical practices.",
      },
      {
        name: "Zenoti",
        category: "Multi-location operations",
        connects:
          "Keeps schedules, memberships, and client records aligned across locations so a client's history follows them between sites.",
      },
      {
        name: "Aesthetic Record",
        category: "Aesthetics EMR",
        connects:
          "Links treatment plans and visit records so follow-up on an unbooked recommendation carries the right context to the front desk.",
      },
      {
        name: "Twilio",
        category: "Voice & SMS",
        connects:
          "Carries the phone number, the missed-call text-back, and every reminder and campaign message, with delivery and opt-out tracked.",
      },
      {
        name: "Stripe",
        category: "Payments",
        connects:
          "Sends deposit and balance links, and reconciles what was collected against the appointment it belongs to.",
      },
      {
        name: "Podium",
        category: "Messaging & reviews",
        connects:
          "Consolidates the review request flow and the messaging inbox where a practice already runs on it.",
      },
      {
        name: "Google Workspace",
        category: "Calendar & email",
        connects:
          "Mirrors provider calendars and sends the email half of confirmations, reminders, and follow-up.",
      },
    ],
  },

  compliance: {
    title: "Health Information, Consent, and What This System Will Not Do",
    intro:
      "Client communication in a health and wellness setting can touch protected health information, and marketing messages are regulated whether or not your practice thinks of itself as a healthcare provider. We treat both as constraints on the build rather than as paperwork at the end of it.",
    disclaimer:
      "None of this is legal or medical advice, and RSG is not your compliance authority. Whether your practice is a HIPAA covered entity depends on facts we cannot determine for you, including whether you bill insurance electronically. Confirm your obligations with your own counsel and compliance advisor. What we can commit to is building to the posture you tell us you need, and documenting exactly what the system stores and sends.",
    items: [
      {
        title: "Minimum necessary information",
        detail:
          "The system is built to hold scheduling and communication data, not clinical records. Names, contact details, the service someone asked about, and the message history are enough to book an appointment and follow up on it. Clinical detail stays in your EMR or chart system, and the assistant is scoped so it cannot retrieve it.",
      },
      {
        title: "Business associate agreements",
        detail:
          "Where your practice is a covered entity and the system will touch protected health information, we identify every vendor in the path and confirm a BAA is in place before that vendor handles anything. If a vendor will not sign one, we design around it or tell you plainly that the integration is off the table.",
      },
      {
        title: "Consent and opt-out on every channel",
        detail:
          "Marketing and reactivation messages are regulated under the TCPA and by carrier rules, independent of HIPAA. Consent is captured and stored with a timestamp, opt-out is honored immediately and permanently across every campaign, and appointment reminders are kept operationally distinct from promotional sends.",
      },
      {
        title: "No clinical judgment, ever",
        detail:
          "The assistant answers questions from your written practice playbook and refuses anything that requires clinical judgment. It will not recommend a treatment, interpret a symptom, comment on medication, or tell someone whether a service is appropriate for them. Those go to a named provider with the conversation attached, and the demo shows the refusal happening rather than hiding it.",
      },
      {
        title: "Access scoped to role",
        detail:
          "A front-desk coordinator, a provider, and an owner see different things. Access is scoped by role so the person confirming appointments is not browsing the full client history, and every access path is documented so you can answer questions about it later.",
      },
      {
        title: "Auditability",
        detail:
          "Every automated message the system sends is logged with its trigger, its timestamp, and the record it belongs to. If a client asks what you sent them and when, the answer is a lookup rather than an investigation.",
      },
    ],
  },

  caseStudy: {
    label: "Illustrative scenario",
    businessType: "Blended med spa and wellness practice, single location",
    size: "2 injectors, 1 esthetician, 1 massage therapist, 2 front-desk staff, roughly 1,900 active clients",
    problem:
      "The practice books well when someone picks up the phone and poorly when nobody can. Instagram DMs are answered in batches at the end of the day, missed calls are returned the next morning if at all, and consultations that do not book on the spot are never followed up on in any consistent way. The owner suspects the biggest leak is between the consultation and the booking but has no way to measure it, because that gap does not exist as a number anywhere in the booking platform.",
    currentStack: [
      "Boulevard for booking and client records",
      "A shared Instagram and Facebook inbox",
      "The practice mobile phone for texts",
      "A spreadsheet of clients who asked about a series",
      "Manual confirmation calls each afternoon",
    ],
    implementation: [
      "Deploy the RSG Wellness Front Desk Assistant on the existing numbers and social inboxes, with a written pricing and services playbook and a hard clinical-refusal boundary",
      "Connect the booking system to Boulevard so offered times reflect real availability and bookings write back",
      "Turn on the no-show sequence at 48/24/2 hours with front-desk escalation at T-24h",
      "Queue every unbooked consultation recommendation with an approved follow-up sequence and an owner",
      "Start a monthly repeating reactivation campaign segmented by service and last visit",
      "Route post-visit feedback so concerns reach a person before they reach a review platform",
    ],
    beforeWorkflow: [
      "Call comes in during a treatment and rings out",
      "Voicemail is checked at the end of the day, or the next morning",
      "DMs are answered in a batch that evening",
      "Consultation happens; client says they'll think about it",
      "Nothing further happens unless the client calls back",
      "Lapsed clients are noticed only when the schedule looks thin",
    ],
    afterWorkflow: [
      "Call rings out and a text-back goes out inside a minute with the after-hours protocol first",
      "The assistant answers pricing and service questions and captures goals and timing",
      "Real available times are offered and the slot is held on reply",
      "Confirmation, intake, and reminders are queued automatically",
      "Unbooked recommendations enter a follow-up queue with an owner and a date",
      "Lapsed clients are contacted on a repeating monthly cadence, replies routed to the front desk",
    ],
    timeline: "6–10 weeks for the first three systems, sequenced one at a time",
    kpis: [
      "Missed-call recovery rate",
      "Average first-response time by channel",
      "No-show rate and T-24h confirmation rate",
      "Consult-to-treatment conversion",
      "Unbooked recommendations older than 30 days",
      "Reactivation reply and rebook rate",
    ],
    projections: [
      { label: "First-response time", value: "Minutes instead of hours" },
      { label: "After-hours inquiries captured", value: "All of them, rather than voicemail" },
      { label: "Unconfirmed appointments", value: "Flagged before the day, not after" },
      { label: "Unbooked consultations", value: "Owned and dated rather than forgotten" },
    ],
    projectionNote:
      "These are projections describing what the system is designed to change, not measured results from this practice, which is fictional and constructed to illustrate the workflow. We do not publish client numbers without written permission, and we will not quote you an outcome before we have seen your call volume, your booking platform, and your actual conversion gaps.",
  },

  ctas: {
    primary: { label: "Book a Systems Consultation", href: "/book" },
    secondary: [
      { label: "Explore the Health & Wellness Demo", href: "/demos/healthwellness" },
      { label: "See How We Work", href: "/process" },
    ],
  },

  assessment: {
    title: "Which system should your practice start with?",
    intro:
      "Five questions, no email required to see the answer. It points at the one system most likely to matter first for a practice shaped like yours; it is a starting point for a conversation, not a diagnosis.",
    questions: [
      {
        id: "practice-type",
        label: "What kind of practice do you run?",
        type: "select",
        required: true,
        options: [
          "Med spa / aesthetic clinic",
          "IV therapy / recovery studio",
          "Massage / bodywork",
          "Chiropractic / physical therapy",
          "Integrative or functional medicine",
          "Blended: several of the above",
        ],
      },
      {
        id: "providers",
        label: "How many providers take appointments?",
        type: "select",
        required: true,
        options: ["Just me", "2–3", "4–6", "7 or more"],
      },
      {
        id: "software",
        label: "What do you book and schedule in?",
        type: "select",
        options: ["Boulevard", "Vagaro", "Mindbody", "Jane App", "Zenoti", "Other / not sure"],
      },
      {
        id: "channels",
        label: "Where do most new inquiries arrive?",
        type: "select",
        options: [
          "Phone calls",
          "Instagram or Facebook DMs",
          "Website forms",
          "Text messages",
          "Walk-ins and referrals",
        ],
      },
      {
        id: "bottleneck",
        label: "What is costing you the most right now?",
        type: "select",
        required: true,
        options: [
          "Calls and messages we cannot get to",
          "No-shows and late cancellations",
          "Consultations that never book treatment",
          "Clients who stopped coming back",
          "Memberships and packages going unused",
          "Not enough reviews",
        ],
      },
    ],
    recommendations: [
      { keywords: ["calls", "messages", "cannot get to", "phone"], systemId: "sys-front-desk" },
      { keywords: ["no-show", "no-shows", "cancellations", "late"], systemId: "sys-noshow" },
      { keywords: ["consultation", "consultations", "never book", "treatment"], systemId: "sys-plan" },
      { keywords: ["stopped coming", "lapsed", "back"], systemId: "sys-reactivation" },
      { keywords: ["membership", "memberships", "package", "packages", "unused"], systemId: "sys-membership" },
      { keywords: ["review", "reviews"], systemId: "sys-reviews" },
    ],
    fallbackSystemId: "sys-front-desk",
  },

  faqs: [
    {
      q: "Does this work with Boulevard, Vagaro, Mindbody, or whatever we book in?",
      a: "Usually, but the honest answer is that integration depth varies by platform. Boulevard, Vagaro, Mindbody, and Jane App all expose usable APIs, so two-way scheduling is generally workable. Older or closed systems sometimes need a sync layer in between, and a few expose nothing useful at all. We confirm exactly what your setup supports before anything is scoped, and if the answer is that a direct integration is not possible we say so rather than building a fragile workaround.",
    },
    {
      q: "Is this HIPAA compliant?",
      a: "Whether your practice is a HIPAA covered entity depends on facts we cannot determine for you, principally whether you transmit health information electronically in connection with a billing transaction. Plenty of cash-pay wellness practices are not covered entities and still hold information they should protect. What we do is build to the posture you tell us you need: minimum-necessary data, BAAs with every vendor in the path where required, role-scoped access, and a full log of what was sent and when. Confirm your actual obligations with your own counsel; we build to them.",
    },
    {
      q: "Will it give clients medical or treatment advice?",
      a: "No, and this is a hard boundary rather than a setting. The assistant answers from your written practice playbook: hours, location, parking, pricing, what a service involves, what to expect. Anything requiring clinical judgment is refused and routed to a named provider with the conversation attached. It will not recommend a treatment, interpret a symptom, comment on medication, or tell someone whether something is appropriate for them. You can watch it refuse in the demo.",
    },
    {
      q: "Do we have to replace our booking system?",
      a: "No. We connect to it. A practice mid-migration is a practice not taking bookings, and replacing a working scheduler is the most expensive way to solve a follow-up problem. The booking platform stays the source of truth; the system reads availability from it and writes bookings back to it.",
    },
    {
      q: "Will clients know they are talking to an assistant?",
      a: "Yes. It identifies itself as the practice's automated assistant in the first line, and hands off to a person whenever the conversation calls for one. We do not build systems that pretend to be a human, both because it is the wrong thing to do and because it reliably backfires the first time someone realizes.",
    },
    {
      q: "How long does it take, and what does it cost?",
      a: "The first system is typically 2–5 weeks depending on which one and how cooperative your booking platform is. Cost is quoted per engagement after we have seen your call volume, your platform, and where your conversion actually leaks; we do not publish package pricing because we have never seen two practices with the same bottleneck.",
    },
    {
      q: "What does our front desk still do?",
      a: "The judgment. They approve campaign messages before they send, handle every clinical and sensitive conversation, make pricing and membership decisions, and can override any workflow at any time. The system takes the repetitive half: the missed-call text-back, the reminder sequence, the follow-up nobody had time for, the daily list of who to call and why.",
    },
  ],

  seo: {
    title: "Health & Wellness AI Receptionist & Client Follow-up",
    description:
      "Client follow-up automation and an AI front desk for med spas, wellness clinics, and recovery studios: answer every call, cut no-shows, and book more visits.",
  },
};
