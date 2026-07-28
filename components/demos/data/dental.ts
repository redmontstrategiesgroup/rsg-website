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
 * RSG Dental Front Desk System — demo data for a fictional practice,
 * "Brightwater Dental". All names, numbers, and messages are sample data.
 * The demo deliberately avoids clinical advice — it handles scheduling,
 * communication, and administrative workflows only.
 */
export const dentalConfig: IndustryConfig = {
  slug: "dental",
  industry: "Dental Offices",
  systemName: "RSG Dental Front Desk System",
  osName: "Dental Front Desk System",
  businessName: "Brightwater Dental",
  description:
    "A patient communication and administrative support system that helps dental offices respond to inquiries, reactivate inactive patients, recover missed calls, and reduce repetitive front desk work.",
  outcome: "Answer every patient — even the ones who call at 7 PM — without adding staff.",
  problem:
    "The front desk juggles the phone, check-ins, insurance questions, and recall lists at the same time. After-hours callers reach voicemail and book with the next practice on their list.",
  workflows: [
    "After-hours missed-call text-back",
    "New patient appointment intake",
    "Overdue-recall patient reactivation",
    "Automated confirmations, forms & reminders",
    "Post-visit review requests with staff alerts",
  ],
  accentLabel: "Patient Communication",
  terminology: DEMO_TERMINOLOGY,
  leadsLabel: "Patients & inquiries",
  staff: [
    { id: "staff-patel", name: "Dr. Patel", role: "Dentist" },
    { id: "staff-sofia", name: "Sofia, RDH", role: "Hygienist" },
    { id: "staff-beth", name: "Beth", role: "Treatment coordinator" },
    { id: "staff-nina", name: "Nina", role: "Front desk" },
  ],
  roles: [
    {
      id: "owner",
      label: "Practice owner",
      description: "Full access — production, recall, reviews, and settings.",
      nav: [
        "overview", "leads", "pipeline", "conversations", "receptionist", "quotes",
        "automations", "tasks", "calendar", "reviews", "campaigns", "analytics", "settings",
      ],
    },
    {
      id: "manager",
      label: "Office manager",
      description: "Front desk workload, recall campaigns, and patient communication.",
      nav: [
        "overview", "leads", "pipeline", "conversations", "receptionist", "quotes",
        "tasks", "calendar", "reviews", "campaigns",
      ],
    },
    {
      id: "staff",
      label: "Front desk",
      description: "Conversations, today's schedule, and open tasks.",
      nav: ["overview", "conversations", "receptionist", "tasks", "calendar", "leads"],
    },
    {
      id: "provider",
      label: "Provider",
      description: "Their schedule and patient records — no admin noise.",
      nav: ["overview", "calendar", "leads"],
    },
  ],
  nav: [
    { id: "overview", label: "Overview" },
    { id: "leads", label: "Patients" },
    { id: "pipeline", label: "Appointments" },
    { id: "conversations", label: "Conversations" },
    { id: "receptionist", label: "AI Receptionist" },
    { id: "quotes", label: "Treatment Estimates" },
    { id: "automations", label: "Automations" },
    { id: "tasks", label: "Front Desk" },
    { id: "calendar", label: "Calendar" },
    { id: "reviews", label: "Reviews" },
    { id: "campaigns", label: "Recall" },
    { id: "analytics", label: "Analytics" },
    { id: "settings", label: "Settings" },
  ],
  metrics: [
    { id: "inquiries", label: "New patient inquiries", value: 19, delta: "+5 this week", deltaDir: "up" },
    { id: "missed-calls", label: "Missed calls recovered", value: 12, delta: "+4", deltaDir: "up", hint: "Text-back within 60 seconds" },
    { id: "requested", label: "Appointments requested", value: 15 },
    { id: "booked", label: "Appointments booked", value: 11, delta: "+3", deltaDir: "up" },
    { id: "reactivated", label: "Inactive patients contacted", value: 64, hint: "Overdue recall campaign" },
    { id: "recall-booked", label: "Reactivation appointments", value: 9, delta: "+9", deltaDir: "up" },
    { id: "tasks-automated", label: "Front desk tasks automated", value: 87, delta: "+31", deltaDir: "up", hint: "Confirmations, forms, reminders" },
    { id: "response", label: "Avg response time", value: 1, format: "minutes", delta: "-4 hrs", deltaGood: true, deltaDir: "down", hint: "Includes after-hours" },
    { id: "no-show-risk", label: "No-show risk", value: 6, format: "percent", delta: "-3 pts", deltaDir: "down", deltaGood: true, hint: "Visits missing a confirmation or forms" },
  ],
  stages: [
    { id: "inquiry", label: "New Inquiry" },
    { id: "info", label: "Info Collected" },
    { id: "requested", label: "Time Requested" },
    { id: "review", label: "Front Desk Review" },
    { id: "confirmed", label: "Confirmed" },
    { id: "forms", label: "Forms Complete" },
    { id: "seen", label: "Visit Complete" },
  ],
  leads: [
    { id: "l-walsh", name: "Karen Walsh", service: "New patient cleaning + exam", source: "Missed call (after hours)", stageId: "confirmed", lastActivity: "1 hr ago", temp: "warm" },
    { id: "l-turner", name: "Malik Turner", service: "Invisalign consultation", source: "Website form", stageId: "requested", lastActivity: "Today 9:15 AM", temp: "hot", note: "Asked about payment plans — flagged for treatment coordinator" },
    { id: "l-russo", name: "Angela Russo", service: "Crown consultation (existing patient)", source: "Phone", stageId: "review", lastActivity: "Today 10:02 AM" },
    { id: "l-hoang", name: "Peter Hoang", service: "Overdue cleaning — 14 months", source: "Recall campaign", stageId: "requested", lastActivity: "2 hrs ago", temp: "warm", note: "Replied to recall text, picked two possible times" },
    { id: "l-silva", name: "Marta Silva", service: "Implant consultation", source: "Google Business Profile", stageId: "info", lastActivity: "Yesterday", temp: "hot" },
    { id: "l-becker", name: "Ross Becker", service: "Emergency appointment request", source: "Missed call", stageId: "confirmed", lastActivity: "Yesterday", note: "Escalated to staff — offered same-day slot per office protocol" },
    { id: "l-james", name: "Diane James", service: "Whitening consultation", source: "Instagram", stageId: "inquiry", lastActivity: "Yesterday", temp: "cold" },
    { id: "l-cho", name: "Grace Cho", service: "6-month recall cleaning", source: "Recall campaign", stageId: "seen", lastActivity: "Monday" },
  ],
  conversations: [
    {
      id: "c-walsh",
      contact: "Karen Walsh",
      channel: "sms",
      topic: "After-hours missed call — recovered",
      messages: [
        { id: "kw-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, you've reached Brightwater Dental — sorry we missed your call, the office is closed until 8 AM. Are you a new or existing patient? For dental emergencies, please follow our emergency line instructions at (508) 555-0119 or call 911 for medical emergencies.", time: "Yesterday 7:04 PM" },
        { id: "kw-2", from: "contact", text: "New patient! Just moved to town, looking to get a cleaning scheduled", time: "7:09 PM" },
        { id: "kw-3", from: "system", meta: "Automated · Intake", text: "Welcome to town! We'd love to get you in. Could I grab your name and whether you have dental insurance? Then I'll send a link to pick a time that works.", time: "7:09 PM" },
        { id: "kw-4", from: "contact", text: "Karen Walsh, and yes — Delta Dental through my employer", time: "7:14 PM" },
        { id: "kw-5", from: "system", meta: "Automated · Scheduling link", text: "Thanks Karen! We're in-network with Delta Dental. Pick a time here: brightwater.demo/schedule — new patient cleanings are 60 minutes. The front desk will confirm in the morning.", time: "7:14 PM" },
      ],
    },
    {
      id: "c-turner",
      contact: "Malik Turner",
      channel: "web",
      topic: "Invisalign consultation request",
      unread: true,
      messages: [
        { id: "mt-1", from: "system", meta: "Automated · Form response", text: "Hi Malik, thanks for your Invisalign consultation request! Dr. Patel runs those on Tuesdays and Thursdays. Do mornings or afternoons work better for you?", time: "Today 9:02 AM" },
        { id: "mt-2", from: "contact", text: "Afternoons. Also — do you offer payment plans for Invisalign?", time: "9:15 AM" },
        { id: "mt-3", from: "system", meta: "Automated · Routed to staff", text: "Great question — our treatment coordinator Beth handles financing options and will text you today with specifics. Meanwhile, here are Thursday afternoon openings: brightwater.demo/schedule", time: "9:15 AM" },
      ],
    },
    {
      id: "c-hoang",
      contact: "Peter Hoang",
      channel: "sms",
      topic: "Recall — overdue 14 months",
      messages: [
        { id: "ph-1", from: "system", meta: "Automated · Recall campaign", text: "Hi Peter, it's Brightwater Dental. It's been about 14 months since your last cleaning with us — Dr. Patel recommends every 6 months. Want me to send a few times? It takes 10 seconds to book.", time: "Today 8:00 AM" },
        { id: "ph-2", from: "contact", text: "Wow, time flies. Yes — early mornings if you have them", time: "10:12 AM" },
        { id: "ph-3", from: "system", meta: "Automated · Scheduling", text: "We do! Tuesday 7:30 AM or Friday 8:00 AM are open with hygienist Dana. Which works? I'll hold it for you.", time: "10:12 AM" },
      ],
    },
    {
      id: "c-becker",
      contact: "Ross Becker",
      channel: "sms",
      topic: "Urgent request — escalated to staff",
      messages: [
        { id: "rb-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, you've reached Brightwater Dental — sorry we missed your call. Are you a new or existing patient, and how can we help? If this is a dental emergency, please follow our emergency line instructions at (508) 555-0119.", time: "Yesterday 12:40 PM" },
        { id: "rb-2", from: "contact", text: "Existing patient. Cracked a molar at lunch, in a fair amount of pain", time: "12:44 PM" },
        { id: "rb-3", from: "system", meta: "Automated · Escalated", text: "I'm flagging this for our front desk right now, Ross — someone will call you within a few minutes. If pain becomes severe, please use our emergency line: (508) 555-0119.", time: "12:44 PM" },
        { id: "rb-4", from: "staff", meta: "Nicole (front desk)", text: "Hi Ross, Nicole from Brightwater — just tried your line. Dr. Patel can see you today at 3:15 PM. Does that work?", time: "12:49 PM" },
        { id: "rb-5", from: "contact", text: "Yes. Thank you for the fast response!", time: "12:51 PM" },
      ],
    },
  ],
  tasks: [
    { id: "t-russo", title: "Review crown consult request — Angela Russo prefers Fridays, verify Dr. Patel's schedule", assignee: "Nicole (front desk)", due: "Today", auto: true },
    { id: "t-turner", title: "Beth: text Malik Turner Invisalign financing options (asked this morning)", assignee: "Beth (treatment coord.)", due: "Today", priority: "high", auto: true },
    { id: "t-silva", title: "Call Marta Silva — implant consult, prefers phone for scheduling", assignee: "Nicole (front desk)", due: "Today", auto: true },
    { id: "t-forms", title: "Incomplete intake forms: 2 patients on tomorrow's schedule — reminder sent, verify by 4 PM", assignee: "Nicole (front desk)", due: "Today", auto: true },
    { id: "t-insurance", title: "Route insurance eligibility question (Guardian PPO) to billing", assignee: "Billing", due: "Tomorrow", auto: true, done: true },
  ],
  activity: [
    { id: "a-1", icon: "message", text: "Peter Hoang replied to recall campaign — offered two morning slots.", time: "10:12 AM" },
    { id: "a-2", icon: "alert", text: "Invisalign financing question routed to treatment coordinator (Malik Turner).", time: "9:15 AM" },
    { id: "a-3", icon: "campaign", text: "Overdue-recall batch sent to 32 patients (9–15 months since last visit).", time: "8:00 AM" },
    { id: "a-4", icon: "automation", text: "Appointment confirmations sent to tomorrow's 14 patients; 11 confirmed so far.", time: "7:30 AM" },
    { id: "a-5", icon: "call", text: "After-hours call from Karen Walsh — text-back sent in 38 seconds.", time: "Yesterday 7:04 PM" },
    { id: "a-6", icon: "alert", text: "Urgent request escalated: Ross Becker (cracked molar) — staff called in 5 min.", time: "Yesterday 12:44 PM" },
    { id: "a-7", icon: "task", text: "Intake form reminder sent to 2 patients with incomplete forms.", time: "Yesterday 4:00 PM" },
    { id: "a-8", icon: "review", text: "Review request sent to Grace Cho after recall cleaning.", time: "Monday 3:30 PM" },
  ],
  calendar: [
    { id: "cal-1", day: "Tue", date: "Jul 14", time: "7:30 AM", title: "Recall cleaning hold — Peter Hoang", withWhom: "Dana, RDH", status: "pending" },
    { id: "cal-2", day: "Tue", date: "Jul 14", time: "3:15 PM", title: "Emergency slot — Ross Becker (cracked molar)", withWhom: "Dr. Patel", status: "confirmed" },
    { id: "cal-3", day: "Wed", date: "Jul 15", time: "9:00 AM", title: "New patient cleaning + exam — Karen Walsh", withWhom: "Dana, RDH + Dr. Patel", status: "confirmed" },
    { id: "cal-4", day: "Thu", date: "Jul 16", time: "2:30 PM", title: "Invisalign consult — Malik Turner", withWhom: "Dr. Patel", status: "pending" },
    { id: "cal-5", day: "Fri", date: "Jul 17", time: "11:00 AM", title: "Crown consult — Angela Russo", withWhom: "Dr. Patel", status: "pending" },
  ],
  reviews: [
    { id: "r-1", name: "Grace Cho", service: "Recall cleaning", status: "requested", time: "Monday" },
    { id: "r-2", name: "Tom Delgado", service: "New patient exam", status: "completed", rating: 5, note: "Booked by text at 9 PM, seen two days later. Smoothest dental visit I've had.", time: "Last week" },
    { id: "r-3", name: "Sandra Levine", service: "Crown placement", status: "completed", rating: 5, note: "The reminders and forms ahead of time made everything easy.", time: "Last week" },
    { id: "r-4", name: "Bill Hutchins", service: "Cleaning", status: "flagged", note: "Front desk was great, but I was billed before insurance processed.", time: "2 weeks ago" },
    { id: "r-5", name: "Ava Martinez", service: "Whitening", status: "completed", rating: 4, time: "3 weeks ago" },
  ],
  campaigns: [
    {
      id: "camp-1",
      name: "Overdue hygiene recall — 9 to 15 months",
      audience: "Active patients overdue for cleaning/exam",
      filters: ["Last visit 9–15 months ago", "Status: active patient", "No future appointment", "Insurance on file"],
      message: "Hi {first name}, it's Brightwater Dental. It's been about {months} months since your last cleaning — Dr. Patel recommends every 6. Reply YES and we'll text you times, or book directly: brightwater.demo/schedule",
      stats: { sent: 64, replied: 21, booked: 9 },
      status: "active",
    },
    {
      id: "camp-2",
      name: "Unscheduled treatment follow-up",
      audience: "Patients with diagnosed, unscheduled treatment plans",
      filters: ["Treatment plan: presented, unscheduled", "Presented 30–120 days ago", "Excludes patients who declined"],
      message: "Hi {first name}, Dr. Patel asked us to check in on the treatment we discussed at your last visit. If you have questions about timing or costs, Beth can walk you through options — or grab a time here: brightwater.demo/schedule",
      stats: { sent: 27, replied: 8, booked: 5 },
      status: "active",
    },
    {
      id: "camp-3",
      name: "Lapsed patients — 18+ months",
      audience: "Patients with no visit in 18+ months",
      filters: ["Last visit > 18 months", "Not marked transferred/inactive"],
      message: "Hi {first name}, it's been a while since we've seen you at Brightwater Dental! We'd love to get you back on schedule — new morning and evening hours make it easier. Want us to text you some options?",
      stats: { sent: 96, replied: 17, booked: 7 },
      status: "completed",
    },
  ],
  automations: [
    { id: "auto-1", kind: "follow-up", name: "Missed-call text-back", trigger: "Any call unanswered (incl. after hours)", steps: ["Instant text with emergency-line notice", "Ask new vs. existing patient", "Collect reason for visit & preferences", "Send scheduling link", "Escalate urgent or complex messages to staff"], runsThisMonth: 58, status: "active" },
    { id: "auto-2", kind: "follow-up", name: "New patient intake", trigger: "Website form or scheduling link used", steps: ["Collect contact, insurance status, visit reason", "Request preferred days & urgency", "Create front-desk review task", "Send confirmation + intake forms on approval"], runsThisMonth: 34, status: "active" },
    { id: "auto-3", kind: "follow-up", name: "Appointment confirmations & reminders", trigger: "Appointment on tomorrow's schedule", steps: ["Confirmation request the day before", "Morning-of reminder with directions", "Flag unconfirmed patients to front desk", "Track incomplete intake forms"], runsThisMonth: 212, status: "active" },
    { id: "auto-4", kind: "follow-up", name: "Hygiene recall reactivation", trigger: "Patient passes overdue threshold", steps: ["Segment by months overdue & insurance", "Send personalized recall message", "Offer direct scheduling link", "Alert staff when patients request help"], runsThisMonth: 64, status: "active" },
    { id: "auto-5", kind: "follow-up", name: "Post-visit review request", trigger: "Eligible appointment completed", steps: ["Thank-you message same evening", "Ask for feedback first", "Positive → review link", "Concern → alert front desk for personal follow-up"], runsThisMonth: 71, status: "active" },
    { id: "auto-6", kind: "follow-up", name: "Insurance question routing", trigger: "Message mentions insurance/coverage", steps: ["Acknowledge and set expectations", "Create billing task with full context", "Notify patient when billing responds"], runsThisMonth: 23, status: "active" },
  ],
  templates: DEMO_TEMPLATES,
  intakeFields: DEMO_INTAKE_FIELDS,
  quote: {
    title: "Instant treatment estimate",
    description:
      "The administrative estimate tool the front desk uses when a patient asks \"what will this cost me?\" — with insurance adjustments applied automatically. Estimates become records with follow-up.",
    documentLabel: "Treatment estimate",
    base: { label: "Exam & imaging", amount: 180 },
    fields: [
      {
        id: "procedure",
        label: "Procedure",
        options: [
          { label: "New patient cleaning + exam", amount: 220 },
          { label: "Whitening (in-office)", amount: 450 },
          { label: "Crown (per tooth)", amount: 1450 },
          { label: "Invisalign (full treatment)", amount: 4800 },
          { label: "Implant (consult + placement)", amount: 3900 },
        ],
      },
      {
        id: "insurance",
        label: "Insurance adjustment (estimated)",
        options: [
          { label: "No insurance", amount: 0 },
          { label: "In-network PPO", amount: -380 },
          { label: "Out-of-network plan", amount: -150 },
        ],
        helper: "Estimates only — the system verifies benefits before the visit.",
      },
      {
        id: "financing",
        label: "Payment",
        options: [
          { label: "Monthly payment plan", amount: 0 },
          { label: "Pay in full (courtesy discount)", amount: -100 },
        ],
      },
    ],
    acceptedStageId: "confirmed",
    disclaimer:
      "Sample administrative estimate — actual treatment and costs are determined by the dentist after clinical evaluation.",
  },
  receptionist: {
    scenarioLabel: "After-hours call — 7:04 PM",
    description: "The office closed at 5. The phone rings anyway — this is where practices lose new patients to whoever answers next.",
    callerRole: "a caller reaching the practice after hours",
    start: "greet",
    nodes: [
      {
        id: "greet",
        say: "Hi, you've reached Brightwater Dental — the office is closed until 8 AM, but I'm the practice's automated assistant and I can help with scheduling and questions right now. Please note: for dental emergencies with severe pain, swelling, or injury, follow our emergency line instructions; call 911 for medical emergencies. How can I help?",
        meta: "Emergency protocol always stated first",
        choices: [
          { id: "c-new", label: "I'm a new patient — I need a cleaning and exam.", next: "insurance" },
          { id: "c-pain", label: "I have a toothache that's getting worse.", next: "triage" },
          { id: "c-ins", label: "Do you take Delta Dental?", next: "ins-answer" },
        ],
      },
      {
        id: "ins-answer",
        say: "We do — Brightwater is in-network with Delta Dental, plus most major PPO plans. Would you like to set up a visit? I can also have Beth, our treatment coordinator, verify your exact benefits before you come in.",
        meta: "Answers from your office playbook",
        choices: [
          { id: "c-new2", label: "Great — I'd like a new patient cleaning.", next: "insurance" },
        ],
      },
      {
        id: "triage",
        say: "I'm sorry you're dealing with that — I can't give medical advice, but I can get you seen quickly. Is there severe pain, facial swelling, or bleeding right now?",
        meta: "Escalation rules from office protocol",
        choices: [
          { id: "c-severe", label: "Yes — it's pretty severe.", next: "done-emergency" },
          { id: "c-mild", label: "No, it's uncomfortable but manageable.", next: "sameday" },
        ],
      },
      {
        id: "done-emergency",
        say: "Please follow our emergency line instructions at (508) 555-0119 now — I've also paged Dr. Patel's on-call service and flagged your number so the team follows up first thing. If this becomes a medical emergency, call 911.",
        outcome: {
          summary: [
            "The caller was routed to the emergency line per office protocol — no medical advice given.",
            "The on-call service was paged and a first-thing follow-up task was created.",
            "The call was logged so the morning team has full context.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-emerg", name: "After-hours caller", service: "Emergency escalation — severe pain", source: "Missed call (after hours)", stageId: "review", lastActivity: "Just now", temp: "hot", note: "Escalated to emergency line + on-call page at 7:04 PM per protocol", assignee: "Nina" } },
            { kind: "task", task: { id: "t-ai-emerg", title: "First thing: call back after-hours emergency caller — escalated to on-call at 7:04 PM", assignee: "Nina", due: "8:00 AM", priority: "high", auto: true } },
            { kind: "metric", id: "missed-calls", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-emerg", title: "Emergency escalated per protocol", body: "On-call paged, morning follow-up task created. Simulated.", tone: "alert" } },
          ],
        },
      },
      {
        id: "sameday",
        say: "Understood. Dr. Patel holds same-day slots for situations like this — tomorrow has 8:20 AM or 11:40 AM open. Which works for you?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-820", label: "8:20 AM, please.", next: "done-sameday" },
          { id: "c-1140", label: "11:40 is better.", next: "done-sameday" },
        ],
      },
      {
        id: "done-sameday",
        say: "You're booked for tomorrow with Dr. Patel. I'm texting your confirmation and new-patient forms now — filling them out tonight saves you 15 minutes at the desk. Feel better soon!",
        outcome: {
          summary: [
            "A same-day-protocol appointment was booked at 7 PM with nobody in the office.",
            "Forms went out automatically so check-in is fast tomorrow.",
            "The patient record, conversation, and front-desk task are all connected.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-tooth", name: "Sam Rivera", service: "Same-day appointment — tooth pain", source: "Missed call (after hours)", stageId: "confirmed", lastActivity: "Just now", temp: "hot", note: "Booked by AI receptionist at 7:04 PM · manageable pain, same-day protocol", assignee: "Dr. Patel" } },
            { kind: "calendar", event: { id: "cal-ai-tooth", day: "Fri", date: "Jul 17", time: "8:20 AM", title: "Same-day visit — Sam Rivera", withWhom: "Dr. Patel", status: "confirmed" } },
            { kind: "conversation", conversation: { id: "c-ai-tooth", contact: "Sam Rivera", channel: "phone", topic: "After-hours call — same-day booked", unread: true, messages: [
              { id: "ai-sd-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call: tooth pain, manageable per caller. Same-day protocol slot booked 8:20 AM with Dr. Patel. Forms texted. No clinical advice given.", time: "Just now" },
            ] } },
            { kind: "metric", id: "missed-calls", delta: 1 },
            { kind: "metric", id: "booked", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-tooth", title: "After-hours call converted", body: "Sam Rivera — same-day slot 8:20 AM. Booked at 7:04 PM.", tone: "success" } },
          ],
        },
      },
      {
        id: "insurance",
        say: "Welcome! We'd love to get you in. Do you have dental insurance? If so, which plan — I'll check the network and note it for the front desk.",
        meta: "Collects intake details",
        choices: [
          { id: "c-delta", label: "Yes — Delta Dental through my employer.", next: "book-cleaning" },
          { id: "c-noins", label: "No insurance — I'll pay out of pocket.", next: "book-cleaning" },
        ],
      },
      {
        id: "book-cleaning",
        say: "Noted. New patient cleanings are 60 minutes with Sofia, our hygienist. I have Thursday 9:00 AM or Friday 2:00 PM open — which is better?",
        meta: "Checks the live schedule",
        choices: [
          { id: "c-thu9", label: "Thursday at 9.", next: "done-cleaning" },
          { id: "c-fri2", label: "Friday at 2.", next: "done-cleaning" },
        ],
      },
      {
        id: "done-cleaning",
        say: "All set — you're booked for a new patient cleaning and exam. Your confirmation and intake forms are on the way by text, and the front desk will verify your benefits before your visit. Welcome to Brightwater!",
        outcome: {
          summary: [
            "A 7 PM caller became a booked new patient — no voicemail, no lost lead.",
            "Insurance details were captured and queued for benefits verification.",
            "Forms went out automatically and the front desk got a morning review task.",
          ],
          effects: [
            { kind: "lead", lead: { id: "l-ai-clean", name: "Jamie Fletcher", service: "New patient cleaning + exam", source: "Missed call (after hours)", stageId: "confirmed", lastActivity: "Just now", temp: "warm", note: "Delta Dental · booked by AI receptionist at 7:04 PM · benefits verification queued", assignee: "Sofia, RDH" } },
            { kind: "calendar", event: { id: "cal-ai-clean", day: "Thu", date: "Jul 16", time: "9:00 AM", title: "New patient cleaning — Jamie Fletcher", withWhom: "Sofia, RDH", status: "confirmed" } },
            { kind: "task", task: { id: "t-ai-clean", title: "Verify Delta Dental benefits — Jamie Fletcher (new patient, Thu 9:00 AM)", assignee: "Nina", due: "Tomorrow", auto: true } },
            { kind: "conversation", conversation: { id: "c-ai-clean", contact: "Jamie Fletcher", channel: "phone", topic: "After-hours call — new patient booked", messages: [
              { id: "ai-c-1", from: "system", meta: "AI receptionist · call summary", text: "After-hours call handled: new patient, Delta Dental. Cleaning + exam booked Thu 9:00 AM with Sofia. Forms texted; benefits verification task created.", time: "Just now" },
            ] } },
            { kind: "metric", id: "inquiries", delta: 1 },
            { kind: "metric", id: "missed-calls", delta: 1 },
            { kind: "metric", id: "booked", delta: 1 },
            { kind: "notify", notification: { id: "n-ai-clean", title: "New patient booked after hours", body: "Jamie Fletcher — Thu 9:00 AM cleaning. Captured at 7:04 PM.", tone: "success" } },
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
      title: "Patient inquiries per week",
      unit: "inquiries",
      points: [
        { label: "W1", value: 11 }, { label: "W2", value: 12 }, { label: "W3", value: 10 },
        { label: "W4", value: 14 }, { label: "W5", value: 15 }, { label: "W6", value: 16 },
        { label: "W7", value: 17 }, { label: "W8", value: 19 },
      ],
    },
    responseTime: {
      title: "Average response time (minutes)",
      unit: "minutes",
      points: [
        { label: "W1", value: 260 }, { label: "W2", value: 180 }, { label: "W3", value: 95 },
        { label: "W4", value: 30 }, { label: "W5", value: 8 }, { label: "W6", value: 3 },
        { label: "W7", value: 2 }, { label: "W8", value: 1 },
      ],
    },
    funnel: {
      title: "Inquiry → visit funnel (8 weeks)",
      points: [
        { label: "Inquiries & recalls", value: 178 },
        { label: "Info collected", value: 141 },
        { label: "Times requested", value: 104 },
        { label: "Appointments confirmed", value: 89 },
        { label: "Visits completed", value: 81 },
      ],
    },
    sources: [
      { name: "Recall campaigns", leads: 52, booked: 28 },
      { name: "Google / website", leads: 41, booked: 22 },
      { name: "Missed calls", leads: 34, booked: 19 },
      { name: "Referrals", leads: 26, booked: 17 },
      { name: "Instagram", leads: 12, booked: 4 },
    ],
    kpis: [
      { id: "k-1", label: "Missed calls recovered", value: 74, format: "percent", delta: "+74 pts", deltaDir: "up", hint: "Previously lost to voicemail" },
      { id: "k-2", label: "Recall reply rate", value: 33, format: "percent", delta: "+18 pts", deltaDir: "up" },
      { id: "k-3", label: "Confirmation rate (T-24h)", value: 91, format: "percent", delta: "+12 pts", deltaDir: "up" },
      { id: "k-4", label: "Front desk hours saved / wk", value: 14, delta: "+14", deltaDir: "up" },
    ],
  },
  scenario: {
    title: "A 7 PM new-patient call hits voicemail — watch the system catch it.",
    intro:
      "The problem: after-hours callers reach voicemail and book with the next practice on their list. Run the scenario to watch a missed call become a confirmed new-patient appointment before the office even opens.",
    steps: [
      {
        id: "s-1",
        title: "A new patient calls after business hours",
        detail: "7:02 PM. The office closed at 5. Lauren Pierce, new to town, calls about getting established — and gets voicemail.",
        tab: "overview",
        effects: [
          { kind: "activity", item: { id: "a-s1", icon: "call", text: "After-hours call from (774) 555-0186 — no answer, office closed.", time: "Just now" } },
        ],
      },
      {
        id: "s-2",
        title: "The call is missed — but not lost",
        detail: "The system logs the missed call and starts the text-back workflow immediately. No overnight gap, no morning callback list.",
        tab: "automations",
        effects: [
          { kind: "metric", id: "missed-calls", delta: 1 },
          { kind: "notify", notification: { id: "n-s2", title: "Missed call — text-back triggered", body: "After-hours caller received an immediate response.", tone: "alert" } },
        ],
      },
      {
        id: "s-3",
        title: "An immediate text goes out",
        detail: "New vs. existing patient, how can we help — plus a clear notice that emergencies should use the office's emergency line or 911.",
        tab: "conversations",
        effects: [
          {
            kind: "conversation",
            conversation: {
              id: "c-lauren",
              contact: "Lauren Pierce",
              channel: "sms",
              topic: "After-hours missed call",
              unread: true,
              messages: [
                { id: "lp-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, you've reached Brightwater Dental — sorry we missed your call, the office is closed until 8 AM. Are you a new or existing patient, and how can we help? If this is a dental emergency, please follow our emergency line instructions at (508) 555-0119, or call 911 for medical emergencies.", time: "Just now" },
              ],
            },
          },
        ],
      },
      {
        id: "s-4",
        title: "She wants a new patient cleaning",
        detail: "Lauren replies at 7:06 PM — the moment when she would otherwise be dialing the next practice on Google.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-2", from: "contact", text: "New patient! We just moved here — looking to set up a cleaning and exam for myself, maybe my husband too", time: "Just now" } },
          { kind: "metric", id: "inquiries", delta: 1 },
        ],
      },
      {
        id: "s-5",
        title: "The system collects the basics",
        detail: "Name, insurance status, preferred days — the same intake questions the front desk asks, minus the hold music.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-3", from: "system", meta: "Automated · Intake", text: "Welcome to the area! Happy to get you both set up. Could I grab your name, whether you have dental insurance, and which days usually work best?", time: "Just now" } },
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-4", from: "contact", text: "Lauren Pierce, Cigna PPO, and Wednesdays or Fridays are best", time: "Just now" } },
          { kind: "lead", lead: { id: "l-lauren", name: "Lauren Pierce", service: "New patient cleaning + exam (x2)", source: "Missed call (after hours)", stageId: "info", lastActivity: "Just now", temp: "hot", note: "Cigna PPO · prefers Wed/Fri · spouse may also join" } },
        ],
      },
      {
        id: "s-6",
        title: "A scheduling link is sent",
        detail: "In-network confirmation and a direct link to open Wednesday and Friday slots. Booking takes her under a minute.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-5", from: "system", meta: "Automated · Scheduling link", text: "Great news — we're in-network with Cigna PPO. Here are open new-patient times on Wednesdays and Fridays: brightwater.demo/schedule. Pick what works and we'll take it from there!", time: "Just now" } },
          { kind: "metric", id: "requested", delta: 1 },
        ],
      },
      {
        id: "s-7",
        title: "Lauren picks a time",
        detail: "Friday 10:00 AM. The slot is held and the request is queued for front-desk review — the system proposes, your team approves.",
        tab: "pipeline",
        effects: [
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-6", from: "contact", text: "Just requested Friday at 10am. Thank you — this was so easy!", time: "Just now" } },
          { kind: "stage", leadId: "l-lauren", stageId: "requested" },
          { kind: "calendar", event: { id: "cal-lauren", day: "Fri", date: "Jul 17", time: "10:00 AM", title: "New patient cleaning + exam — Lauren Pierce (hold)", withWhom: "Dana, RDH + Dr. Patel", status: "pending" } },
        ],
      },
      {
        id: "s-8",
        title: "The front desk gets a review task",
        detail: "At 8 AM, Nicole sees one task: confirm Lauren's Friday hold and verify insurance — not a voicemail queue and a cold callback.",
        tab: "tasks",
        effects: [
          { kind: "task", task: { id: "t-lauren", title: "Confirm Friday 10 AM hold + verify Cigna eligibility — Lauren Pierce (new patient x2)", assignee: "Nicole (front desk)", due: "Today 8 AM", priority: "high", auto: true } },
          { kind: "stage", leadId: "l-lauren", stageId: "review" },
          { kind: "notify", notification: { id: "n-s8", title: "New patient request ready for review", body: "Lauren Pierce — Friday 10 AM hold, Cigna PPO, intake queued.", tone: "success" } },
        ],
      },
      {
        id: "s-9",
        title: "Confirmation and forms go out",
        detail: "Nicole approves with one click. Lauren gets her confirmation, intake forms, and directions — form completion is tracked automatically.",
        tab: "conversations",
        effects: [
          { kind: "message", conversationId: "c-lauren", message: { id: "lp-7", from: "system", meta: "Automated · Confirmation", text: "You're confirmed, Lauren — Friday, Jul 17 at 10:00 AM with Dr. Patel. Your new-patient forms: brightwater.demo/forms (5 min, saves you time at check-in). Parking is behind the building.", time: "Just now" } },
          { kind: "stage", leadId: "l-lauren", stageId: "confirmed" },
          { kind: "metric", id: "booked", delta: 1 },
          { kind: "metric", id: "tasks-automated", delta: 3 },
          { kind: "completeTask", taskId: "t-lauren" },
        ],
      },
      {
        id: "s-10",
        title: "The patient joins the appointment pipeline",
        detail: "Reminders are scheduled, forms are tracked, and the no-show risk flag is armed. Lauren — and probably her husband — are Brightwater patients now.",
        tab: "pipeline",
        effects: [
          { kind: "activity", item: { id: "a-s10", icon: "automation", text: "Reminder sequence + form tracking armed for Lauren Pierce (Fri 10 AM).", time: "Just now" } },
        ],
      },
      {
        id: "s-11",
        title: "The dashboard updates",
        detail: "One after-hours call: recovered, booked, and confirmed — with roughly 90 seconds of staff time. That's the front desk system working.",
        tab: "overview",
        effects: [
          { kind: "notify", notification: { id: "n-s11", title: "Scenario complete", body: "After-hours missed call → confirmed new patient, ~90 seconds of staff time.", tone: "success" } },
        ],
      },
      {
        id: "s-12",
        title: "Now try it yourself",
        detail:
          "Take a 7 PM call as the AI receptionist's caller, build a treatment estimate with insurance adjustments, or reschedule a visit on the calendar. Everything here is safe to touch.",
        tab: "receptionist",
        effects: [
          { kind: "notify", notification: { id: "n-s12", title: "Your turn", body: "Try the after-hours call, then price a procedure in Treatment Estimates.", tone: "default" } },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: "scn-new-patient",
      label: "New-patient inquiry to confirmed visit",
      description:
        "A 9:40 PM website inquiry becomes a confirmed, forms-complete new patient — insurance answered, slot held, front desk approves in one click.",
      steps: [
        {
          id: "sc-np-1",
          title: "A new-patient inquiry arrives at 9:40 PM",
          detail:
            "The office is dark. Priya Nair, new to town, writes in through the website: does Brightwater take MetLife PPO, and how far out are new-patient cleanings booking? The system picks it up instantly instead of queuing her for morning.",
          tab: "conversations",
          effects: [
            {
              kind: "conversation",
              conversation: {
                id: "c-priya",
                contact: "Priya Nair",
                channel: "web",
                topic: "New patient — insurance & availability",
                unread: true,
                messages: [
                  { id: "pn-1", from: "contact", text: "Hi — we just moved to the area. Do you take MetLife PPO? And how far out are you booking new patient cleanings?", time: "Just now" },
                ],
              },
            },
            { kind: "metric", id: "inquiries", delta: 1 },
            { kind: "activity", item: { id: "a-np-1", icon: "message", text: "After-hours website inquiry from Priya Nair — automated response engaged.", time: "Just now" } },
          ],
        },
        {
          id: "sc-np-2",
          title: "The AI answers insurance and availability",
          detail:
            "The AI answers from the office playbook: MetLife PPO is in-network. Then it reads open new-patient slots straight from the live schedule — at 9:40 PM, with nobody at the desk.",
          tab: "conversations",
          effects: [
            { kind: "message", conversationId: "c-priya", message: { id: "pn-2", from: "system", meta: "Automated · Office playbook", text: "Welcome to the area, Priya! Brightwater is in-network with MetLife PPO. New patient cleanings are 60 minutes with Sofia, our hygienist — Thursday 10:00 AM or Friday 2:00 PM are open this week. Want me to hold one?", time: "Just now" } },
            { kind: "lead", lead: { id: "l-priya", name: "Priya Nair", service: "New patient cleaning + exam", source: "Website chat (after hours)", stageId: "info", lastActivity: "Just now", temp: "hot", note: "MetLife PPO · asked about availability at 9:40 PM" } },
            { kind: "metric", id: "tasks-automated", delta: 1 },
          ],
        },
        {
          id: "sc-np-3",
          title: "She books Thursday at 10",
          detail:
            "Priya picks Thursday. The slot goes onto the calendar as a pending hold — the system proposes, the front desk approves. Nothing is final without a human.",
          tab: "calendar",
          effects: [
            { kind: "message", conversationId: "c-priya", message: { id: "pn-3", from: "contact", text: "Thursday at 10 works great. Let's do it!", time: "Just now" } },
            { kind: "stage", leadId: "l-priya", stageId: "requested" },
            { kind: "metric", id: "requested", delta: 1 },
            { kind: "calendar", event: { id: "cal-priya", day: "Thu", date: "Jul 16", time: "10:00 AM", title: "New patient cleaning + exam — Priya Nair (hold)", withWhom: "Sofia, RDH + Dr. Patel", status: "pending" } },
            { kind: "notify", notification: { id: "n-np-3", title: "New patient hold placed", body: "Priya Nair — Thu 10:00 AM, pending front-desk approval.", tone: "default" } },
          ],
        },
        {
          id: "sc-np-4",
          title: "The front desk gets one tidy task",
          detail:
            "At 8 AM, Nina sees a single review task with everything attached — name, plan, requested time — instead of a voicemail to decode and a cold callback to make.",
          tab: "tasks",
          effects: [
            { kind: "task", task: { id: "t-priya", title: "Approve Thu 10 AM hold + verify MetLife PPO benefits — Priya Nair (new patient)", assignee: "Nina", due: "Today 8 AM", priority: "high", auto: true } },
            { kind: "stage", leadId: "l-priya", stageId: "review" },
            { kind: "notify", notification: { id: "n-np-4", title: "Ready for review", body: "Priya Nair's hold is queued with insurance details attached.", tone: "default" } },
          ],
        },
        {
          id: "sc-np-5",
          title: "Approved — confirmation and intake forms go out",
          detail:
            "Nina approves with one click. The confirmation, digital intake forms, and parking directions send automatically, and the system starts tracking form completion.",
          tab: "conversations",
          effects: [
            { kind: "completeTask", taskId: "t-priya" },
            { kind: "appointmentStatus", eventId: "cal-priya", status: "confirmed" },
            { kind: "stage", leadId: "l-priya", stageId: "confirmed" },
            { kind: "metric", id: "booked", delta: 1 },
            { kind: "message", conversationId: "c-priya", message: { id: "pn-4", from: "system", meta: "Automated · Confirmation + forms", text: "You're confirmed, Priya — Thursday, Jul 16 at 10:00 AM with Sofia and Dr. Patel. Your new-patient forms: brightwater.demo/forms (about 5 minutes, saves time at check-in). Parking is behind the building.", time: "Just now" } },
            { kind: "metric", id: "tasks-automated", delta: 2 },
          ],
        },
        {
          id: "sc-np-6",
          title: "Forms come back the same night",
          detail:
            "Priya finishes her digital intake from the couch. Her record moves to Forms Complete — no clipboard at check-in, no double entry for the front desk.",
          tab: "pipeline",
          effects: [
            { kind: "message", conversationId: "c-priya", message: { id: "pn-5", from: "contact", text: "Forms are done — that was easy. See you Thursday!", time: "Just now" } },
            { kind: "stage", leadId: "l-priya", stageId: "forms" },
            { kind: "activity", item: { id: "a-np-6", icon: "automation", text: "Intake forms completed by Priya Nair — chart-ready before her first visit.", time: "Just now" } },
          ],
        },
        {
          id: "sc-np-7",
          title: "Reminders arm and no-show risk drops",
          detail:
            "A day-before confirmation and a morning-of reminder schedule themselves. A confirmed time plus completed forms puts Priya in the lowest no-show-risk band — and the dashboard shows it.",
          tab: "overview",
          effects: [
            { kind: "metric", id: "no-show-risk", delta: -1 },
            { kind: "metric", id: "tasks-automated", delta: 2 },
            { kind: "activity", item: { id: "a-np-7", icon: "calendar", text: "Reminder sequence armed for Priya Nair (Thu 10:00 AM) — T-24h confirmation + morning-of text.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-np-7", title: "Scenario complete", body: "After-hours inquiry → confirmed, forms-complete new patient. Simulated end to end.", tone: "success" } },
          ],
        },
      ],
    },
    {
      id: "scn-plan-followup",
      label: "Unscheduled treatment plan follow-up",
      description:
        "A crown presented 42 days ago never got scheduled. Watch a gentle follow-up, a straight answer on cost, and a spot on Friday's schedule.",
      steps: [
        {
          id: "sc-tp-1",
          title: "The system flags a presented, unscheduled plan",
          detail:
            "A nightly sweep compares presented treatment plans against the schedule. Derek Foley's crown — presented 42 days ago, no appointment on file — enters the follow-up sequence.",
          tab: "campaigns",
          effects: [
            { kind: "lead", lead: { id: "l-foley", name: "Derek Foley", service: "Crown #30 — presented, unscheduled", source: "Treatment follow-up campaign", stageId: "info", lastActivity: "Just now", temp: "warm", note: "Crown presented 42 days ago · no appointment on file · follow-up sequence started" } },
            { kind: "activity", item: { id: "a-tp-1", icon: "automation", text: "Nightly sweep: Derek Foley's presented crown has no appointment — follow-up sequence started.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-tp-1", title: "Unscheduled treatment found", body: "Derek Foley — crown presented 42 days ago. Gentle follow-up queued.", tone: "default" } },
          ],
        },
        {
          id: "sc-tp-2",
          title: "A gentle check-in goes out",
          detail:
            "No pressure, no scare copy — the exact message Dr. Patel approved: a check-in with an easy way to ask about timing or cost, or to book directly.",
          tab: "conversations",
          effects: [
            {
              kind: "conversation",
              conversation: {
                id: "c-foley",
                contact: "Derek Foley",
                channel: "sms",
                topic: "Treatment follow-up — crown",
                messages: [
                  { id: "df-1", from: "system", meta: "Automated · Treatment follow-up", text: "Hi Derek, it's Brightwater Dental. Dr. Patel asked us to check in on the crown we discussed at your last visit. If timing or cost is the question, Beth can walk you through options — or grab a time here: brightwater.demo/schedule", time: "Just now" },
                ],
              },
            },
          ],
        },
        {
          id: "sc-tp-3",
          title: "Derek replies with the real objection: cost",
          detail:
            "He's been putting it off over price. The system doesn't guess at numbers — it routes the thread to Beth, the treatment coordinator, with the plan details attached.",
          tab: "tasks",
          effects: [
            { kind: "message", conversationId: "c-foley", message: { id: "df-2", from: "contact", text: "Honestly I've been putting it off — what would my share be with insurance?", time: "Just now" } },
            { kind: "conversationMeta", conversationId: "c-foley", patch: { unread: true } },
            { kind: "task", task: { id: "t-foley", title: "Beth: call Derek Foley with crown estimate + payment plan options (asked by text)", assignee: "Beth (treatment coord.)", due: "Today", priority: "high", auto: true } },
            { kind: "metric", id: "tasks-automated", delta: 1 },
            { kind: "notify", notification: { id: "n-tp-3", title: "Cost question routed", body: "Derek Foley's thread handed to Beth with full context.", tone: "alert" } },
          ],
        },
        {
          id: "sc-tp-4",
          title: "Beth answers with a written estimate",
          detail:
            "Beth builds the estimate in the system — crown, in-network adjustment, monthly plan option — and texts it back with two open Friday times. The estimate saves to Derek's record.",
          tab: "quotes",
          effects: [
            { kind: "quote", quote: { id: "q-foley", contact: "Derek Foley", leadId: "l-foley", lines: [{ label: "Crown (per tooth)", amount: 1450 }, { label: "In-network PPO adjustment (estimated)", amount: -380 }], total: 1070, status: "sent", createdAt: "Just now" } },
            { kind: "message", conversationId: "c-foley", message: { id: "df-3", from: "staff", meta: "Beth (treatment coord.)", text: "Hi Derek, Beth from Brightwater. With your PPO, the crown estimate comes to about $1,070, and a monthly plan is available. Dr. Patel has Friday 8:40 AM or 1:20 PM open — want me to hold one?", time: "Just now" } },
            { kind: "stage", leadId: "l-foley", stageId: "requested" },
            { kind: "metric", id: "requested", delta: 1 },
          ],
        },
        {
          id: "sc-tp-5",
          title: "The crown gets scheduled",
          detail:
            "Derek takes Friday 8:40. The visit lands on Dr. Patel's calendar, the estimate flips to accepted, and Beth's task closes itself — nothing left to remember.",
          tab: "calendar",
          effects: [
            { kind: "message", conversationId: "c-foley", message: { id: "df-4", from: "contact", text: "Friday 8:40 works. Thanks for making that painless.", time: "Just now" } },
            { kind: "calendar", event: { id: "cal-foley", day: "Fri", date: "Jul 17", time: "8:40 AM", title: "Crown prep — Derek Foley", withWhom: "Dr. Patel", status: "confirmed" } },
            { kind: "stage", leadId: "l-foley", stageId: "confirmed" },
            { kind: "quoteStatus", quoteId: "q-foley", status: "accepted" },
            { kind: "completeTask", taskId: "t-foley" },
            { kind: "metric", id: "booked", delta: 1 },
          ],
        },
        {
          id: "sc-tp-6",
          title: "Confirmation goes out — the plan stops leaking",
          detail:
            "The confirmation and pre-visit reminder schedule themselves. A treatment plan that sat stalled for 42 days moves to Friday's schedule in a single text thread.",
          tab: "overview",
          effects: [
            { kind: "message", conversationId: "c-foley", message: { id: "df-5", from: "system", meta: "Automated · Confirmation", text: "You're set, Derek — Friday, Jul 17 at 8:40 AM with Dr. Patel for your crown. We'll send a reminder the day before. Reply here anytime with questions.", time: "Just now" } },
            { kind: "metric", id: "tasks-automated", delta: 2 },
            { kind: "activity", item: { id: "a-tp-6", icon: "pipeline", text: "Unscheduled treatment recovered: Derek Foley's crown scheduled 42 days after presentation.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-tp-6", title: "Treatment plan scheduled", body: "A $1,070 estimated crown moved from 'presented' to Friday's schedule. Simulated.", tone: "success" } },
          ],
        },
      ],
    },
    {
      id: "scn-reactivation",
      label: "Overdue patient reactivation",
      description:
        "A recall campaign wakes a patient who drifted for 16 months, books the evening hygiene slot she actually wants, and asks for the review after her visit.",
      steps: [
        {
          id: "sc-ra-1",
          title: "The recall campaign finds Carla",
          detail:
            "The overdue-recall segment refreshes: Carla Mendes — last cleaning 16 months ago, no future appointment, insurance on file — lands in the next batch. One friendly message, easy opt-out.",
          tab: "campaigns",
          effects: [
            { kind: "activity", item: { id: "a-ra-1", icon: "campaign", text: "Recall batch sent to 12 overdue patients — includes Carla Mendes (16 months since last visit).", time: "Just now" } },
            { kind: "metric", id: "reactivated", delta: 12 },
            { kind: "notify", notification: { id: "n-ra-1", title: "Recall batch sent", body: "12 overdue patients contacted. Replies route back to this inbox.", tone: "default" } },
          ],
        },
        {
          id: "sc-ra-2",
          title: "Carla replies eight minutes later",
          detail:
            "\"Has it really been that long?\" She asks for evenings — the reason she drifted in the first place. The system logs her preference and checks the schedule for real evening openings.",
          tab: "conversations",
          effects: [
            {
              kind: "conversation",
              conversation: {
                id: "c-carla",
                contact: "Carla Mendes",
                channel: "sms",
                topic: "Recall — overdue 16 months",
                unread: true,
                messages: [
                  { id: "cm-1", from: "system", meta: "Automated · Recall campaign", text: "Hi Carla, it's Brightwater Dental. It's been about 16 months since your last cleaning — Dr. Patel recommends every 6. Want us to text you a few times? Booking takes 10 seconds.", time: "Just now" },
                  { id: "cm-2", from: "contact", text: "Oh wow, has it really been that long? Yes — do you have anything after 5? Work has been crazy", time: "Just now" },
                ],
              },
            },
            { kind: "lead", lead: { id: "l-carla", name: "Carla Mendes", service: "Overdue cleaning — 16 months", source: "Recall campaign", stageId: "info", lastActivity: "Just now", temp: "warm", note: "Prefers evenings after 5 PM · 16 months since last visit" } },
          ],
        },
        {
          id: "sc-ra-3",
          title: "An evening slot books itself",
          detail:
            "Tuesday 5:10 PM with Sofia is open. Carla taps the link and the visit books and confirms — the front desk never touches the phone.",
          tab: "calendar",
          effects: [
            { kind: "message", conversationId: "c-carla", message: { id: "cm-3", from: "system", meta: "Automated · Scheduling", text: "We added evening hours for exactly this — Tuesday 5:10 PM with Sofia, our hygienist, is open. Grab it here: brightwater.demo/schedule", time: "Just now" } },
            { kind: "message", conversationId: "c-carla", message: { id: "cm-4", from: "contact", text: "Booked the Tuesday 5:10. Thank you!!", time: "Just now" } },
            { kind: "calendar", event: { id: "cal-carla", day: "Tue", date: "Jul 14", time: "5:10 PM", title: "Recall cleaning — Carla Mendes", withWhom: "Sofia, RDH", status: "confirmed" } },
            { kind: "stage", leadId: "l-carla", stageId: "confirmed" },
            { kind: "metric", id: "recall-booked", delta: 1 },
            { kind: "metric", id: "booked", delta: 1 },
          ],
        },
        {
          id: "sc-ra-4",
          title: "Confirmation, forms, and reminders handle themselves",
          detail:
            "An updated health-history form goes out since it's been over a year, reminders schedule automatically, and Carla's record moves to Forms Complete when she finishes.",
          tab: "pipeline",
          effects: [
            { kind: "message", conversationId: "c-carla", message: { id: "cm-5", from: "system", meta: "Automated · Confirmation + forms", text: "You're confirmed for Tuesday, Jul 14 at 5:10 PM with Sofia. Since it's been a bit, here's a quick health-history update: brightwater.demo/forms. We'll remind you the day before.", time: "Just now" } },
            { kind: "stage", leadId: "l-carla", stageId: "forms" },
            { kind: "metric", id: "tasks-automated", delta: 3 },
            { kind: "activity", item: { id: "a-ra-4", icon: "automation", text: "Confirmation + health-history form sent to Carla Mendes; reminder sequence armed.", time: "Just now" } },
          ],
        },
        {
          id: "sc-ra-5",
          title: "Visit complete — the review request waits until evening",
          detail:
            "Tuesday's cleaning wraps up. That evening, the system sends a thank-you and asks how the visit went — feedback first, so any concern reaches staff instead of the internet.",
          tab: "reviews",
          effects: [
            { kind: "appointmentStatus", eventId: "cal-carla", status: "completed" },
            { kind: "stage", leadId: "l-carla", stageId: "seen" },
            { kind: "review", item: { id: "r-carla", name: "Carla Mendes", service: "Recall cleaning", status: "requested", time: "Just now" } },
            { kind: "activity", item: { id: "a-ra-5", icon: "review", text: "Post-visit thank-you + review request sent to Carla Mendes.", time: "Just now" } },
          ],
        },
        {
          id: "sc-ra-6",
          title: "Five stars — and a referral invite",
          detail:
            "Carla rates the visit five stars, so the system shares the review link and a refer-a-friend invite. Her recall clock resets so the 16-month gap never happens again.",
          tab: "reviews",
          effects: [
            { kind: "reviewStatus", reviewId: "r-carla", status: "completed", rating: 5 },
            { kind: "message", conversationId: "c-carla", message: { id: "cm-6", from: "contact", text: "Honestly the easiest dental visit I've ever set up. Left you 5 stars!", time: "Just now" } },
            { kind: "activity", item: { id: "a-ra-6", icon: "review", text: "Carla Mendes left a 5-star review — referral invite sent; next recall set for 6 months out.", time: "Just now" } },
            { kind: "notify", notification: { id: "n-ra-6", title: "Reactivation complete", body: "A 16-month lapse ends: cleaned, reviewed, and back on the 6-month cycle. Simulated.", tone: "success" } },
          ],
        },
      ],
    },
  ],
  simActions: [
    {
      id: "sim-missed-call",
      label: "Simulate missed call",
      description: "Lunch-rush call goes unanswered — text-back catches it.",
      tab: "conversations",
      effects: [
        { kind: "activity", item: { id: "a-sim-mc", icon: "call", text: "Missed call at 12:15 PM (lunch rush) — text-back sent in 40 seconds.", time: "Just now" } },
        {
          kind: "conversation",
          conversation: {
            id: "c-omar",
            contact: "Omar Haddad",
            channel: "sms",
            topic: "Missed call — appointment change",
            unread: true,
            messages: [
              { id: "oh-1", from: "system", meta: "Automated · Missed-call text-back", text: "Hi, you've reached Brightwater Dental — sorry we missed your call! Are you a new or existing patient, and how can we help? For dental emergencies, please use our emergency line: (508) 555-0119.", time: "Just now" },
              { id: "oh-2", from: "contact", text: "Existing — need to move my Thursday cleaning to next week if possible", time: "Just now" },
            ],
          },
        },
        { kind: "metric", id: "missed-calls", delta: 1 },
        { kind: "task", task: { id: "t-omar", title: "Reschedule Omar Haddad's Thursday cleaning to next week", assignee: "Nicole (front desk)", due: "Today", auto: true } },
        { kind: "notify", notification: { id: "n-sim-mc", title: "Missed call handled", body: "Omar Haddad's reschedule request captured — task created.", tone: "success" } },
      ],
    },
    {
      id: "sim-recall",
      label: "Run recall batch",
      description: "Contact the next segment of overdue patients.",
      tab: "campaigns",
      effects: [
        { kind: "activity", item: { id: "a-sim-rc", icon: "campaign", text: "Recall batch sent to 16 patients overdue 9–15 months.", time: "Just now" } },
        { kind: "metric", id: "reactivated", delta: 16 },
        { kind: "notify", notification: { id: "n-sim-rc", title: "Recall responses coming in", body: "3 replies in the first hour — 1 booked directly from the link.", tone: "success" } },
        { kind: "metric", id: "recall-booked", delta: 1 },
        { kind: "activity", item: { id: "a-sim-rc2", icon: "calendar", text: "Recall booking: patient self-scheduled a Tuesday cleaning from the campaign link.", time: "Just now" } },
      ],
    },
    {
      id: "sim-review",
      label: "Send review request",
      description: "A completed visit triggers the feedback-first flow.",
      tab: "reviews",
      effects: [
        { kind: "review", item: { id: "r-sim", name: "Ross Becker", service: "Emergency visit — crown", status: "requested", time: "Just now" } },
        { kind: "activity", item: { id: "a-sim-rev", icon: "review", text: "Review request sent to Ross Becker after emergency visit.", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-rev", title: "Review request sent", body: "Feedback is collected first — concerns alert staff for personal follow-up.", tone: "success" } },
      ],
    },
    {
      id: "sim-escalate",
      label: "Escalate urgent message",
      description: "A complex message routes straight to staff.",
      tab: "tasks",
      effects: [
        { kind: "notify", notification: { id: "n-sim-esc", title: "Staff attention required", body: "Patient message flagged: billing dispute + appointment question. Routed to Nicole.", tone: "alert" } },
        { kind: "task", task: { id: "t-esc", title: "Call patient re: billing question on last visit + reschedule request (flagged by system)", assignee: "Nicole (front desk)", due: "Today", priority: "high", auto: true } },
        { kind: "activity", item: { id: "a-sim-esc", icon: "alert", text: "Complex message escalated to staff — automation stands down on this thread.", time: "Just now" } },
      ],
    },
    {
      id: "sim-plan-nudge",
      label: "Nudge unscheduled treatment",
      description: "Follow up on a treatment plan that was presented but never scheduled.",
      tab: "conversations",
      effects: [
        {
          kind: "conversation",
          conversation: {
            id: "c-nadia",
            contact: "Nadia Brooks",
            channel: "sms",
            topic: "Treatment follow-up — onlay",
            unread: true,
            messages: [
              { id: "nb-1", from: "system", meta: "Automated · Treatment follow-up", text: "Hi Nadia, it's Brightwater Dental. Dr. Patel asked us to check in on the onlay we discussed in May. If timing or cost is the question, Beth can walk you through options — or grab a time: brightwater.demo/schedule", time: "Just now" },
              { id: "nb-2", from: "contact", text: "Thanks for the reminder — what would my insurance cover on that?", time: "Just now" },
            ],
          },
        },
        { kind: "task", task: { id: "t-nadia", title: "Beth: send Nadia Brooks onlay estimate with insurance breakdown (asked by text)", assignee: "Beth (treatment coord.)", due: "Today", auto: true } },
        { kind: "activity", item: { id: "a-sim-tp", icon: "automation", text: "Treatment follow-up sent to Nadia Brooks — cost question routed to Beth.", time: "Just now" } },
        { kind: "notify", notification: { id: "n-sim-tp", title: "Follow-up got a reply", body: "Nadia Brooks asked about coverage — task created for Beth.", tone: "success" } },
      ],
    },
    {
      id: "sim-confirmations",
      label: "Run tomorrow's confirmations",
      description: "Send confirmations + form checks for tomorrow's schedule.",
      tab: "overview",
      effects: [
        { kind: "activity", item: { id: "a-sim-cf", icon: "automation", text: "Confirmations sent to tomorrow's 13 patients — 9 confirmed in the first hour; 1 incomplete form flagged.", time: "Just now" } },
        { kind: "metric", id: "tasks-automated", delta: 13 },
        { kind: "metric", id: "no-show-risk", delta: -1 },
        { kind: "task", task: { id: "t-sim-cf", title: "Call 1 unconfirmed patient on tomorrow's schedule (flagged by confirmation run)", assignee: "Nina", due: "Today 4 PM", auto: true } },
        { kind: "notify", notification: { id: "n-sim-cf", title: "Confirmation run complete", body: "9 of 13 confirmed so far — the holdout is flagged for a quick call.", tone: "success" } },
      ],
    },
  ],
  builderFlow: {
    title: "After-hours call → confirmed appointment",
    steps: [
      { label: "Missed Call Detected", sub: "Including after hours" },
      { label: "Send Text-Back", sub: "With emergency notice" },
      { label: "New or Existing Patient?" },
      { label: "Collect Visit Details", sub: "Reason, insurance, days" },
      { label: "Send Scheduling Link" },
      { label: "Hold Requested Time" },
      { label: "Front Desk Review", sub: "Human approval" },
      { label: "Send Confirmation + Forms" },
      { label: "Track Forms & Remind" },
    ],
  },
  breakdown: {
    inputs: [
      "Missed and after-hours calls",
      "Website appointment requests",
      "Text messages",
      "Overdue recall lists",
      "Existing patient records",
      "Insurance questions",
    ],
    systemDoes: [
      "Texts back every missed call within a minute",
      "Collects intake details and preferred times",
      "Holds appointment slots for front-desk approval",
      "Runs recall campaigns on overdue patients",
      "Sends confirmations, forms, and reminders",
      "Routes insurance and billing questions with context",
      "Escalates urgent or complex messages to staff immediately",
    ],
    teamControls: [
      "Approving every held appointment",
      "All clinical questions and treatment decisions",
      "Emergency handling per office protocol",
      "Insurance and billing specifics",
      "Sensitive patient conversations",
      "Message wording, timing, and every workflow",
    ],
    integrations: [
      "Practice management systems",
      "Scheduling platforms",
      "Google Calendar",
      "Outlook Calendar",
      "Twilio SMS",
      "Email",
      "Website forms",
      "Review platforms",
      "Payment processors",
      "Digital forms platforms",
    ],
  },
  cta: {
    headline: "Reduce Front Desk Work Without Sacrificing Patient Experience",
    button: "Build This System for My Dental Office",
  },
  seo: {
    title: "Dental Front Desk System Demo | Redmont Strategies Group",
    description:
      "Interactive demo of a dental office operating system: after-hours missed-call recovery, new patient intake, recall reactivation, confirmations, forms, and review requests.",
  },
};
