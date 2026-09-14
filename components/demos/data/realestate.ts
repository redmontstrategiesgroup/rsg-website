import type { IndustryConfig } from "../types";

/**
 * RSG Brokerage Operations System: demo data for a fictional residential
 * brokerage, "Harborline Realty Group" — two offices, a listing team and a
 * buyer team, one transaction coordinator. All names, addresses, and numbers
 * are sample data.
 *
 * Two deliberate modeling choices:
 *
 * 1. `Lead.value` is estimated gross commission, not list price. The pipeline
 *    view sums `value`, and mixing the two would make the pipeline total
 *    meaningless. List price lives in `fields.listPrice`.
 * 2. `terminology.appointment` is the generic "Appointment", not "Showing".
 *    That noun renders the "New {appointment}" button and the booked toast,
 *    and this calendar also carries listing appointments, inspections, and
 *    closings. The showing flavor lives in the nav label and appointmentTypes.
 *
 * The demo handles scheduling, communication, and coordination workflows only.
 * It never gives a valuation, an opinion of price, or legal advice — the
 * receptionist's valuation branch exists specifically to show that boundary.
 */
export const realestateConfig: IndustryConfig = {
  slug: "realestate",
  industry: "Residential Brokerages & Agent Teams",
  systemName: "RSG Brokerage Operations System",
  osName: "Brokerage Operations System",
  businessName: "Harborline Realty Group",
  description:
    "A lead response and transaction system that helps residential brokerages answer every portal lead in seconds, coordinate showings without phone tag, keep every contingency deadline visible, and turn past clients into repeat and referral business.",
  outcome: "Answer every lead in seconds, and never miss a contingency deadline.",
  problem:
    "Portal leads arrive at 9 PM and get a reply the next morning, after three other agents have already called. Showings run on phone tag between three parties, and every deadline in the brokerage lives in one coordinator's spreadsheet.",
  workflows: [
    "Speed-to-lead response and agent routing",
    "Showing scheduling and seller feedback",
    "Listing pipeline from signed to live",
    "Contingency deadline tracking and alerts",
    "Past-client and referral nurture",
  ],
  accentLabel: "Lead Response & Transactions",
  terminology: {
    record: "client",
    records: "Clients",
    appointment: "Appointment",
    appointments: "Appointments",
  },
  leadsLabel: "Clients & leads",
  nav: [
    { id: "overview", label: "Overview" },
    { id: "leads", label: "Clients & Leads" },
    { id: "pipeline", label: "Transactions" },
    { id: "conversations", label: "Conversations" },
    { id: "receptionist", label: "AI Receptionist" },
    { id: "quotes", label: "Listing Proposals" },
    { id: "automations", label: "Automations" },
    { id: "tasks", label: "Transaction Tasks" },
    { id: "calendar", label: "Showings & Calendar" },
    { id: "reviews", label: "Reviews & Referrals" },
    { id: "campaigns", label: "Campaigns" },
    { id: "analytics", label: "Analytics" },
    { id: "recovered", label: "Recovered" },
    { id: "boundaries", label: "Boundaries & Disclosures" },
    { id: "settings", label: "Settings" },
  ],
  staff: [
    { id: "st-marisol", name: "Marisol Vega", role: "Listing specialist" },
    { id: "st-dev", name: "Dev Okafor", role: "Buyer specialist" },
    { id: "st-tanya", name: "Tanya Brandt", role: "Transaction coordinator" },
    { id: "st-chris", name: "Chris Meade", role: "Team lead" },
    { id: "st-priya", name: "Priya Raman", role: "Client care" },
  ],
  roles: [
    {
      id: "owner",
      label: "Broker / owner",
      description: "Everything: production, settings, and the full system.",
      nav: ["overview", "leads", "pipeline", "conversations", "receptionist", "quotes", "automations", "tasks", "calendar", "reviews", "campaigns", "analytics", "settings", "recovered", "boundaries"],
    },
    {
      id: "manager",
      label: "Team lead",
      description: "Agent accountability, pipelines, campaigns, and exceptions.",
      nav: ["overview", "leads", "pipeline", "conversations", "receptionist", "quotes", "tasks", "calendar", "reviews", "campaigns", "analytics", "recovered", "boundaries"],
    },
    {
      id: "staff",
      label: "Transaction coordinator",
      description: "Files, deadlines, documents, and the closing calendar.",
      nav: ["overview", "conversations", "tasks", "calendar", "leads", "quotes", "recovered", "boundaries"],
    },
    {
      id: "provider",
      label: "Agent",
      description: "Their clients, showings, conversations, and tasks.",
      nav: ["overview", "calendar", "leads", "conversations", "tasks", "recovered", "boundaries"],
    },
  ],
  metrics: [
    { id: "new-leads", label: "New leads", value: 38, delta: "+9 this week", deltaDir: "up", hint: "Portals, IDX site, sign calls" },
    { id: "speed-to-lead", label: "Median speed to lead", value: 3, format: "minutes", delta: "-52 min", deltaDir: "down", deltaGood: true, hint: "Was 55 min before routing" },
    { id: "appointments-set", label: "Appointments set", value: 17, delta: "+5", deltaDir: "up" },
    { id: "showings-booked", label: "Showings booked", value: 27, delta: "+8", deltaDir: "up", hint: "Confirmed without phone tag" },
    { id: "under-contract", label: "Files under contract", value: 9 },
    { id: "deadlines-at-risk", label: "Deadlines at risk", value: 1, delta: "-4", deltaDir: "down", deltaGood: true, hint: "Contingency dates inside 72 hours" },
    { id: "sphere-touches", label: "Sphere touchpoints", value: 214, delta: "+38", deltaDir: "up", hint: "From the past-client engine" },
    { id: "lead-to-appt", label: "Lead → appointment rate", value: 34, format: "percent", delta: "+11 pts", deltaDir: "up" },
  ],
  stages: [
    { id: "new-lead", label: "New Lead" },
    { id: "contacted", label: "Contacted" },
    { id: "appointment-set", label: "Appointment Set" },
    { id: "active-client", label: "Active Buyer / Listing" },
    { id: "under-contract", label: "Under Contract" },
    { id: "closed", label: "Closed" },
    { id: "sphere", label: "Past Client & Sphere" },
  ],
  leads: [
    { id: "l-harmon", name: "Alicia Harmon", service: "Selling: 22 Cordwainer Dr", source: "IDX website", stageId: "appointment-set", value: 22470, lastActivity: "12 min ago", temp: "hot", note: "Relocating for work, wants to list before Thanksgiving", assignee: "Marisol Vega", fields: { listPrice: "$749,000", intent: "Selling", timeline: "30–60 days" } },
    { id: "l-boyd", name: "Trevor Boyd", service: "Buying: 3BR, Duxbury / Marshfield", source: "Zillow", stageId: "contacted", value: 14100, lastActivity: "40 min ago", temp: "hot", assignee: "Dev Okafor", fields: { priceRange: "$450k–$525k", intent: "Buying", financing: "Pre-approved" } },
    { id: "l-santos", name: "Renata Santos", service: "Selling: 14 Sea Breeze Ln", source: "Past client referral", stageId: "under-contract", value: 15870, lastActivity: "2 hrs ago", assignee: "Marisol Vega", note: "Inspection contingency expires Thursday 5:00 PM", fields: { listPrice: "$529,000", intent: "Selling", contingency: "Inspection — Thu 5:00 PM" } },
    { id: "l-whitaker", name: "Gordon Whitaker", service: "Buying: waterfront, no timeline", source: "Open house", stageId: "new-lead", value: 26000, lastActivity: "Yesterday", temp: "cold", note: "9-month timeline, on the long-term buyer nurture track", fields: { priceRange: "$800k+", intent: "Buying", financing: "Talking to a lender" } },
    { id: "l-okonkwo", name: "Ify Okonkwo", service: "Buying: first home, Plymouth", source: "Realtor.com", stageId: "active-client", value: 11400, lastActivity: "3 hrs ago", temp: "warm", assignee: "Dev Okafor", fields: { priceRange: "$375k–$420k", intent: "Buying", financing: "Pre-approved" } },
    { id: "l-frazier", name: "Dale & Nina Frazier", service: "Selling + buying: move-up", source: "Sign call", stageId: "contacted", value: 31200, lastActivity: "5 hrs ago", temp: "warm", assignee: "Chris Meade", note: "Needs both sides — sale contingent on purchase", fields: { listPrice: "$615,000", intent: "Both", timeline: "Within 90 days" } },
    { id: "l-mcgrath", name: "Colleen McGrath", service: "Closed: 8 Rockland Way", source: "Sphere", stageId: "closed", value: 13950, lastActivity: "Yesterday", assignee: "Marisol Vega", fields: { listPrice: "$465,000", intent: "Selling", closed: "Closed Oct 10" } },
    { id: "l-abrams", name: "Peter Abrams", service: "Past client: bought 2 years ago", source: "Anniversary campaign", stageId: "sphere", value: 0, lastActivity: "2 days ago", note: "Replied to the closing-anniversary touch asking about home values", fields: { intent: "Past client (buyer)", closed: "Closed Oct 2023" } },
  ],
  conversations: [
    {
      id: "c-harmon",
      contact: "Alicia Harmon",
      channel: "web",
      topic: "Seller inquiry: 22 Cordwainer Dr",
      unread: true,
      messages: [
        { id: "c-harmon-1", from: "contact", text: "We're being relocated and need to sell. What's the process and how fast can you list?", time: "Today 9:12 PM" },
        { id: "c-harmon-2", from: "system", meta: "Automated · Speed-to-lead", text: "Hi Alicia, this is Harborline Realty Group — thanks for reaching out about 22 Cordwainer Dr. Marisol handles listings on that side of town and can walk you through timing. Are you looking to be on the market in the next 30 days, or is this further out?", time: "9:12 PM" },
        { id: "c-harmon-3", from: "contact", text: "Ideally on the market before Thanksgiving. We haven't done anything to prep it.", time: "9:19 PM" },
        { id: "c-harmon-4", from: "system", meta: "Automated · Qualifying", text: "That's very doable. Marisol will bring a pre-listing plan and a net sheet so you can see what a sale actually leaves you. She has Thursday at 5:30 PM or Saturday at 10:00 AM — which works better?", time: "9:19 PM" },
      ],
    },
    {
      id: "c-boyd",
      contact: "Trevor Boyd",
      channel: "sms",
      topic: "Zillow lead: routed and claimed",
      messages: [
        { id: "c-boyd-1", from: "system", meta: "Automated · Speed-to-lead", text: "Hi Trevor, this is Harborline Realty Group's assistant for Dev. You just asked about a 3-bedroom in Duxbury. Are you already working with an agent, or would it help to see a few that fit before the weekend?", time: "Today 11:02 AM" },
        { id: "c-boyd-2", from: "contact", text: "Not working with anyone yet. We're pre-approved to 525.", time: "11:06 AM" },
        { id: "c-boyd-3", from: "system", meta: "Automated · Qualifying", text: "Perfect — that opens up a lot in Duxbury and Marshfield. I'm sending three that just hit and a link to book a tour block Saturday morning: harborline.demo/book", time: "11:06 AM" },
        { id: "c-boyd-4", from: "staff", meta: "Dev Okafor (buyer specialist)", text: "Trevor, one of the three has an offer deadline Friday at noon — worth seeing Thursday evening if you can swing it. Want me to request a showing?", time: "11:24 AM" },
      ],
    },
    {
      id: "c-santos",
      contact: "Renata Santos",
      channel: "sms",
      topic: "Seller update: showing feedback",
      messages: [
        { id: "c-santos-1", from: "system", meta: "Automated · Weekly seller update", text: "Hi Renata — this week at 14 Sea Breeze Ln: 6 showings, 4 feedback responses. Buyers loved the yard; two mentioned the kitchen as dated. Full summary and the current comps are in your seller portal.", time: "Yesterday 4:00 PM" },
        { id: "c-santos-2", from: "contact", text: "That's the most useful update we've gotten from any agent. Should we be thinking about price?", time: "Yesterday 4:31 PM" },
        { id: "c-santos-3", from: "staff", meta: "Marisol Vega (listing specialist)", text: "Let's talk it through Thursday — I'll bring the last 30 days of comparable activity so it's a numbers conversation, not a guess.", time: "Yesterday 4:48 PM" },
      ],
    },
    {
      id: "c-abrams",
      contact: "Peter Abrams",
      channel: "email",
      topic: "Closing anniversary: replied",
      messages: [
        { id: "c-abrams-1", from: "system", meta: "Automated · Closing anniversary", text: "Hi Peter — two years ago today you closed on your place. Here's what's sold on your street since, in case you're curious what it means for your equity. No agenda, just the numbers.", time: "2 days ago 8:00 AM" },
        { id: "c-abrams-2", from: "contact", text: "Wild how much has changed. My sister is looking in the same area — can I connect you two?", time: "2 days ago 12:40 PM" },
      ],
    },
  ],
  tasks: [
    { id: "t-inspection", title: "Inspection contingency expires Thu 5:00 PM — 14 Sea Breeze Ln, confirm response or extension", assignee: "Tanya Brandt", due: "Today", priority: "high", auto: true },
    { id: "t-appraisal", title: "Coordinate appraisal access — 120 Tremont St, lender needs the lockbox code", assignee: "Tanya Brandt", due: "Today", auto: true },
    { id: "t-whitaker", title: "Personal call: Gordon Whitaker, 9-month timeline, no contact in 21 days", assignee: "Dev Okafor", due: "Tomorrow", auto: true },
    { id: "t-photos", title: "Confirm photographer and sign install — 22 Cordwainer Dr goes live Monday", assignee: "Priya Raman", due: "Fri", auto: true },
    { id: "t-preapproval", title: "Collect updated pre-approval letter — Ify Okonkwo (expires in 9 days)", assignee: "Dev Okafor", due: "Mon", done: true },
  ],
  activity: [
    { id: "a-1", icon: "message", text: "Peter Abrams replied to the closing-anniversary touch offering a referral.", time: "2 days ago" },
    { id: "a-2", icon: "alert", text: "Inspection contingency on 14 Sea Breeze Ln flagged: expires tomorrow at 5:00 PM.", time: "8:15 AM" },
    { id: "a-3", icon: "automation", text: "Weekly seller update sent to 6 active listings with showing feedback attached.", time: "Yesterday 4:00 PM" },
    { id: "a-4", icon: "call", text: "Sign call from 22 Cordwainer Dr answered by the assistant after hours.", time: "Yesterday 7:41 PM" },
    { id: "a-5", icon: "pipeline", text: "Trevor Boyd claimed by Dev Okafor 94 seconds after the Zillow lead landed.", time: "11:04 AM" },
    { id: "a-6", icon: "calendar", text: "Showing block confirmed for Trevor Boyd: Saturday 10:00 AM, three properties.", time: "11:31 AM" },
    { id: "a-7", icon: "review", text: "Review request sent to Colleen McGrath after her closing on 8 Rockland Way.", time: "Yesterday" },
    { id: "a-8", icon: "task", text: "Task created: updated pre-approval letter needed for Ify Okonkwo.", time: "Yesterday 3:20 PM" },
  ],
  calendar: [
    { id: "cal-1", day: "Thu", date: "Oct 16", time: "5:30 PM", title: "Listing appointment: Alicia Harmon", withWhom: "Marisol Vega", status: "confirmed", note: "22 Cordwainer Dr — bring net sheet and pre-listing plan" },
    { id: "cal-2", day: "Thu", date: "Oct 16", time: "6:30 PM", title: "Showing: 41 Bayberry Rd", withWhom: "Dev Okafor", status: "pending" },
    { id: "cal-3", day: "Thu", date: "Oct 16", time: "11:00 AM", title: "Inspection walkthrough: 14 Sea Breeze Ln", withWhom: "Tanya Brandt", status: "risk", note: "Contingency expires today at 5:00 PM" },
    { id: "cal-4", day: "Sat", date: "Oct 18", time: "10:00 AM", title: "Buyer tour block: Trevor Boyd (3 properties)", withWhom: "Dev Okafor", status: "confirmed" },
    { id: "cal-5", day: "Mon", date: "Oct 20", time: "9:00 AM", title: "Closing: 120 Tremont St", withWhom: "Chris Meade", status: "confirmed" },
    { id: "cal-6", day: "Mon", date: "Oct 20", time: "2:00 PM", title: "Buyer consultation: referral from Peter Abrams", withWhom: "Dev Okafor", status: "pending" },
  ],
  reviews: [
    { id: "r-1", name: "Colleen McGrath", service: "Sold 8 Rockland Way", status: "requested", time: "Yesterday" },
    { id: "r-2", name: "Marcus Bell", service: "Bought in Kingston", status: "completed", rating: 5, note: "Dev had us in three houses the day we called. We were under contract in a week.", time: "3 days ago" },
    { id: "r-3", name: "Janice Pell", service: "Sold in Plymouth", status: "flagged", note: "Great outcome, but I went two weeks mid-contract without hearing anything about the appraisal.", time: "Last week" },
    { id: "r-4", name: "The Ferreiras", service: "Bought in Duxbury", status: "completed", rating: 5, note: "Tanya kept every date straight. We never once wondered what came next.", time: "Last week" },
    { id: "r-5", name: "Owen Hartley", service: "Sold in Marshfield", status: "scheduled", time: "Next week" },
  ],
  campaigns: [
    {
      id: "camp-1",
      name: "Closing anniversary & equity update",
      audience: "Past clients at their 1, 2, 3, 5, and 7-year closing anniversary",
      filters: ["Stage: past client", "Closing anniversary this month", "Consent on file", "Not currently in an active transaction"],
      message: "Hi {first_name} — {appointment_date} marks another year since you closed. Here's what's sold nearby since, in case you're curious what it means for your equity. No agenda, just the numbers. Reply STOP to opt out.",
      stats: { sent: 96, replied: 24, booked: 6 },
      status: "active",
    },
    {
      id: "camp-2",
      name: "Long-timeline buyer re-engagement",
      audience: "Buyers with a 6+ month timeline and no contact in 30 days",
      filters: ["Intent: buying", "Timeline > 6 months", "No agent contact in 30 days", "Saved search active"],
      message: "Hi {first_name}, {staff_name} at {business_name} asked me to check in. Nothing urgent — just checking whether your timeline has shifted, and whether the saved search is still showing you the right things. Reply STOP to opt out.",
      stats: { sent: 64, replied: 19, booked: 5 },
      status: "active",
    },
    {
      id: "camp-3",
      name: "Just-listed sphere announcement",
      audience: "Past clients and sphere within 3 miles of a new listing",
      filters: ["Consent on file", "Within 3 miles of {location}", "No opt-out in prior 60 days"],
      message: "Hi {first_name} — we just listed {location}. If you know someone who's been waiting for something in the neighborhood, send them my way. Reply STOP to opt out.",
      stats: { sent: 148, replied: 31, booked: 9 },
      status: "completed",
    },
  ],
  automations: [
    { id: "auto-0", kind: "intake", name: "Portal & IDX lead intake", trigger: "Zillow, Realtor.com, or IDX site inquiry received", steps: ["Create the client record with source and intent", "Send the first text within 60 seconds", "Assign to the on-duty agent", "Create a follow-up task if no reply in 2 hours"], runsThisMonth: 142, status: "active", delayLabel: "Under 60 seconds", message: "Hi {first_name}, this is {business_name}'s assistant for {staff_name}. You just asked about {location}. Are you already working with an agent, or would it help to see a few that fit?" },
    { id: "auto-1", kind: "routing", name: "Round-robin routing & claim window", trigger: "New lead assigned to the on-duty agent", steps: ["Assign by round-robin within the right team", "Open a 5-minute claim window", "Escalate to the next agent if unclaimed", "Notify the team lead on the second escalation"], runsThisMonth: 131, status: "active", delayLabel: "5 minutes" },
    { id: "auto-2", kind: "missed-call", name: "Sign-call & after-hours text-back", trigger: "Call to the listing line not answered within 4 rings", steps: ["Send a text back within 60 seconds", "Identify the property from the number dialed", "Offer a showing time or a callback", "Create an agent task if no reply in 2 hours"], runsThisMonth: 71, status: "active", delayLabel: "60 seconds", message: "Hi {first_name}, this is {business_name}'s automated assistant. Sorry we missed your call about {location}. Would you like me to check showing times, or have {staff_name} call you back?" },
    { id: "auto-3", kind: "reminders", name: "Showing confirmation & feedback loop", trigger: "Showing scheduled or access event recorded", steps: ["Confirm with both agents and the seller", "Send the buyer's agent a feedback request 30 minutes after the access event", "Roll responses into the weekly seller summary", "Flag listings with no feedback in 7 days"], runsThisMonth: 118, status: "active", delayLabel: "30 minutes after showing" },
    { id: "auto-4", kind: "updates", name: "Contingency deadline watch", trigger: "Contract dates entered or changed on a file", steps: ["Calculate inspection, appraisal, financing, and title dates", "Alert the coordinator at 5 days, 3 days, and 24 hours", "Escalate to the team lead inside 24 hours", "Log every extension against the file"], runsThisMonth: 46, status: "active", delayLabel: "5 days / 3 days / 24 hours" },
    { id: "auto-5", kind: "follow-up", name: "Document chase", trigger: "Required document missing from a file checklist", steps: ["Request the document from the responsible party", "Remind after 24 hours, then 48", "Create a coordinator task on the third attempt", "Mark the checklist item when the document lands"], runsThisMonth: 89, status: "active", delayLabel: "24 hours" },
    { id: "auto-6", kind: "reactivation", name: "Long-timeline buyer nurture", trigger: "Buyer with a 6+ month timeline, no contact in 30 days", steps: ["Segment by area, price band, and stated timeline", "Send a market note tied to their saved search", "Route replies to the assigned agent", "Return the lead to active on any reply"], runsThisMonth: 4, status: "active", delayLabel: "30 days quiet", message: "Hi {first_name}, {staff_name} at {business_name} asked me to check in. Nothing urgent — has your timeline shifted at all, and is the saved search still showing you the right things?" },
    { id: "auto-7", kind: "referral", name: "Closing anniversary & referral ask", trigger: "Closing anniversary reached", steps: ["Send a neighborhood equity update", "Wait for a reply, then route to the original agent", "Ask for the introduction at the point goodwill peaks", "Log the referral source on any new lead created"], runsThisMonth: 8, status: "active", delayLabel: "Annually on the closing date" },
    { id: "auto-8", kind: "review", name: "Post-closing review request", trigger: "File marked closed", steps: ["Wait 2 days after the closing", "Send a short feedback question first", "Positive → share the review link", "Concern raised → flag for the team lead"], runsThisMonth: 22, status: "paused", delayLabel: "2 days after closing" },
  ],
  templates: [
    { id: "tpl-1", name: "Speed-to-lead first text", channel: "sms", tone: "direct", text: "Hi {first_name}, this is {business_name}'s assistant for {staff_name}. You just asked about {location}. Are you already working with an agent, or would it help to see a few that fit?" },
    { id: "tpl-2", name: "Showing confirmation", channel: "sms", tone: "professional", text: "Hi {first_name}, your showing at {location} is confirmed for {appointment_date} at {appointment_time} with {staff_name}. Reply R if you need to move it." },
    { id: "tpl-3", name: "Weekly seller update", channel: "email", tone: "professional", text: "Hi {first_name}, here's this week at {location}: showing count, buyer feedback, and current comparable activity. {staff_name} will call {appointment_date} to walk through what it means." },
    { id: "tpl-4", name: "Inspection deadline reminder", channel: "internal", tone: "direct", text: "Deadline alert: the inspection contingency on {location} expires {appointment_date} at {appointment_time}. Confirm the response or file an extension before then." },
    { id: "tpl-5", name: "Closing anniversary", channel: "email", tone: "friendly", text: "Hi {first_name} — another year since you closed on {location}. Here's what's sold nearby since, in case you're curious what it means for your equity. No agenda, just the numbers." },
    { id: "tpl-6", name: "Review request", channel: "sms", tone: "premium", text: "Hi {first_name}, congratulations again on {location}. If {staff_name} and the team earned it, a short review helps more than you'd think: {review_link}" },
  ],
  intakeFields: [
    { id: "name", label: "Full name", type: "text", required: true },
    { id: "phone", label: "Mobile number", type: "phone", required: true, helper: "For showing confirmations and updates (simulated)" },
    { id: "email", label: "Email", type: "email" },
    { id: "intent", label: "Are you buying or selling?", type: "select", required: true, options: ["Buying", "Selling", "Both: selling and buying", "Just watching the market"] },
    { id: "timeline", label: "How soon are you looking to move?", type: "select", required: true, options: ["Within 30 days", "1–3 months", "3–6 months", "6–12 months", "No set timeline"] },
    { id: "price_range", label: "Price range", type: "select", options: ["Under $400k", "$400k–$550k", "$550k–$750k", "$750k–$1M", "Over $1M"] },
    { id: "area", label: "Towns or neighborhoods", type: "text", helper: "e.g. \"Duxbury, Marshfield, or anywhere on the water\"" },
    { id: "financing", label: "Where are you on financing?", type: "select", options: ["Pre-approved", "Talking to a lender", "Paying cash", "Haven't started", "Selling first"] },
    { id: "notes", label: "Anything we should know?", type: "textarea" },
    { id: "consent", label: "OK to text me about my inquiry", type: "checkbox" },
  ],
  quote: {
    title: "Instant seller net sheet",
    description:
      "The same estimate an agent walks a seller through at the listing appointment. Pick the terms on a $650,000 list price; generated net sheets become records with automated follow-up.",
    documentLabel: "Seller net sheet",
    base: { label: "Estimated list price", amount: 650000 },
    fields: [
      {
        id: "listing-fee",
        label: "Listing-side fee",
        options: [
          { label: "2.5%", amount: -16250 },
          { label: "2%", amount: -13000 },
          { label: "1.5%", amount: -9750 },
        ],
        helper: "Commission is always negotiable and is set between the seller and the broker.",
      },
      {
        id: "buyer-comp",
        label: "Buyer-agent compensation offered (optional)",
        options: [
          { label: "2.5%", amount: -16250 },
          { label: "2%", amount: -13000 },
          { label: "None", amount: 0 },
        ],
        helper: "Any offer to a buyer's broker is the seller's choice and is negotiable.",
      },
      {
        id: "payoff",
        label: "Estimated mortgage payoff",
        options: [
          { label: "Owned outright", amount: 0 },
          { label: "About $180,000", amount: -180000 },
          { label: "About $320,000", amount: -320000 },
          { label: "About $450,000", amount: -450000 },
        ],
        helper: "Bracketed for the demo; a real net sheet uses your actual payoff statement.",
      },
      {
        id: "closing",
        label: "Seller closing costs & transfer tax",
        options: [
          { label: "Standard: about $7,900", amount: -7900 },
          { label: "With title issues: about $9,800", amount: -9800 },
          { label: "Complex file: about $14,200", amount: -14200 },
        ],
        helper: "MA deed excise ($4.56 per $1,000 ≈ $2,964) plus attorney, recording, and smoke/CO certificate.",
      },
      {
        id: "concessions",
        label: "Buyer concessions",
        options: [
          { label: "None", amount: 0 },
          { label: "$5,000 toward closing costs", amount: -5000 },
          { label: "$10,000 toward closing costs", amount: -10000 },
        ],
      },
      {
        id: "prep",
        label: "Pre-listing prep",
        options: [
          { label: "None", amount: 0 },
          { label: "Staging and photography", amount: -2500 },
          { label: "Paint, repairs, and staging", amount: -5500 },
        ],
      },
    ],
    acceptedStageId: "active-client",
    disclaimer:
      "Demo figures for illustration only. A real net sheet is prepared by a licensed agent from your actual payoff statement, title quote, and contract terms. This is not an appraisal, a valuation, or a guarantee of proceeds.",
    totalLabel: "Estimated net proceeds",
  },
  receptionist: {
    scenarioLabel: "After-hours sign call: buyer standing at a listing",
    description: "It's 7:40 PM on a Tuesday. A buyer is parked outside a listing and calls the number on the sign. Every agent is at dinner or with clients.",
    callerRole: "a buyer outside 22 Cordwainer Drive at 7:40 PM",
    start: "greet",
    nodes: [
      {
        id: "greet",
        say: "Thanks for calling Harborline Realty Group! Our agents are out with clients right now, but I'm the team's automated assistant and I can help with most things. Are you calling about a specific property?",
        choices: [
          { id: "c-avail", label: "I'm outside 22 Cordwainer Drive — is it still available?", next: "availability" },
          { id: "c-resched", label: "I need to move tomorrow's showing.", next: "resched" },
          { id: "c-value", label: "Actually, how much is my house worth?", next: "valuation" },
        ],
      },
      {
        id: "availability",
        say: "It is — 22 Cordwainer Drive is active, listed at $749,000, three bedrooms and two and a half baths. Are you already working with an agent, or would you like me to get you inside?",
        meta: "Reads listing status off the MLS feed",
        choices: [
          { id: "c-noagent", label: "Not working with anyone. I'd love to see it.", next: "buyer-times" },
          { id: "c-hasagent", label: "I have an agent, just curious.", next: "hasagent" },
        ],
      },
      {
        id: "hasagent",
        say: "Then your agent is the right person to get you in — I won't step on that. I can text you the listing sheet and the open house times so you have everything in front of you. Would that help?",
        meta: "Agency disclosure: does not solicit a represented buyer",
        choices: [
          { id: "c-sheet", label: "Yes, send the listing sheet.", next: "done-sheet" },
        ],
      },
      {
        id: "done-sheet",
        say: "Sent — listing sheet and the open house schedule are on their way by text. Have your agent reach out to Marisol if you'd like a private showing. Thanks for calling!",
        outcome: {
          summary: [
            "A represented buyer was helped without being solicited away from their agent.",
            "The assistant recognized existing representation and changed course on its own.",
            "The call was logged so nobody follows up as though this were an open lead.",
          ],
          effects: [
            { kind: "boundary", ruleId: "representation", summary: "Caller already has an agent. Sent the listing sheet, created no lead, made no pitch.", outcome: "declined" },
            { kind: "activity", item: { id: "a-ai-sheet", icon: "call", text: "After-hours sign call: represented buyer sent the listing sheet, no solicitation, no lead created.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-ai-sheet", title: "Represented buyer handled correctly", body: "The assistant recognized existing representation and did not pursue the lead.", tone: "default" } },
          ],
        },
      },
      {
        id: "resched",
        say: "Happy to help. I see a showing at 41 Bayberry Road tomorrow at 6:30 PM under this number. I can move it to Thursday at 5:00 PM or Saturday at 11:30 AM. Which works better?",
        meta: "Looks up the live showing calendar",
        choices: [
          { id: "c-thu", label: "Thursday at 5 works.", next: "done-resched" },
          { id: "c-sat", label: "Saturday morning is better.", next: "done-resched-sat" },
        ],
      },
      {
        id: "done-resched",
        say: "Done — your showing is moved, and I've notified both the listing agent and the seller so nobody's waiting at an empty house. A new confirmation is on its way by text.",
        outcome: {
          summary: [
            "The showing was rescheduled without a single round of phone tag.",
            "The listing agent and the seller were both notified automatically.",
            "The change was logged on the client's record and the shared calendar.",
          ],
          effects: [
            { kind: "calendarUpdate", eventId: "cal-2", patch: { day: "Thu", date: "Oct 16", time: "5:00 PM", status: "confirmed", note: "Rescheduled by the assistant during an after-hours call" } },
            { kind: "activity", item: { id: "a-ai-resched", icon: "calendar", text: "AI receptionist moved the 41 Bayberry Rd showing to Thursday 5:00 PM; both agents and the seller notified.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-ai-resched", title: "Showing rescheduled by assistant", body: "No phone tag between three parties — handled during the after-hours call.", tone: "success" } },
          ],
        },
      },
      {
        id: "buyer-times",
        say: "Let's get you in. Dev handles buyers on that side of town; he can show it tomorrow at 5:30 PM or Saturday at 11:30 AM. Which works?",
        meta: "Checks the live showing calendar",
        choices: [
          { id: "c-show-thu", label: "Tomorrow at 5:30.", next: "done-showing" },
          { id: "c-show-sat", label: "Saturday at 11:30.", next: "done-showing" },
        ],
      },
      {
        id: "done-showing",
        say: "You're booked with Dev. I'm texting your confirmation and the listing sheet now, and the seller's been notified. Thanks for calling Harborline!",
        outcome: {
          summary: [
            "A sign call at 7:40 PM became a booked showing instead of a voicemail.",
            "The buyer's record, the calendar, and the call summary all updated at once.",
            "The assistant introduced itself as automated and never spoke for an agent.",
          ],
          effects: [
            { kind: "boundary", ruleId: "licensee", summary: "Booked a showing as the team's assistant; never presented itself as Dev or any licensee.", outcome: "disclosed" },
            { kind: "lead", lead: { id: "l-ai-buyer", name: "Nathan Ruiz", service: "Buying: 22 Cordwainer Dr", source: "Sign call", stageId: "appointment-set", value: 22470, lastActivity: "Just now", temp: "hot", note: "After-hours sign call outside 22 Cordwainer Dr · showing booked by AI receptionist", assignee: "Dev Okafor", fields: { intent: "Buying", timeline: "Within 30 days" } } },
            { kind: "calendar", event: { id: "cal-ai-showing", day: "Thu", date: "Oct 16", time: "5:30 PM", title: "Showing: 22 Cordwainer Dr, Nathan Ruiz", withWhom: "Dev Okafor", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-buyer", contact: "Nathan Ruiz", channel: "phone", topic: "After-hours sign call: showing booked", unread: true, messages: [
              { id: "ai-buyer-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours sign call handled. Unrepresented buyer outside 22 Cordwainer Dr. Showing booked Thu 5:30 PM with Dev; seller notified; listing sheet texted. No valuation discussed.", time: "Just now" },
            ] } },
            { kind: "metric", id: "new-leads", delta: 1 },
            { kind: "metric", id: "showings-booked", delta: 1 },
            { kind: "recovery", event: { contact: "Nathan Ruiz", amount: 22470, silentFor: "Called 7:40 PM, every agent busy", trigger: "after-hours", summary: "Buyer parked outside a listing got a showing instead of a voicemail.", automationId: "auto-2" } },
            { kind: "notify", notification: { id: "n-ai-buyer", title: "Sign call converted", body: "Nathan Ruiz: showing at 22 Cordwainer Dr, Thu 5:30 PM with Dev.", tone: "success" } },
          ],
        },
      },
      {
        id: "done-resched-sat",
        say: "Done — your showing is moved to Saturday at 11:30 AM, and I've notified both the listing agent and the seller so nobody's waiting at an empty house. A new confirmation is on its way by text.",
        outcome: {
          summary: [
            "The showing was rescheduled without a single round of phone tag.",
            "The listing agent and the seller were both notified automatically.",
            "The change was logged on the client's record and the shared calendar.",
          ],
          effects: [
            { kind: "calendarUpdate", eventId: "cal-2", patch: { day: "Sat", date: "Oct 18", time: "11:30 AM", status: "confirmed", note: "Rescheduled by the assistant during an after-hours call" } },
            { kind: "activity", item: { id: "a-ai-resched-sat", icon: "calendar", text: "AI receptionist moved the 41 Bayberry Rd showing to Saturday 11:30 AM; both agents and the seller notified.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-ai-resched-sat", title: "Showing rescheduled by assistant", body: "No phone tag between three parties — handled during the after-hours call.", tone: "success" } },
          ],
        },
      },
      {
        id: "valuation",
        say: "I'm not able to put a number on a home — that has to come from a licensed agent who's actually seen it, and anything I guessed would be worth exactly nothing to you. What I can do is get Marisol out to you this week with a full comparable market analysis. Would that be useful?",
        meta: "Scope limit: never gives a value or an opinion of price",
        choices: [
          { id: "c-yes-cma", label: "Yes, that would be great.", next: "times" },
          { id: "c-ballpark", label: "Can't you just give me a ballpark?", next: "no-ballpark" },
        ],
      },
      {
        id: "no-ballpark",
        say: "I really can't, and I'd rather tell you that than make something up. Two houses on the same street can be sixty thousand apart for reasons that only show up in person. Marisol does this all day and she'll bring the actual comparable sales. Thursday evening or Saturday morning?",
        meta: "Holds the boundary under pressure",
        choices: [
          { id: "c-fine", label: "Fair enough — let's find a time.", next: "times" },
        ],
      },
      {
        id: "times",
        say: "Marisol has Thursday at 5:30 PM or Saturday at 10:00 AM. Which one works?",
        meta: "Checks the live calendar",
        choices: [
          { id: "c-thu2", label: "Thursday at 5:30.", next: "done-booked" },
          { id: "c-sat2", label: "Saturday at 10.", next: "done-booked" },
        ],
      },
      {
        id: "done-booked",
        say: "You're all set with Marisol. I'm texting your confirmation now, along with what she'll bring — recent comparable sales and a net sheet so you can see what a sale actually leaves you. Thanks for calling Harborline!",
        outcome: {
          summary: [
            "A sign call at 7:40 PM became a booked appointment instead of a voicemail.",
            "The assistant never gave a value — it routed the valuation to a licensed agent.",
            "The client record, the calendar, and the call summary all updated at once.",
          ],
          effects: [
            { kind: "boundary", ruleId: "valuation", summary: "Caller asked what their home is worth, then pushed for a ballpark. Declined both and booked Marisol for a CMA.", outcome: "declined" },
            { kind: "recovery", event: { contact: "Nathan Ruiz", amount: 19500, silentFor: "Called 7:40 PM, every agent busy", trigger: "after-hours", summary: "Seller sign call became a listing appointment; no number given over the phone.", automationId: "auto-2" } },
            { kind: "lead", lead: { id: "l-ai-sign", name: "Nathan Ruiz", service: "Selling: interested in a CMA", source: "Sign call", stageId: "appointment-set", value: 19500, lastActivity: "Just now", temp: "hot", note: "After-hours sign call at 22 Cordwainer Dr · booked by AI receptionist · no valuation given", assignee: "Marisol Vega", fields: { intent: "Selling", timeline: "Exploring" } } },
            { kind: "calendar", event: { id: "cal-ai-sign", day: "Thu", date: "Oct 16", time: "5:30 PM", title: "Listing appointment: Nathan Ruiz", withWhom: "Marisol Vega", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-sign", contact: "Nathan Ruiz", channel: "phone", topic: "After-hours sign call: appointment booked", unread: true, messages: [
              { id: "ai-sign-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours sign call handled. Caller asked for a home value; assistant declined to estimate and routed to a licensed agent. Listing appointment booked Thu 5:30 PM with Marisol. Confirmation texted. No valuation, no opinion of price given.", time: "Just now" },
            ] } },
            { kind: "metric", id: "new-leads", delta: 1 },
            { kind: "metric", id: "appointments-set", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-sign", title: "After-hours sign call converted", body: "Nathan Ruiz: listing appointment Thu 5:30 PM, booked while every agent was unavailable.", tone: "success" } },
          ],
        },
      },
    ],
  },
  appointmentTypes: [
    { id: "apt-buyer", label: "Buyer consultation", duration: 45 },
    { id: "apt-listing", label: "Listing appointment", duration: 60 },
    { id: "apt-showing", label: "Property showing", duration: 30 },
    { id: "apt-inspection", label: "Inspection walkthrough", duration: 90 },
    { id: "apt-closing", label: "Closing", duration: 60 },
  ],
  scheduleDays: [
    { day: "Wed", date: "Oct 15" },
    { day: "Thu", date: "Oct 16" },
    { day: "Fri", date: "Oct 17" },
    { day: "Sat", date: "Oct 18" },
    { day: "Mon", date: "Oct 20" },
  ],
  sampleCustomer: {
    first_name: "Alicia",
    service: "Listing consultation",
    location: "22 Cordwainer Dr",
    appointment_date: "Thursday, Oct 16",
    appointment_time: "5:30 PM",
    estimate_amount: "$749,000",
  },
  analytics: {
    volume: {
      title: "New leads per week",
      unit: "leads",
      points: [
        { label: "W1", value: 33 }, { label: "W2", value: 36 }, { label: "W3", value: 35 },
        { label: "W4", value: 41 }, { label: "W5", value: 42 }, { label: "W6", value: 38 },
        { label: "W7", value: 43 }, { label: "W8", value: 44 },
      ],
    },
    responseTime: {
      title: "Median speed to lead (minutes)",
      unit: "minutes",
      points: [
        { label: "W1", value: 55 }, { label: "W2", value: 41 }, { label: "W3", value: 26 },
        { label: "W4", value: 14 }, { label: "W5", value: 8 }, { label: "W6", value: 5 },
        { label: "W7", value: 4 }, { label: "W8", value: 3 },
      ],
    },
    funnel: {
      title: "Lead → closing funnel (8 weeks)",
      points: [
        { label: "Leads captured", value: 312 },
        { label: "Contacted within 5 minutes", value: 268 },
        { label: "Appointments set", value: 106 },
        { label: "Agreements signed", value: 61 },
        { label: "Under contract", value: 38 },
        { label: "Closed", value: 29 },
      ],
    },
    sources: [
      { name: "Zillow", leads: 96, booked: 24 },
      { name: "Realtor.com", leads: 58, booked: 14 },
      { name: "Sphere & referrals", leads: 47, booked: 26 },
      { name: "Open houses & sign calls", leads: 41, booked: 13 },
      { name: "IDX website", leads: 39, booked: 11 },
      { name: "Paid social", leads: 31, booked: 7 },
    ],
    kpis: [
      { id: "k-1", label: "Lead → appointment rate", value: 34, format: "percent", delta: "+11 pts", deltaDir: "up" },
      { id: "k-2", label: "Appointment → agreement rate", value: 58, format: "percent", delta: "+9 pts", deltaDir: "up" },
      { id: "k-3", label: "Median speed to lead", value: 3, format: "minutes", delta: "-52 min", deltaDir: "down", deltaGood: true },
      { id: "k-4", label: "Repeat & referral share of closings", value: 41, format: "percent", delta: "+12 pts", deltaDir: "up" },
    ],
  },
  scenario: {
    title: "A seller inquiry arrives from the IDX site at 9:12 PM, watch it become a listing appointment.",
    intro:
      "The problem: seller inquiries land after hours, sit in an inbox overnight, and by morning the homeowner has already talked to two other agents. Run the scenario to watch one inquiry go from first message to a booked listing appointment.",
    steps: [
      {
        id: "s-1",
        title: "A seller inquiry lands at 9:12 PM",
        detail: "Alicia Harmon fills out the valuation form on the IDX site. Without a system, this waits until someone opens the inbox tomorrow morning.",
        tab: "conversations",
        effects: [
          {
            kind: "conversation",
            conversation: {
              id: "c-alicia",
              contact: "Alicia Harmon",
              channel: "web",
              topic: "Seller inquiry: 22 Cordwainer Dr",
              unread: true,
              messages: [{ id: "sa-1", from: "contact", text: "We're being relocated and need to sell. What's the process and how fast can you list?", time: "Just now" }],
            },
          },
          { kind: "metric", id: "new-leads", delta: 1 },
        ],
      },
      {
        id: "s-2",
        title: "The first text goes out in 38 seconds",
        detail: "Not an auto-reply — a real qualifying question, the same one your best agent would ask. The homeowner is still at their laptop.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-2", from: "system", meta: "Automated · Speed-to-lead", text: "Hi Alicia, this is Harborline Realty Group — thanks for reaching out about 22 Cordwainer Dr. Are you looking to be on the market in the next 30 days, or is this further out?", time: "Just now" } },
          { kind: "activity", item: { id: "a-s2", icon: "message", text: "Speed-to-lead text sent to Alicia Harmon in 38 seconds.", time: "Just now" } },
        ],
      },
      {
        id: "s-3",
        title: "A client record is created with source and intent",
        detail: "Alicia becomes a record with the property, her intent, and where she came from; nothing lives only in a form notification.",
        tab: "leads",
        effects: [
          { kind: "lead", lead: { id: "l-alicia", name: "Alicia Harmon", service: "Selling: 22 Cordwainer Dr", source: "IDX website", stageId: "new-lead", value: 22470, lastActivity: "Just now", temp: "hot", note: "Relocation, wants to be on the market before Thanksgiving", fields: { listPrice: "$749,000", intent: "Selling" } } },
          { kind: "activity", item: { id: "a-s3", icon: "automation", text: "Client record created from IDX seller inquiry: Alicia Harmon (22 Cordwainer Dr).", time: "Just now" } },
        ],
      },
      {
        id: "s-4",
        title: "Routing assigns the on-duty listing agent",
        detail: "Round-robin picks Marisol and opens a five-minute claim window. If she doesn't claim it, it escalates automatically; a lead everybody can see is a lead nobody owns.",
        tab: "leads",
        effects: [
          { kind: "updateLead", leadId: "l-alicia", patch: { assignee: "Marisol Vega", stageId: "contacted" } },
          { kind: "notify", notification: { id: "n-s4", title: "Lead routed: Alicia Harmon", body: "Assigned to Marisol Vega with a 5-minute claim window. Escalates automatically if unclaimed.", tone: "alert" } },
        ],
      },
      {
        id: "s-5",
        title: "Qualifying questions collect timeline and motivation",
        detail: "Timeline, motivation, and whether there's a mortgage to pay off; everything Marisol needs to walk in prepared instead of discovering it at the kitchen table.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-3", from: "contact", text: "Ideally before Thanksgiving. We haven't done anything to prep it, and we still owe about $320k.", time: "Just now" } },
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-4", from: "system", meta: "Automated · Qualifying", text: "That's very doable. Marisol will bring a pre-listing plan and a net sheet so you can see what a sale actually leaves you. She has Thursday at 5:30 PM or Saturday at 10:00 AM — which works better?", time: "Just now" } },
        ],
      },
      {
        id: "s-6",
        title: "A listing appointment comes off the live calendar",
        detail: "Alicia picks Thursday at 5:30. The appointment, her record, and the pipeline all move at once, at 9:20 PM, with nobody awake.",
        tab: "calendar",
        effects: [
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-5", from: "contact", text: "Thursday at 5:30 works for us.", time: "Just now" } },
          { kind: "calendar", event: { id: "cal-alicia", day: "Thu", date: "Oct 16", time: "5:30 PM", title: "Listing appointment: Alicia Harmon", withWhom: "Marisol Vega", status: "confirmed" } },
          { kind: "stage", leadId: "l-alicia", stageId: "appointment-set" },
          { kind: "metric", id: "appointments-set", delta: 1 },
          { kind: "recovery", event: { contact: "Alicia Harmon", amount: 22470, silentFor: "Arrived 9:12 PM, nobody awake", trigger: "after-hours", summary: "IDX seller inquiry booked a listing appointment eight minutes after it landed.", automationId: "auto-0" } },
        ],
      },
      {
        id: "s-7",
        title: "The pre-listing packet and net sheet go out",
        detail: "The pre-listing checklist and a net-sheet worksheet go out now. The comparable sales come from Marisol in person Thursday; the system never sends an opinion of price.",
        tab: "quotes",
        effects: [
          { kind: "workflowRun", run: { id: "wr-s7", automationId: "auto-0", name: "Pre-listing packet", detail: "Pre-listing checklist and net-sheet worksheet sent to Alicia Harmon; comps held for the agent.", time: "Just now", simulated: true } },
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-6", from: "system", meta: "Automated · Pre-listing packet", text: "Sent — a prep checklist and a net-sheet worksheet at the payoff you mentioned, so Thursday is a numbers conversation. Marisol will bring the comparable sales herself.", time: "Just now" } },
          { kind: "boundary", ruleId: "comps", summary: "Automation sent the checklist and worksheet but held the comparable sales for Marisol to present in person.", outcome: "declined", source: "automation" },
        ],
      },
      {
        id: "s-7b",
        title: "What the assistant refused to do",
        detail: "Alicia asked, in the same thread, what the system thought the house was worth. It didn't guess: the question went to Marisol with the file, and the refusal was logged. That's not a gap in the product; it's the product.",
        tab: "boundaries",
        effects: [
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-6b", from: "contact", text: "Rough idea what it'd list for? Just so we can plan.", time: "Just now" } },
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-6c", from: "system", meta: "Automated · Valuation routed", text: "That has to come from Marisol after she's seen the house; anything I guessed would be worth nothing to you. She'll bring the comparable sales Thursday.", time: "Just now" } },
          { kind: "boundary", ruleId: "valuation", summary: "Alicia asked for a rough list price by text. Routed to Marisol; no number given.", outcome: "routed", source: "scenario" },
        ],
      },
      {
        id: "s-8",
        title: "Reminder and no-show sequence scheduled",
        detail: "Confirmation now, reminders at 48 and 24 hours. Listing appointments get cancelled quietly all the time; this is what keeps them on the calendar.",
        tab: "automations",
        effects: [
          { kind: "activity", item: { id: "a-s8", icon: "automation", text: "Reminder sequence scheduled for Alicia Harmon's listing appointment (48h / 24h).", time: "Just now" } },
          { kind: "message", conversationId: "c-alicia", message: { id: "sa-7", from: "system", meta: "Automated · Confirmation", text: "You're confirmed for Thursday, Oct 16 at 5:30 PM with Marisol Vega. We'll send a reminder so it doesn't sneak up on you.", time: "Just now" } },
        ],
      },
      {
        id: "s-9",
        title: "Agent prep tasks are created",
        detail: "Automation handles the routine; the agent handles the judgment. Marisol gets tasks to pull comps and pencil in the photographer before Thursday.",
        tab: "tasks",
        effects: [
          { kind: "task", task: { id: "t-alicia-comps", title: "Pull comparable sales for 22 Cordwainer Dr before Thursday 5:30 PM", assignee: "Marisol Vega", due: "Thu", priority: "high", auto: true } },
          { kind: "task", task: { id: "t-alicia-photo", title: "Hold a photographer slot for 22 Cordwainer Dr, pending signed agreement", assignee: "Priya Raman", due: "Fri", auto: true } },
          { kind: "notify", notification: { id: "n-s9", title: "Listing appointment booked", body: "Alicia Harmon, Thu 5:30 PM with Marisol. Prep tasks assigned.", tone: "success" } },
        ],
      },
      {
        id: "s-10",
        title: "The pipeline and team dashboard reflect it",
        detail: "From a 9:12 PM form fill to a booked listing appointment in eight minutes, with nobody at a desk. That's the difference between an inbox and an operating system.",
        tab: "overview",
        effects: [
          { kind: "metric", id: "lead-to-appt", delta: 1 },
          { kind: "activity", item: { id: "a-s10", icon: "pipeline", text: "Alicia Harmon moved from New Lead to Appointment Set in 8 minutes.", time: "Just now" } },
          { kind: "notify", notification: { id: "n-s10", title: "Scenario complete", body: "After-hours seller inquiry → booked listing appointment in 8 minutes, fully automated with agent oversight.", tone: "success" } },
        ],
      },
      {
        id: "s-11",
        title: "Now try it yourself",
        detail:
          "Take an after-hours sign call as the AI receptionist's caller (ask it what your house is worth), build a seller net sheet, or flag a contingency deadline. Everything here is safe to touch.",
        tab: "receptionist",
        effects: [
          { kind: "notify", notification: { id: "n-s11", title: "Your turn", body: "Try the sign call, then build a net sheet in Listing Proposals.", tone: "default" } },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: "sc-under-contract",
      label: "Under contract to clear-to-close",
      description: "Watch the coordination system carry a file through inspection, appraisal, and financing without a missed date.",
      steps: [
        {
          id: "uc-1",
          title: "Inspection report lands with repair requests",
          detail: "The buyer's agent sends a repair request 48 hours before the inspection contingency expires. The clock is already running.",
          tab: "tasks",
          effects: [
            { kind: "task", task: { id: "t-uc-repair", title: "Repair request received on 14 Sea Breeze Ln, seller response due Thu 5:00 PM", assignee: "Tanya Brandt", due: "Today", priority: "high", auto: true } },
            { kind: "notify", notification: { id: "n-uc-1", title: "Repair request received", body: "14 Sea Breeze Ln: response due before the inspection contingency expires Thursday 5:00 PM.", tone: "alert" } },
          ],
        },
        {
          id: "uc-2",
          title: "The seller is briefed and responds",
          detail: "Renata gets the request, the cost estimates, and the deadline in one message instead of three phone calls.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-santos", message: { id: "uc-m1", from: "system", meta: "Automated · Deadline brief", text: "Renata, the buyer requested three repairs on 14 Sea Breeze Ln with estimates attached. Your response is due Thursday at 5:00 PM. Marisol will call at 10 to walk through options.", time: "Just now" } },
            { kind: "message", conversationId: "c-santos", message: { id: "uc-m2", from: "contact", text: "We'll do the electrical and the slider, not the roof. Let's counter.", time: "Just now" } },
          ],
        },
        {
          id: "uc-3",
          title: "Repair negotiation closes the contingency",
          detail: "The counter is signed and the inspection contingency is released. The deadline that was 24 hours out is now off the board.",
          tab: "pipeline",
          effects: [
            { kind: "completeTask", taskId: "t-inspection" },
            { kind: "metric", id: "deadlines-at-risk", delta: -1 },
            { kind: "activity", item: { id: "a-uc-3", icon: "pipeline", text: "Inspection contingency released on 14 Sea Breeze Ln, repair addendum signed by both parties.", time: "Just now" } },
          ],
        },
        {
          id: "uc-4",
          title: "The appraisal comes in and financing clears",
          detail: "Appraisal at value, financing contingency released, and the file advances with every date logged against it.",
          tab: "tasks",
          effects: [
            { kind: "task", task: { id: "t-uc-appraisal", title: "Appraisal received at value on 14 Sea Breeze Ln, financing contingency released", assignee: "Tanya Brandt", due: "Today", done: true, auto: true } },
            { kind: "activity", item: { id: "a-uc-4", icon: "automation", text: "Financing contingency released on 14 Sea Breeze Ln, lender clear-to-close received.", time: "Just now" } },
          ],
        },
        {
          id: "uc-5",
          title: "Closing is scheduled and everyone is notified",
          detail: "The closing goes on the calendar four weeks out and all four parties get the details. No date was ever tracked in a spreadsheet.",
          tab: "calendar",
          effects: [
            { kind: "calendar", event: { id: "cal-uc-close", day: "Fri", date: "Nov 14", time: "11:00 AM", title: "Closing: 14 Sea Breeze Ln", withWhom: "Tanya Brandt", status: "confirmed" } },
            { kind: "notify", notification: { id: "n-uc-5", title: "Clear to close", body: "14 Sea Breeze Ln: clear to close, closing Nov 14 at 11:00 AM. Every contingency met on time.", tone: "success" } },
          ],
        },
      ],
    },
    {
      id: "sc-referral",
      label: "A past client becomes a referral",
      description: "The loop closes: a closing anniversary touch turns into a new client at the top of the pipeline.",
      steps: [
        {
          id: "rf-1",
          title: "The closing-anniversary touch goes out",
          detail: "Not a holiday card. A neighborhood equity update tied to the actual anniversary of Peter's closing, sent automatically.",
          tab: "campaigns",
          effects: [
            { kind: "activity", item: { id: "a-rf-1", icon: "campaign", text: "Closing-anniversary batch sent to 14 past clients with neighborhood equity updates.", time: "Just now" } },
            { kind: "metric", id: "sphere-touches", delta: 14 },
          ],
        },
        {
          id: "rf-2",
          title: "Peter replies, and offers an introduction",
          detail: "The ask lands at the moment goodwill peaks, and the reply routes straight to the agent who closed him two years ago.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-abrams", message: { id: "rf-m1", from: "contact", text: "My sister is looking in the same area — can I connect you two?", time: "Just now" } },
            { kind: "notify", notification: { id: "n-rf-2", title: "Referral offered: Peter Abrams", body: "Routed to Dev Okafor, the agent who closed his purchase in 2023.", tone: "success" } },
          ],
        },
        {
          id: "rf-3",
          title: "The referral enters the pipeline with its source intact",
          detail: "A new client record, attributed to the sphere rather than to a portal. This is the number that makes the referral engine defensible at budget time. Dana opted in by text before anything else was sent.",
          tab: "leads",
          effects: [
            { kind: "lead", lead: { id: "l-rf-sister", name: "Dana Abrams", service: "Buying: 3BR, same neighborhood", source: "Past client referral", stageId: "new-lead", value: 16500, lastActivity: "Just now", temp: "warm", note: "Referred by Peter Abrams (bought Oct 2023) · opted in by text", assignee: "Dev Okafor", fields: { intent: "Buying", priceRange: "$500k–$600k" } } },
            { kind: "metric", id: "new-leads", delta: 1 },
            { kind: "activity", item: { id: "a-rf-3", icon: "pipeline", text: "New lead from the sphere: Dana Abrams, referred by Peter Abrams.", time: "Just now" } },
            { kind: "recovery", event: { contact: "Dana Abrams", amount: 16500, silentFor: "Sphere, 2 years since closing", trigger: "referral", summary: "Anniversary touch turned a past client into a referral at the top of the pipeline.", automationId: "auto-7" } },
          ],
        },
        {
          id: "rf-4",
          title: "A buyer consultation is booked",
          detail: "The cheapest lead in the business, converted the same day, and the loop starts over at stage one.",
          tab: "calendar",
          effects: [
            { kind: "calendar", event: { id: "cal-rf", day: "Mon", date: "Oct 20", time: "2:00 PM", title: "Buyer consultation: Dana Abrams", withWhom: "Dev Okafor", status: "confirmed" } },
            { kind: "stage", leadId: "l-rf-sister", stageId: "appointment-set" },
            { kind: "metric", id: "appointments-set", delta: 1 },
            { kind: "notify", notification: { id: "n-rf-4", title: "Referral converted", body: "Dana Abrams booked a buyer consultation the same day the anniversary touch went out.", tone: "success" } },
          ],
        },
      ],
    },
  ],
  simActions: [
    {
      id: "sim-portal-lead",
      label: "Simulate a Zillow lead",
      description: "A portal lead arrives: watch the response go out before an agent sees it.",
      tab: "conversations",
      effects: [
        {
          kind: "conversation",
          conversation: {
            id: "c-sim-zillow",
            contact: "Kara Lindqvist",
            channel: "sms",
            topic: "Zillow lead: first response sent",
            unread: true,
            messages: [
              { id: "sz-1", from: "system", meta: "Automated · Speed-to-lead", text: "Hi Kara, this is Harborline Realty Group's assistant for Dev. You just asked about 41 Bayberry Rd. Are you already working with an agent, or would it help to see a few that fit?", time: "Just now" },
              { id: "sz-2", from: "contact", text: "Not working with anyone. We're moving from out of state in January.", time: "Just now" },
            ],
          },
        },
        { kind: "lead", lead: { id: "l-sim-kara", name: "Kara Lindqvist", service: "Buying: relocating in January", source: "Zillow", stageId: "contacted", value: 17800, lastActivity: "Just now", temp: "warm", assignee: "Dev Okafor", fields: { intent: "Buying", timeline: "3–6 months" } } },
        { kind: "activity", item: { id: "a-sim-zillow", icon: "message", text: "Zillow lead received: first response sent in 41 seconds, before any agent opened the app.", time: "Just now" } },
        { kind: "metric", id: "new-leads", delta: 1 },
        { kind: "notify", notification: { id: "n-sim-zillow", title: "Portal lead answered in 41 seconds", body: "Kara Lindqvist replied within two minutes. Routed to Dev Okafor.", tone: "success" } },
        { kind: "recovery", event: { contact: "Kara Lindqvist", amount: 17800, silentFor: "Zillow lead, answered in 41 s", trigger: "after-hours", summary: "Portal lead answered before any agent opened the app.", automationId: "auto-0" } },
      ],
    },
    {
      id: "sim-routing-escalation",
      label: "Trigger routing escalation",
      description: "An agent doesn't claim a lead inside the window: watch it move on.",
      tab: "leads",
      effects: [
        { kind: "lead", lead: { id: "l-sim-escalated", name: "Hannah Ostrowski", service: "Buying: 4BR, Hingham", source: "Realtor.com", stageId: "new-lead", value: 18000, lastActivity: "Just now", temp: "warm", note: "Unclaimed for 5 minutes, escalated from the on-duty agent to the team lead", assignee: "Chris Meade", fields: { intent: "Buying", priceRange: "$550k–$650k" } } },
        { kind: "recovery", event: { contact: "Hannah Ostrowski", amount: 18000, silentFor: "Unclaimed 5 minutes", trigger: "deadline", summary: "Portal lead sat unclaimed; the claim window expired and it moved to the team lead instead of dying in a queue.", automationId: "auto-1" } },
        { kind: "activity", item: { id: "a-sim-esc", icon: "alert", text: "Hannah Ostrowski unclaimed after 5 minutes, escalated to Chris Meade (team lead).", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-esc", title: "Lead escalated", body: "Unclaimed inside the 5-minute window. Reassigned automatically so it never sits.", tone: "alert" } },
      ],
    },
    {
      id: "sim-deadline-risk",
      label: "Flag a contingency deadline",
      description: "A contract date comes inside 72 hours: watch the coordinator get alerted.",
      tab: "tasks",
      effects: [
        { kind: "task", task: { id: "t-sim-deadline", title: "Financing contingency on 3 Harbor View Ter expires in 72 hours, confirm lender commitment", assignee: "Tanya Brandt", due: "Today", priority: "high", auto: true } },
        { kind: "activity", item: { id: "a-sim-deadline", icon: "alert", text: "Financing contingency on 3 Harbor View Ter flagged: 72 hours remaining, coordinator alerted.", time: "Just now" } },
        { kind: "metric", id: "deadlines-at-risk", delta: 1 },
        { kind: "notify", notification: { id: "n-sim-deadline", title: "Deadline at risk", body: "3 Harbor View Ter: financing contingency in 72 hours. Escalates to the team lead at 24.", tone: "alert" } },
      ],
    },
    {
      id: "sim-anniversary",
      label: "Send anniversary batch",
      description: "Run the closing-anniversary touch and watch a referral come back.",
      tab: "campaigns",
      effects: [
        { kind: "activity", item: { id: "a-sim-anniv", icon: "campaign", text: "Closing-anniversary batch sent to 14 past clients with neighborhood equity updates.", time: "Just now" } },
        { kind: "metric", id: "sphere-touches", delta: 14 },
        { kind: "message", conversationId: "c-abrams", message: { id: "sim-rf-1", from: "contact", text: "My sister is looking in the same area — can I connect you two?", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-anniv", title: "Referral from the sphere", body: "1 of 14 past clients replied offering an introduction, routed to their original agent.", tone: "success" } },
      ],
    },
  ],
  builderFlow: {
    title: "IDX seller inquiry → listing appointment",
    steps: [
      { label: "New IDX Inquiry", sub: "Property + intent captured" },
      { label: "Create Client Record", sub: "Source attributed" },
      { label: "Send First Text", sub: "Under 60 seconds" },
      { label: "Route to On-Duty Agent", sub: "5-minute claim window" },
      { label: "Escalate If Unclaimed" },
      { label: "Ask Timeline & Motivation" },
      { label: "Offer Calendar Times" },
      { label: "Book Appointment", sub: "Live availability" },
      { label: "Send Pre-Listing Packet", sub: "Comps + net sheet" },
      { label: "Schedule Reminders", sub: "48h / 24h" },
      { label: "Create Agent Prep Tasks" },
    ],
  },
  breakdown: {
    inputs: [
      "Zillow and Realtor.com portal leads",
      "IDX website inquiries and saved searches",
      "Sign calls and after-hours phone calls",
      "Open house sign-ins",
      "Showing requests and lockbox access events",
      "Contract dates and transaction documents",
      "Past-client and sphere records",
    ],
    systemDoes: [
      "Answers every lead in seconds and routes it to a named agent",
      "Escalates any lead left unclaimed inside the window",
      "Books showings and confirms them with all three parties",
      "Collects showing feedback and rolls it into seller updates",
      "Tracks every contingency date and alerts before it expires",
      "Chases missing documents until the checklist is complete",
      "Runs closing-anniversary and long-timeline nurture on a schedule",
      "Traces every closing back to its source and the agent activity behind it",
    ],
    teamControls: [
      "Pricing strategy and every valuation or CMA conclusion",
      "Offer strategy and all negotiation",
      "Any advice that requires a license",
      "Approving campaign messages before they send",
      "Agency relationships and disclosure conversations",
      "Which clients an automation may contact, and when",
      "Adjusting any workflow, deadline rule, or sequence",
    ],
    integrations: [
      "CRM platforms (Follow Up Boss, BoldTrail, Sierra, BoomTown)",
      "MLS / RESO Web API and IDX feeds",
      "Showing platforms (ShowingTime, BrokerBay)",
      "Transaction management (Dotloop, SkySlope)",
      "E-signature (DocuSign)",
      "CMA and net sheet tools",
      "Back office and commission platforms",
      "Google Workspace (Gmail & Calendar)",
      "Twilio SMS",
    ],
  },
  boundaries: {
    intro: "The assistant answers, routes, books, and reminds. It never prices a home, never solicits a buyer who has an agent, never signs as a licensee, and never sends a CMA conclusion on its own. Every time it holds that line, it's logged here.",
    rules: [
      { id: "valuation", label: "Never gives a value or an opinion of price", kind: "route", detail: "Any 'what's it worth' goes to a licensed agent with a CMA appointment, even under pressure for a ballpark.", routesTo: "st-marisol" },
      { id: "representation", label: "Never solicits a represented buyer", kind: "never", detail: "If the caller has an agent, they get the listing sheet and no pitch. No lead is created." },
      { id: "licensee", label: "Never signs as a licensed agent", kind: "always", detail: "Every automated call and text identifies itself as the team's assistant for the named agent, never as the agent." },
      { id: "comps", label: "Never sends comparable sales or CMA conclusions without agent review", kind: "never", detail: "Checklists and worksheets go out automatically; the comps and the price conversation stay with the agent." },
      { id: "consent", label: "Never texts without consent on file", kind: "never", detail: "Anniversary, nurture, and just-listed touches go only to contacts with consent, and every campaign carries STOP." },
    ],
    seed: [
      { id: "bnd-seed-1", ruleId: "valuation", at: "Yesterday 7:41 PM", summary: "Sign call asked what 22 Cordwainer Dr would sell for. Declined; booked a CMA with Marisol.", outcome: "declined", source: "receptionist" },
      { id: "bnd-seed-2", ruleId: "representation", at: "Yesterday 12:15 PM", summary: "Open-house follow-up text: buyer replied 'we have an agent'. Sequence stopped, no further contact.", outcome: "declined", source: "automation" },
      { id: "bnd-seed-3", ruleId: "consent", at: "Monday 9:00 AM", summary: "Just-listed sphere batch skipped 22 contacts with no consent on file.", outcome: "declined", source: "automation" },
      { id: "bnd-seed-4", ruleId: "comps", at: "Sunday 8:30 PM", summary: "IDX seller inquiry received a prep checklist; comparable sales held for Marisol's Tuesday appointment.", outcome: "declined", source: "automation" },
    ],
  },
  recovered: {
    intro: "Every lead that arrived after hours, sat unclaimed, or went quiet, and still became an appointment because the system acted. Pipelines show what's alive; this shows what would have died.",
    attributionRule: "counted when a contact who had gone quiet for 48 hours or more re-engaged within 24 hours of an automated touch and advanced a stage, when an unclaimed lead was escalated inside the claim window and booked, or when an after-hours inquiry was booked before an agent saw it.",
    seed: [
      { id: "rec-seed-1", at: "Yesterday", contact: "Trevor Boyd", amount: 14100, silentFor: "Zillow lead, answered in 94 s", trigger: "after-hours", summary: "Claimed by Dev inside the window; tour block booked the same morning.", automationId: "auto-1" },
      { id: "rec-seed-2", at: "2 days ago", contact: "Peter Abrams", amount: 16500, silentFor: "Quiet 2 years", trigger: "referral", summary: "Closing-anniversary touch produced a referral for his sister.", automationId: "auto-7" },
      { id: "rec-seed-3", at: "Friday", contact: "Gordon Whitaker", amount: 26000, silentFor: "Quiet 21 days", trigger: "reactivation", summary: "Long-timeline buyer nurture got a reply and a call with Dev.", automationId: "auto-6" },
      { id: "rec-seed-4", at: "Thursday", contact: "Renata Santos", amount: 15870, silentFor: "Deadline inside 72 h", trigger: "deadline", summary: "Inspection contingency flagged; repair response filed before it lapsed.", automationId: "auto-4" },
      { id: "rec-seed-5", at: "Wednesday", contact: "Owen Hartley", amount: 17400, silentFor: "Sign call 8:05 PM, no agent free", trigger: "after-hours", summary: "Listing appointment booked by the assistant after hours.", automationId: "auto-2" },
      { id: "rec-seed-6", at: "Last week", contact: "Marcus Bell", amount: 13200, silentFor: "Unclaimed 5 minutes", trigger: "deadline", summary: "Realtor.com lead escalated to the team lead when the on-duty agent didn't claim it; under contract in a week.", automationId: "auto-1" },
      { id: "rec-seed-7", at: "Last week", contact: "The Ferreiras", amount: 19800, silentFor: "Quiet 4 months", trigger: "reactivation", summary: "Long-timeline buyers came back on a saved-search market note.", automationId: "auto-6" },
    ],
  },
  requestServices: [
    "Speed-to-lead response and agent routing",
    "Showing scheduling and seller feedback",
    "Listing pipeline from signed to live",
    "Transaction coordination and deadline tracking",
    "Past-client and referral nurture",
    "Long-timeline buyer follow-up",
    "Agent accountability and production reporting",
    "Source attribution from spend to closing",
  ],
  requestExtras: [
    { id: "brokerage-type", label: "What best describes you?", options: ["Solo agent", "Agent team inside a brokerage", "Independent brokerage", "Franchise brokerage", "Multi-office brokerage"] },
    { id: "agent-count", label: "How many agents?", options: ["Just me", "2–5 agents", "6–15 agents", "16–40 agents", "41+ agents"] },
    { id: "annual-transactions", label: "Transactions closed last year", options: ["Under 50 transactions", "50–150 transactions", "150–400 transactions", "400+ transactions"] },
    { id: "crm", label: "What CRM are you on?", options: ["Follow Up Boss", "BoldTrail / kvCORE", "Sierra Interactive", "BoomTown", "Something else", "No CRM"], helper: "We connect to what you already run rather than replacing it." },
  ],
  cta: {
    headline: "Answer Every Lead. Close Every Deadline.",
    button: "Build This System for My Brokerage",
  },
  seo: {
    title: "Real Estate Brokerage Operations Demo | Redmont Strategies Group",
    description:
      "Interactive demo of a residential brokerage operating system: speed-to-lead response, showing coordination, listing pipeline, transaction deadline tracking, and past-client referral nurture.",
  },
};
