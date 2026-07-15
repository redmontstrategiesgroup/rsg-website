import type { ClientRecord, ClientPublic } from "./types";

/* ======================================================================
 * DEVELOPMENT-ONLY DEMO DATA — never reaches production.
 *
 * `SEED_CLIENTS` / `DEMO_PASSWORD` are consumed ONLY by store.ts's
 * fileClients(), which loads them exclusively when isDemoDataEnabled()
 * (dev + NEXT_PUBLIC_ENABLE_DEMO_DATA=true). In production these are never
 * read — real client accounts live in Supabase. Do not import these
 * elsewhere. `toPublic` below is real, shared functionality.
 * ==================================================================== */
export const DEMO_PASSWORD = "redmont2026";

export const SEED_CLIENTS: ClientRecord[] = [
  {
    id: "glow-aesthetics",
    name: "Dr. Elise Moreau",
    email: "demo@glowaesthetics.com",
    company: "Glow Aesthetics",
    plan: "Growth Retainer",
    since: "Jan 2026",
    strategist: "Redmont Strategies Group",
    metrics: [
      {
        key: "leads",
        label: "Leads captured",
        value: 1284,
        format: "number",
        delta: "+18% MoM",
        hint: "Across calls, DMs, forms",
      },
      {
        key: "booked",
        label: "Consults booked",
        value: 342,
        format: "number",
        delta: "+27% MoM",
        hint: "Auto-scheduled + assisted",
      },
      {
        key: "revenue",
        label: "Revenue influenced",
        value: 486000,
        format: "currency",
        delta: "+31% MoM",
        hint: "Attributed to AI workflows",
      },
      {
        key: "response",
        label: "Avg. response time",
        value: 28,
        format: "duration",
        delta: "-96%",
        hint: "Down from ~11 hours",
      },
    ],
    systems: [
      {
        name: "AI Front Desk",
        category: "Automation",
        status: "live",
        description:
          "Answers missed calls with an SMS follow-up, qualifies intent, and books consults into the calendar.",
        throughput: "1,284 msgs / mo",
        uptime: 99.98,
      },
      {
        name: "Lead Reactivation Engine",
        category: "Marketing",
        status: "live",
        description:
          "Re-engages your dormant lead list with personalized multi-step sequences across SMS + email.",
        throughput: "3,900 contacts",
        uptime: 99.9,
      },
      {
        name: "Instagram DM Autoresponder",
        category: "Automation",
        status: "optimizing",
        description:
          "Handles inbound DMs from ads and organic posts, answers FAQs, and routes hot leads to staff.",
        throughput: "612 convos / mo",
        uptime: 99.7,
      },
      {
        name: "Review + Referral Loop",
        category: "Marketing",
        status: "building",
        description:
          "Requests reviews after each visit and nudges happy clients into a referral flow.",
        throughput: "Launching soon",
        uptime: 100,
      },
    ],
    projects: [
      {
        name: "Multi-location booking logic",
        phase: "Build",
        progress: 64,
        due: "Jul 18",
        owner: "RSG Automation",
      },
      {
        name: "Paid social creative refresh",
        phase: "Launch",
        progress: 88,
        due: "Jul 09",
        owner: "RSG Marketing",
      },
      {
        name: "CRM + pipeline migration",
        phase: "Optimize",
        progress: 100,
        due: "Complete",
        owner: "RSG Automation",
      },
    ],
    activity: [
      { kind: "booking", text: "New consult booked — Botox, Thu 2:00 PM", time: "6m ago" },
      { kind: "lead", text: "Instagram DM captured & qualified (hot)", time: "22m ago" },
      { kind: "system", text: "AI Front Desk handled a missed call in 24s", time: "41m ago" },
      { kind: "report", text: "Weekly performance report generated", time: "3h ago" },
      { kind: "lead", text: "Reactivation sequence re-booked a lapsed client", time: "5h ago" },
      { kind: "message", text: "Strategist note: new nurture copy is live", time: "1d ago" },
    ],
    deliverables: [
      { name: "June performance report", type: "PDF report", date: "Jul 01", status: "Ready" },
      { name: "Reactivation sequence v3", type: "Automation", date: "Jun 26", status: "Ready" },
      { name: "Q3 growth roadmap", type: "Strategy doc", date: "Jul 12", status: "In review" },
      { name: "Landing page — filler promo", type: "Web page", date: "Jul 15", status: "Scheduled" },
    ],
    invoices: [
      { id: "RSG-1042", amount: 997, date: "Jul 01", status: "Paid" },
      { id: "RSG-1021", amount: 997, date: "Jun 01", status: "Paid" },
      { id: "RSG-1058", amount: 997, date: "Aug 01", status: "Upcoming" },
    ],
  },
  {
    id: "apex-dental",
    name: "Marcus Hale",
    email: "client@apexdental.com",
    company: "Apex Dental Collective",
    plan: "Custom AI Build",
    since: "Nov 2025",
    strategist: "Redmont Strategies Group",
    metrics: [
      {
        key: "leads",
        label: "Leads captured",
        value: 2870,
        format: "number",
        delta: "+22% MoM",
        hint: "6 locations",
      },
      {
        key: "booked",
        label: "Appointments booked",
        value: 921,
        format: "number",
        delta: "+19% MoM",
        hint: "Auto-scheduled",
      },
      {
        key: "revenue",
        label: "Revenue influenced",
        value: 1240000,
        format: "currency",
        delta: "+24% MoM",
        hint: "Attributed to AI workflows",
      },
      {
        key: "uptime",
        label: "Automation uptime",
        value: 99,
        format: "percent",
        delta: "30d",
        hint: "Across all systems",
      },
    ],
    systems: [
      {
        name: "Omnichannel Intake Agent",
        category: "Automation",
        status: "live",
        description:
          "A retrieval-augmented agent that answers patient questions from your policies and books across all 6 locations.",
        throughput: "8,400 msgs / mo",
        uptime: 99.99,
      },
      {
        name: "Insurance Pre-Check Bot",
        category: "Automation",
        status: "live",
        description:
          "Collects insurance details up front and flags coverage questions before the visit.",
        throughput: "1,100 checks / mo",
        uptime: 99.8,
      },
      {
        name: "Recall + Recare Campaigns",
        category: "Marketing",
        status: "optimizing",
        description:
          "Automated 6-month recall outreach segmented by treatment history.",
        throughput: "5,200 contacts",
        uptime: 99.9,
      },
      {
        name: "Analytics Warehouse",
        category: "Data",
        status: "live",
        description:
          "Unified reporting pipeline across all locations feeding a live executive dashboard.",
        throughput: "Realtime",
        uptime: 100,
      },
    ],
    projects: [
      {
        name: "Custom RAG knowledge base",
        phase: "Optimize",
        progress: 92,
        due: "Jul 20",
        owner: "RSG AI Engineering",
      },
      {
        name: "Voice AI receptionist pilot",
        phase: "Discovery",
        progress: 25,
        due: "Aug 05",
        owner: "RSG AI Engineering",
      },
      {
        name: "Exec dashboard v2",
        phase: "Launch",
        progress: 78,
        due: "Jul 14",
        owner: "RSG Data",
      },
    ],
    activity: [
      { kind: "system", text: "Intake agent resolved 214 messages autonomously", time: "12m ago" },
      { kind: "booking", text: "Cleaning booked at Apex — Midtown", time: "34m ago" },
      { kind: "report", text: "Location P&L snapshot refreshed", time: "2h ago" },
      { kind: "system", text: "RAG knowledge base re-indexed (v14)", time: "6h ago" },
      { kind: "message", text: "Strategist note: voice pilot kickoff Thu", time: "1d ago" },
    ],
    deliverables: [
      { name: "Voice AI pilot scope", type: "Strategy doc", date: "Jun 30", status: "Ready" },
      { name: "Knowledge base v14", type: "AI system", date: "Jun 28", status: "Ready" },
      { name: "Exec dashboard v2", type: "Dashboard", date: "Jul 14", status: "In review" },
    ],
    invoices: [
      { id: "RSG-0990", amount: 6500, date: "Jul 01", status: "Paid" },
      { id: "RSG-0964", amount: 6500, date: "Jun 01", status: "Paid" },
      { id: "RSG-1061", amount: 6500, date: "Aug 01", status: "Upcoming" },
    ],
  },
];

/** Strip secrets before returning a client to the browser. */
export function toPublic(record: ClientRecord): ClientPublic {
  const { passwordHash: _passwordHash, ...pub } = record;
  return pub;
}
