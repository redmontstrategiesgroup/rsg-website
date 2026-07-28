import type { IndustryVertical } from "../types";

/**
 * Default content for the Dental & Specialty Healthcare Practices vertical.
 *
 * Every claim here is qualitative or simple arithmetic; projections are
 * labeled as modeled. ROI input and assumption ids must match dentalRoi()
 * in lib/industries/roi.ts. Demo copy describes the actual fictional
 * "Brightwater Dental" demo in components/demos/data/dental.ts.
 */
export const dentalVertical: IndustryVertical = {
  slug: "dental-practices",
  status: "published",
  name: "Dental & Specialty Healthcare Practices",
  shortName: "Dental & Healthcare",
  audience: [
    "General dentistry",
    "Cosmetic dentistry",
    "Orthodontics",
    "Oral surgery",
    "Med spas & appointment-based specialty practices",
  ],
  terminology: {
    customer: "patient",
    customers: "patients",
    job: "appointment",
    jobs: "appointments",
    team: "front desk",
  },

  hero: {
    eyebrow: "Dental & Specialty Healthcare Practices",
    headline: "Fill More Chairs Without Burning Out the Front Desk",
    subheadline:
      "RSG builds patient booking and follow-up systems for dental and specialty practices: an assistant that answers every call and message — including the ones that come in at 7 PM — confirmations that cut no-shows, and structured follow-up that gets treatment plans and overdue patients back on the schedule. Your front desk approves; the system does the chasing.",
    primaryCta: {
      label: "Assess Your Patient Booking and Follow-Up Systems",
      href: "#assessment",
    },
    demoCta: {
      label: "Explore the Dental Practice Demo",
      href: "/demos/dental",
    },
    designedFor:
      "Built for general, cosmetic, orthodontic, and oral-surgery practices, plus med spas and other appointment-based specialty clinics. If your patients book by phone, text, and web form and your schedule lives in a practice management system, this is designed for you.",
  },

  problemsIntro:
    "Most practices do not have a dentistry problem — they have an administrative one. The phone rings while the front desk is checking someone in, treatment plans age quietly in charts, and the recall list gets worked when there's time, which is never. These are the failure points we see most often.",
  problems: [
    {
      id: "unanswered-calls",
      title: "Calls go unanswered while patients are being treated",
      detail:
        "The front desk cannot check in a patient, take a payment, and answer two phone lines at once, so mid-day calls ring out during the busiest treatment hours. The caller who reaches voicemail is usually dialing the next practice on their search results within minutes.",
      cost: "If ten missed callers a month would have booked, that is ten patients' first-year value gone — every month.",
    },
    {
      id: "no-shows",
      title: "No-shows and late cancellations leave chairs empty",
      detail:
        "A single confirmation call the day before is easy to ignore, and unconfirmed patients are rarely flagged until they simply do not arrive. Without a live waitlist, a 9 AM cancellation becomes an empty chair instead of a backfilled slot.",
      cost: "An empty hygiene chair still costs the hygienist's paid hour; ten no-shows a month is ten paid hours producing nothing.",
    },
    {
      id: "unscheduled-plans",
      title: "Diagnosed treatment sits unscheduled in charts",
      detail:
        "A patient hears the plan, says they want to think about it, and the case enters the chart with no owner and no follow-up date. Most practices can name the problem but cannot name the current size of their unscheduled-plan backlog.",
      cost: "Fifty unscheduled plans at an average plan value of $1,800 is $90,000 sitting in charts.",
    },
    {
      id: "insurance-intake",
      title: "Insurance verification and intake slow everything down",
      detail:
        "Benefits get verified day-of between phone calls, and new patients fill out paper forms on a clipboard while their appointment slot ticks away. Errors from re-keyed insurance details surface later as billing disputes and angry reviews.",
      cost: "Fifteen minutes of paperwork at check-in comes directly out of chair time the practice already paid for.",
    },
    {
      id: "inactive-patients",
      title: "The inactive patient list has no owner",
      detail:
        "Patients who lapse past twelve or eighteen months rarely made a decision to leave — they just never got a reason to come back. The PMS knows exactly who they are, but nobody's job is to work that list systematically.",
      cost: "Six hundred inactive patients is often the largest list a practice owns, and usually the only one with no owner.",
    },
    {
      id: "manual-recall",
      title: "Recall and confirmations are still manual",
      detail:
        "Recall — the routine re-appointment of hygiene patients every six months — runs on printed lists and phone tag in most offices. Confirmation calls consume staff hours every single day and still miss the patients who only respond to text.",
      cost: "Two staff hours a day on confirmation calls is roughly a quarter of a full-time front-desk position.",
    },
    {
      id: "front-desk-overload",
      title: "The front desk is the practice's single point of failure",
      detail:
        "One or two people carry the phones, check-ins, insurance questions, recall lists, and every doctor's schedule preference in their heads. When they are out sick or leave, the practice's operating knowledge walks out with them.",
      cost: "Turnover at the desk costs rehiring and retraining, and every departure takes the undocumented playbook with it.",
    },
    {
      id: "lead-source-blindness",
      title: "Nobody knows which channel produced which patient",
      detail:
        "Google Ads, the website, Instagram, referrals, and recall campaigns all feed the same phone line, and the source is rarely recorded past 'how did you hear about us?'. Marketing budgets get renewed or cut based on gut feel rather than booked patients per channel.",
      cost: "Marketing spend without attribution means renewal decisions get made on anecdote, not on which channel filled chairs.",
    },
    {
      id: "cosmetic-follow-up",
      title: "Cosmetic and elective cases go cold without follow-up",
      detail:
        "Whitening, aligner, and implant consultations are considered purchases — patients compare, hesitate, and wait for someone to answer their financing questions. A consultation with no structured follow-up sequence is usually a consultation the practice paid to lose.",
      cost: "Elective cases are among the highest-value appointments a practice books, and the least likely to book themselves.",
    },
    {
      id: "after-hours",
      title: "Patient questions arrive after the office closes",
      detail:
        "Working patients call about appointments, insurance, and openings in the evening — exactly when the office is dark. Voicemail answers none of their questions and captures almost none of their intent.",
      cost: "The patient calling at 7 PM books somewhere that same evening; the only question is whether it's with you.",
    },
    {
      id: "disconnected-systems",
      title: "Scheduling, communication, and the PMS don't talk",
      detail:
        "The schedule lives in the PMS, texting lives in a separate tool, forms live in a third, and staff re-key patient details between them. Every gap between systems is a place where a booking, a form, or an insurance detail silently falls through.",
      cost: "Every re-keyed record is staff time spent twice and a fresh chance for a scheduling or billing error.",
    },
  ],

  workflow: {
    title: "The Patient Journey, Stage by Stage",
    intro:
      "Every practice runs the same underlying pipeline, whether anyone manages it or not: inquiry to qualification to appointment to treatment to recall. Below is where each stage breaks, which RSG system owns it, and what gets automated — with your front desk approving every appointment and every clinical question going to a human.",
    stages: [
      {
        id: "inquiry",
        label: "Patient inquiry",
        happens:
          "A prospective or existing patient calls, texts, or submits a web form. Most inquiries arrive while the front desk is mid-check-in or on the other line, and everything after close lands on voicemail.",
        failures: [
          "Calls ring out during treatment hours and never come back",
          "Voicemails pile up and get returned a day later, if at all",
          "Web forms wait until the next business morning for a reply",
          "Nobody records which channel the inquiry came from",
        ],
        system: "RSG Dental Front Desk Assistant",
        automations: [
          "Missed-call text-back within a minute, with the office's emergency-line protocol stated first",
          "Common questions — hours, network status, parking, appointment length — answered from the office playbook",
          "Every inquiry logged with its source channel before a human touches it",
        ],
        kpis: [
          "Missed-call recovery rate",
          "Average first-response time",
          "Inquiries per week by channel",
          "After-hours share of inquiries",
        ],
        integrations: ["Twilio", "Weave", "NexHealth"],
      },
      {
        id: "qualification",
        label: "Insurance & service qualification",
        happens:
          "The practice determines whether it offers what the patient needs and whether their plan is in network. Handled entirely by phone, this stage consumes front-desk minutes; handled loosely, it produces day-of billing surprises.",
        failures: [
          "'Do you take my insurance?' ties up the phone lines all day",
          "Wrong or vague network answers turn into billing disputes later",
          "Complex coverage questions bounce between the desk and billing with no owner",
          "Insurance details never get captured for advance verification",
        ],
        system: "RSG Dental Front Desk Assistant",
        automations: [
          "Network and plan questions answered from a maintained office playbook, not improvised",
          "Insurance details captured in the conversation and queued for benefits verification",
          "Billing and coverage questions routed to the right person with full context attached",
        ],
        kpis: [
          "Qualification-to-booking rate",
          "Insurance questions resolved without staff time",
          "Benefits verification turnaround",
        ],
        integrations: ["Dentrix", "Open Dental", "Weave"],
      },
      {
        id: "scheduled",
        label: "Appointment scheduled",
        happens:
          "The patient picks a time. Every round of phone tag between interest and a booked slot is another chance to lose them, and any slot offered that does not match the real PMS schedule creates rework.",
        failures: [
          "Phone tag stretches a 60-second booking into a three-day exchange",
          "Times get offered that conflict with the actual PMS schedule",
          "Requests sit in an inbox with no hold on the slot",
          "Double-bookings from schedules kept in two places",
        ],
        system: "RSG New Patient Conversion System",
        automations: [
          "Self-scheduling links that show real availability for the right appointment type and provider",
          "Requested slots held and queued for front-desk approval — the system proposes, staff confirms",
          "Approved appointments written back to the PMS schedule automatically",
        ],
        kpis: [
          "Inquiry-to-booking rate",
          "Time from inquiry to booked appointment",
          "Share of appointments booked without staff involvement",
        ],
        integrations: ["NexHealth", "Dentrix", "Open Dental", "Curve Dental"],
      },
      {
        id: "intake",
        label: "Digital intake completed",
        happens:
          "Health history, insurance details, and consents get collected before the visit. When intake happens on a clipboard at check-in, the appointment starts late and the data gets re-keyed into the PMS by hand.",
        failures: [
          "Paper forms at check-in burn the first fifteen minutes of the slot",
          "Incomplete forms are discovered only when the patient is standing at the desk",
          "Insurance details re-keyed from paper introduce billing errors",
          "No one tracks who has and hasn't finished their forms",
        ],
        system: "RSG New Patient Conversion System",
        automations: [
          "Digital intake forms sent automatically the moment an appointment is confirmed",
          "Completion tracked per patient, with reminders to anyone unfinished",
          "Incomplete forms flagged to the front desk the day before — not at check-in",
        ],
        kpis: [
          "Form completion rate before visit day",
          "Average check-in time",
          "Intake errors requiring rework",
        ],
        integrations: ["NexHealth", "Dentrix", "Google Workspace"],
      },
      {
        id: "confirmations",
        label: "Confirmation & reminders",
        happens:
          "The practice confirms tomorrow's schedule. Done manually, this is hours of dialing every day; done thinly, unconfirmed patients slide straight into the no-show column.",
        failures: [
          "Staff spend hours a day on confirmation calls",
          "Unconfirmed patients go unnoticed until they fail to arrive",
          "One channel, one attempt — patients who only answer texts never get reached",
          "Cancellations open holes with no waitlist to fill them",
        ],
        system: "RSG Appointment Confirmation & No-Show Reduction System",
        automations: [
          "Multi-touch confirmation sequence: day-before request, morning-of reminder with directions",
          "Unconfirmed patients flagged to the front desk while there is still time to act",
          "Cancellations trigger waitlist offers so the slot gets backfilled instead of wasted",
        ],
        kpis: [
          "Confirmation rate 24 hours out",
          "No-show rate",
          "Late-cancellation rate",
          "Backfilled slots per month",
        ],
        integrations: ["Dentrix", "Open Dental", "Twilio", "Solutionreach"],
      },
      {
        id: "attended",
        label: "Appointment attended",
        happens:
          "The patient arrives — or doesn't. Either way the chair, the hygienist, and the doctor's time were already paid for, so what happens in the first minutes after a no-show decides whether the hour is lost.",
        failures: [
          "No-shows are discovered at appointment time with no recovery plan",
          "The open chair sits empty for the full slot",
          "No-show patients never get rescheduled and quietly become inactive",
          "Nobody reaches out while the patient still remembers they missed",
        ],
        system: "RSG Appointment Confirmation & No-Show Reduction System",
        automations: [
          "No-show recovery message within minutes, offering the next available times",
          "The opened slot offered to the waitlist for same-day backfill",
          "Visit completion logged so post-visit workflows start on time",
        ],
        kpis: [
          "No-show rate",
          "Same-day backfill rate",
          "No-show reschedule rate",
        ],
        integrations: ["Dentrix", "Open Dental", "Twilio"],
      },
      {
        id: "plan-presented",
        label: "Treatment plan presented",
        happens:
          "The dentist diagnoses, and the treatment coordinator presents the plan and its cost. This is the moment the patient either schedules or says they want to think about it — and what happens next usually depends on whether anyone wrote anything down.",
        failures: [
          "Presented-but-unscheduled plans are tracked nowhere outside the chart",
          "Financing questions go unanswered and the case stalls",
          "The estimate is verbal or a paper printout the patient loses",
          "Follow-up depends entirely on the coordinator's memory",
        ],
        system: "RSG Treatment Acceptance System",
        automations: [
          "Every presented plan logged with a status: scheduled, pending, or declined",
          "A written estimate with estimated insurance adjustments sent the same day",
          "Financing and cost questions routed straight to the treatment coordinator with context",
        ],
        kpis: [
          "Plans presented vs. plans scheduled",
          "Same-day acceptance rate",
          "Average days from presentation to scheduling",
        ],
        integrations: ["Dentrix", "Eaglesoft", "Stripe"],
      },
      {
        id: "plan-follow-up",
        label: "Treatment follow-up",
        happens:
          "Someone follows up on the plans that did not schedule. In most practices that someone is a coordinator with a call list she never gets to, which is why the backlog only grows.",
        failures: [
          "Unscheduled plans age silently — 30 days becomes 300",
          "One follow-up call, then nothing, forever",
          "Cosmetic and elective cases — whitening, aligners, implants — go cold fastest",
          "Patients who explicitly declined keep getting contacted anyway",
        ],
        system: "RSG Treatment Acceptance System",
        automations: [
          "Structured follow-up sequence at 30, 60, and 90 days after presentation",
          "Declined plans suppressed automatically so follow-up stays respectful",
          "Replies mentioning cost or timing escalate to the treatment coordinator immediately",
        ],
        kpis: [
          "Unscheduled-plan backlog size",
          "Follow-up-to-scheduled rate",
          "Treatment value scheduled from the backlog",
        ],
        integrations: ["Dentrix", "Open Dental", "Twilio", "Stripe"],
      },
      {
        id: "recall",
        label: "Recall scheduling",
        happens:
          "Hygiene patients are due back roughly every six months — recall is the industry's term for re-appointing them. The PMS already knows every due date; the failure is that acting on those dates is a manual job nobody has time for.",
        failures: [
          "Recall lists get printed and worked 'when there's time'",
          "Patients pass their due date with no contact at all",
          "Generic postcards go out with no way to book from them",
          "Non-responders fall off the list instead of getting a second touch",
        ],
        system: "RSG Recall & Patient Reactivation Engine",
        automations: [
          "Recall messages triggered by PMS due dates, personalized with months overdue",
          "A direct self-scheduling link in every message — booking takes seconds, not a callback",
          "Non-responders escalated to a different channel and cadence instead of being dropped",
        ],
        kpis: [
          "Recall booking rate",
          "Share of due patients actually contacted",
          "Hygiene chair utilization",
        ],
        integrations: ["Dentrix", "Open Dental", "RevenueWell", "Solutionreach"],
      },
      {
        id: "reviews",
        label: "Review or referral request",
        happens:
          "The hours after a good visit are the best moment the practice will ever have to ask for a review or a referral. Most offices ask inconsistently, so their online presence lags years behind their actual patient experience.",
        failures: [
          "Nobody asks, so only the unhappy patients post",
          "A frustrated patient reaches Google before anyone at the desk knows there was a problem",
          "No staff alert when feedback comes back negative",
          "The referral moment passes unused",
        ],
        system: "RSG New Patient Conversion System",
        automations: [
          "Same-evening message after eligible visits, asking for feedback first",
          "Positive feedback routed to a review link; concerns routed to staff for a personal call",
          "Requests logged per patient so nobody gets asked twice",
        ],
        kpis: [
          "Review request rate",
          "New public reviews per month",
          "Time to respond to flagged concerns",
        ],
        integrations: ["Twilio", "Google Workspace", "Weave"],
      },
      {
        id: "reactivation",
        label: "Patient reactivation",
        happens:
          "Patients who lapse past twelve or eighteen months quietly attrite — few of them decided to leave, they just never got a reason to return. The inactive list is usually the largest untouched asset in the PMS.",
        failures: [
          "Nobody owns the inactive list",
          "One generic blast a year, with no segmentation",
          "No distinction between nine months overdue and four years gone",
          "Patients who moved or transferred keep getting messages",
        ],
        system: "RSG Recall & Patient Reactivation Engine",
        automations: [
          "The inactive list segmented by months lapsed, insurance status, and history",
          "Personalized win-back campaigns with direct booking links, run in controlled batches",
          "Replies routed to the front desk with the patient's full context attached",
        ],
        kpis: [
          "Reactivation rate above baseline",
          "Campaign reply rate",
          "Revenue from reactivated patients",
        ],
        integrations: ["Dentrix", "Open Dental", "Curve Dental", "Twilio"],
      },
    ],
  },

  demoSlug: "dental",
  demo: {
    title: "Explore the Dental Front Desk System",
    description:
      "A fully working simulation built around Brightwater Dental, a fictional practice. Take an after-hours call as the caller, run a recall batch, build a treatment estimate, and watch a 7 PM missed call become a confirmed new patient — every screen is the real product interface running on sample data.",
    highlights: [
      "A new-patient pipeline that tracks every inquiry from first contact through visit complete",
      "Real conversation threads: after-hours missed-call text-backs, recall replies, and urgent messages escalated to staff",
      "An interactive AI front-desk receptionist — take a simulated 7 PM call and watch it book, escalate, or route per office protocol",
      "A treatment-estimate builder with procedure, insurance-adjustment, and payment options",
      "A calendar with confirmed visits, pending holds, and no-show recovery built in",
      "Recall and reactivation campaigns with sent, replied, and booked counts per segment",
      "An automations view showing exactly what runs on missed calls, confirmations, recall, and reviews",
      "Lead-source analytics: which channels produce inquiries, and which produce booked patients",
    ],
    simulations: [
      "Receiving a new-patient inquiry",
      "Answering common patient questions automatically",
      "Booking the appointment",
      "Sending digital intake forms",
      "Confirming the appointment and reducing no-show risk",
      "Following up on an unscheduled treatment plan",
      "Reactivating an overdue patient",
    ],
    disclaimer:
      "The demo is a fully simulated environment. Every patient, message, appointment, and metric is fictional sample data — it never connects to, accesses, or touches real patient data or any live practice system.",
  },

  systemsIntro:
    "We build seven named systems for dental and specialty practices. Each is scoped to your PMS, your protocols, and your front desk's actual workload — and each keeps a hard boundary: staff approve appointments, humans handle everything clinical, and the automation does the repetitive chasing in between.",
  systems: [
    {
      id: "front-desk-assistant",
      name: "RSG Dental Front Desk Assistant",
      flagship: true,
      outcome:
        "Every call, text, and web inquiry gets an accurate answer within a minute — including nights and weekends — without adding front-desk headcount.",
      capabilities: [
        "Missed-call text-back that opens with your emergency-line protocol before anything else",
        "Answers common questions — hours, insurance networks, parking, appointment types — from a playbook your office controls",
        "Captures new-patient details and holds requested appointment slots for front-desk approval",
        "Routes insurance, billing, and anything clinical to the right person with full context",
        "Escalates urgent messages to staff immediately and stands down on that thread",
        "Covers after-hours and lunch-rush windows where most new patients are currently lost",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Twilio", "Weave", "NexHealth", "Dentrix", "Open Dental", "Google Workspace"],
    },
    {
      id: "new-patient-conversion",
      name: "RSG New Patient Conversion System",
      outcome:
        "Inquiries from every channel become booked, formed, and confirmed new patients — with the source of each one recorded.",
      capabilities: [
        "Speed-to-lead follow-up on web forms and messages before the patient calls the next practice",
        "Self-scheduling links against real PMS availability, with slot holds pending staff approval",
        "Digital intake sent on booking, tracked to completion, and flagged when unfinished",
        "Source attribution on every inquiry so marketing decisions run on booked patients, not anecdotes",
        "Feedback-first review and referral requests after completed visits",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["NexHealth", "Dentrix", "Open Dental", "Twilio", "Google Workspace"],
    },
    {
      id: "no-show-reduction",
      name: "RSG Appointment Confirmation & No-Show Reduction System",
      outcome:
        "Tomorrow's schedule confirms itself, unconfirmed patients get flagged while there is still time, and cancelled slots get backfilled instead of wasted.",
      capabilities: [
        "Multi-touch confirmation sequences: day-before request, morning-of reminder with directions",
        "Unconfirmed-patient flags to the front desk with enough lead time to act",
        "Waitlist management that offers cancelled slots to patients who want in sooner",
        "No-show recovery messages within minutes, with rescheduling built into the message",
        "Form-completion checks bundled into the reminder flow so check-ins start on time",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Dentrix", "Open Dental", "Solutionreach", "Twilio", "Weave"],
    },
    {
      id: "treatment-acceptance",
      name: "RSG Treatment Acceptance System",
      outcome:
        "Presented-but-unscheduled treatment stops aging silently in charts and gets a structured, respectful follow-up path back onto the schedule.",
      capabilities: [
        "A live register of every presented plan and its status — scheduled, pending, declined",
        "Written estimates with estimated insurance adjustments, delivered the same day as the consult",
        "Follow-up sequences at 30, 60, and 90 days, with declined plans suppressed automatically",
        "Cost and financing questions routed directly to the treatment coordinator",
        "Cosmetic and elective consult follow-up tuned for considered, comparison-shopped decisions",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Dentrix", "Eaglesoft", "Open Dental", "Stripe", "Twilio"],
    },
    {
      id: "recall-reactivation",
      name: "RSG Recall & Patient Reactivation Engine",
      outcome:
        "Recall due dates and the inactive list get worked automatically and continuously, instead of in occasional bursts when someone finds the time.",
      capabilities: [
        "Recall campaigns triggered by PMS due dates, personalized by months overdue and insurance status",
        "Direct self-scheduling links so booking takes seconds instead of a callback",
        "Inactive-list segmentation: nine months overdue is not the same message as three years gone",
        "Controlled batch sending so replies never swamp the front desk",
        "Suppression rules for transferred, moved, and do-not-contact patients",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Dentrix", "Open Dental", "Curve Dental", "RevenueWell", "Solutionreach", "Twilio"],
    },
    {
      id: "practice-dashboard",
      name: "RSG Practice Performance Dashboard",
      outcome:
        "One view of the numbers that actually run the practice — inquiries, bookings, no-shows, recall, and which marketing channel filled which chair.",
      capabilities: [
        "The full funnel from inquiry to completed visit, by week and by channel",
        "Lead-source attribution: patients and production per channel, not clicks",
        "No-show, confirmation, and recall rates tracked against your own baseline",
        "Unscheduled-treatment backlog size and movement over time",
        "Front-desk response times, including after hours",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Dentrix", "Open Dental", "CareStack", "QuickBooks", "Google Workspace"],
    },
    {
      id: "secure-knowledge-assistant",
      name: "RSG Secure Internal Knowledge Assistant",
      outcome:
        "Staff get instant, permissioned answers from your own office documents — protocols, insurance rules, fee schedules, policies — instead of interrupting whoever has been there longest.",
      capabilities: [
        "Answers drawn only from documents your practice approves — never from the open internet",
        "Role-based access so a hygienist, a biller, and an associate see only what they should",
        "Audit logging of every question and answer for accountability",
        "Hard refusal on clinical judgment: it retrieves your written protocols, it does not practice dentistry",
        "Runs in a private, access-controlled environment scoped during implementation",
      ],
      timeline: "4–8 weeks",
      pricing: "Custom quote",
      integrations: ["Google Workspace", "Microsoft 365", "Dentrix", "Open Dental"],
    },
  ],

  integrations: {
    intro:
      "The practice management system stays the source of truth — RSG systems read from it and write back to it rather than replacing it. These are the platforms we most commonly connect for dental and specialty practices.",
    disclaimer:
      "Integration availability depends on each platform's API, plan tier, and account permissions, and is verified during scoping. RSG does not claim official partnerships with any platform listed here.",
    items: [
      {
        name: "Dentrix",
        category: "Practice management (PMS)",
        connects:
          "Writes approved appointments back to the Dentrix schedule and reads recall due dates, unscheduled treatment plans, and patient status to drive follow-up.",
      },
      {
        name: "Open Dental",
        category: "Practice management (PMS)",
        connects:
          "Uses Open Dental's API to sync the schedule both ways and pull recall due dates, treatment-plan status, and inactive-patient lists for campaigns.",
      },
      {
        name: "Eaglesoft",
        category: "Practice management (PMS)",
        connects:
          "Reads schedule, recall, and treatment-plan data from Eaglesoft so confirmations and follow-up run against what the chart actually says.",
      },
      {
        name: "Curve Dental",
        category: "Practice management (PMS)",
        connects:
          "Connects to Curve's cloud platform to sync appointments and pull patient, recall, and reactivation lists without exports or re-keying.",
      },
      {
        name: "CareStack",
        category: "Practice management (PMS)",
        connects:
          "Pulls scheduling, production, and patient data from CareStack into the performance dashboard and follow-up workflows.",
      },
      {
        name: "NexHealth",
        category: "Patient communication",
        connects:
          "Provides real-time scheduling, forms, and messaging sync with supported PMS platforms — often the cleanest write path into the schedule.",
      },
      {
        name: "Weave",
        category: "Patient communication",
        connects:
          "Feeds missed-call events and two-way text threads into the follow-up pipeline so no conversation lives only in a phone system.",
      },
      {
        name: "Solutionreach",
        category: "Patient communication",
        connects:
          "Coordinates reminder and recall messaging so automated sequences extend what you already run instead of double-texting patients.",
      },
      {
        name: "RevenueWell",
        category: "Patient communication",
        connects:
          "Aligns marketing and recall campaigns with RSG reactivation sequences and shares campaign outcomes back for attribution.",
      },
      {
        name: "Stripe",
        category: "Payments & accounting",
        connects:
          "Handles deposits and treatment-plan payments, with payment status feeding the confirmation and treatment-follow-up workflows.",
      },
      {
        name: "QuickBooks",
        category: "Payments & accounting",
        connects:
          "Connects payment and revenue data to the practice dashboard so production and collections appear next to the pipeline that generated them.",
      },
      {
        name: "Twilio",
        category: "Communications",
        connects:
          "Carries the SMS and voice layer — text-backs, confirmations, recall campaigns — under your practice's own numbers.",
      },
      {
        name: "Google Workspace",
        category: "Productivity",
        connects:
          "Syncs calendars and email, and serves as a permissioned document source for the internal knowledge assistant.",
      },
      {
        name: "Microsoft 365",
        category: "Productivity",
        connects:
          "Connects Outlook calendars and SharePoint documents for practices that run on Microsoft, including knowledge-assistant sources.",
      },
    ],
  },

  roi: {
    title: "Estimate What the Gaps Are Costing Your Practice",
    intro:
      "Enter your own numbers — inquiries, no-shows, the unscheduled-plan backlog, the inactive list — and see what conservative, stated assumptions suggest is recoverable. Every assumption is shown and adjustable; nothing here is a promise.",
    disclaimer:
      "All results are estimates computed from the inputs you provide and the stated modeling assumptions. They are illustrations of potential opportunity, not guaranteed financial outcomes, and actual results depend on your practice, your market, and how the systems are implemented and used.",
    inputs: [
      {
        id: "monthlyInquiries",
        label: "New-patient inquiries per month",
        min: 10,
        max: 400,
        step: 5,
        defaultValue: 60,
        format: "number",
        helper: "Calls, web forms, and messages from prospective patients — not existing-patient traffic.",
      },
      {
        id: "bookingRate",
        label: "Current inquiry-to-booking rate",
        min: 5,
        max: 95,
        step: 5,
        defaultValue: 45,
        format: "percent",
        helper: "The share of inquiries that currently end up as booked appointments.",
      },
      {
        id: "newPatientValue",
        label: "First-year value of a new patient",
        min: 200,
        max: 5000,
        step: 50,
        defaultValue: 900,
        format: "currency",
        helper: "Typical first-year production per new patient — exams, hygiene, imaging, and initial treatment.",
      },
      {
        id: "monthlyNoShows",
        label: "No-shows per month",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 12,
        format: "number",
        helper: "Appointments per month lost to no-shows and last-minute cancellations that go unfilled.",
      },
      {
        id: "unscheduledPlans",
        label: "Unscheduled treatment plans on the books",
        min: 0,
        max: 500,
        step: 5,
        defaultValue: 60,
        format: "number",
        helper: "Plans that have been presented but never scheduled. Your PMS can usually report this number.",
      },
      {
        id: "avgPlanValue",
        label: "Average treatment-plan value",
        min: 200,
        max: 20000,
        step: 100,
        defaultValue: 1800,
        format: "currency",
        helper: "The average dollar value of a presented treatment plan at your practice.",
      },
      {
        id: "inactivePatients",
        label: "Inactive patients (12+ months)",
        min: 0,
        max: 5000,
        step: 25,
        defaultValue: 600,
        format: "number",
        helper: "Patients with no visit in over a year who haven't been marked as transferred or dismissed.",
      },
      {
        id: "reactivationRate",
        label: "Current annual reactivation rate",
        min: 0,
        max: 20,
        step: 1,
        defaultValue: 2,
        format: "percent",
        helper: "The share of your inactive list that comes back in a typical year today. If you don't track it, it's usually low.",
      },
    ],
    assumptions: [
      {
        id: "bookingLift",
        label: "Booking lift on currently-lost inquiries",
        value: 0.12,
        helper:
          "Share of inquiries that currently slip away but book when every call and form is answered within a minute and offered online scheduling. Decimal: 0.12 = 12%. Applied only to inquiries that do not book today.",
      },
      {
        id: "noShowReduction",
        label: "No-show reduction",
        value: 0.3,
        helper:
          "Modeled reduction in monthly no-shows once multi-touch confirmations, unconfirmed-patient flags, and waitlist backfill run consistently. Decimal: 0.3 = 30%.",
      },
      {
        id: "planAcceptRate",
        label: "Unscheduled-plan scheduling rate",
        value: 0.2,
        helper:
          "Share of the current unscheduled-treatment backlog modeled to schedule with structured 30/60/90-day follow-up. Decimal: 0.2 = 20%. Counted once, not annually.",
      },
      {
        id: "reactivationLift",
        label: "Reactivation rate with campaigns",
        value: 0.06,
        helper:
          "Modeled share of the inactive list that returns with segmented reactivation campaigns. Decimal: 0.06 = 6%. Only the lift above your current rate is counted.",
      },
      {
        id: "reactivatedValue",
        label: "First-year value of a reactivated patient",
        value: 320,
        helper:
          "Modeled first-year production for a returning patient — typically hygiene, exam, and imaging. A dollar figure, not a rate.",
      },
    ],
    recommendedSystemId: "front-desk-assistant",
  },

  compliance: {
    title: "PHI, HIPAA, and Where the Automation Stops",
    intro:
      "Patient communication systems in a dental or medical setting touch protected health information, so the safeguards are not optional extras — they are the architecture. Here is how RSG approaches it, stated plainly: we design safeguards that can support a compliant environment; no vendor can sell compliance itself.",
    disclaimer:
      "RSG does not provide legal, medical, or regulatory advice. Nothing on this page is a compliance determination. Whether any implementation is compliant depends on the complete implementation, the vendors involved, your written procedures, and how your practice actually operates the system day to day — engage qualified counsel for compliance decisions.",
    items: [
      {
        title: "HIPAA & protected health information (PHI)",
        detail:
          "Any system that handles appointment details, health history, or patient identifiers is handling PHI and is designed under HIPAA's Privacy and Security Rule requirements. There is no such thing as a 'HIPAA-certified' product — we build and document safeguards that can support a compliant environment, and compliance itself depends on the full implementation and your practice's operation of it.",
      },
      {
        title: "Business associate agreements (BAAs)",
        detail:
          "Where a vendor or RSG handles PHI on the practice's behalf, a BAA is executed before any PHI flows. During scoping we map exactly which vendors in the stack touch PHI and confirm each supports a BAA on the plan tier you actually have.",
      },
      {
        title: "Minimum-necessary access",
        detail:
          "Each workflow is scoped to the least patient data it needs to function — a confirmation sequence needs an appointment time and a phone number, not a chart. Data the automation does not need is data it never receives.",
      },
      {
        title: "Role-based permissions",
        detail:
          "Access is granted by role: front desk, billing, provider, and administrator each see different views and different data. Permissions are reviewed at implementation and documented so the practice can maintain them after handoff.",
      },
      {
        title: "Encryption in transit and at rest",
        detail:
          "PHI is encrypted in transit and at rest across the systems we implement. Vendor encryption claims are verified during scoping rather than assumed from marketing pages.",
      },
      {
        title: "Audit logs",
        detail:
          "Access to patient data and actions taken by the system are logged so there is a durable record of who saw what and what the automation did. Logs support both internal review and the documentation a practice needs if questions ever arise.",
      },
      {
        title: "Secure data retention",
        detail:
          "Retention periods are defined during implementation to match your policies and applicable requirements — data is kept as long as it must be and not longer. Disposal of PHI follows a documented process, not an ad-hoc deletion.",
      },
      {
        title: "Patient communication consent",
        detail:
          "Automated texts and calls run against recorded patient consent, honor opt-outs immediately, and follow telemarketing and messaging rules. Consent status lives with the patient record so every campaign checks it before sending.",
      },
      {
        title: "Human review of anything clinical",
        detail:
          "Anything touching diagnosis, treatment, medication, or clinical judgment is routed to your staff — automation handles scheduling and administrative communication only. Escalation rules are written with your office and tested before go-live.",
      },
      {
        title: "No AI diagnosis or medical advice — ever",
        detail:
          "The systems we build are prohibited by design from independently providing diagnoses, treatment recommendations, or medical advice, and that boundary is enforced in the system's rules, not left to model behavior. A patient describing symptoms triggers the office's escalation protocol, including your emergency-line instructions.",
      },
    ],
  },

  caseStudy: {
    label: "Illustrative scenario — not a client result",
    businessType: "Two-doctor general dentistry practice",
    size: "2 dentists, 3 hygienists, 2 front-desk staff, roughly 2,400 active patients",
    problem:
      "The front desk was losing mid-day and after-hours calls to voicemail, no-shows ran unchecked because confirmations were a single phone call, an unscheduled-treatment backlog had accumulated in the charts, and the inactive list had not been systematically worked in years. Nobody could say which marketing channel produced which patient.",
    currentStack: ["Dentrix", "Weave", "Google Workspace", "QuickBooks", "Stripe"],
    implementation: [
      "Deploy the RSG Dental Front Desk Assistant on the existing numbers: missed-call text-back with the office's emergency protocol, playbook answers, and slot holds pending front-desk approval",
      "Stand up the RSG Appointment Confirmation & No-Show Reduction System against the Dentrix schedule, with unconfirmed-patient flags and a waitlist",
      "Build the RSG Treatment Acceptance System's plan register from the existing chart backlog and start 30/60/90-day follow-up sequences",
      "Launch the RSG Recall & Patient Reactivation Engine on recall due dates and the 12-month-plus inactive segment, in controlled batches",
      "Turn on the RSG Practice Performance Dashboard so inquiries, bookings, no-shows, and lead sources report from one place",
    ],
    beforeWorkflow: [
      "Mid-day and evening calls hit voicemail; a callback list gets worked the next morning",
      "Front desk spends the first two hours of every day on confirmation calls",
      "New patients fill out paper forms at check-in while their slot ticks away",
      "Treatment plans that don't schedule at the desk go into the chart and are never touched again",
      "Recall postcards go out quarterly; the inactive list is not worked at all",
      "Marketing spend is renewed on gut feel because sources aren't tracked",
    ],
    afterWorkflow: [
      "Every missed call gets a text within a minute — after-hours callers are answered, qualified, and offered times before the office opens",
      "Confirmations run automatically across text and email; staff only touch the flagged exceptions",
      "Intake forms go out at booking and are tracked to completion before visit day",
      "Every presented plan sits in a register with a status and an automatic follow-up date",
      "Recall and reactivation campaigns run continuously in segments, with replies routed to the desk",
      "The dashboard shows bookings, no-shows, and production by lead source every week",
    ],
    timeline:
      "6–10 weeks from scoping to full rollout, phased so the front desk adopts one workflow at a time",
    kpis: [
      "Missed-call recovery rate",
      "Inquiry-to-booking rate",
      "No-show rate",
      "Unscheduled-plan backlog and its monthly movement",
      "Recall and reactivation booking rates",
      "Front-desk hours spent on manual confirmations and callbacks",
    ],
    projections: [
      {
        label: "Modeled no-show reduction",
        value:
          "Roughly 30% fewer unfilled no-show slots once confirmations, flags, and waitlist backfill run consistently — the same assumption used in our ROI calculator",
      },
      {
        label: "Modeled booking lift",
        value:
          "About 12% of inquiries that currently slip away are modeled to book when every call and form gets an answer within a minute",
      },
      {
        label: "Modeled treatment-plan recovery",
        value:
          "Around 20% of the existing unscheduled-plan backlog is modeled to schedule under structured 30/60/90-day follow-up",
      },
      {
        label: "Modeled front-desk workload",
        value:
          "Daily confirmation calls, form chasing, and recall list work largely move to automation, returning front-desk hours to patients standing at the desk",
      },
    ],
    projectionNote:
      "These projections are modeled from the stated assumptions applied to a hypothetical practice. They are not measured results from a client engagement, and they are not a guarantee of any outcome.",
  },

  ctas: {
    primary: {
      label: "Assess Your Patient Booking and Follow-Up Systems",
      href: "#assessment",
    },
    secondary: [
      { label: "Find Missed Patient Opportunities", href: "#roi" },
      { label: "Explore the Dental Practice Demo", href: "/demos/dental" },
      { label: "Build My Patient Growth System", href: "/book" },
    ],
  },

  assessment: {
    title: "Assess Your Patient Booking and Follow-Up Systems",
    intro:
      "Twelve questions about how your practice handles inquiries, confirmations, treatment follow-up, and recall. Based on your answers, we point you at the system that addresses your biggest constraint — before any call is booked.",
    questions: [
      {
        id: "practice-type",
        label: "What type of practice are you?",
        type: "select",
        required: true,
        options: [
          "General dentistry",
          "Cosmetic dentistry",
          "Orthodontics",
          "Oral surgery",
          "Med spa / aesthetic specialty",
          "Other specialty practice",
        ],
      },
      {
        id: "providers",
        label: "How many providers (dentists, hygienists, clinicians)?",
        type: "number",
        required: true,
        placeholder: "e.g. 5",
      },
      {
        id: "locations",
        label: "How many locations?",
        type: "number",
        required: true,
        placeholder: "e.g. 1",
      },
      {
        id: "pms",
        label: "Which practice management software do you run?",
        type: "select",
        required: true,
        options: ["Dentrix", "Open Dental", "Eaglesoft", "Curve Dental", "CareStack", "Other / not sure"],
        helper: "Integration depth depends on the PMS and its API access — we verify this during scoping.",
      },
      {
        id: "monthly-inquiries",
        label: "Roughly how many new-patient inquiries per month?",
        type: "number",
        placeholder: "e.g. 60",
        helper: "Calls, web forms, and messages from prospective patients.",
      },
      {
        id: "no-show-rate",
        label: "What is your approximate no-show rate?",
        type: "select",
        options: ["Under 5%", "5–10%", "10–20%", "Over 20%", "Not sure — we don't track it"],
      },
      {
        id: "recall-process",
        label: "How does hygiene recall work today?",
        type: "select",
        options: [
          "Front desk calls from a printed list when there's time",
          "Automated reminders through our PMS",
          "A third-party tool handles it",
          "Postcards or mailers",
          "No consistent process",
        ],
      },
      {
        id: "treatment-follow-up",
        label: "What happens to treatment plans that don't get scheduled at the desk?",
        type: "select",
        options: [
          "Treatment coordinator calls when there's time",
          "We follow up once, then it sits in the chart",
          "Tracked in a spreadsheet",
          "Handled by PMS reminders",
          "No consistent follow-up",
        ],
      },
      {
        id: "communication-tools",
        label: "What do you use for patient communication?",
        type: "select",
        options: ["Weave", "Solutionreach", "RevenueWell", "NexHealth", "Built into our PMS", "Phone and email only"],
      },
      {
        id: "insurance-intake",
        label: "How do insurance verification and intake work today?",
        type: "select",
        options: [
          "Front desk verifies day-of, between calls",
          "Verified in advance, manually",
          "Outsourced verification service",
          "Digital forms with advance verification",
          "Paper forms at check-in",
        ],
      },
      {
        id: "phi-involved",
        label: "Would the systems we discuss involve protected health information (PHI)?",
        type: "select",
        options: ["Yes", "No", "Unsure"],
        helper:
          "Most patient-communication systems do. If PHI is involved, BAAs and technical safeguards are scoped into the implementation accordingly.",
      },
      {
        id: "bottleneck",
        label: "What is your biggest administrative bottleneck right now?",
        type: "select",
        required: true,
        options: [
          "Phones & front-desk workload",
          "No-shows & confirmations",
          "Unscheduled treatment plans",
          "Recall & reactivation",
          "New-patient conversion",
          "Reporting & lead sources",
        ],
      },
    ],
    recommendations: [
      { keywords: ["phones", "front-desk workload"], systemId: "front-desk-assistant" },
      { keywords: ["no-show", "no-shows"], systemId: "no-show-reduction" },
      { keywords: ["unscheduled"], systemId: "treatment-acceptance" },
      { keywords: ["reactivation"], systemId: "recall-reactivation" },
      { keywords: ["new-patient conversion", "conversion"], systemId: "new-patient-conversion" },
      { keywords: ["reporting", "lead sources"], systemId: "practice-dashboard" },
    ],
    fallbackSystemId: "front-desk-assistant",
  },

  faqs: [
    {
      q: "Does this work with Dentrix, Open Dental, or our PMS?",
      a: "Usually, but the honest answer is that integration depth varies by platform. Open Dental and cloud systems like Curve and CareStack expose strong APIs; Dentrix and Eaglesoft often connect best through a sync layer such as NexHealth. What your specific PMS, plan tier, and account permissions support is verified during scoping — before you commit to anything.",
    },
    {
      q: "How long does implementation take?",
      a: "Individual systems typically run 2–4 weeks for the front-desk assistant or confirmation system and 3–6 weeks for conversion, treatment-acceptance, or recall systems. A full multi-system rollout is usually 6–10 weeks, phased so your front desk adopts one workflow at a time instead of relearning everything at once.",
    },
    {
      q: "How does pricing work?",
      a: "Every system is a custom quote. Scope depends on your PMS, patient volume, how many workflows we build, and whether PHI safeguards and BAAs are involved — so we price after scoping, not from a rate card. You get a fixed written quote before any build starts.",
    },
    {
      q: "How is patient data handled?",
      a: "Systems that touch PHI are designed around HIPAA safeguards: minimum-necessary access, role-based permissions, encryption in transit and at rest, audit logs, and BAAs with every vendor that handles PHI. We won't call anything 'HIPAA certified' — no such certification exists — and compliance ultimately depends on the complete implementation and how your practice operates it.",
    },
    {
      q: "Does RSG replace our practice management software?",
      a: "No. Your PMS stays the source of truth for the schedule and the chart. RSG systems connect to it — reading recall due dates, treatment-plan status, and availability, and writing approved appointments back — so your team keeps working in the software they already know.",
    },
    {
      q: "Will the AI give patients clinical advice?",
      a: "No, and this is enforced by design rather than left to chance. The assistant handles scheduling and administrative questions only; anything involving symptoms, diagnosis, treatment, or medication triggers your office's escalation protocol, including your emergency-line instructions, and goes to a human. Your staff also approve every appointment the system proposes.",
    },
  ],

  seo: {
    title: "Dental Practice AI Receptionist & Patient Follow-Up Automation",
    description:
      "Dental patient follow-up automation and an AI front desk that answers every call, cuts no-shows, and books more patients — integrated with your PMS.",
  },
};
