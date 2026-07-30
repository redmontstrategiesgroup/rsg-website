import type { IndustryVertical } from "../types";

/**
 * Default content for the Home Service & Trade Businesses vertical.
 *
 * Voice: direct, premium consulting. No invented statistics, no client
 * names. The case study is an illustrative scenario and is labeled as such.
 * No page projects a dollar outcome and nothing is priced in advance.
 */
export const homeServicesVertical: IndustryVertical = {
  slug: "home-services",
  status: "published",
  name: "Home Service & Trade Businesses",
  shortName: "Home Services",
  audience: [
    "HVAC",
    "Plumbing",
    "Electrical",
    "Roofing",
    "Exterior cleaning",
    "Landscaping",
    "General contracting",
  ],
  terminology: {
    customer: "customer",
    customers: "customers",
    job: "job",
    jobs: "jobs",
    team: "crew",
  },

  hero: {
    eyebrow: "Home Service & Trade Businesses",
    headline: "Turn More Service Calls Into Scheduled, Completed, and Collected Jobs",
    subheadline:
      "Your crews do good work. The jobs you lose are lost before the truck ever rolls — in the missed call, the estimate nobody chased, the invoice that sat for a month. RSG builds the systems that close those gaps: every call answered or recovered, every estimate followed up until there's an answer, every completed job invoiced, collected, and asked for a review.",
    primaryCta: {
      label: "Find Where Your Service Business Is Losing Jobs",
      href: "#assessment",
    },
    demoCta: {
      label: "Explore the Home Service Demo",
      href: "/demos/contractors",
    },
    designedFor:
      "Built for owner-operated HVAC, plumbing, electrical, roofing, exterior cleaning, landscaping, and general contracting companies — typically 2 to 50 trucks — where the office is stretched thin and the owner is still the one who notices when a lead slips.",
  },

  problemsIntro:
    "None of these problems are about the quality of your work. They are operational leaks — each one small enough to tolerate on any given day, and each one compounding across a season. Most service businesses have at least six of them.",
  problems: [
    {
      id: "missed-calls",
      title: "Missed calls become someone else's jobs",
      detail:
        "Homeowners calling a plumber or an HVAC company rarely leave a voicemail and wait — they call the next name in the search results. A call that rings out while your crew is on a roof or under a sink usually becomes a job for whoever answered.",
      cost: "Five missed calls a week at a $2,000 average job is up to $10,000 of work you never got to quote.",
    },
    {
      id: "after-hours",
      title: "After-hours emergencies go to voicemail",
      detail:
        "Burst pipes, dead furnaces, and storm leaks happen at 9 PM, and those are the highest-intent callers you will ever get. Voicemail after the third ring tells them to keep dialing until a competitor picks up.",
      cost: "Emergency callers don't wait for morning — they call down the list until someone answers.",
    },
    {
      id: "estimate-follow-up",
      title: "Estimates go out, then silence",
      detail:
        "Quotes get written at the kitchen table at 9 PM, sent, and never mentioned again unless the homeowner calls back. Nobody has time to chase a two-week-old estimate when today's schedule is already full.",
      cost: "An estimate nobody follows up on closes at exactly zero.",
    },
    {
      id: "scheduling-dispatch",
      title: "Scheduling lives on a whiteboard",
      detail:
        "Jobs get booked by whoever answers the phone, into whatever slot sounds free, with no view of territory, trade, or drive time. The result is double-bookings, crews crossing town twice in a day, and reschedules handled from the owner's cell.",
      cost: "An hour of avoidable windshield time per tech per day is an hour of billable work gone.",
    },
    {
      id: "field-context",
      title: "Technicians arrive without the full picture",
      detail:
        "The tech shows up without the job history, the photos the customer sent, the gate code, or what the last visit found. Every 'let me call the office' moment stretches the job and quietly erodes the customer's confidence.",
      cost: "A tech without context sells less, works slower, and gets reviewed worse.",
    },
    {
      id: "scattered-leads",
      title: "Leads live in five different places",
      detail:
        "Calls hit the cell phone, web forms hit an inbox, Google Local Services and Angi leads sit in their own dashboards, and referrals arrive by text. There is no single list of open opportunities, so nobody can say what fell through this week.",
      cost: "A lead that never makes it onto the list is indistinguishable from a lead you never got.",
    },
    {
      id: "reviews",
      title: "Reviews happen only when someone remembers",
      detail:
        "Happy customers get asked for a review when the office thinks of it, which is rarely; unhappy ones post on Google without being asked. Meanwhile the competitor with three hundred reviews wins the click even when your work is better.",
      cost: "Every completed job that isn't asked is a five-star review your competitor effectively keeps.",
    },
    {
      id: "collections",
      title: "Finished work sits uncollected",
      detail:
        "Invoices go out days after the job, without a payment link, and reminders depend on the office noticing the aging report. Work you have already paid labor and materials for becomes an interest-free loan to your customer.",
      cost: "Revenue you've earned but not collected still has to cover this week's payroll.",
    },
    {
      id: "job-profitability",
      title: "No visibility into which jobs make money",
      detail:
        "Revenue is visible; margin is not. Without job costing against the estimate, the losing job types — the underpriced service calls, the change-order-prone remodels — keep getting booked because nobody can see them losing.",
      cost: "You can't stop taking losing jobs if you can't see which jobs lose.",
    },
    {
      id: "seasonality",
      title: "The phone controls the calendar, not you",
      detail:
        "Peak season buries the office and slow season empties the schedule, while a list of past customers and unsold estimates sits untouched. Maintenance plans and reactivation campaigns are the standard fix, and almost nobody runs them consistently.",
      cost: "Slow-season payroll doesn't pause just because the phone does.",
    },
    {
      id: "manual-updates",
      title: "The office is a human status-update machine",
      detail:
        "Confirmations, on-the-way calls, delay notices, and 'where's my tech?' callbacks eat hours of coordinator time every day. Every one of those touches is predictable, and almost every one can be sent automatically the moment a job status changes.",
      cost: "An office manager spending half the day relaying statuses isn't booking new work.",
    },
    {
      id: "owner-dependency",
      title: "The system is the owner's memory",
      detail:
        "Which quote needs a nudge, which customer is annoyed, which crew is behind — it all lives in one person's head and phone. That works right up until the week it doesn't, and it caps how large the business can get.",
      cost: "A business that only runs when the owner is watching can never take a real vacation — or scale.",
    },
  ],

  workflow: {
    title: "The Lead-to-Collected-Job Workflow",
    intro:
      "Every home service job moves through the same eleven stages, whether you run three trucks or thirty. Each stage below shows what typically breaks, which RSG system fixes it, and the numbers worth watching. Walk your last ten jobs through this map and count where they leaked.",
    stages: [
      {
        id: "lead-received",
        label: "Lead received",
        happens:
          "A homeowner calls, submits a website form, taps a Google Local Services ad, sends a Facebook lead, or gets referred by a neighbor. Each source arrives on a different screen — the cell phone, an inbox, a platform dashboard — and someone has to notice it.",
        failures: [
          "Leads from ad platforms sit unnoticed in their own dashboards for hours",
          "Nobody records where the lead came from, so marketing spend can't be judged",
          "Duplicate entries when the same homeowner calls and fills out the form",
          "First response takes hours because intake depends on someone being at a desk",
        ],
        system: "RSG Service Command Center",
        automations: [
          "Capture every source — calls, forms, LSA, ads, referrals — into one lead record automatically",
          "Send a confirmation text within a minute of any form or ad lead",
          "Tag each lead with its source and assign it by trade and territory",
        ],
        kpis: [
          "Time to first response",
          "Leads captured per source",
          "Percentage of leads with complete contact details",
        ],
        integrations: ["CallRail", "Twilio", "Zapier", "Google Business Profile"],
      },
      {
        id: "qualified",
        label: "Call or form qualified",
        happens:
          "Someone finds out what the job actually is: the trade, the address, the urgency, and whether it's a real opportunity or a solicitation. On a good day the office handles it; on a busy day the call rings out and the form sits until tonight.",
        failures: [
          "Calls ring out while both coordinators are on other lines",
          "Voicemail is the after-hours plan, and emergency callers don't use it",
          "No urgency triage — a burst pipe waits in line behind a gutter quote",
          "Intake notes are incomplete, so the estimator calls the customer to re-ask everything",
        ],
        system: "RSG AI Reception & Missed-Call Recovery",
        automations: [
          "Text back every missed call within about a minute, asking for project details and photos",
          "Answer overflow and after-hours calls with an AI receptionist that qualifies, detects urgency, and books",
          "Page the on-call rotation automatically when a call is flagged as an emergency",
        ],
        kpis: [
          "Call answer rate",
          "Missed-call recovery rate",
          "After-hours leads captured",
          "Qualification completeness",
        ],
        integrations: ["Twilio", "CallRail", "Housecall Pro"],
      },
      {
        id: "scheduled",
        label: "Appointment scheduled",
        happens:
          "The estimate visit or service call gets a slot on the calendar. This usually takes several back-and-forth messages, and the appointment quality depends on whoever booked it knowing the territory and the crew's day.",
        failures: [
          "Three rounds of phone tag just to agree on a time",
          "Double-bookings and slots that ignore drive time",
          "No confirmation or reminder, so no-shows surprise everyone",
          "Reschedules handled ad hoc, leaving dead holes in the day",
        ],
        system: "RSG Scheduling & Dispatch System",
        automations: [
          "Offer self-scheduling from live availability the moment a lead is qualified",
          "Send confirmation and reminder texts automatically",
          "Apply territory and buffer rules so booked slots respect drive time",
        ],
        kpis: [
          "Lead-to-booked time",
          "No-show rate",
          "Booking rate on qualified leads",
        ],
        integrations: ["Google Calendar", "Housecall Pro", "Jobber"],
      },
      {
        id: "dispatched",
        label: "Technician dispatched",
        happens:
          "The right technician — right trade, right skills, right part of town — heads to the job. The customer wants to know when; the tech wants to know what they're walking into.",
        failures: [
          "The customer never gets an arrival window, then calls the office twice to ask",
          "The tech arrives without job history, photos, or access notes",
          "Assignments ignore territory, so trucks crisscross the county",
          "Same-day changes reach the crew late or not at all",
        ],
        system: "RSG Scheduling & Dispatch System",
        automations: [
          "Send on-the-way texts with the tech's name and arrival estimate",
          "Push a job packet — history, photos, gate codes, prior visit notes — to the technician's phone",
          "Reassign and notify automatically when a job runs long or cancels",
        ],
        kpis: [
          "On-time arrival rate",
          "Jobs per tech per day",
          "Drive time between jobs",
          "'Where's my tech?' call volume",
        ],
        integrations: ["ServiceTitan", "Twilio", "CompanyCam", "Google Calendar"],
      },
      {
        id: "estimate-created",
        label: "Estimate created",
        happens:
          "The estimator scopes the work, prices it, and delivers a written estimate. Speed matters more than most owners think: the first professional, photo-backed quote in the homeowner's inbox frames every quote that follows it.",
        failures: [
          "Estimates written at night, days after the visit, while the homeowner collects competing bids",
          "Pricing varies by who wrote the quote",
          "Quotes sent as paper or a bare text with no delivery or open tracking",
          "Site photos never make it from the tech's phone into the estimate",
        ],
        system: "RSG Service Command Center",
        automations: [
          "Build line-item estimates from templated pricing on-site or same-day",
          "Attach field photos to the estimate record automatically",
          "Deliver quotes with tracking, so you know when the customer opens them",
        ],
        kpis: [
          "Same-day estimate rate",
          "Visit-to-quote turnaround",
          "Quote open rate",
        ],
        integrations: ["ServiceTitan", "Housecall Pro", "CompanyCam"],
      },
      {
        id: "estimate-followed",
        label: "Estimate followed up",
        happens:
          "The homeowner goes quiet — comparing bids, waiting on a spouse, or just busy. This is the single most expensive gap in the trade: the job is rarely lost to a competitor's price, it's lost to silence, because following up feels like pestering and nobody has the time.",
        failures: [
          "No follow-up at all once the quote leaves the office",
          "One 'just checking in' message, then the file is forgotten",
          "Follow-ups continue awkwardly after the customer already replied",
          "No one can see which quotes are aging or how much money is sitting in them",
        ],
        system: "RSG Estimate Follow-Up Engine",
        automations: [
          "Run a day-2 / day-5 / day-10 follow-up sequence on every sent estimate",
          "Pause the sequence instantly when the customer replies or a rep takes over",
          "Alert sales when a quote ages past its threshold or the customer re-opens it",
        ],
        kpis: [
          "Follow-up coverage (percentage of estimates that get followed up)",
          "Estimate close rate",
          "Days from quote to decision",
          "Revenue revived from aging quotes",
        ],
        integrations: ["Twilio", "Jobber", "Zapier"],
      },
      {
        id: "job-approved",
        label: "Job approved",
        happens:
          "The customer says yes. Now the contract needs signing, the deposit needs collecting, and the job needs a start date — and every day of delay between 'yes' and 'scheduled' is a day for second thoughts.",
        failures: [
          "The approval sits in a text thread with no next step triggered",
          "Deposit requests go out late and get chased by phone",
          "The start date is left as 'we'll call you', and nobody does",
          "The customer hears nothing between approval and the crew's arrival",
        ],
        system: "RSG Customer Communication Portal",
        automations: [
          "Send the contract and deposit request the moment a quote is approved",
          "Offer start-date scheduling as soon as the deposit clears",
          "Send a what-to-expect message covering crew, timeline, and prep",
        ],
        kpis: [
          "Approval-to-deposit time",
          "Approval-to-scheduled time",
          "Deposit collection rate",
        ],
        integrations: ["Stripe", "QuickBooks", "Twilio"],
      },
      {
        id: "work-completed",
        label: "Work completed",
        happens:
          "The crew finishes the job. Closeout is where field work turns into business data: completion photos, final scope versus estimate, materials used, and anything the customer flagged before the truck pulls away.",
        failures: [
          "Closeout paperwork lags days behind the actual work",
          "No completion photos, so warranty and dispute questions become memory contests",
          "Punch-list items live in the tech's head and resurface as angry calls",
          "Actual costs never get reconciled against the estimate",
        ],
        system: "RSG Field Operations Dashboard",
        automations: [
          "Require a completion checklist with photos before a job can close",
          "Roll actual labor and material costs up against the original estimate",
          "Notify the customer of completion with photos and warranty notes",
        ],
        kpis: [
          "Same-day closeout rate",
          "Gross margin per job",
          "Callback / punch-list rate",
        ],
        integrations: ["CompanyCam", "ServiceTitan", "QuickBooks"],
      },
      {
        id: "invoice-collected",
        label: "Invoice collected",
        happens:
          "The invoice goes out and — eventually — gets paid. The distance between those two events is where cash flow lives, and it's controlled almost entirely by how fast the invoice arrives and how easy it is to pay.",
        failures: [
          "Invoices sent days after completion, from a different system than the job",
          "No payment link, so paying requires a check or a phone call",
          "Reminders depend on someone reading the aging report",
          "Payments recorded in QuickBooks but never reflected back on the job",
        ],
        system: "RSG Service Command Center",
        automations: [
          "Generate and send the invoice with a payment link the moment the job closes",
          "Run a polite, persistent reminder cadence on unpaid invoices",
          "Sync payments to accounting and mark the job collected automatically",
        ],
        kpis: [
          "Days from completion to payment",
          "Percentage collected on-site or same-day",
          "Receivables over 30 days",
        ],
        integrations: ["QuickBooks", "Stripe", "Twilio"],
      },
      {
        id: "review-requested",
        label: "Review requested",
        happens:
          "The customer is asked — or not — to say publicly what they just experienced. Review volume is the local search flywheel for the trades: it drives ranking, clicks, and the price you can charge, and it is built one completed job at a time.",
        failures: [
          "Requests go out only when the office remembers, which is rarely",
          "Unhappy customers reach Google before anyone hears the complaint",
          "The request arrives weeks late, after the goodwill has faded",
          "Nobody responds to the reviews that do come in",
        ],
        system: "RSG Review & Reactivation System",
        automations: [
          "Trigger a feedback-first request automatically once the job is complete and paid",
          "Route satisfied customers to your Google review link",
          "Turn concerns into an office follow-up task before they become public reviews",
        ],
        kpis: [
          "Review request rate",
          "New reviews per month",
          "Average rating trend",
        ],
        integrations: ["Google Business Profile", "Twilio"],
      },
      {
        id: "reactivation",
        label: "Maintenance / reactivation campaign",
        happens:
          "The relationship either compounds or expires. Past customers need seasonal maintenance, hold unsold estimates, and know neighbors — and reaching them costs a fraction of buying a new lead. Almost every service business knows this; almost none executes it consistently.",
        failures: [
          "The past-customer list exists but nobody ever messages it",
          "Maintenance plans are offered sporadically, or not at all",
          "Unclosed estimates from last season are simply archived",
          "Slow-season capacity goes unfilled while the customer list sits idle",
        ],
        system: "RSG Review & Reactivation System",
        automations: [
          "Run seasonal campaigns segmented by service history and time since last visit",
          "Offer maintenance-plan enrollment automatically after qualifying jobs",
          "Revive unclosed estimates with a no-pressure re-engagement sequence",
        ],
        kpis: [
          "Campaign reply rate",
          "Maintenance-plan enrollments",
          "Jobs booked from past customers",
          "Slow-season schedule fill",
        ],
        integrations: ["Housecall Pro", "Twilio", "Make"],
      },
    ],
  },

  demoSlug: "contractors",
  demo: {
    title: "Run a Service Company's Front Office for Ten Minutes",
    description:
      "The demo drops you into the operating system of Hartwell Contracting, a fictional multi-trade company. You can watch a $19,500 deck request travel from web form to won job — including the two days of homeowner silence in the middle — then take an after-hours emergency call as the AI receptionist's caller, build a quote, and drag leads through the pipeline yourself.",
    highlights: [
      "A lead inbox that pulls calls, web forms, Google LSA, ads, and referrals into one list",
      "A live AI receptionist call flow that qualifies, triages a storm-damage emergency, and books the visit",
      "A schedule and dispatch calendar with estimates, job starts, and crew assignments",
      "An estimate builder that prices a project live and arms follow-up on send",
      "Follow-up automations — day-2/5/10 sequences that pause the moment a human replies",
      "A customer communication timeline: missed-call text-backs, on-the-way texts, and progress updates",
      "Review automation that asks for feedback first and routes concerns to the office",
      "Analytics with response time, quote close rate, pipeline value, and lead-source performance",
    ],
    simulations: [
      "Receiving a missed call while the crew is on a job",
      "Qualifying the customer automatically",
      "Scheduling the service appointment",
      "Dispatching a technician with full job context",
      "Building and sending an estimate",
      "Automatic estimate follow-up",
      "Completing the job",
      "Requesting payment and a review",
    ],
    disclaimer:
      "The demo is a fully simulated environment. Hartwell Contracting is a fictional company, and every name, number, message, and dollar figure is sample data. Nothing you do in the demo touches real customer data — yours or anyone else's.",
  },

  systemsIntro:
    "RSG doesn't sell software licenses — we design, build, and run operational systems on top of the tools you already use. Each system below is scoped to your trades, your call volume, and your existing platform. Most engagements start with one or two systems aimed at the biggest leak, not all seven at once.",
  systems: [
    {
      id: "service-command-center",
      name: "RSG Service Command Center",
      outcome:
        "Every lead, job, estimate, invoice, and customer conversation in one operating picture, so nothing in the business depends on somebody's memory.",
      capabilities: [
        "Unified lead inbox across calls, web forms, Google LSA, ad platforms, and referrals",
        "Visual job pipeline with real dollar values at every stage",
        "Automatic intake confirmations and lead assignment by trade and territory",
        "Same-day invoicing with payment links and automated reminder cadences",
        "Two-way text and email from the job record, with full history",
        "Owner dashboard: pipeline value, close rate, response time, and receivables",
      ],
      timeline: "4–8 weeks",
      pricing: "Custom quote",
      integrations: ["ServiceTitan", "Housecall Pro", "Jobber", "QuickBooks", "Stripe", "Twilio"],
      flagship: true,
    },
    {
      id: "ai-reception",
      name: "RSG AI Reception & Missed-Call Recovery",
      outcome:
        "Every call answered or recovered within about a minute — including nights, weekends, and the hours when every crew is on a job.",
      capabilities: [
        "Missed-call text-back that reaches the caller in under a minute and asks for details and photos",
        "AI receptionist for overflow and after-hours calls: qualifies the job, detects urgency, and books from live availability",
        "Emergency triage that pages your on-call rotation instead of taking a message",
        "Call summaries and transcripts filed to the customer record automatically",
        "Spam and robocall filtering so the office phone only rings for real work",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Twilio", "CallRail", "Housecall Pro", "Google Calendar"],
    },
    {
      id: "scheduling-dispatch",
      name: "RSG Scheduling & Dispatch System",
      outcome:
        "The right technician on the right job with the customer informed at every step — without the office playing phone tag all day.",
      capabilities: [
        "Customer self-scheduling from live availability, with territory and drive-time rules",
        "Automatic confirmations, reminders, and on-the-way texts with arrival estimates",
        "Trade- and territory-based technician assignment",
        "Job packets pushed to the tech's phone: history, photos, access notes, prior visits",
        "Reschedule and cancellation handling that backfills the empty slot",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["ServiceTitan", "Housecall Pro", "Jobber", "FieldEdge", "Service Fusion", "Google Calendar"],
    },
    {
      id: "estimate-follow-up",
      name: "RSG Estimate Follow-Up Engine",
      outcome:
        "No estimate dies of silence — every quote gets a disciplined, polite follow-up sequence until there is an answer either way.",
      capabilities: [
        "Automatic day-2 / day-5 / day-10 follow-up on every sent estimate",
        "Instant pause when the customer replies or a rep takes over manually",
        "Quote-aging alerts showing how much money is sitting unanswered",
        "Open and engagement tracking on delivered quotes",
        "Batch revival campaigns for unclosed estimates from past seasons",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Housecall Pro", "Jobber", "Twilio", "Zapier"],
    },
    {
      id: "customer-portal",
      name: "RSG Customer Communication Portal",
      outcome:
        "Customers always know what's happening with their job — so they stop calling the office to ask, and start referring you because of it.",
      capabilities: [
        "Automated status updates at every milestone: scheduled, on the way, in progress, delayed, complete",
        "Contract, deposit, and approval requests delivered the moment a quote is accepted",
        "Photo and document sharing tied to the job record",
        "One continuous conversation thread across text and email",
        "Escalation to a human whenever the customer's reply needs one",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Twilio", "CompanyCam", "Stripe", "ServiceTitan"],
    },
    {
      id: "review-reactivation",
      name: "RSG Review & Reactivation System",
      outcome:
        "A steady stream of public reviews from completed jobs, and a past-customer list that produces booked work in the slow months.",
      capabilities: [
        "Feedback-first review requests triggered when a job is completed and paid",
        "Concern routing that creates an office task before a complaint becomes a public review",
        "Seasonal maintenance campaigns segmented by service history",
        "Maintenance-plan enrollment offers after qualifying jobs",
        "Unclosed-estimate revival campaigns with honest, no-pressure messaging",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["Google Business Profile", "Twilio", "Housecall Pro", "Make"],
    },
    {
      id: "field-dashboard",
      name: "RSG Field Operations Dashboard",
      outcome:
        "Owner-level visibility into jobs, margins, technicians, and lead sources — without anyone building spreadsheets on Sunday night.",
      capabilities: [
        "Job costing: actual labor and materials against the original estimate, per job and per job type",
        "Close rate, response time, and pipeline reporting in one view",
        "Lead-source attribution down to the call, so marketing spend answers for itself",
        "Technician productivity and callback tracking",
        "Receivables aging and collection status at a glance",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["ServiceTitan", "QuickBooks", "CallRail", "CompanyCam", "n8n"],
    },
  ],

  integrations: {
    intro:
      "RSG systems connect to the field service management (FSM) platform, accounting, phone, and calendar tools you already run — we build around your stack rather than forcing a replacement. If you're on spreadsheets today, we'll help you choose a platform worth building on.",
    disclaimer:
      "Integration availability depends on each platform's API, plan tier, and account permissions, and is verified for your specific accounts during scoping. RSG builds against each platform's published interfaces and does not claim official partnerships with any company listed here.",
    items: [
      {
        name: "ServiceTitan",
        category: "Field service management",
        connects:
          "Syncs customers, jobs, schedules, and pricebook data so leads captured by RSG systems become dispatchable ServiceTitan jobs without re-entry.",
      },
      {
        name: "Housecall Pro",
        category: "Field service management",
        connects:
          "Connects jobs, estimates, invoices, and customer records so follow-up sequences and review requests fire from real job-status changes.",
      },
      {
        name: "Jobber",
        category: "Field service management",
        connects:
          "Pulls quotes, jobs, and visit schedules into the pipeline and pushes booked appointments and follow-up outcomes back.",
      },
      {
        name: "FieldEdge",
        category: "Field service management",
        connects:
          "Links dispatch boards and work orders so technician assignments and job statuses stay in step with automated customer updates.",
      },
      {
        name: "Service Fusion",
        category: "Field service management",
        connects:
          "Syncs jobs, estimates, and customer records so scheduling automations and reminders operate on live Service Fusion data.",
      },
      {
        name: "CompanyCam",
        category: "Field documentation",
        connects:
          "Attaches job-site photos to the lead, estimate, and closeout record so quotes, disputes, and warranty questions have visual evidence.",
      },
      {
        name: "QuickBooks",
        category: "Payments & accounting",
        connects:
          "Syncs invoices and payments so collection reminders reflect what's actually owed and paid jobs stop getting chased.",
      },
      {
        name: "Stripe",
        category: "Payments & accounting",
        connects:
          "Powers payment links on invoices and deposit requests, and reports payment events back to the job record in real time.",
      },
      {
        name: "Google Calendar",
        category: "Scheduling",
        connects:
          "Publishes estimate visits and job starts to the calendars your crew already checks, and reads availability for self-scheduling.",
      },
      {
        name: "Google Business Profile",
        category: "Reviews & local presence",
        connects:
          "Routes satisfied customers to your review link and tracks incoming reviews and ratings alongside job data.",
      },
      {
        name: "Twilio",
        category: "Communications",
        connects:
          "Carries the text-message layer: missed-call text-backs, confirmations, on-the-way notices, follow-ups, and review requests.",
      },
      {
        name: "CallRail",
        category: "Communications",
        connects:
          "Pulls call recordings, missed-call events, and lead-source attribution into the pipeline so every call becomes accountable data.",
      },
      {
        name: "Zapier",
        category: "Automation platform",
        connects:
          "Bridges lead sources and niche tools that lack direct integrations, moving form fills and ad leads into the command center.",
      },
      {
        name: "Make",
        category: "Automation platform",
        connects:
          "Runs multi-step automation scenarios — campaign triggers, data syncs, and alerts — between your platforms.",
      },
      {
        name: "n8n",
        category: "Automation platform",
        connects:
          "Hosts self-managed automation workflows for businesses that want their integration logic running on infrastructure they control.",
      },
    ],
  },

  compliance: {
    title: "Compliance & Risk, Handled Like Adults",
    intro:
      "Automating customer communication and putting AI on your phone line creates real obligations — around consent, recordings, payment data, and who can see what. We design for them from day one rather than bolting on disclaimers later. Here is what a responsible implementation covers.",
    disclaimer:
      "RSG does not provide legal, medical, or regulatory advice. Whether any implementation meets your obligations depends on the complete system — the vendors involved, your written procedures, and how your team operates it day to day. Confirm requirements for your state and trade with qualified counsel.",
    items: [
      {
        title: "Text and call consent (TCPA-style consent capture)",
        detail:
          "The TCPA is the federal law governing automated calls and texts to consumers, and it requires consent before you send them. RSG systems capture consent at intake — on forms, in call flows, and in booking — and record when and how it was given, so every automated message your business sends has a documented basis.",
      },
      {
        title: "Opt-outs and quiet hours",
        detail:
          "Every automated sequence honors STOP and unsubscribe requests immediately and permanently, across all campaigns. Sending windows are enforced so follow-ups and campaigns don't text customers at 6 AM, and suppression lists carry across systems so an opted-out customer stays opted out.",
      },
      {
        title: "Call-recording disclosure",
        detail:
          "Call recording laws vary state by state: some states require only one party's consent, while others — including Massachusetts — require all parties to consent. Recording and AI-transcription features are configured to match the rules where you operate, including announcement messages where they're required.",
      },
      {
        title: "Payment-data security",
        detail:
          "Card numbers never pass through or get stored in RSG-built systems. Payments run through processors like Stripe and QuickBooks, which are certified to handle card data; your systems hold only payment status and receipts, so a compromise of your CRM never exposes a card number.",
      },
      {
        title: "Employee and subcontractor access controls",
        detail:
          "Role-based access limits what each person sees: technicians see their own jobs, not your full customer list; subcontractors see even less. Offboarding is a single revocation step, so a departed tech or a sub you stopped using doesn't keep a working login to your customer base.",
      },
      {
        title: "Customer record retention",
        detail:
          "Customer records, messages, and call recordings are kept under a defined retention policy rather than accumulating forever. Deletion requests can be honored across connected systems, and retention windows are set with your obligations and warranty periods in mind.",
      },
      {
        title: "Property access information",
        detail:
          "Gate codes, alarm codes, lockbox locations, and interior photos are among the most sensitive data a service business holds. These fields are restricted to the assigned technician and office roles, excluded from broadcast messages and campaigns, and never used in automated message templates.",
      },
      {
        title: "Human approval gates for high-risk actions",
        detail:
          "AI in an RSG system books appointments, answers questions, and sends updates — it does not set prices, issue refunds, promise scope, or commit crews without a human approving. Every high-risk action routes to a named person, and the boundary between 'AI handles it' and 'a human decides' is written down, not implied.",
      },
    ],
  },

  caseStudy: {
    label: "Illustrative scenario — not a client result",
    businessType: "Two-trade HVAC and plumbing company",
    size: "8 field technicians, 2 office coordinators, roughly $2.4M in annual revenue",
    problem:
      "Peak season buries the office: both coordinators are on the phone most of the day, so a meaningful share of calls ring out — including after-hours emergencies that go straight to voicemail. Estimates are tracked in a spreadsheet and followed up when the owner remembers, which in July is never. Invoices go out from QuickBooks up to a week after completion, and reviews get requested only when a customer seems especially happy. The work itself is good; the operation around it leaks at every stage.",
    currentStack: [
      "Housecall Pro",
      "QuickBooks Online",
      "Google Calendar",
      "Google Business Profile",
      "Excel estimate tracker",
    ],
    implementation: [
      "Weeks 1–2: deploy RSG AI Reception & Missed-Call Recovery on the main line — instant text-back on missed calls, AI answering after hours with emergency paging to the on-call tech.",
      "Weeks 2–4: stand up the RSG Service Command Center connected to Housecall Pro and QuickBooks, replacing the Excel tracker with one pipeline holding every lead, estimate, job, and invoice.",
      "Weeks 4–5: arm the RSG Estimate Follow-Up Engine with a day-2 / day-5 / day-10 sequence on every sent quote, pausing on any human reply.",
      "Weeks 5–6: turn on the RSG Review & Reactivation System — feedback-first review requests after paid jobs, plus a fall maintenance campaign to past customers.",
      "Weeks 6–8: add the RSG Field Operations Dashboard for weekly owner reporting on close rate, response time, margins, and receivables.",
    ],
    beforeWorkflow: [
      "A homeowner calls at 4:40 PM; both coordinators are on other lines and the call rings out",
      "No voicemail is left — the homeowner calls the next company in the search results",
      "Estimates from this week's visits get typed up at night and logged in the spreadsheet",
      "Follow-up happens if the owner remembers during a slow moment; most quotes get one touch or none",
      "The invoice goes out from QuickBooks four to seven days after the job, without a payment link",
      "A review gets requested once or twice a month, when someone thinks of it",
    ],
    afterWorkflow: [
      "Every missed call gets a text-back within about a minute; after-hours calls reach the AI receptionist, which qualifies, books, and pages on-call for emergencies",
      "Each lead lands in one pipeline with its source, urgency, and photos attached, assigned by trade",
      "Appointments are self-scheduled from live availability, with confirmations and on-the-way texts sent automatically",
      "Estimates go out same-day with tracking, and the follow-up sequence runs until the customer answers either way",
      "The invoice, with a payment link, is sent the moment the job closes — reminders continue until it's paid",
      "Every completed, paid job triggers a feedback-first review request and joins the seasonal campaign list",
    ],
    timeline: "6–8 weeks from kickoff to all five systems live",
    kpis: [
      "Call answer + recovery rate",
      "Time to first response",
      "Estimate follow-up coverage",
      "Estimate close rate",
      "Days from completion to payment",
      "New reviews per month",
    ],
    projections: [
      {
        label: "Missed-call recovery (modeled)",
        value:
          "With ~25% of calls currently missed, instant text-back is projected to recover roughly half of those callers — several additional booked jobs per month at the company's own booking rate.",
      },
      {
        label: "Estimate follow-up (modeled)",
        value:
          "Applying the company's close rate, dampened for late follow-up, to the ~8 currently uncontacted estimates per month projects 1–2 additional wins monthly from quotes that today close at zero.",
      },
      {
        label: "Collections (modeled)",
        value:
          "Same-day invoicing with payment links and automatic reminders is projected to move typical collection from about a week after completion toward days, pulling receivables forward.",
      },
      {
        label: "Reviews (modeled)",
        value:
          "Moving from asking roughly 1 in 10 customers to an automated ask on about half of completed jobs is, arithmetically, a ~5x increase in review requests sent.",
      },
    ],
    projectionNote:
      "These outcomes are modeled from the scenario's stated inputs. They are projections, not measured client results, and they are not a guarantee of any financial outcome.",
  },

  ctas: {
    primary: {
      label: "Find Where Your Service Business Is Losing Jobs",
      href: "#assessment",
    },
    secondary: [
      { label: "Analyze My Lead-to-Job Workflow", href: "#workflow" },
      { label: "Explore the Home Service Demo", href: "/demos/contractors" },
      { label: "Build My Service Command Center", href: "/book" },
    ],
  },

  assessment: {
    title: "The Home Service Operations Assessment",
    intro:
      "Twelve questions, about three minutes. Answer honestly — the point is to locate your biggest leak, not to grade you. Based on your answers, we'll point you at the one system most likely to pay for itself first.",
    questions: [
      {
        id: "services",
        label: "Which services do you offer?",
        type: "select",
        options: [
          "HVAC",
          "Plumbing",
          "Electrical",
          "Roofing / siding / exterior",
          "Landscaping / exterior cleaning",
          "General contracting / multi-trade",
        ],
        required: true,
      },
      {
        id: "service-area",
        label: "What area do you serve?",
        type: "text",
        placeholder: "e.g. Plymouth County and the South Shore",
      },
      {
        id: "office-staff",
        label: "How many office staff handle calls, scheduling, and billing?",
        type: "number",
        placeholder: "2",
      },
      {
        id: "field-techs",
        label: "How many field technicians or crew members do you run?",
        type: "number",
        placeholder: "8",
      },
      {
        id: "monthly-leads",
        label: "Roughly how many leads do you get per month, across all sources?",
        type: "number",
        placeholder: "60",
        helper: "Calls, web forms, Google, Angi, referrals — everything.",
      },
      {
        id: "avg-job-value",
        label: "What's your average job value, in dollars?",
        type: "number",
        placeholder: "1800",
        helper: "Blend service calls and installs into one rough average.",
      },
      {
        id: "current-platform",
        label: "What do you run the business on today?",
        type: "select",
        options: [
          "ServiceTitan",
          "Housecall Pro",
          "Jobber",
          "FieldEdge or Service Fusion",
          "Spreadsheets and paper",
          "Nothing formal — phone and memory",
        ],
        required: true,
      },
      {
        id: "scheduling-process",
        label: "How does scheduling and dispatch actually work?",
        type: "select",
        options: [
          "FSM software with a real dispatch board",
          "Google Calendar or a shared calendar",
          "Whiteboard or paper schedule",
          "Texting the crew each morning",
          "One person runs it all from their phone",
        ],
      },
      {
        id: "missed-calls",
        label: "What happens when a call is missed today?",
        type: "select",
        options: [
          "Automatic text-back goes out",
          "An answering service picks up",
          "It goes to voicemail",
          "Someone calls back when they get a chance",
          "We honestly don't know how many we miss",
        ],
      },
      {
        id: "estimate-follow-up",
        label: "How do estimates get followed up after they're sent?",
        type: "select",
        options: [
          "Automated follow-up sequence",
          "Tracked in a spreadsheet, chased manually",
          "One follow-up call, then we move on",
          "When we remember",
          "No follow-up — we wait for the customer",
        ],
      },
      {
        id: "invoicing",
        label: "How does invoicing and collection work?",
        type: "select",
        options: [
          "Invoiced on-site with card payment",
          "Sent from accounting software within a day or two",
          "Sent whenever the office gets to it",
          "Paper invoices, checks in the mail",
          "Collections are a known problem",
        ],
      },
      {
        id: "bottleneck",
        label: "What's the biggest operational bottleneck right now?",
        type: "select",
        options: [
          "Missed calls & lead response",
          "Estimate follow-up",
          "Scheduling & dispatch",
          "Invoicing & collections",
          "Reviews & repeat business",
          "Owner visibility & reporting",
        ],
        required: true,
      },
    ],
    recommendations: [
      {
        keywords: ["missed call", "lead response", "voicemail", "answering service"],
        systemId: "ai-reception",
      },
      {
        keywords: ["estimate follow-up", "no follow-up", "when we remember", "wait for the customer"],
        systemId: "estimate-follow-up",
      },
      {
        keywords: ["scheduling", "dispatch", "whiteboard", "texting the crew"],
        systemId: "scheduling-dispatch",
      },
      {
        keywords: ["invoicing", "collections", "checks in the mail"],
        systemId: "service-command-center",
      },
      {
        keywords: ["reviews", "repeat business", "reactivation"],
        systemId: "review-reactivation",
      },
      {
        keywords: ["visibility", "reporting", "profitability"],
        systemId: "field-dashboard",
      },
    ],
    fallbackSystemId: "service-command-center",
  },

  faqs: [
    {
      q: "Does this replace ServiceTitan, Housecall Pro, or Jobber?",
      a: "No. RSG systems connect to the field service management platform you already run and fill the gaps around it — call recovery, follow-up discipline, customer communication, and owner reporting. Your FSM stays the system of record for jobs and dispatch. If you're on spreadsheets, we'll help you pick a platform worth building on first.",
    },
    {
      q: "How long does implementation take?",
      a: "It depends on scope. A single system like missed-call recovery or estimate follow-up typically runs 2–4 weeks; the full Service Command Center runs 4–8 weeks. Systems go live one at a time so the office is never learning everything at once, and each phase has to prove itself before the next starts.",
    },
    {
      q: "How does pricing work?",
      a: "Every engagement is scoped and quoted individually — a 3-truck plumbing company and a 30-truck HVAC operation are not the same project, and pretending otherwise produces bad builds. You get a fixed scope and a custom quote before any work begins, with no charge for the scoping conversation.",
    },
    {
      q: "What happens to our customer data?",
      a: "It stays yours. RSG builds on your accounts — your FSM, your phone numbers, your Twilio and Stripe accounts — so nothing is held hostage in a platform we own. Access is role-based, sensitive fields like gate codes are restricted, card data lives only with your payment processor, and if we part ways, the systems and the data remain with you.",
    },
    {
      q: "Will the AI receptionist say something wrong or commit us to a price?",
      a: "It's not allowed to. The AI qualifies callers, detects urgency, and books appointments from your live availability — it does not quote prices, promise scope, or approve refunds. Anything in that category routes to a named human, and every call produces a transcript so you can audit exactly what was said.",
    },
    {
      q: "We're seasonal — is this worth it in the slow months?",
      a: "The slow months are where two of these systems earn the most. Reactivation campaigns fill the schedule from past customers and unsold estimates precisely when the phone is quiet, and follow-up automation makes sure the smaller lead volume you do get converts at its best. Peak season is when missed-call recovery carries the load.",
    },
  ],

  seo: {
    title: "AI Automation for HVAC, Plumbing & Home Service Companies",
    description:
      "Missed-call recovery, scheduling and dispatch systems, estimate follow-up, and review automation built for HVAC, plumbing, electrical, and trade businesses.",
  },
};
