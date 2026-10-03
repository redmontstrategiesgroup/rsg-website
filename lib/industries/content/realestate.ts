import type { IndustryVertical } from "../types";

/**
 * Default content for the Residential Brokerages & Agent Teams vertical.
 *
 * Honesty rules: no invented statistics, no client names, no guarantees.
 * The case study is explicitly illustrative. No page projects a dollar
 * outcome and nothing is priced in advance.
 *
 * One rule specific to this vertical: nothing here — and nothing the systems
 * described here do — gives a valuation, an opinion of price, or advice that
 * requires a license. That boundary is the subject of a compliance item, and
 * the demo's receptionist enforces it in front of the visitor.
 */
export const realEstateVertical: IndustryVertical = {
  slug: "real-estate",
  status: "published",
  name: "Residential Brokerages & Agent Teams",
  shortName: "Real Estate",
  terminology: {
    customer: "client",
    customers: "clients",
    job: "transaction",
    jobs: "transactions",
    team: "agents",
  },

  hero: {
    eyebrow: "Residential Brokerages & Agent Teams",
    headline: "Every lead answered, every showing booked, every deadline met.",
    subheadline:
      "RSG builds and operates the systems that answer portal leads in seconds, coordinate showings without phone tag, keep every contingency deadline visible, and keep past clients in touch — connected to the CRM, MLS feed, and transaction platform your brokerage already runs.",
    primaryCta: {
      label: "Assess Your Brokerage's Lead Response and Transaction Flow",
      href: "#assessment",
    },
    demoCta: {
      label: "Explore the Brokerage Operations Demo",
      href: "/demos/realestate",
    },
    designedFor:
      "Designed for residential brokerages, agent teams, and producing team leads — from a five-agent team to a multi-office brokerage. If your leads sit unanswered overnight, your showings run on phone tag, and your past-client database hasn't been touched in a year, this page is about you.",
  },

  problemsIntro:
    "These are the failure points we find inside residential brokerages and agent teams. Individually each one looks like the cost of doing business. Added up, they are usually the difference between a team that compounds and a team that runs on the personal energy of whoever is working hardest that month.",
  problems: [
    {
      id: "speed-to-lead",
      title: "Portal leads that wait hours for a first response",
      detail:
        "A Zillow or Realtor.com inquiry lands in an inbox at 9 PM. The buyer hears back at ten the next morning, after three other agents have already called and one has already set an appointment.",
      cost: "The agent who answers first sets the appointment; everyone else is doing unpaid research.",
    },
    {
      id: "no-routing",
      title: "Leads in a shared inbox with no owner",
      detail:
        "No round-robin, no claim window, no escalation. The lead is visible to everyone, which means nobody is accountable for it, and the ones that go cold do so without anyone noticing they were assigned.",
      cost: "A lead with four possible owners has none.",
    },
    {
      id: "floor-duty-roulette",
      title: "Response quality that depends on who is on floor duty",
      detail:
        "The same inquiry gets a full qualification conversation from one agent and a one-word text from another. Nobody is doing anything wrong; there is simply no shared standard for the first ten minutes.",
      cost: "Your conversion rate isn't one number, it's twelve different numbers wearing a trench coat.",
    },
    {
      id: "showing-phone-tag",
      title: "Showings coordinated by phone tag",
      detail:
        "The buyer's agent texts the listing agent, the listing agent texts the seller, the seller replies two hours later, and by then the slot is gone and the buyer has toured something else.",
      cost: "Every hour of coordination lag is an hour a competing buyer is standing in the house.",
    },
    {
      id: "no-showing-feedback",
      title: "Showing feedback that never reaches the seller",
      detail:
        "Agents tour, form opinions, and never write them down. The seller calls Friday asking why there's been no news, and the honest answer is that six people walked through and nobody wrote a sentence.",
      cost: "A seller with no feedback assumes the agent isn't working — that's how price conversations get lost.",
    },
    {
      id: "listing-pipeline-in-a-head",
      title: "Pre-list to go-live tracked in one person's head",
      detail:
        "Photos, staging, sign install, disclosures, MLS entry, syndication check — a dozen dependencies with real lead times, coordinated from memory and a whiteboard that only one person can read.",
      cost: "Every day between a signed agreement and a live listing is a day of inventory earning nothing.",
    },
    {
      id: "contingency-deadlines",
      title: "Contingency deadlines tracked in a spreadsheet",
      detail:
        "Inspection, appraisal, financing, and title dates live in a tab the coordinator opens each morning and hopes is current. One person's attention is the only thing standing between the brokerage and a missed date.",
      cost: "A missed contingency date is a legal problem, not an admin problem.",
    },
    {
      id: "document-chasing",
      title: "The under-contract period spent chasing documents",
      detail:
        "Pre-approval letters, addenda, disclosures, and repair receipts collected across four parties and six text threads, with no checklist that shows at a glance what is still outstanding.",
      cost: "Chasing paper is the single largest consumer of coordinator time in most brokerages.",
    },
    {
      id: "cold-sphere",
      title: "A past-client database that has gone cold",
      detail:
        "Two thousand names, one holiday card a year, and a \"just checking in\" text when business is slow. Everybody knows the sphere is the best source of business, and nobody has a system that works it.",
      cost: "Your sphere is the cheapest business you will ever get, and it's the only source nobody is working.",
    },
    {
      id: "no-referral-ask",
      title: "Referrals that depend on remembering to ask",
      detail:
        "No closing-anniversary touch, no home-value update, no structured ask at the moment goodwill actually peaks. The referral happens if the agent happens to be thinking about it.",
      cost: "The referral you didn't ask for went to whoever did.",
    },
    {
      id: "long-timeline-buyers",
      title: "Long-timeline buyers abandoned after the third email",
      detail:
        "The nine-month buyer gets saved-search alerts nobody reads and no human contact after the first month, because the pipeline rewards attention to whoever is ready this week.",
      cost: "The buyer who wasn't ready in March closes in November — with somebody else.",
    },
    {
      id: "no-attribution",
      title: "No line from spend to closing",
      detail:
        "Nobody can say which portal, sign call, open house, or campaign produced last quarter's closed volume. Budgets get renewed by habit, and the sources that actually convert can't argue for more.",
      cost: "Renewing portal spend you can't attribute is a bet re-placed automatically every month.",
    },
  ],

  workflow: {
    title: "The brokerage lifecycle, stage by stage",
    intro:
      "Twelve stages from first inquiry to the production report that funds next quarter's lead spend. Every stage has known failure modes, a named RSG system responsible for it, and numbers worth watching. This is the map we use during scoping.",
    stages: [
      {
        id: "lead-captured",
        label: "Lead captured",
        happens:
          "An inquiry arrives from a portal, the IDX site, a sign call, or an open house sign-in. The source is knowable at this exact moment, and in most brokerages it is lost within the hour.",
        failures: [
          "Portal leads landing in a personal inbox with no record anywhere else",
          "Open house sign-in sheets typed up days later, or never",
          "Sign calls that ring out after hours with no capture at all",
          "No way to tell later which source produced a closing",
        ],
        system: "RSG Brokerage Lead Response System",
        automations: [
          "Capture from every portal, IDX form, and tracked phone number into one record",
          "Source and property tagged automatically at the moment of capture",
          "After-hours text-back on any unanswered call to a tracked line",
        ],
        kpis: [
          "Leads captured by source",
          "Share of leads with a known source",
          "After-hours capture rate",
        ],
        integrations: ["Zillow Premier Agent", "Realtor.com Connections Plus", "Follow Up Boss"],
      },
      {
        id: "first-response",
        label: "First response & routing",
        happens:
          "The first few minutes decide the outcome. The lead needs a real message from a named agent and an owner who is accountable for it, whether or not anyone is at a desk.",
        failures: [
          "Leads answered the next business morning, hours after competing agents",
          "Shared inboxes where everyone assumes someone else replied",
          "Auto-replies that acknowledge receipt without asking anything",
          "No escalation when the on-duty agent is unavailable",
        ],
        system: "RSG Brokerage Lead Response System",
        automations: [
          "First outbound message within seconds, day or night",
          "Round-robin assignment with a timed claim window",
          "Automatic escalation to the next agent, then the team lead, when unclaimed",
        ],
        kpis: [
          "Median speed to lead",
          "Share of leads answered within five minutes",
          "Unclaimed-lead rate",
        ],
        integrations: ["Follow Up Boss", "BoldTrail (kvCORE)", "Sierra Interactive"],
      },
      {
        id: "qualification",
        label: "Qualification & appointment set",
        happens:
          "Timeline, motivation, price band, and financing status get established, and the conversation converts into a calendar appointment — or it doesn't, and the reason should be recorded either way.",
        failures: [
          "Qualification quality that varies by whoever picked up",
          "Appointments offered by text tag instead of live availability",
          "Financing status discovered at the third showing",
          "No record of why a lead didn't convert",
        ],
        system: "RSG Brokerage Lead Response System",
        automations: [
          "Standard qualifying sequence tuned per source and intent",
          "Live calendar availability offered inside the conversation",
          "Appointment confirmations and reminders queued on booking",
        ],
        kpis: [
          "Lead → appointment rate",
          "Appointments set per agent",
          "Share of leads with financing status recorded",
        ],
        integrations: ["Follow Up Boss", "Google Workspace (Gmail & Calendar)", "BoomTown"],
      },
      {
        id: "long-timeline-nurture",
        label: "Long-timeline nurture",
        happens:
          "Most inquiries are not ready this month. A six- to twelve-month buyer needs to stay in contact with a human cadence until their timeline arrives, rather than being dropped into a drip nobody reads.",
        failures: [
          "Long-timeline buyers dropped after the third unanswered email",
          "Saved-search alerts firing with no human contact attached",
          "No trigger that returns a nurtured lead to active when they re-engage",
          "The nurture list growing without anyone ever working it",
        ],
        system: "RSG Buyer Nurture & Long-Timeline Follow-Up System",
        automations: [
          "Segmentation by area, price band, and stated timeline",
          "Market notes tied to the buyer's own saved search",
          "Automatic return to the active pipeline on any reply",
        ],
        kpis: [
          "Nurtured leads returning to active",
          "Reply rate on nurture touches",
          "Closings originating from leads over six months old",
        ],
        integrations: ["BoldTrail (kvCORE)", "Sierra Interactive", "Follow Up Boss"],
      },
      {
        id: "consultation",
        label: "Buyer consult or listing appointment",
        happens:
          "The appointment where representation is won or lost. The agent should walk in with comparables, a net sheet, and the client's stated priorities already in hand.",
        failures: [
          "Agents preparing comps the morning of, or in the car",
          "Net sheets built by hand in a spreadsheet at the kitchen table",
          "Listing appointments quietly cancelled with no reminder sequence",
          "Agreements emailed as attachments and chased for days",
        ],
        system: "RSG Listing Pipeline System",
        automations: [
          "Pre-appointment packet with comparables and a net sheet sent automatically",
          "Reminder sequence for the appointment itself",
          "Agreement sent for signature with staged follow-up on unsigned envelopes",
        ],
        kpis: [
          "Appointment → agreement rate",
          "Appointment no-show rate",
          "Time from appointment to signed agreement",
        ],
        integrations: ["CloudCMA", "DocuSign", "Google Workspace (Gmail & Calendar)"],
      },
      {
        id: "listing-prep",
        label: "Listing prep & go-live",
        happens:
          "Between a signed agreement and a live listing sit photos, staging, sign install, disclosures, MLS entry, and a syndication check — a dozen vendor dependencies with real lead times.",
        failures: [
          "Photographer and stager booked ad hoc, days later than they should be",
          "Disclosure packets assembled at the last minute",
          "MLS entry delayed by one missing field nobody flagged",
          "Syndication never verified, so the listing is invisible on a major portal",
        ],
        system: "RSG Listing Pipeline System",
        automations: [
          "Vendor scheduling triggered by the signed agreement",
          "Pre-list checklist with owners and due dates per task",
          "Syndication verification with an alert when a portal hasn't picked the listing up",
        ],
        kpis: [
          "Days from signed to live",
          "Share of listings live within the target window",
          "Listings with verified syndication at go-live",
        ],
        integrations: ["MLS / RESO Web API", "Dotloop", "SkySlope"],
      },
      {
        id: "showings",
        label: "Showings & seller feedback",
        happens:
          "Requests come in, three parties have to agree on a time, the showing happens, and the seller needs to hear what buyers actually said — ideally the same day, not when they call to ask.",
        failures: [
          "Showing requests coordinated by text between three parties",
          "Confirmations that never reach the seller, who is home when they shouldn't be",
          "Feedback requested manually, when it's requested at all",
          "Sellers going a week with no update while showings pile up",
        ],
        system: "RSG Showing & Appointment Coordination System",
        automations: [
          "Showing requests confirmed against live availability with all parties notified",
          "Feedback requested automatically after the access event",
          "Weekly seller summaries built from showing counts and feedback",
        ],
        kpis: [
          "Showings per listing per week",
          "Feedback-capture rate",
          "Median time to confirm a showing request",
        ],
        integrations: ["ShowingTime", "BrokerBay", "SentriLock"],
      },
      {
        id: "offer",
        label: "Offer & negotiation",
        happens:
          "Offers arrive on different forms at different hours, get compared, countered, and eventually signed. Every version needs to be tracked and every party kept current.",
        failures: [
          "Offers compared by reading PDFs side by side in an inbox",
          "Counter deadlines tracked in someone's head",
          "Sellers unclear which version is live",
          "Signed documents scattered across email threads",
        ],
        system: "RSG Transaction Coordination System",
        automations: [
          "Offer intake logged against the listing with terms summarized side by side",
          "Signature status tracked with reminders on unsigned envelopes",
          "Every party notified when a version becomes the live one",
        ],
        kpis: [
          "Offers per listing",
          "List-to-contract ratio",
          "Days on market",
        ],
        integrations: ["Dotloop", "DocuSign", "SkySlope"],
      },
      {
        id: "under-contract",
        label: "Under contract & coordination",
        happens:
          "Thirty to forty-five days with four to six hard dates and a document checklist across four parties. This is where files die, and where the deadline that gets missed is always the one nobody was watching.",
        failures: [
          "Contingency dates living only in a coordinator's spreadsheet",
          "Repair negotiations conducted across three text threads",
          "Missing documents discovered at the compliance review",
          "Deadlines noticed at twenty-four hours instead of five days",
        ],
        system: "RSG Transaction Coordination System",
        automations: [
          "Contingency dates calculated from the executed contract and watched automatically",
          "Escalating alerts at five days, three days, and twenty-four hours",
          "Document chase sequences per responsible party until the checklist clears",
        ],
        kpis: [
          "Contingency deadlines missed",
          "Document turnaround time",
          "Fall-through rate",
        ],
        integrations: ["Dotloop", "SkySlope", "DocuSign"],
      },
      {
        id: "closing",
        label: "Closing & handoff",
        happens:
          "The file closes, the commission is recorded, and the client transitions from an active transaction to a past client — a handoff that in most brokerages simply doesn't happen.",
        failures: [
          "Closed files never formally handed to a follow-up track",
          "Commission and production data re-keyed into the back office",
          "Review requests depending on the agent remembering",
          "Clients who close and are never contacted again",
        ],
        system: "RSG Transaction Coordination System",
        automations: [
          "Closing checklist completion and file archival",
          "Automatic enrollment into the past-client track on close",
          "Review request sequenced a few days after closing, feedback captured privately first",
        ],
        kpis: [
          "Closings per month",
          "On-time close rate",
          "Reviews per closing",
        ],
        integrations: ["Brokermint", "SkySlope", "Google Workspace (Gmail & Calendar)"],
      },
      {
        id: "sphere",
        label: "Past-client & referral nurture",
        happens:
          "The database that should produce a third of next year's business. Worked properly it runs on anniversaries, equity updates, and a structured ask at the moment goodwill peaks.",
        failures: [
          "One holiday card a year standing in for a relationship",
          "Equity updates promised and never sent",
          "No structured referral ask at any point",
          "Referrals that arrive with no record of who sent them",
        ],
        system: "RSG Sphere & Past-Client Engine",
        automations: [
          "Closing-anniversary touches with neighborhood equity updates",
          "Referral asks timed to the moment goodwill peaks",
          "Referral source recorded on every lead the sphere produces",
        ],
        kpis: [
          "Touchpoints per client per year",
          "Repeat and referral share of closings",
          "Review rate",
        ],
        integrations: ["Follow Up Boss", "BoldTrail (kvCORE)", "Brokermint"],
      },
      {
        id: "reporting",
        label: "Team performance & attribution",
        happens:
          "The owner needs one answer to \"what did we close, who closed it, and what produced it.\" That answer should set next quarter's lead spend, and stage twelve feeds straight back into stage one.",
        failures: [
          "Production reported from the back office weeks after the fact",
          "Source attribution guessed from memory at renewal time",
          "Agent activity invisible until a closing does or doesn't happen",
          "Portal spend renewed because it was renewed last year",
        ],
        system: "RSG Brokerage Performance & Attribution Platform",
        automations: [
          "Closed-file and commission data consolidated into production reporting",
          "Source attribution carried from capture through to closing",
          "Activity-to-closing reporting per agent and per team",
        ],
        kpis: [
          "Source-attributed closings",
          "Cost per closing by source",
          "Activity-to-closing ratio by agent",
        ],
        integrations: ["Brokermint", "Follow Up Boss", "MLS / RESO Web API"],
      },
    ],
  },

  demoSlug: "realestate",
  demo: {
    title: "Walk through the Brokerage Operations System",
    description:
      "A hands-on simulation of the system running for Harborline Realty Group, a fictional two-office residential brokerage with a listing team, a buyer team, and one transaction coordinator. You can explore it as the broker, the team lead, the transaction coordinator, or an agent — everything is clickable, and nothing in it is real.",
    highlights: [
      "A transaction pipeline that runs from new lead through under contract and closing, and then into the past-client sphere — because the lifecycle closes on itself",
      "An AI receptionist that takes an after-hours sign call and, when the caller asks what their house is worth, declines to give a number and routes it to a licensed agent instead",
      "Contingency deadline tracking with escalating alerts, including a live inspection date inside seventy-two hours",
      "A seller net sheet builder — list price minus commission, payoff, closing costs, concessions, and prep — that generates a record with automated follow-up",
      "A conversation inbox spanning SMS, the IDX site, email, and phone, with speed-to-lead responses timestamped in seconds",
      "Round-robin routing with a five-minute claim window, and an escalation you can trigger yourself",
      "Closing-anniversary and long-timeline buyer campaigns with sent, replied, and booked counts",
      "Analytics comparing lead sources on volume against conversion — where the sphere's small, high-converting numbers make their own argument",
    ],
    simulations: [
      "A portal lead arriving and being answered in seconds",
      "An unclaimed lead escalating to the next agent",
      "A contingency deadline coming inside seventy-two hours",
      "A closing-anniversary batch producing a referral",
      "An after-hours sign call becoming a listing appointment",
      "A file moving from under contract to clear-to-close",
      "A past client's referral entering the pipeline as a new lead",
    ],
    disclaimer:
      "The demo is a fully simulated environment populated entirely with fictional sample data — a made-up brokerage, made-up clients, made-up addresses and numbers. It never touches real client data, no message is ever sent, and nothing you do inside it affects any real system.",
  },

  systemsIntro:
    "Seven named systems, built and operated by RSG. Each one is responsible for a specific set of the failure points above; together they form the connected picture. Every engagement is scoped individually against your CRM, your MLS, your transaction platform, and your team structure — there is no off-the-shelf bundle.",
  systems: [
    {
      id: "lead-response",
      name: "RSG Brokerage Lead Response System",
      outcome:
        "Every portal lead, sign call, and website inquiry answered in seconds and owned by a named agent.",
      capabilities: [
        "Capture from every portal, IDX form, and tracked phone number into one record with its source intact",
        "First outbound message within seconds, day or night, from the assigned agent",
        "Round-robin routing with a timed claim window and automatic escalation",
        "Standard qualifying sequences tuned per source and intent",
        "Live calendar availability offered inside the conversation",
        "After-hours and missed-call text-back on every tracked line",
      ],
      timeline: "3–5 weeks",
      pricing: "Custom quote",
      integrations: ["Follow Up Boss", "BoldTrail (kvCORE)", "Zillow Premier Agent", "Realtor.com Connections Plus", "Sierra Interactive"],
      flagship: true,
    },
    {
      id: "showing-coordination",
      name: "RSG Showing & Appointment Coordination System",
      outcome:
        "Showings booked, confirmed, and fed back to the seller without a single round of phone tag.",
      capabilities: [
        "Showing requests confirmed against live availability with all three parties notified",
        "Access events reconciled against scheduled showings",
        "Feedback requested automatically after each showing",
        "Weekly seller summaries built from showing counts and buyer feedback",
        "Alerts on listings with no showing activity or no feedback in seven days",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["ShowingTime", "BrokerBay", "SentriLock", "Google Workspace (Gmail & Calendar)"],
    },
    {
      id: "listing-pipeline",
      name: "RSG Listing Pipeline System",
      outcome:
        "Signed listings that go live on schedule, with every vendor, disclosure, and syndication tracked.",
      capabilities: [
        "Pre-appointment packets with comparables and a net sheet sent automatically",
        "Vendor scheduling triggered by the signed agreement",
        "Pre-list checklists with an owner and a due date on every task",
        "Agreement signature tracking with staged follow-up on unsigned envelopes",
        "Syndication verification with alerts when a portal hasn't picked the listing up",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["CloudCMA", "DocuSign", "MLS / RESO Web API", "Dotloop"],
    },
    {
      id: "transaction-coordination",
      name: "RSG Transaction Coordination System",
      outcome:
        "Every contingency deadline visible and alerted before it expires, across every file in the brokerage.",
      capabilities: [
        "Contingency dates calculated from the executed contract and watched automatically",
        "Escalating alerts at five days, three days, and twenty-four hours",
        "Document chase sequences per responsible party until the checklist clears",
        "Offer intake logged against the listing with terms summarized side by side",
        "Closing checklists, file archival, and automatic handoff to the past-client track",
      ],
      timeline: "4–8 weeks",
      pricing: "Custom quote",
      integrations: ["Dotloop", "SkySlope", "DocuSign", "Brokermint"],
    },
    {
      id: "sphere-engine",
      name: "RSG Sphere & Past-Client Engine",
      outcome:
        "A past-client database that produces repeat and referral business on a schedule instead of on a hunch.",
      capabilities: [
        "Closing-anniversary touches with neighborhood equity updates",
        "Structured referral asks timed to the moment goodwill peaks",
        "Just-listed and just-sold announcements to the sphere around a property",
        "Referral source recorded on every lead the sphere produces",
        "Review requests that capture feedback privately before asking publicly",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Follow Up Boss", "BoldTrail (kvCORE)", "Brokermint"],
    },
    {
      id: "buyer-nurture",
      name: "RSG Buyer Nurture & Long-Timeline Follow-Up System",
      outcome:
        "Long-timeline buyers kept warm by the system until they are ready, instead of dropped at ninety days.",
      capabilities: [
        "Segmentation by area, price band, and stated timeline",
        "Market notes tied to the buyer's own saved search rather than generic newsletters",
        "Automatic return to the active pipeline on any reply",
        "Quiet-period detection that flags a nurtured lead going fully cold",
      ],
      timeline: "2–4 weeks",
      pricing: "Custom quote",
      integrations: ["BoldTrail (kvCORE)", "Sierra Interactive", "Follow Up Boss", "BoomTown"],
    },
    {
      id: "performance-platform",
      name: "RSG Brokerage Performance & Attribution Platform",
      outcome:
        "Every closing traced back to the source and the agent activity that produced it.",
      capabilities: [
        "Closed-file and commission data consolidated into production reporting",
        "Source attribution carried from capture through to closing",
        "Activity-to-closing reporting per agent, per team, and per office",
        "Cost per closing by lead source, so renewal decisions have evidence behind them",
        "Exception alerts when an agent's or a source's numbers break trend",
      ],
      timeline: "3–6 weeks",
      pricing: "Custom quote",
      integrations: ["Brokermint", "Follow Up Boss", "MLS / RESO Web API", "BoomTown"],
    },
  ],

  integrations: {
    intro:
      "RSG systems connect to the platforms you already run rather than replacing them. These are the integrations we most commonly build against in brokerage engagements.",
    disclaimer:
      "Integration availability depends on each platform's API, plan tier, and account permissions — and, for listing data, on your MLS's participation agreement — all verified during scoping. RSG builds and maintains these connections on your behalf and does not claim official partnerships with any platform listed here.",
    items: [
      {
        name: "Follow Up Boss",
        category: "CRM",
        connects:
          "Keeps lead records, stage, assignment, and action plans in sync with response, routing, and appointment automation.",
      },
      {
        name: "BoldTrail (kvCORE)",
        category: "CRM & IDX website",
        connects:
          "Feeds website behavior, saved searches, and smart-campaign membership into lead scoring, routing, and nurture segmentation.",
      },
      {
        name: "Sierra Interactive",
        category: "CRM & IDX website",
        connects:
          "Pushes site inquiries and property-view history into the response system and the long-timeline buyer track.",
      },
      {
        name: "BoomTown",
        category: "Lead generation & CRM",
        connects:
          "Feeds sourced leads and agent activity into attribution and accountability reporting.",
      },
      {
        name: "Zillow Premier Agent",
        category: "Portal lead source",
        connects:
          "Captures inbound buyer and seller connections with the source intact, so speed-to-lead and attribution both work.",
      },
      {
        name: "Realtor.com Connections Plus",
        category: "Portal lead source",
        connects:
          "Captures, routes, and attributes portal inquiries to closed volume rather than counting them as impressions.",
      },
      {
        name: "MLS / RESO Web API",
        category: "Listing data",
        connects:
          "Keeps listing status, price changes, and comparables current for availability answers and seller updates, within your MLS's display rules.",
      },
      {
        name: "ShowingTime",
        category: "Showing scheduling",
        connects:
          "Flows showing requests, confirmations, and agent feedback into seller update summaries automatically.",
      },
      {
        name: "BrokerBay",
        category: "Showing management",
        connects:
          "Keeps brokerage-managed showing requests and access windows in one calendar with the rest of the team's day.",
      },
      {
        name: "SentriLock",
        category: "Lockbox & access records",
        connects:
          "Confirms a showing actually occurred from the access event and triggers the feedback request without anyone typing it in.",
      },
      {
        name: "Dotloop",
        category: "Transaction management & e-sign",
        connects:
          "Drives deadline alerts and party-by-party status updates from loop milestones and contingency dates.",
      },
      {
        name: "SkySlope",
        category: "Transaction management & broker review",
        connects:
          "Surfaces file checklist status and broker-review flags as tasks before they become compliance findings.",
      },
      {
        name: "DocuSign",
        category: "E-signature",
        connects:
          "Drives follow-up from envelope status: sent, viewed, and unsigned agreements each get their own reminder path.",
      },
      {
        name: "CloudCMA",
        category: "CMA & net sheets",
        connects:
          "Generates and delivers comparable and net-sheet packets ahead of the listing appointment.",
      },
      {
        name: "Brokermint",
        category: "Back office & commissions",
        connects:
          "Consolidates closed-file and commission data into production reporting by agent, team, and source.",
      },
      {
        name: "Google Workspace (Gmail & Calendar)",
        category: "Communication & scheduling",
        connects:
          "Keeps agent calendars, appointment availability, and threaded client email in one system rather than two.",
      },
    ],
  },

  compliance: {
    title: "Compliance & risk, designed in from the start",
    intro:
      "Brokerages carry licensing, fair-housing, and consumer-contact obligations that most software simply ignores, and automation makes every one of them easier to breach at scale. These are the controls we design into every brokerage engagement.",
    disclaimer:
      "RSG does not provide legal, medical, or regulatory advice. Compliance is a property of your complete implementation — the vendors you choose, the procedures you follow, your MLS's rules, and how your agents operate day to day — not of any single tool. Verify your specific obligations with qualified counsel and your broker of record.",
    items: [
      {
        title: "Fair Housing and steering risk in automation",
        detail:
          "No automated message, audience filter, or AI reply may reference or infer a protected class. Segmentation is built on transaction stage, consent, and stated preferences — never demographics, and never neighborhood language that functions as a proxy for them. Campaign copy is human-reviewed before anything sends.",
      },
      {
        title: "TCPA and Do-Not-Call obligations",
        detail:
          "Automated calling and texting to numbers you have no documented consent for carries per-message statutory exposure, and volume is exactly what makes it expensive. We capture consent with a timestamp and a source, honor an internal do-not-call list across every sequence, enforce quiet hours, and make opt-out immediate and global.",
      },
      {
        title: "License, brokerage, and advertising disclosure",
        detail:
          "Required license numbers, brokerage name, and state-specific disclosures are appended to outbound templates and agent-branded pages by the system rather than left to each agent's signature block. Team names and branding follow your state's team-name rules.",
      },
      {
        title: "MLS rules and IDX display",
        detail:
          "Listing data use is governed by your MLS's participation agreement: display requirements, attribution, refresh cadence, and limits on redistribution. Integrations read through sanctioned feeds — we do not scrape — and marketing automations are designed to stay inside what your MLS permits.",
      },
      {
        title: "Agency disclosure timing",
        detail:
          "The system prompts for the agency disclosure at the point your state requires it, and no automation advances a client past a step that requires it. Automated replies also recognize an already-represented consumer and stop rather than soliciting them.",
      },
      {
        title: "E-signature validity and record retention",
        detail:
          "ESIGN- and UETA-compliant signature providers, and a written retention schedule for transaction files that matches your state's requirement — rather than files aging indefinitely inside one agent's personal inbox.",
      },
      {
        title: "Wire-fraud and earnest-money controls",
        detail:
          "No automation ever transmits wire instructions. Client-facing messages about funds carry a fraud warning and point to a verified callback procedure. Money movement stays a human decision with an audit trail behind it.",
      },
      {
        title: "Independent-contractor agent access",
        detail:
          "Agents and the brokerage often have competing claims on the same records. Role-based permissions, a written record of what is agent-owned versus brokerage-owned, an export policy, and same-day revocation on departure — agreed before anything is built.",
      },
      {
        title: "AI disclosure and scope limits",
        detail:
          "Automated assistants identify themselves as automated, never provide legal advice, and never give a valuation or an opinion of price — those hand off to a licensed agent. This is designed in as a hard boundary, not prompted in as a suggestion.",
      },
      {
        title: "Vendor records and client PII",
        detail:
          "Transaction files carry financial documents and often government identifiers. Every platform that touches them belongs on a written subprocessor list stating what it holds and why, with a defined retention schedule attached.",
      },
    ],
  },

  caseStudy: {
    label: "Illustrative scenario — not a client result",
    businessType: "Residential brokerage with a listing team and a buyer team",
    size: "18 agents across two offices, roughly 240 closed transactions a year, one transaction coordinator and a part-time admin",
    problem:
      "Portal leads were answered in an average of 55 minutes, and only when someone happened to be on floor duty. Showings were coordinated by text between three parties. The coordinator's contingency spreadsheet was the only record of every deadline in the brokerage, and she was the only person who could read it. A 2,600-name past-client database had received one holiday email in eighteen months, and nobody could say which of five paid sources produced last quarter's closings.",
    currentStack: ["Follow Up Boss", "ShowingTime", "Dotloop", "Google Workspace", "Excel"],
    implementation: [
      "Deploy the RSG Brokerage Lead Response System across every portal, the IDX site, and the tracked sign-call lines, with round-robin routing and a five-minute claim window.",
      "Layer the RSG Showing & Appointment Coordination System over ShowingTime so requests, confirmations, and feedback reach all three parties without a text thread.",
      "Move every contingency date out of the spreadsheet into the RSG Transaction Coordination System, with escalating alerts and per-party document chases.",
      "Launch the RSG Sphere & Past-Client Engine — closing anniversaries, equity updates, and a structured referral ask — against the full 2,600-name database.",
      "Replace end-of-quarter guesswork with the RSG Brokerage Performance & Attribution Platform, carrying source attribution from capture through to closing.",
    ],
    beforeWorkflow: [
      "A portal lead arrives at 9 PM and gets a first reply the following mid-morning, after three competing agents.",
      "A showing takes four messages across three people to schedule, and often loses the slot anyway.",
      "Six buyers tour a listing in a week and the seller hears nothing until she calls to ask.",
      "The inspection deadline is safe because one person remembered to open the spreadsheet that morning.",
      "The past-client database gets one holiday email a year and produces referrals by accident.",
      "Portal spend is renewed each year because it was renewed last year.",
    ],
    afterWorkflow: [
      "Every lead gets a real qualifying message within seconds and a named owner within five minutes, or it escalates.",
      "Showing requests are confirmed against live availability with all three parties notified automatically.",
      "Buyer feedback is captured after each showing and reaches the seller in a weekly summary she can act on.",
      "Every contingency date is calculated from the contract and alerts at five days, three days, and twenty-four hours.",
      "Past clients receive anniversary and equity touches on a schedule, with the referral ask timed to the moment goodwill peaks.",
      "Every closing carries its source, so next quarter's lead budget is set from attributed closings rather than habit.",
    ],
    timeline:
      "10–14 weeks from scoping to full rollout, phased team by team so no agent loses access to a live pipeline mid-transaction.",
    kpis: [
      "Median speed to lead",
      "Lead → appointment rate",
      "Appointment → agreement rate",
      "Days from signed agreement to live listing",
      "Contingency deadlines missed",
      "Repeat and referral share of closings",
      "Source-attributed closings",
    ],
    projections: [
      {
        label: "Speed to lead (modeled)",
        value:
          "First response modeled as moving from tens of minutes to under five, by removing the dependency on someone being at a desk",
      },
      {
        label: "Appointment set rate (modeled)",
        value:
          "A share of currently unanswered or slowly answered leads modeled as converting to appointments once the first response is immediate and owned",
      },
      {
        label: "Missed contingency deadlines (modeled)",
        value:
          "Missed dates modeled as approaching zero once deadlines are calculated from the contract and alerted three times rather than watched by one person",
      },
      {
        label: "Coordinator hours per file (modeled)",
        value:
          "Time spent chasing documents and re-confirming dates modeled as falling substantially once chases run per party until the checklist clears",
      },
    ],
    projectionNote:
      "This is an illustrative scenario, not a measured result from a real engagement. It shows the shape of the problem and the systems that address it, and is not a promise or guarantee of any particular outcome.",
  },

  ctas: {
    primary: {
      label: "Assess Your Brokerage's Lead Response and Transaction Flow",
      href: "#assessment",
    },
    secondary: [
      { label: "Map My Brokerage Workflow", href: "#workflow" },
      { label: "Explore the Brokerage Operations Demo", href: "/demos/realestate" },
      { label: "Build My Brokerage System", href: "/book" },
    ],
  },

  assessment: {
    title: "Brokerage Lead Response & Transaction Assessment",
    intro:
      "Twelve questions, about three minutes. Your answers show where leads, showings, and deadlines are falling through the gaps between your systems — and which RSG system addresses the biggest gap first. No obligation follows.",
    questions: [
      {
        id: "brokerage-type",
        label: "What best describes your business?",
        type: "select",
        options: [
          "Solo agent",
          "Agent team inside a brokerage",
          "Independent brokerage",
          "Franchise brokerage",
          "Multi-office brokerage",
        ],
        required: true,
      },
      {
        id: "agent-count",
        label: "How many agents are on the team?",
        type: "select",
        options: ["Just me", "2–5 agents", "6–15 agents", "16–40 agents", "41+ agents"],
        required: true,
      },
      {
        id: "annual-transactions",
        label: "Roughly how many transactions did you close last year?",
        type: "number",
        placeholder: "e.g. 240",
        required: true,
      },
      {
        id: "buyer-seller-mix",
        label: "What is your buyer-to-seller mix?",
        type: "select",
        options: [
          "Mostly buyers",
          "Mostly listings",
          "Roughly even",
          "Shifting toward listings",
        ],
      },
      {
        id: "crm",
        label: "Which CRM does the team run on?",
        type: "select",
        options: [
          "Follow Up Boss",
          "BoldTrail / kvCORE",
          "Sierra Interactive",
          "BoomTown",
          "Something else",
          "No CRM today",
        ],
        required: true,
      },
      {
        id: "lead-sources",
        label: "Where does most of your business come from today?",
        type: "select",
        options: [
          "Paid portals",
          "The team's own IDX website",
          "Sphere and referrals",
          "Open houses and sign calls",
          "Paid social and search",
          "No single dominant source",
        ],
        required: true,
      },
      {
        id: "speed-to-lead",
        label: "How quickly does a new lead typically get a first response?",
        type: "select",
        options: [
          "Within five minutes, consistently",
          "Within the hour during business hours",
          "Same day, usually",
          "Next business day",
          "Honestly, it varies a lot",
        ],
        required: true,
      },
      {
        id: "showing-process",
        label: "How are showings scheduled today?",
        type: "select",
        options: [
          "A showing platform, used consistently",
          "A showing platform, used inconsistently",
          "Text and phone between agents",
          "The listing agent coordinates each one by hand",
        ],
      },
      {
        id: "transaction-coordination",
        label: "How are contract deadlines tracked?",
        type: "select",
        options: [
          "Transaction management software with date alerts",
          "Transaction software, but dates watched manually",
          "A shared spreadsheet",
          "The coordinator's own system",
          "Each agent tracks their own",
        ],
        required: true,
      },
      {
        id: "past-client-nurture",
        label: "What happens with past clients after closing?",
        type: "select",
        options: [
          "A structured multi-year plan runs automatically",
          "Occasional campaigns when someone gets to it",
          "A holiday card and not much else",
          "Whatever the individual agent chooses to do",
          "Nothing consistent",
        ],
      },
      {
        id: "attribution",
        label: "Can you say which source produced last quarter's closings?",
        type: "select",
        options: [
          "Yes, down to cost per closing",
          "Roughly, from memory and spot checks",
          "Only total lead counts, not closings",
          "No, we renew spend on judgment",
        ],
      },
      {
        id: "biggest-bottleneck",
        label: "What is the biggest operational bottleneck right now?",
        type: "select",
        options: [
          "Lead response speed & routing",
          "Showing scheduling & seller feedback",
          "Listing pipeline & time to market",
          "Transaction deadlines & document chasing",
          "Past-client & referral nurture",
          "Agent accountability & reporting",
        ],
        required: true,
        helper: "This weighs most heavily in the recommendation.",
      },
    ],
    // Keywords are full distinctive phrases from the biggest-bottleneck options,
    // and appear in no other option anywhere in the questionnaire. recommendSystem
    // flattens every answer into one haystack and takes the first match, so a
    // short keyword like "routing" or "nurture" would collide across questions.
    recommendations: [
      { keywords: ["response speed & routing"], systemId: "lead-response" },
      { keywords: ["showing scheduling & seller"], systemId: "showing-coordination" },
      { keywords: ["listing pipeline & time"], systemId: "listing-pipeline" },
      { keywords: ["deadlines & document chasing"], systemId: "transaction-coordination" },
      { keywords: ["past-client & referral nurture"], systemId: "sphere-engine" },
      { keywords: ["accountability & reporting"], systemId: "performance-platform" },
    ],
    fallbackSystemId: "lead-response",
  },

  faqs: [
    {
      q: "Do you replace our CRM or transaction platform?",
      a: "No — RSG systems connect to what you already run: Follow Up Boss, BoldTrail, Sierra Interactive, BoomTown, Dotloop, SkySlope, and the platforms around them. Replacing a core platform mid-season is a large, disruptive project we would only recommend if scoping shows it is genuinely necessary, and the decision stays yours.",
    },
    {
      q: "Will this work with our MLS and IDX feed?",
      a: "Usually, and it depends on your MLS's participation agreement, your IDX vendor, and what your feed actually permits. We verify every connection against your real accounts during scoping, before anything is built or billed. We work through sanctioned feeds and do not scrape listing data.",
    },
    {
      q: "Our agents are independent contractors and guard their databases. How does this work?",
      a: "That tension is real and it gets settled in writing before anything is built: role-based access, a defined split between agent-owned and brokerage-owned records, an export policy, and revocation on departure. Agents keep what is theirs; the brokerage keeps a transaction record it can actually produce when it needs to.",
    },
    {
      q: "Doesn't automated texting create TCPA exposure?",
      a: "It can, and volume is exactly what makes it expensive — which is why consent capture with a timestamp and source, an internal do-not-call list, quiet hours, and immediate global opt-out are built in rather than bolted on. We design and implement the controls; you and your counsel own the policy behind them.",
    },
    {
      q: "How do you keep automated marketing Fair Housing compliant?",
      a: "Segments are built on transaction stage, consent, and stated preferences only — never demographics, and never neighborhood language used as a proxy for them. Campaign copy is human-reviewed before it sends, and automated replies are scoped so they cannot volunteer an opinion about who belongs where.",
    },
    {
      q: "How long does it take, and how does pricing work?",
      a: "A single focused system, such as showing coordination or long-timeline buyer nurture, typically takes 2–4 weeks. The core lead response and transaction stack runs 4–8 weeks, and a full brokerage rollout is phased over 10–14 weeks by team so nobody loses a live pipeline mid-transaction. Every engagement is a custom quote written after a fixed, written scope. We don't publish flat prices because they would be wrong in one direction or the other for most brokerages.",
    },
  ],

  seo: {
    title: "Real Estate Brokerage and Agent Team Systems | Redmont Strategies",
    description:
      "Speed-to-lead response, showing coordination, listing pipeline, transaction deadline tracking, and past-client referral nurture — scoped, built, and run for residential brokerages and agent teams.",
  },
};
