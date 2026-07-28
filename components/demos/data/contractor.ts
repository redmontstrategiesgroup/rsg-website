import type { IndustryConfig } from "../types";
import {
  DEMO_APPOINTMENT_TYPES,
  DEMO_INTAKE_FIELDS,
  DEMO_SAMPLE_CUSTOMER,
  DEMO_SCHEDULE_DAYS,
  DEMO_TEMPLATES,
  DEMO_TERMINOLOGY,
} from "./shared";

/**
 * RSG Contractor Lead System — demo data for a fictional company,
 * "Hartwell Contracting". All names, numbers, and messages are sample data.
 */
export const contractorConfig: IndustryConfig = {
  slug: "contractors",
  industry: "Contractors & Home Services",
  systemName: "RSG Contractor Lead System",
  osName: "Contractor Lead System",
  businessName: "Hartwell Contracting",
  description:
    "A lead management and customer communication system that helps contractors respond faster, follow up on estimates, keep customers informed, and recover unclosed opportunities.",
  outcome: "Answer every estimate request fast — and stop losing quotes to silence.",
  problem:
    "Estimate requests come in while the crew is on a roof or under a sink. Quotes go out and nobody follows up. The jobs don't go to the best contractor — they go to the one who answered.",
  workflows: [
    "Instant estimate-request capture & assignment",
    "Automated quote follow-up sequences",
    "Visual job pipeline with real dollar value",
    "On-the-way and job-progress customer updates",
    "Seasonal & maintenance reactivation campaigns",
  ],
  accentLabel: "Lead & Job Management",
  terminology: {
    ...DEMO_TERMINOLOGY,
    record: "lead",
    records: "Leads",
    appointment: "Estimate",
    appointments: "Estimates",
  },
  leadsLabel: "Leads & jobs",
  staff: [
    { id: "staff-mike", name: "Mike (sales)", role: "Sales & quotes" },
    { id: "staff-dave", name: "Dave (estimator)", role: "Estimator" },
    { id: "staff-sam", name: "Sam (crew lead)", role: "Crew lead" },
    { id: "staff-office", name: "Office", role: "Admin & dispatch" },
  ],
  roles: [
    {
      id: "owner",
      label: "Owner",
      description: "Full access — pipeline value, campaigns, analytics, and settings.",
      nav: [
        "overview", "leads", "pipeline", "conversations", "receptionist", "quotes",
        "automations", "tasks", "calendar", "reviews", "campaigns", "analytics", "settings",
      ],
    },
    {
      id: "manager",
      label: "Office manager",
      description: "Runs intake, scheduling, quotes, and customer communication.",
      nav: [
        "overview", "leads", "pipeline", "conversations", "receptionist", "quotes",
        "tasks", "calendar", "reviews",
      ],
    },
    {
      id: "staff",
      label: "Estimator / crew",
      description: "Sees the day's schedule, assigned leads, and open tasks.",
      nav: ["overview", "leads", "tasks", "calendar"],
    },
  ],
  nav: [
    { id: "overview", label: "Overview" },
    { id: "leads", label: "Leads" },
    { id: "pipeline", label: "Pipeline" },
    { id: "conversations", label: "Conversations" },
    { id: "receptionist", label: "AI Receptionist" },
    { id: "quotes", label: "Quotes" },
    { id: "automations", label: "Automations" },
    { id: "tasks", label: "Tasks" },
    { id: "calendar", label: "Schedule & Dispatch" },
    { id: "reviews", label: "Reviews" },
    { id: "campaigns", label: "Campaigns" },
    { id: "analytics", label: "Analytics" },
    { id: "settings", label: "Settings" },
  ],
  metrics: [
    { id: "requests", label: "New estimate requests", value: 18, delta: "+5 this week", deltaDir: "up" },
    { id: "response", label: "Avg response time", value: 4, format: "minutes", delta: "-3.1 hrs", deltaDir: "down", deltaGood: true, hint: "Was 3+ hours before automation" },
    { id: "estimates", label: "Estimates scheduled", value: 11, delta: "+3", deltaDir: "up" },
    { id: "quotes-sent", label: "Quotes sent", value: 14 },
    { id: "quotes-waiting", label: "Quotes awaiting response", value: 6, hint: "Follow-up automation active" },
    { id: "pipeline-value", label: "Pipeline value", value: 214000, format: "currency", delta: "+$38k", deltaDir: "up" },
    { id: "jobs-won", label: "Jobs won this month", value: 7, delta: "+2", deltaDir: "up" },
    { id: "followups", label: "Follow-ups due", value: 4, hint: "Automated unless a rep replies first" },
  ],
  stages: [
    { id: "new", label: "New Lead" },
    { id: "contacted", label: "Contacted" },
    { id: "est-scheduled", label: "Estimate Scheduled" },
    { id: "quote-sent", label: "Quote Sent" },
    { id: "follow-up", label: "Follow-Up" },
    { id: "approved", label: "Approved" },
    { id: "scheduled", label: "Job Scheduled" },
    { id: "in-progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
  ],
  leads: [
    { id: "l-obrien", name: "Tom O'Brien", service: "Kitchen remodel", source: "Google LSA", stageId: "quote-sent", value: 42000, lastActivity: "2 days ago", temp: "warm", note: "Quote sent Tue — day-2 follow-up scheduled" },
    { id: "l-castillo", name: "Elena Castillo", service: "Roof replacement", source: "Website form", stageId: "est-scheduled", value: 18500, lastActivity: "Today 8:40 AM", temp: "hot" },
    { id: "l-freeman", name: "Doug Freeman", service: "Bathroom renovation", source: "Referral", stageId: "follow-up", value: 23000, lastActivity: "5 days ago", temp: "warm", note: "Opened quote twice — no reply. Final check-in queued" },
    { id: "l-patel", name: "Anita Patel", service: "Composite deck — 320 sq ft", source: "Facebook ad", stageId: "contacted", value: 19800, lastActivity: "1 hr ago", temp: "hot" },
    { id: "l-sullivan", name: "Mark Sullivan", service: "Siding repair", source: "Missed call", stageId: "new", value: 6500, lastActivity: "3 hrs ago", temp: "warm", note: "Text-back sent — awaiting details" },
    { id: "l-webb", name: "Carrie Webb", service: "Basement finish", source: "Website form", stageId: "approved", value: 54000, lastActivity: "Yesterday" },
    { id: "l-morris", name: "James & Kate Morris", service: "Screened porch addition", source: "Repeat customer", stageId: "scheduled", value: 31000, lastActivity: "Yesterday" },
    { id: "l-diaz", name: "Robert Diaz", service: "Fence installation", source: "Google LSA", stageId: "in-progress", value: 8900, lastActivity: "Today 7:05 AM" },
    { id: "l-chen", name: "Lisa Chen", service: "Window replacement (9 units)", source: "Reactivation", stageId: "completed", value: 12400, lastActivity: "Last Friday" },
  ],
  conversations: [
    {
      id: "c-obrien",
      contact: "Tom O'Brien",
      channel: "sms",
      topic: "Kitchen remodel — quote follow-up",
      messages: [
        { id: "ob-1", from: "system", meta: "Automated · Quote delivery", text: "Hi Tom, your kitchen remodel quote from Hartwell Contracting is ready: hartwell.demo/quote/2481. Mike is happy to walk through it — just reply here with any questions.", time: "Tue 4:12 PM" },
        { id: "ob-2", from: "system", meta: "Automated · Day-2 follow-up", text: "Hi Tom, checking in on the kitchen quote we sent Tuesday. Happy to adjust scope or phase the work if that helps — want Mike to give you a call?", time: "Today 9:00 AM" },
      ],
    },
    {
      id: "c-castillo",
      contact: "Elena Castillo",
      channel: "sms",
      topic: "Roof replacement — estimate visit",
      unread: true,
      messages: [
        { id: "ec-1", from: "system", meta: "Automated · Confirmation", text: "Hi Elena, you're confirmed for a roof estimate this Thursday, 9–10 AM. Dave, our estimator, will text when he's on the way.", time: "Yesterday 3:30 PM" },
        { id: "ec-2", from: "system", meta: "Automated · On-the-way", text: "Good morning Elena — Dave is on the way and should arrive around 9:05 AM. He'll be in a gray Hartwell truck.", time: "Today 8:40 AM" },
        { id: "ec-3", from: "contact", text: "Great, I'll be home. Gate code is 4482", time: "Today 8:47 AM" },
      ],
    },
    {
      id: "c-sullivan",
      contact: "Mark Sullivan",
      channel: "sms",
      topic: "Missed call — siding repair",
      messages: [
        { id: "ms-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, this is Hartwell Contracting — sorry we missed your call! We're out on job sites. What kind of project can we help with? Text a few details (and photos help).", time: "Today 11:20 AM" },
        { id: "ms-2", from: "contact", text: "Some siding came loose on the north side of the house after the storm. Maybe 40 sq ft?", time: "Today 11:34 AM" },
      ],
    },
    {
      id: "c-morris",
      contact: "James & Kate Morris",
      channel: "email",
      topic: "Screened porch — schedule confirmation",
      messages: [
        { id: "jm-1", from: "system", meta: "Automated · Job scheduled", text: "Your screened porch project is scheduled to start Monday, Jul 20. Materials arrive Friday. Your crew lead is Sam Ortiz — he'll introduce himself on day one.", time: "Yesterday 10:00 AM" },
        { id: "jm-2", from: "contact", text: "Perfect. Should we clear the patio furniture beforehand?", time: "Yesterday 11:15 AM" },
        { id: "jm-3", from: "staff", meta: "Sam (crew lead)", text: "Morning! If you can clear the small items we'll handle the heavy pieces when we arrive. See you Monday.", time: "Yesterday 12:02 PM" },
      ],
    },
  ],
  tasks: [
    { id: "t-freeman", title: "Final check-in call — Doug Freeman opened bathroom quote twice, no reply in 5 days", assignee: "Mike (sales)", due: "Today", priority: "high", auto: true },
    { id: "t-sullivan", title: "Review storm-damage photos from Mark Sullivan and price siding repair", assignee: "Dave (estimator)", due: "Today", auto: true },
    { id: "t-webb", title: "Send contract + deposit invoice — Carrie Webb basement finish ($54,000 approved)", assignee: "Office", due: "Today", priority: "high", auto: true },
    { id: "t-diaz", title: "Order gate hardware for Diaz fence job before final day", assignee: "Sam (crew lead)", due: "Tomorrow" },
    { id: "t-chen", title: "Review request follow-up — Lisa Chen hasn't clicked the link yet", assignee: "Office", due: "Wed", auto: true, done: true },
  ],
  activity: [
    { id: "a-1", icon: "message", text: "On-the-way text sent to Elena Castillo — estimator arriving 9:05 AM.", time: "8:40 AM" },
    { id: "a-2", icon: "automation", text: "Day-2 quote follow-up sent to Tom O'Brien ($42,000 kitchen remodel).", time: "9:00 AM" },
    { id: "a-3", icon: "call", text: "Missed call from Mark Sullivan — text-back sent in 45 seconds.", time: "11:20 AM" },
    { id: "a-4", icon: "task", text: "Photo review task assigned to Dave from Sullivan storm-damage reply.", time: "11:35 AM" },
    { id: "a-5", icon: "pipeline", text: "Carrie Webb approved the basement finish quote — moved to Approved.", time: "Yesterday 4:50 PM" },
    { id: "a-6", icon: "alert", text: "Quote aging alert: Doug Freeman at 5 days with no response.", time: "Yesterday 9:00 AM" },
    { id: "a-7", icon: "review", text: "Review request sent to Lisa Chen after window job completion.", time: "Friday 5:15 PM" },
    { id: "a-8", icon: "campaign", text: "Seasonal campaign queued: gutter & roof checks for past customers.", time: "Friday 8:00 AM" },
  ],
  calendar: [
    { id: "cal-1", day: "Thu", date: "Jul 16", time: "9:00 AM", title: "Roof estimate — Elena Castillo", withWhom: "Dave (estimator)", status: "confirmed" },
    { id: "cal-2", day: "Thu", date: "Jul 16", time: "1:30 PM", title: "Deck estimate — Anita Patel", withWhom: "Dave (estimator)", status: "pending" },
    { id: "cal-3", day: "Fri", date: "Jul 17", time: "7:00 AM", title: "Fence install — Diaz (final day)", withWhom: "Crew B", status: "confirmed" },
    { id: "cal-4", day: "Mon", date: "Jul 20", time: "7:30 AM", title: "Screened porch start — Morris residence", withWhom: "Crew A · Sam Ortiz", status: "confirmed" },
    { id: "cal-5", day: "Tue", date: "Jul 21", time: "10:00 AM", title: "Pre-construction walkthrough — Carrie Webb basement", withWhom: "Mike + Sam", status: "pending" },
  ],
  reviews: [
    { id: "r-1", name: "Lisa Chen", service: "Window replacement", status: "requested", time: "Friday" },
    { id: "r-2", name: "Paul & Denise Carter", service: "Roof replacement", status: "completed", rating: 5, note: "Crew showed up when they said they would, every day. Texted updates constantly.", time: "Last week" },
    { id: "r-3", name: "Greg Thornton", service: "Deck rebuild", status: "completed", rating: 5, note: "The only contractor who actually answered the phone.", time: "2 weeks ago" },
    { id: "r-4", name: "Marie Bissette", service: "Bathroom renovation", status: "flagged", note: "Happy with the work but cleanup on the last day was rushed.", time: "2 weeks ago" },
    { id: "r-5", name: "Alan Reyes", service: "Siding & trim", status: "completed", rating: 4, time: "3 weeks ago" },
  ],
  campaigns: [
    {
      id: "camp-1",
      name: "Unclosed estimates — 60 days",
      audience: "Quoted but never responded, last 60 days",
      filters: ["Stage: quote sent / follow-up", "No reply ≥ 14 days", "Quote value ≥ $5,000"],
      message: "Hi {first name}, Hartwell here. We quoted your {project} a few weeks back — budgets and timing change, so no pressure. Want us to re-price it, phase it, or close the file?",
      stats: { sent: 34, replied: 9, booked: 4 },
      status: "active",
    },
    {
      id: "camp-2",
      name: "Seasonal — fall gutter & roof checks",
      audience: "Past customers with exterior work 12+ months ago",
      filters: ["Customer: completed job", "Service: roofing / siding / gutters", "Last visit > 12 months"],
      message: "Hi {first name}, it's Hartwell Contracting. Fall's coming — we're booking gutter cleanings and roof checkups for past customers first. Want us to add you to the route?",
      stats: { sent: 88, replied: 26, booked: 15 },
      status: "active",
    },
    {
      id: "camp-3",
      name: "Cross-service — deck customers → power washing",
      audience: "Deck/porch customers from prior seasons",
      filters: ["Service history: deck or porch", "Job completed > 10 months", "No open quote"],
      message: "Hi {first name}! Your deck is due for a wash and reseal to keep the warranty happy. We're in your neighborhood the week of {date} — want a quick quote?",
      stats: { sent: 41, replied: 11, booked: 6 },
      status: "draft",
    },
  ],
  automations: [
    { id: "auto-1", kind: "intake", name: "Estimate request intake", trigger: "Website form, LSA, or Facebook lead submitted", steps: ["Create lead with project details & photos", "Send instant confirmation text", "Assign to estimator by service & territory", "Create follow-up task", "Add to estimate pipeline"], runsThisMonth: 47, status: "active" },
    { id: "auto-2", kind: "follow-up", name: "Quote follow-up sequence", trigger: "Quote marked sent", steps: ["Delivery confirmation with quote link", "Follow-up at day 2", "Follow-up at day 5", "Final check-in at day 10", "Pause instantly when a rep replies manually", "Notify sales when customer engages"], runsThisMonth: 31, status: "active" },
    { id: "auto-3", kind: "missed-call", name: "Missed-call text-back", trigger: "Office or cell line rings out", steps: ["Text back within 60 seconds", "Ask for project details & photos", "Create lead and assign", "Task the office if no reply in 2 hours"], runsThisMonth: 22, status: "active" },
    { id: "auto-4", kind: "updates", name: "Customer job updates", trigger: "Job status changes", steps: ["Estimate confirmed & on-the-way texts", "Job scheduled / delayed notices", "Progress updates at key milestones", "Completion + invoice notice"], runsThisMonth: 58, status: "active" },
    { id: "auto-5", kind: "review", name: "Post-job review request", trigger: "Job marked complete + invoice paid", steps: ["Send thank-you message", "Ask for feedback first", "Positive → send review link", "Concern → create office follow-up task"], runsThisMonth: 12, status: "active" },
    { id: "auto-6", kind: "reactivation", name: "Maintenance reactivation", trigger: "Monthly segment of past customers", steps: ["Segment by service & season", "Send neighborhood-route offer", "Route replies to office inbox"], runsThisMonth: 2, status: "active" },
  ],
  templates: DEMO_TEMPLATES,
  intakeFields: DEMO_INTAKE_FIELDS,
  quote: {
    title: "Instant project estimate",
    description:
      "The same calculator a homeowner can use on your website. Pick the project and options — the number updates live, and generated quotes become records with automated follow-up.",
    documentLabel: "Quote",
    base: { label: "Site visit, permits & project management", amount: 1800 },
    fields: [
      {
        id: "project",
        label: "Project type",
        options: [
          { label: "Composite deck (up to 300 sq ft)", amount: 14500 },
          { label: "Bathroom renovation", amount: 18500 },
          { label: "Kitchen remodel", amount: 34000 },
          { label: "Roof replacement (asphalt)", amount: 15500 },
          { label: "Siding repair", amount: 4200 },
        ],
      },
      {
        id: "scope",
        label: "Scope",
        options: [
          { label: "Standard", amount: 0 },
          { label: "Large / added square footage", amount: 6500 },
          { label: "Small / partial", amount: -2500 },
        ],
      },
      {
        id: "finish",
        label: "Finish level",
        options: [
          { label: "Builder grade", amount: 0 },
          { label: "Mid-range", amount: 3800 },
          { label: "Premium", amount: 9500 },
        ],
      },
      {
        id: "timeline",
        label: "Timeline",
        options: [
          { label: "Flexible", amount: 0 },
          { label: "Priority start (2–3 weeks)", amount: 1500 },
        ],
        helper: "Rush scheduling adds crew-overtime allowance.",
      },
    ],
    sentStageId: "quote-sent",
    acceptedStageId: "approved",
    disclaimer: "Demo calculator with sample pricing — real quotes are priced after a site visit.",
  },
  receptionist: {
    scenarioLabel: "After-hours call — storm damage",
    description: "It's 9:40 PM. The office line rings — every crew is home for the night.",
    callerRole: "a homeowner whose roof just started leaking",
    start: "greet",
    nodes: [
      {
        id: "greet",
        say: "Thanks for calling Hartwell Contracting — you've reached our automated assistant. The crews are off-site right now, but I can get your project moving tonight. What can we help with?",
        choices: [
          { id: "c-leak", label: "My roof is leaking after the storm — water's coming into the bedroom.", next: "triage" },
          { id: "c-deck", label: "I'd like an estimate for rebuilding my deck.", next: "deck-size" },
          { id: "c-hours", label: "What are your hours?", next: "hours" },
        ],
      },
      {
        id: "hours",
        say: "The office is staffed 7 AM to 5 PM, Monday through Saturday — but I can capture your project details and get you scheduled any time. Was there a project I can help with?",
        choices: [
          { id: "c-leak2", label: "Actually yes — my roof started leaking tonight.", next: "triage" },
          { id: "c-deck2", label: "Yes — a deck rebuild estimate.", next: "deck-size" },
        ],
      },
      {
        id: "triage",
        say: "That sounds urgent, so I'm flagging it for our on-call estimator right now. Roughly how much water is coming in?",
        meta: "Urgency detection",
        choices: [
          { id: "c-drip", label: "A slow drip near the window.", next: "address" },
          { id: "c-steady", label: "A steady stream — I've got a bucket under it.", next: "address" },
        ],
      },
      {
        id: "address",
        say: "Got it — I've noted the severity. What's the property address so I can route the right crew?",
        meta: "Collects job details",
        choices: [
          { id: "c-addr", label: "42 Colonial Drive, Marshfield.", next: "book" },
        ],
      },
      {
        id: "book",
        say: "Thanks — Dave covers Marshfield. I can have him out tomorrow at 8:00 AM to tarp and inspect, or I can page the emergency line tonight for an after-hours surcharge. Which works better?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-morning", label: "Tomorrow at 8 AM is fine.", next: "done-roof" },
          { id: "c-tonight", label: "Please send someone tonight.", next: "done-roof-tonight" },
        ],
      },
      {
        id: "done-roof",
        say: "You're booked: roof leak inspection, tomorrow 8:00 AM at 42 Colonial Drive with Dave. I've texted you a confirmation and sent Dave the storm-damage notes. If anything changes overnight, reply here any time.",
        outcome: {
          summary: [
            "A lead was created with the address, severity, and storm-damage notes attached.",
            "Tomorrow's 8:00 AM inspection was booked directly onto Dave's schedule.",
            "A prep task was assigned to Dave, and the whole call transcript landed in Conversations.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-roof", name: "Pat Delaney", service: "Roof leak — storm damage", source: "After-hours call", stageId: "est-scheduled", value: 8500, lastActivity: "Just now", temp: "hot", note: "Steady leak into bedroom · 42 Colonial Dr, Marshfield · AI receptionist booked 8 AM inspection", assignee: "Dave (estimator)" } },
            { kind: "calendar", event: { id: "cal-ai-roof", day: "Fri", date: "Jul 17", time: "8:00 AM", title: "Storm-damage inspection — Pat Delaney", withWhom: "Dave (estimator)", status: "confirmed" } },
            { kind: "task", task: { id: "t-ai-roof", title: "Review storm-damage call notes before 8 AM inspection — Pat Delaney (42 Colonial Dr)", assignee: "Dave (estimator)", due: "Tomorrow", priority: "high", auto: true } },
            { kind: "conversation", conversation: { id: "c-ai-roof", contact: "Pat Delaney", channel: "phone", topic: "After-hours call — roof leak", unread: true, messages: [
              { id: "ai-r-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call handled: roof leak (steady stream) at 42 Colonial Dr, Marshfield. Inspection booked Fri 8:00 AM with Dave. Caller notified of confirmation by text.", time: "Just now" },
            ] } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "metric", id: "estimates", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-roof", title: "After-hours call converted", body: "Pat Delaney — roof leak booked for 8 AM. No human touched it.", tone: "success" } },
          ],
        },
      },
      {
        id: "done-roof-tonight",
        say: "Understood — I've paged the on-call line and marked this as an emergency dispatch. Someone will call you back within 15 minutes to confirm tonight's visit. Your details and photos link are already in the job record.",
        outcome: {
          summary: [
            "An emergency lead was created and flagged hot, with the on-call estimator paged.",
            "A 15-minute callback task went to the on-call rotation.",
            "The call transcript and severity notes landed in Conversations for the crew.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-roof-em", name: "Pat Delaney", service: "Roof leak — emergency dispatch", source: "After-hours call", stageId: "contacted", value: 9800, lastActivity: "Just now", temp: "hot", note: "EMERGENCY — steady leak · 42 Colonial Dr, Marshfield · on-call paged by AI receptionist", assignee: "Dave (estimator)" } },
            { kind: "task", task: { id: "t-ai-roof-em", title: "URGENT: call Pat Delaney back within 15 min — emergency roof leak, 42 Colonial Dr", assignee: "Dave (estimator)", due: "Now", priority: "high", auto: true } },
            { kind: "conversation", conversation: { id: "c-ai-roof-em", contact: "Pat Delaney", channel: "phone", topic: "EMERGENCY — roof leak dispatch", unread: true, messages: [
              { id: "ai-re-1", from: "system", meta: "AI receptionist · call summary", text: "Emergency after-hours call: steady roof leak at 42 Colonial Dr, Marshfield. On-call estimator paged; caller promised a callback within 15 minutes.", time: "Just now" },
            ] } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-roof-em", title: "Emergency dispatch triggered", body: "Roof leak flagged urgent — on-call rotation paged. Simulated.", tone: "alert" } },
          ],
        },
      },
      {
        id: "deck-size",
        say: "Happy to help with that. Roughly how big is the deck, and are you thinking wood or composite?",
        meta: "Collects job details",
        choices: [
          { id: "c-deck-comp", label: "About 300 square feet — we'd like composite.", next: "deck-book" },
          { id: "c-deck-wood", label: "Smaller, maybe 180 square feet, pressure-treated wood.", next: "deck-book" },
        ],
      },
      {
        id: "deck-book",
        say: "Perfect — I've started your estimate file. Dave has Saturday 10:00 AM or Tuesday 1:30 PM open for an on-site measure. Which suits you?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-deck-sat", label: "Saturday at 10 works.", next: "done-deck" },
          { id: "c-deck-tue", label: "Tuesday afternoon, please.", next: "done-deck" },
        ],
      },
      {
        id: "done-deck",
        say: "You're all set — estimate visit booked with Dave. I've texted the confirmation, and you can reply with photos any time to speed up the quote. Thanks for calling Hartwell!",
        outcome: {
          summary: [
            "A deck-estimate lead was created with size and material preferences captured.",
            "The estimate visit was booked on Dave's schedule with confirmation and reminders queued.",
            "The transcript is in Conversations, so no detail is lost between the call and the visit.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-deck", name: "Chris Nolan", service: "Deck rebuild — estimate", source: "After-hours call", stageId: "est-scheduled", value: 16800, lastActivity: "Just now", temp: "warm", note: "~300 sq ft composite · booked via AI receptionist after hours", assignee: "Dave (estimator)" } },
            { kind: "calendar", event: { id: "cal-ai-deck", day: "Sat", date: "Jul 18", time: "10:00 AM", title: "Deck estimate — Chris Nolan", withWhom: "Dave (estimator)", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-deck", contact: "Chris Nolan", channel: "phone", topic: "After-hours call — deck estimate", messages: [
              { id: "ai-d-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call handled: ~300 sq ft composite deck rebuild. Estimate visit booked Sat 10:00 AM with Dave. Photo request sent by text.", time: "Just now" },
            ] } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "metric", id: "estimates", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-deck", title: "After-hours estimate booked", body: "Chris Nolan — deck rebuild, Saturday 10 AM. Captured while everyone slept.", tone: "success" } },
          ],
        },
      },
    ],
  },
  appointmentTypes: DEMO_APPOINTMENT_TYPES,
  scheduleDays: DEMO_SCHEDULE_DAYS,
  sampleCustomer: DEMO_SAMPLE_CUSTOMER,
  analytics: {
    volume: {
      title: "Estimate requests per week",
      unit: "requests",
      points: [
        { label: "W1", value: 9 }, { label: "W2", value: 11 }, { label: "W3", value: 10 },
        { label: "W4", value: 14 }, { label: "W5", value: 12 }, { label: "W6", value: 15 },
        { label: "W7", value: 16 }, { label: "W8", value: 18 },
      ],
    },
    responseTime: {
      title: "Average response time (minutes)",
      unit: "minutes",
      points: [
        { label: "W1", value: 190 }, { label: "W2", value: 140 }, { label: "W3", value: 85 },
        { label: "W4", value: 40 }, { label: "W5", value: 18 }, { label: "W6", value: 9 },
        { label: "W7", value: 6 }, { label: "W8", value: 4 },
      ],
    },
    funnel: {
      title: "Request → job funnel (8 weeks)",
      points: [
        { label: "Estimate requests", value: 105 },
        { label: "Estimates completed", value: 74 },
        { label: "Quotes sent", value: 61 },
        { label: "Quotes answered", value: 44 },
        { label: "Jobs won", value: 27 },
      ],
    },
    sources: [
      { name: "Google LSA / search", leads: 38, booked: 12 },
      { name: "Website form", leads: 24, booked: 8 },
      { name: "Referrals & repeat", leads: 18, booked: 9 },
      { name: "Facebook ads", leads: 14, booked: 3 },
      { name: "Missed calls", leads: 11, booked: 4 },
    ],
    kpis: [
      { id: "k-1", label: "Quote close rate", value: 44, format: "percent", delta: "+12 pts", deltaDir: "up" },
      { id: "k-2", label: "Avg response time", value: 4, format: "minutes", delta: "-3.1 hrs", deltaDir: "down", deltaGood: true },
      { id: "k-3", label: "Quotes revived by follow-up", value: 9, delta: "+9", deltaDir: "up" },
      { id: "k-4", label: "Pipeline value", value: 214000, format: "currency", delta: "+$38k", deltaDir: "up" },
    ],
  },
  scenario: {
    title: "A $19k deck request comes in — watch it survive the follow-up gap.",
    intro:
      "The problem: quotes go out, homeowners go quiet, and nobody has time to chase. Run the scenario to watch a deck renovation go from web form to approved job — including the silence in the middle.",
    steps: [
      {
        id: "s-1",
        title: "A homeowner submits an estimate request",
        detail: "Brian Kowalski fills out the website form: deck renovation, ~300 sq ft, budget range, three photos, prefers text.",
        tab: "leads",
        effects: [
          { kind: "lead", lead: { id: "l-brian", name: "Brian Kowalski", service: "Deck renovation — 300 sq ft", source: "Website form", stageId: "new", value: 19500, lastActivity: "Just now", temp: "hot", note: "Budget $15–25k · timeline: this summer · 3 photos attached" } },
          { kind: "metric", id: "requests", delta: 1 },
          { kind: "activity", item: { id: "a-s1", icon: "automation", text: "New estimate request: Brian Kowalski — deck renovation with photos.", time: "Just now" } },
        ],
      },
      {
        id: "s-2",
        title: "The lead enters the system",
        detail: "Project details, budget, timeline, and photos land in one record — not in an inbox someone checks after 5 PM.",
        tab: "pipeline",
        effects: [
          { kind: "notify", notification: { id: "n-s2", title: "New lead assigned", body: "Brian Kowalski (deck, $15–25k budget) auto-assigned to Dave.", tone: "success" } },
        ],
      },
      {
        id: "s-3",
        title: "An instant confirmation text goes out",
        detail: "Brian hears back in under a minute — while every other contractor's voicemail is still full.",
        tab: "conversations",
        effects: [
          {
            kind: "conversation",
            conversation: {
              id: "c-brian",
              contact: "Brian Kowalski",
              channel: "sms",
              topic: "Deck renovation — estimate request",
              unread: true,
              messages: [
                { id: "bk-1", from: "system", meta: "Automated · Intake confirmation", text: "Hi Brian, thanks for the deck renovation request — photos received. This is Hartwell Contracting. Dave, our estimator, covers your area. Want to grab an estimate time now? hartwell.demo/schedule", time: "Just now" },
              ],
            },
          },
          { kind: "activity", item: { id: "a-s3", icon: "message", text: "Confirmation text sent to Brian Kowalski — response time: 52 seconds.", time: "Just now" } },
        ],
      },
      {
        id: "s-4",
        title: "The lead is assigned to an estimator",
        detail: "Dave gets the job by territory and trade, with photos and budget attached. A follow-up task is created automatically.",
        tab: "tasks",
        effects: [
          { kind: "task", task: { id: "t-brian", title: "Review deck photos & confirm scope before Saturday estimate — Brian Kowalski", assignee: "Dave (estimator)", due: "Fri", auto: true } },
          { kind: "stage", leadId: "l-brian", stageId: "contacted" },
        ],
      },
      {
        id: "s-5",
        title: "An estimate visit is booked",
        detail: "Brian picks Saturday at 10 AM from the live schedule. Confirmation and reminders are queued.",
        tab: "calendar",
        effects: [
          { kind: "message", conversationId: "c-brian", message: { id: "bk-2", from: "contact", text: "Booked Saturday 10am. We'll be home!", time: "Just now" } },
          { kind: "calendar", event: { id: "cal-brian", day: "Sat", date: "Jul 18", time: "10:00 AM", title: "Deck estimate — Brian Kowalski", withWhom: "Dave (estimator)", status: "confirmed" } },
          { kind: "metric", id: "estimates", delta: 1 },
          { kind: "stage", leadId: "l-brian", stageId: "est-scheduled" },
        ],
      },
      {
        id: "s-6",
        title: "The quote goes out",
        detail: "After the visit, Dave builds the quote: $19,500 composite rebuild. The system delivers it and starts the follow-up clock.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-brian", message: { id: "bk-3", from: "system", meta: "Automated · Quote delivery", text: "Hi Brian, your deck renovation quote is ready: hartwell.demo/quote/2519 — $19,500 for the full composite rebuild we walked through. Questions welcome, right here.", time: "Just now" } },
          { kind: "metric", id: "quotes-sent", delta: 1 },
          { kind: "stage", leadId: "l-brian", stageId: "quote-sent" },
          { kind: "activity", item: { id: "a-s6", icon: "automation", text: "Quote #2519 delivered to Brian Kowalski — follow-up sequence armed.", time: "Just now" } },
        ],
      },
      {
        id: "s-7",
        title: "The homeowner goes quiet",
        detail: "Two days pass. No reply. This is exactly where most contractors lose the job — not to a competitor, but to silence.",
        tab: "pipeline",
        effects: [
          { kind: "stage", leadId: "l-brian", stageId: "follow-up" },
          { kind: "metric", id: "quotes-waiting", delta: 1 },
          { kind: "activity", item: { id: "a-s7", icon: "alert", text: "Quote aging: no response from Brian Kowalski at day 2.", time: "Just now" } },
        ],
      },
      {
        id: "s-8",
        title: "The follow-up automation activates",
        detail: "A day-2 check-in goes out automatically — friendly, useful, and paused instantly if anyone on the team replies manually.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-brian", message: { id: "bk-4", from: "system", meta: "Automated · Day-2 follow-up", text: "Hi Brian, checking in on the deck quote. If the number's the sticking point we can phase the project or look at pressure-treated instead of composite. Want Dave to call?", time: "Just now" } },
        ],
      },
      {
        id: "s-9",
        title: "Brian responds — and accepts",
        detail: "The follow-up did its job. Brian replies, asks one question, and approves the quote. Sales is notified the moment he engages.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-brian", message: { id: "bk-5", from: "contact", text: "Sorry, crazy week! No — the number works. Let's do the composite. What's next?", time: "Just now" } },
          { kind: "notify", notification: { id: "n-s9", title: "Quote accepted: Brian Kowalski", body: "$19,500 deck renovation approved from day-2 follow-up.", tone: "success" } },
          { kind: "metric", id: "quotes-waiting", delta: -1 },
          { kind: "metric", id: "jobs-won", delta: 1 },
        ],
      },
      {
        id: "s-10",
        title: "The job moves into scheduling",
        detail: "Contract and deposit tasks are created, and the job lands on the production calendar.",
        tab: "pipeline",
        effects: [
          { kind: "stage", leadId: "l-brian", stageId: "approved" },
          { kind: "task", task: { id: "t-brian-2", title: "Send contract + deposit invoice — Kowalski deck ($19,500)", assignee: "Office", due: "Today", priority: "high", auto: true } },
          { kind: "activity", item: { id: "a-s10", icon: "pipeline", text: "Kowalski deck approved — moved to Approved, contract task created.", time: "Just now" } },
        ],
      },
      {
        id: "s-11",
        title: "The pipeline value updates",
        detail: "$19,500 recovered by a text message no human had to remember to send. Multiply that across every quiet quote in your pipeline.",
        tab: "overview",
        effects: [
          { kind: "metric", id: "pipeline-value", delta: 19500 },
          { kind: "notify", notification: { id: "n-s11", title: "Scenario complete", body: "Web form → instant reply → quote → automated follow-up → $19,500 job won.", tone: "success" } },
        ],
      },
      {
        id: "s-12",
        title: "Now try it yourself",
        detail:
          "Take an after-hours call as the AI receptionist's caller, build an instant quote in the Quotes tab, or drag a lead through the pipeline. Everything here is safe to touch.",
        tab: "receptionist",
        effects: [
          { kind: "notify", notification: { id: "n-s12", title: "Your turn", body: "Try the AI receptionist call, then build a quote in the Quotes tab.", tone: "default" } },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: "scn-missed-call-dispatch",
      label: "Missed call to booked job",
      description:
        "The whole crew is on a roof when the office line rings out. Watch the text-back catch the lead, qualify it, and put a crew member on the schedule — before anyone climbs down.",
      steps: [
        {
          id: "sc-mc-1",
          title: "A call rings out on the office line",
          detail:
            "11:52 AM — Rosa Alvarez calls while every crew is mid-job. Within 60 seconds the missed-call automation texts her back, so the lead never reaches a competitor's voicemail.",
          tab: "conversations",
          effects: [
            { kind: "activity", item: { id: "a-sc-mc1", icon: "call", text: "Missed call from Rosa Alvarez — text-back sent in 38 seconds.", time: "Just now" } },
            {
              kind: "conversation",
              conversation: {
                id: "c-sc-alvarez",
                contact: "Rosa Alvarez",
                channel: "sms",
                topic: "Missed call — deck stair repair",
                unread: true,
                messages: [
                  { id: "sc-ra-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, this is Hartwell Contracting — sorry we missed your call, the crews are out on job sites. What project can we help with? A few details (and photos) get you priced faster.", time: "Just now" },
                ],
              },
            },
            { kind: "workflowRun", run: { id: "wr-sc-mc", automationId: "auto-3", name: "Missed-call text-back", detail: "Simulated run: rang-out call from Rosa Alvarez answered by text within 60 seconds.", time: "Just now", simulated: true } },
          ],
        },
        {
          id: "sc-mc-2",
          title: "The AI qualifies the job by text",
          detail:
            "The assistant asks for the service, address, and urgency. Rosa replies with photos — two cracked deck stairs and a party this Saturday. A hot lead record is created automatically.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-2", from: "contact", text: "The bottom two steps on our deck cracked through — someone nearly went down. We're hosting a party Saturday. Photos attached.", time: "Just now" } },
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-3", from: "system", meta: "Automated · Qualification", text: "Got it — cracked deck stairs, safety issue, needed before Saturday. What's the property address so we can route the nearest crew?", time: "Just now" } },
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-4", from: "contact", text: "9 Pinehurst Rd, Scituate.", time: "Just now" } },
            { kind: "lead", lead: { id: "l-sc-alvarez", name: "Rosa Alvarez", service: "Deck stair rebuild — safety repair", source: "Missed call", stageId: "new", value: 2400, lastActivity: "Just now", temp: "hot", note: "2 cracked stairs · 9 Pinehurst Rd, Scituate · party Saturday — needs same-week fix · photos attached" } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "activity", item: { id: "a-sc-mc2", icon: "message", text: "Rosa Alvarez qualified by text: deck stair safety repair, needed before Saturday.", time: "Just now" } },
          ],
        },
        {
          id: "sc-mc-3",
          title: "A repair slot comes off the live schedule",
          detail:
            "The system sees Friday afternoon open on Sam's route and offers it. Rosa takes it — the small-repair visit lands on the calendar without a single callback.",
          tab: "calendar",
          effects: [
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-5", from: "system", meta: "Automated · Scheduling", text: "We can have a crew lead at 9 Pinehurst Rd this Friday at 3:30 PM to rebuild the stairs — small repairs are priced on site before any work starts. Want that slot?", time: "Just now" } },
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-6", from: "contact", text: "Yes — Friday 3:30 works. Thank you!", time: "Just now" } },
            { kind: "calendar", event: { id: "cal-sc-alvarez", day: "Fri", date: "Jul 17", time: "3:30 PM", title: "Deck stair rebuild — Rosa Alvarez", withWhom: "Sam (crew lead)", status: "confirmed", note: "Safety repair · photos on file · price on site" } },
            { kind: "stage", leadId: "l-sc-alvarez", stageId: "scheduled" },
          ],
        },
        {
          id: "sc-mc-4",
          title: "A dispatch ticket goes to the crew lead",
          detail:
            "Sam gets a dispatch ticket with the address, photos, urgency, and the full text thread attached. No sticky notes, no 'who took this call?'",
          tab: "tasks",
          effects: [
            { kind: "task", task: { id: "t-sc-alvarez", title: "Dispatch: Fri 3:30 PM — deck stair rebuild @ 9 Pinehurst Rd (Alvarez). Party Saturday, safety flag. Photos + thread on the lead record.", assignee: "Sam (crew lead)", due: "Fri", priority: "high", auto: true } },
            { kind: "updateLead", leadId: "l-sc-alvarez", patch: { assignee: "Sam (crew lead)", lastActivity: "Just now" } },
            { kind: "conversationMeta", conversationId: "c-sc-alvarez", patch: { assignee: "Sam (crew lead)", unread: false } },
            { kind: "activity", item: { id: "a-sc-mc4", icon: "task", text: "Dispatch ticket created for Sam — Alvarez stair rebuild, Friday 3:30 PM.", time: "Just now" } },
          ],
        },
        {
          id: "sc-mc-5",
          title: "Rosa gets a confirmation with the details",
          detail:
            "A confirmation text goes out with the day, time, and who's coming — and she can reply to this same thread right up until the truck arrives.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-sc-alvarez", message: { id: "sc-ra-7", from: "system", meta: "Automated · Confirmation", text: "You're booked: deck stair rebuild, Friday 3:30 PM at 9 Pinehurst Rd with Sam, our crew lead. He has your photos. Reply here any time if anything changes.", time: "Just now" } },
          ],
        },
        {
          id: "sc-mc-6",
          title: "The numbers move",
          detail:
            "A call nobody could answer became a booked $2,400 job in one text thread. That's the math on every missed call the system catches.",
          tab: "overview",
          effects: [
            { kind: "metric", id: "jobs-won", delta: 1 },
            { kind: "metric", id: "pipeline-value", delta: 2400 },
            { kind: "notify", notification: { id: "n-sc-mc", title: "Missed call converted", body: "Rosa Alvarez — $2,400 stair rebuild booked and dispatched to Sam. No human answered the phone.", tone: "success" } },
          ],
        },
      ],
    },
    {
      id: "scn-quote-to-paid",
      label: "Estimate to collected invoice",
      description:
        "Follow Anita Patel's 320 sq ft deck from the estimate visit through the quote, the automated nudge, approval, the build, and the paid invoice — with a review request at the end.",
      steps: [
        {
          id: "sc-q-1",
          title: "Dave prices the deck after the site visit",
          detail:
            "Thursday's estimate visit wraps and Dave builds the quote from the walkthrough: $19,800 for the composite deck. The moment it's marked sent, the follow-up sequence arms itself.",
          tab: "quotes",
          effects: [
            { kind: "appointmentStatus", eventId: "cal-2", status: "completed" },
            { kind: "quote", quote: { id: "q-sc-patel", contact: "Anita Patel", leadId: "l-patel", lines: [
              { label: "Composite deck — 320 sq ft", amount: 16500 },
              { label: "Rail & lighting upgrade", amount: 2100 },
              { label: "Site prep, permits & management", amount: 1200 },
            ], total: 19800, status: "sent", createdAt: "Just now" } },
            { kind: "stage", leadId: "l-patel", stageId: "quote-sent" },
            { kind: "metric", id: "quotes-sent", delta: 1 },
            { kind: "activity", item: { id: "a-sc-q1", icon: "automation", text: "Quote delivered to Anita Patel ($19,800 deck) — follow-up sequence armed.", time: "Just now" } },
          ],
        },
        {
          id: "sc-q-2",
          title: "The quote lands in her texts",
          detail:
            "Anita gets the quote link the minute Dave hits send — same thread she'll use for every question, update, and invoice later.",
          tab: "conversations",
          effects: [
            {
              kind: "conversation",
              conversation: {
                id: "c-sc-patel",
                contact: "Anita Patel",
                channel: "sms",
                topic: "Composite deck — quote & build",
                unread: true,
                messages: [
                  { id: "sc-ap-1", from: "system", meta: "Automated · Quote delivery", text: "Hi Anita, your deck quote from Hartwell Contracting is ready: hartwell.demo/quote/2534 — $19,800 for the 320 sq ft composite build with rail lighting. Dave's happy to walk through it, just reply here.", time: "Just now" },
                ],
              },
            },
            { kind: "metric", id: "quotes-waiting", delta: 1 },
            { kind: "workflowRun", run: { id: "wr-sc-q", automationId: "auto-2", name: "Quote follow-up sequence", detail: "Simulated run: delivery confirmed for quote #2534, day-2 / day-5 / day-10 nudges queued.", time: "Just now", simulated: true } },
          ],
        },
        {
          id: "sc-q-3",
          title: "Two quiet days — the nudge goes out",
          detail:
            "No reply by day 2, so the system sends a friendly check-in on its own. If anyone on the team had replied manually, the sequence would have paused instantly.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-sc-patel", message: { id: "sc-ap-2", from: "system", meta: "Automated · Day-2 follow-up", text: "Hi Anita, checking in on the deck quote. If timing or budget is the question, we can phase the build or trim the lighting package. Want Dave to give you a call?", time: "Just now" } },
            { kind: "stage", leadId: "l-patel", stageId: "follow-up" },
            { kind: "activity", item: { id: "a-sc-q3", icon: "alert", text: "Quote aging: day-2 follow-up sent to Anita Patel automatically.", time: "Just now" } },
          ],
        },
        {
          id: "sc-q-4",
          title: "Anita approves the job",
          detail:
            "The nudge did its work. She replies, the quote flips to accepted, the lead moves to Approved, and sales is notified the second she engages.",
          tab: "pipeline",
          effects: [
            { kind: "message", conversationId: "c-sc-patel", message: { id: "sc-ap-3", from: "contact", text: "Sorry for the slow reply — we're in. Keep the lighting. When can you start?", time: "Just now" } },
            { kind: "quoteStatus", quoteId: "q-sc-patel", status: "accepted" },
            { kind: "stage", leadId: "l-patel", stageId: "approved" },
            { kind: "metric", id: "quotes-waiting", delta: -1 },
            { kind: "metric", id: "jobs-won", delta: 1 },
            { kind: "notify", notification: { id: "n-sc-q4", title: "Quote accepted: Anita Patel", body: "$19,800 composite deck approved off the day-2 follow-up.", tone: "success" } },
          ],
        },
        {
          id: "sc-q-5",
          title: "The build hits the production schedule",
          detail:
            "The job lands on Crew B's calendar for Monday, a materials task goes to the office, and Anita gets the start-date notice — all from one stage change.",
          tab: "calendar",
          effects: [
            { kind: "calendar", event: { id: "cal-sc-patel", day: "Mon", date: "Jul 20", time: "7:00 AM", title: "Deck build start — Anita Patel", withWhom: "Crew B · Sam (crew lead)", status: "confirmed" } },
            { kind: "stage", leadId: "l-patel", stageId: "scheduled" },
            { kind: "task", task: { id: "t-sc-patel-mat", title: "Order composite decking, rail kit & lighting for Patel build — on site by Monday 7 AM", assignee: "Office", due: "Fri", priority: "high", auto: true } },
            { kind: "message", conversationId: "c-sc-patel", message: { id: "sc-ap-4", from: "system", meta: "Automated · Job scheduled", text: "Great news — your deck build starts Monday, Jul 20 at 7:00 AM. Crew B with Sam, our crew lead. Materials arrive Friday; we'll text progress updates as we go.", time: "Just now" } },
          ],
        },
        {
          id: "sc-q-6",
          title: "Work wraps — the invoice goes out itself",
          detail:
            "The crew marks the job complete. Anita gets the completion notice with the final invoice link, and the office gets a collect-payment ticket — nobody has to remember to bill.",
          tab: "tasks",
          effects: [
            { kind: "stage", leadId: "l-patel", stageId: "completed" },
            { kind: "appointmentStatus", eventId: "cal-sc-patel", status: "completed" },
            { kind: "message", conversationId: "c-sc-patel", message: { id: "sc-ap-5", from: "system", meta: "Automated · Completion & invoice", text: "Your deck is done — Sam walked the punch list this afternoon. Final invoice ($19,800): hartwell.demo/pay/2534. Card or ACH both work. Thank you for choosing Hartwell!", time: "Just now" } },
            { kind: "task", task: { id: "t-sc-patel-inv", title: "Collect final payment — Patel deck ($19,800). Invoice link texted; card & ACH accepted.", assignee: "Office", due: "Today", priority: "high", auto: true } },
            { kind: "activity", item: { id: "a-sc-q6", icon: "automation", text: "Patel deck marked complete — invoice sent and payment task created.", time: "Just now" } },
          ],
        },
        {
          id: "sc-q-7",
          title: "Payment clears, review request follows",
          detail:
            "Anita pays by card the same evening. The payment task closes, the post-job automation asks her for feedback, and $19,800 lands in the numbers.",
          tab: "reviews",
          effects: [
            { kind: "completeTask", taskId: "t-sc-patel-inv" },
            { kind: "review", item: { id: "r-sc-patel", name: "Anita Patel", service: "Composite deck — 320 sq ft", status: "requested", time: "Just now" } },
            { kind: "metric", id: "pipeline-value", delta: 19800 },
            { kind: "activity", item: { id: "a-sc-q7", icon: "review", text: "Invoice paid — review request sent to Anita Patel after positive feedback check.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-sc-q7", title: "Scenario complete", body: "Estimate → quote → automated nudge → approval → build → paid invoice → review request. $19,800 collected.", tone: "success" } },
          ],
        },
      ],
    },
    {
      id: "scn-reactivation-route",
      label: "Maintenance list wakes up",
      description:
        "Past customers are the cheapest jobs you'll ever book. Watch the seasonal segment go out, a past window customer reply, and a maintenance visit land on the neighborhood route.",
      steps: [
        {
          id: "sc-re-1",
          title: "The fall segment goes out",
          detail:
            "The reactivation automation pulls every past exterior customer 12+ months out and sends the gutter & roof-check offer — 23 texts, zero office time.",
          tab: "campaigns",
          effects: [
            { kind: "workflowRun", run: { id: "wr-sc-re", automationId: "auto-6", name: "Maintenance reactivation", detail: "Simulated run: seasonal gutter & roof-check offer sent to 23 past exterior customers.", time: "Just now", simulated: true } },
            { kind: "activity", item: { id: "a-sc-re1", icon: "campaign", text: "Fall maintenance segment sent to 23 past customers (gutter & roof checks).", time: "Just now" } },
          ],
        },
        {
          id: "sc-re-2",
          title: "A past customer replies",
          detail:
            "Lisa Chen — window replacement, completed last quarter — texts back within the hour. Her reply threads straight into the inbox with her history attached.",
          tab: "conversations",
          effects: [
            {
              kind: "conversation",
              conversation: {
                id: "c-sc-chen",
                contact: "Lisa Chen",
                channel: "sms",
                topic: "Fall maintenance — gutter & roof check",
                unread: true,
                messages: [
                  { id: "sc-lc-1", from: "system", meta: "Automated · Reactivation campaign", text: "Hi Lisa, it's Hartwell Contracting. Fall's coming — we're booking gutter cleanings and roof checkups for past customers first. Want us to add you to the route?", time: "Just now" },
                  { id: "sc-lc-2", from: "contact", text: "Yes please — same house. The back gutters were overflowing in that last storm.", time: "Just now" },
                ],
              },
            },
            { kind: "notify", notification: { id: "n-sc-re2", title: "Reactivation reply", body: "Lisa Chen wants on the fall route — gutters overflowing in the last storm.", tone: "success" } },
          ],
        },
        {
          id: "sc-re-3",
          title: "A maintenance job is created from her record",
          detail:
            "No forms, no re-typing. The system opens a new job on her existing record — address, history, and gate notes carried over from the window project.",
          tab: "leads",
          effects: [
            { kind: "lead", lead: { id: "l-sc-chen-maint", name: "Lisa Chen", service: "Gutter cleaning & roof check", source: "Reactivation", stageId: "new", value: 950, lastActivity: "Just now", temp: "warm", note: "Past customer — window replacement completed. Back gutters overflowing. Address & access notes carried from prior job." } },
            { kind: "metric", id: "requests", delta: 1 },
            { kind: "activity", item: { id: "a-sc-re3", icon: "pipeline", text: "Maintenance job opened from Lisa Chen's customer record — no re-entry.", time: "Just now" } },
          ],
        },
        {
          id: "sc-re-4",
          title: "Booked onto Tuesday's neighborhood route",
          detail:
            "The scheduler slots her onto the route already passing her street Tuesday morning. Confirmation goes out in the same thread.",
          tab: "calendar",
          effects: [
            { kind: "message", conversationId: "c-sc-chen", message: { id: "sc-lc-3", from: "system", meta: "Automated · Confirmation", text: "You're on the route: gutter cleaning & roof check, Tuesday Jul 21 at 8:30 AM. Crew B is already in your neighborhood that morning. We'll text when they're on the way.", time: "Just now" } },
            { kind: "calendar", event: { id: "cal-sc-chen", day: "Tue", date: "Jul 21", time: "8:30 AM", title: "Gutter cleaning & roof check — Lisa Chen", withWhom: "Crew B", status: "confirmed" } },
            { kind: "stage", leadId: "l-sc-chen-maint", stageId: "scheduled" },
          ],
        },
        {
          id: "sc-re-5",
          title: "Revenue from a list that was doing nothing",
          detail:
            "A $950 route stop from one automated text — and 22 more offers are still out working. The old customer list quietly becomes a booking channel.",
          tab: "overview",
          effects: [
            { kind: "metric", id: "pipeline-value", delta: 950 },
            { kind: "notify", notification: { id: "n-sc-re5", title: "Reactivation booked", body: "Lisa Chen — $950 maintenance visit on Tuesday's route. Simulated campaign, real workflow.", tone: "success" } },
          ],
        },
      ],
    },
  ],
  simActions: [
    {
      id: "sim-missed-call",
      label: "Simulate missed call",
      description: "The crew's on a roof — the text-back catches the lead.",
      tab: "conversations",
      effects: [
        { kind: "activity", item: { id: "a-sim-mc", icon: "call", text: "Missed call from Janet Kowar — text-back sent in 41 seconds.", time: "Just now" } },
        {
          kind: "conversation",
          conversation: {
            id: "c-janet",
            contact: "Janet Kowar",
            channel: "sms",
            topic: "Missed call — gutter replacement",
            unread: true,
            messages: [
              { id: "jk-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, this is Hartwell Contracting — sorry we missed you, the crews are out on sites. What project can we help with? Photos help if you have them.", time: "Just now" },
              { id: "jk-2", from: "contact", text: "Need gutters replaced on a colonial, maybe 160 linear feet. When could someone look?", time: "Just now" },
            ],
          },
        },
        { kind: "lead", lead: { id: "l-janet", name: "Janet Kowar", service: "Gutter replacement — 160 lf", source: "Missed call", stageId: "new", value: 3800, lastActivity: "Just now", temp: "warm" } },
        { kind: "metric", id: "requests", delta: 1 },
        { kind: "notify", notification: { id: "n-sim-mc", title: "Missed call recovered", body: "Janet Kowar — gutter replacement lead created and assigned.", tone: "alert" } },
      ],
    },
    {
      id: "sim-followup",
      label: "Send quote follow-up",
      description: "Nudge Doug Freeman's 5-day-old bathroom quote.",
      tab: "conversations",
      effects: [
        {
          kind: "conversation",
          conversation: {
            id: "c-freeman",
            contact: "Doug Freeman",
            channel: "sms",
            topic: "Bathroom quote — final check-in",
            messages: [
              { id: "df-1", from: "system", meta: "Automated · Final check-in", text: "Hi Doug, last note from us on the bathroom quote — if the timing's off we'll close the file and you can reopen anytime. If it's budget, Mike has a couple of ideas to trim it. Either way, no hard feelings!", time: "Just now" },
              { id: "df-2", from: "contact", text: "Appreciate the low pressure. Let's talk trimming it — can Mike call Thursday?", time: "Just now" },
            ],
          },
        },
        { kind: "notify", notification: { id: "n-sim-fu", title: "Customer engaged: Doug Freeman", body: "Replied to final check-in — call requested Thursday. Automation paused.", tone: "success" } },
        { kind: "task", task: { id: "t-freeman-call", title: "Call Doug Freeman Thursday — discuss trimming bathroom scope", assignee: "Mike (sales)", due: "Thu", priority: "high", auto: true } },
        { kind: "activity", item: { id: "a-sim-fu", icon: "automation", text: "Follow-up paused for Doug Freeman — human takeover after reply.", time: "Just now" } },
      ],
    },
    {
      id: "sim-update",
      label: "Send customer update",
      description: "Crew status flows to the customer automatically.",
      tab: "conversations",
      effects: [
        { kind: "message", conversationId: "c-morris", message: { id: "jm-4", from: "system", meta: "Automated · Progress update", text: "Morris porch update: framing passed inspection this morning. Screens and trim start tomorrow — still tracking for Friday completion.", time: "Just now" } },
        { kind: "activity", item: { id: "a-sim-up", icon: "message", text: "Progress update sent to Morris residence (framing inspection passed).", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-up", title: "Customer update sent", body: "Morris porch — milestone update delivered without office time.", tone: "success" } },
      ],
    },
    {
      id: "sim-reactivation",
      label: "Trigger reactivation",
      description: "Wake up old estimates that never closed.",
      tab: "campaigns",
      effects: [
        { kind: "activity", item: { id: "a-sim-re", icon: "campaign", text: "Unclosed-estimates campaign sent to 14 quotes from the last 60 days.", time: "Just now" } },
        { kind: "metric", id: "requests", delta: 1 },
        { kind: "notify", notification: { id: "n-sim-re", title: "Reactivation response", body: "A $9,200 fence quote from May replied: 'Ready to move forward.'", tone: "success" } },
        { kind: "activity", item: { id: "a-sim-re2", icon: "message", text: "May fence quote re-engaged — office notified for scheduling.", time: "Just now" } },
      ],
    },
    {
      id: "sim-job-complete",
      label: "Complete a job",
      description: "The Diaz fence wraps — invoice and review request go out on their own.",
      tab: "tasks",
      effects: [
        { kind: "stage", leadId: "l-diaz", stageId: "completed" },
        { kind: "appointmentStatus", eventId: "cal-3", status: "completed" },
        {
          kind: "conversation",
          conversation: {
            id: "c-sim-diaz",
            contact: "Robert Diaz",
            channel: "sms",
            topic: "Fence job — completion & invoice",
            messages: [
              { id: "rd-1", from: "system", meta: "Automated · Completion & invoice", text: "Your fence installation is complete — the crew walked the gate hardware and latches before leaving. Final invoice ($8,900): hartwell.demo/pay/2507. Reply here with any punch-list items.", time: "Just now" },
            ],
          },
        },
        { kind: "task", task: { id: "t-sim-diaz-inv", title: "Collect final payment — Diaz fence ($8,900). Invoice link delivered by text.", assignee: "Office", due: "Today", priority: "high", auto: true } },
        { kind: "review", item: { id: "r-sim-diaz", name: "Robert Diaz", service: "Fence installation", status: "requested", time: "Just now" } },
        { kind: "activity", item: { id: "a-sim-jc", icon: "review", text: "Diaz fence marked complete — invoice sent, review request queued after feedback check.", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-jc", title: "Job completed", body: "Diaz fence — completion notice, invoice, and review request all fired automatically.", tone: "success" } },
      ],
    },
  ],
  builderFlow: {
    title: "Estimate request → won job",
    steps: [
      { label: "New Lead Submitted", sub: "Form, call, or ad" },
      { label: "Create Contact", sub: "Scope, budget, photos" },
      { label: "Send Confirmation", sub: "Under 60 seconds" },
      { label: "Assign Estimator", sub: "By trade & territory" },
      { label: "Schedule Estimate" },
      { label: "Deliver Quote" },
      { label: "Wait 2 Days" },
      { label: "Check for Response" },
      { label: "Send Follow-Up", sub: "Day 2 · Day 5 · Day 10" },
      { label: "Update Pipeline Stage" },
    ],
  },
  breakdown: {
    inputs: [
      "Website estimate forms",
      "Google Local Services & ad leads",
      "Missed and after-hours calls",
      "Text messages & photos",
      "Past customer records",
      "Old quote lists",
    ],
    systemDoes: [
      "Creates one lead record per project with photos and budget",
      "Responds to every request in under a minute",
      "Assigns leads by trade and territory",
      "Runs the quote follow-up sequence until someone answers",
      "Sends on-the-way, scheduling, and progress updates",
      "Requests reviews after completed jobs",
      "Tracks pipeline value, close rate, and response time",
    ],
    teamControls: [
      "Pricing and scope on every quote",
      "Site visits and estimates",
      "When automation pauses — any manual reply takes over",
      "Negotiations and closing",
      "Crew scheduling and the work itself",
      "Which campaigns run, and to whom",
    ],
    integrations: [
      "Field service management software",
      "CRM platforms",
      "Google Calendar",
      "Outlook Calendar",
      "Twilio SMS",
      "Email",
      "Website forms",
      "Facebook lead ads",
      "Stripe & payment processors",
      "Review platforms",
    ],
  },
  cta: {
    headline: "Stop Letting Estimate Requests Go Cold",
    button: "Build This System for My Company",
  },
  seo: {
    title: "Contractor Lead System Demo | Redmont Strategies Group",
    description:
      "Interactive demo of a contractor operating system: instant estimate-request response, quote follow-up automation, job pipeline, customer updates, and reactivation campaigns.",
  },
};
