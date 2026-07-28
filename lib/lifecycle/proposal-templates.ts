/**
 * Proposal templates — one per service category.
 *
 * Each template carries complete section copy (every ProposalSectionKey),
 * default optional services, and a milestone payment-schedule builder.
 * Dynamic values use {{business_name}}, {{challenges}}, {{outcomes}},
 * {{investment}}, and {{deposit}} placeholders; buildProposalSections()
 * resolves them against a seed at proposal-creation time.
 */

import type {
  PaymentScheduleEntry,
  ProposalOption,
  ProposalSection,
} from "@/lib/lifecycle/types";
import { formatCents } from "@/lib/lifecycle/types";

export type ProposalTemplateOption = Omit<
  ProposalOption,
  "id" | "proposal_id" | "created_at" | "selected"
>;

export type ProposalTemplate = {
  key: string;
  label: string;
  title: string;
  sections: ProposalSection[];
  defaultOptions: ProposalTemplateOption[];
  buildSchedule: (totalCents: number, depositCents: number) => PaymentScheduleEntry[];
};

type SectionItem = { title: string; detail?: string; meta?: string };

type TemplateCopy = {
  summary: string;
  recommendationTitle: string;
  recommendation: string;
  scope: SectionItem[];
  deliverables: SectionItem[];
  exclusions: SectionItem[];
  phases: SectionItem[];
  timeline: string;
  integrations: SectionItem[];
  support: string;
  /** Optional override for the shared security copy (used by Private AI). */
  security?: string;
};

// ---------------------------------------------------------------------------
// Shared section copy (identical framing across templates)
// ---------------------------------------------------------------------------

const CURRENT_CHALLENGES_BODY =
  "Every recommendation in this proposal traces back to a specific problem we identified together. " +
  "Based on what you shared during qualification, your assessment, and our consultation, " +
  "{{business_name}} is currently working against: {{challenges}}. " +
  "None of these are unusual — but left unaddressed, each one quietly costs time, revenue, or both.";

const DESIRED_OUTCOMES_BODY =
  "Success for this engagement is defined by your goals, not ours. Together we established that the " +
  "outcomes that matter most to {{business_name}} are: {{outcomes}}. Every phase, deliverable, and " +
  "milestone in this proposal is structured to move those numbers — and your monthly reporting will " +
  "track them explicitly.";

const RESPONSIBILITIES_BODY =
  "Clear ownership keeps projects on schedule. Here is exactly who does what during this engagement.";

const RESPONSIBILITIES_ITEMS: SectionItem[] = [
  {
    title: "Redmont Strategies Group",
    detail:
      "System design, configuration, integration, testing, documentation, training materials, and " +
      "project management. We lead every technical workstream and report progress at each milestone.",
  },
  {
    title: "{{business_name}}",
    detail:
      "Timely access to existing accounts and systems, a single point of contact for decisions, " +
      "feedback within the agreed review windows, and participation in scheduled training sessions.",
  },
  {
    title: "Joint",
    detail:
      "Progress check-ins during active build phases and sign-off at each approval gate before the " +
      "next phase begins.",
  },
];

const DEFAULT_SECURITY_BODY =
  "Your business data is handled with the same discipline we apply to our own. Access to your systems " +
  "is limited to the team members working on this engagement, credentials are stored in an encrypted " +
  "vault and never in plain text, and everything used during the build remains yours — we claim no " +
  "ownership of your customer records, content, or operational data. Confidentiality terms are " +
  "available for signature before any system access is granted, and access is revoked at your request " +
  "or at project close, whichever comes first.";

const INVESTMENT_BODY =
  "The total investment for the engagement described in this proposal is {{investment}}. A deposit of " +
  "{{deposit}} reserves your project start and is credited in full against the total. Optional services " +
  "can be added below — one-time options adjust the project total, while recurring options are billed " +
  "on their own cycle after launch. There are no hidden fees: anything that would change the price " +
  "comes to you as a written change order before work begins.";

const PAYMENT_SCHEDULE_BODY =
  "The investment is split into predictable payments tied to real project milestones — you never pay " +
  "for work you cannot see. The schedule below reflects the current total of {{investment}} with a " +
  "deposit of {{deposit}}; approved optional services are itemized on each invoice.";

const SUPPORT_ITEMS: SectionItem[] = [
  {
    title: "Launch support — included",
    detail:
      "Thirty days of post-launch support are included: adjustments, fixes, and questions are handled " +
      "at no additional cost while your team settles into the new system.",
  },
  {
    title: "Training library — included",
    detail:
      "Every system ships with recorded walkthroughs and written guides in your client portal, so new " +
      "team members can be trained without scheduling a call.",
  },
  {
    title: "Ongoing care — optional",
    detail:
      "Monitoring, updates, and priority support are available as a recurring plan under Optional " +
      "Services. No long-term commitment is required to launch.",
  },
];

const ASSUMPTIONS_BODY =
  "This proposal is priced and scheduled on the following working assumptions. If any of them change, " +
  "we flag the impact on cost or timeline before it happens — never after.";

const ASSUMPTIONS_ITEMS: SectionItem[] = [
  {
    title: "Access",
    detail:
      "{{business_name}} provides access to the required accounts, systems, and content within five " +
      "business days of the deposit clearing.",
  },
  {
    title: "Point of contact",
    detail:
      "One decision-maker is available for approvals, and review feedback is returned within three " +
      "business days so the timeline holds.",
  },
  {
    title: "Third-party services",
    detail:
      "Subscription fees for third-party platforms (phone, SMS, hosting, or software licenses) are " +
      "billed directly to {{business_name}} by the provider and are not included in this investment.",
  },
  {
    title: "Scope",
    detail:
      "Work not listed under Scope or Deliverables is out of scope. Anything additional is quoted as a " +
      "written change order before work begins.",
  },
  {
    title: "Validity",
    detail:
      "Pricing and timeline are valid through the expiration date shown on this proposal; after that, " +
      "both may need to be reconfirmed.",
  },
];

const NEXT_STEPS_BODY =
  "Approving this proposal takes about two minutes and locks in your pricing and project start window.";

const NEXT_STEPS_ITEMS: SectionItem[] = [
  {
    title: "1. Approve this proposal",
    detail:
      "Use the approval button on this page. If anything needs adjusting first, leave a comment on the " +
      "relevant section and we respond quickly.",
  },
  {
    title: "2. Sign the agreement",
    detail: "We prepare your service agreement for electronic signature the same business day.",
  },
  {
    title: "3. Pay the deposit",
    detail: "The {{deposit}} deposit reserves your build slot and activates your client portal.",
  },
  {
    title: "4. Kickoff",
    detail:
      "We schedule your kickoff call and begin onboarding {{business_name}} immediately — most " +
      "projects start within one week of the deposit clearing.",
  },
];

const SCOPE_BODY =
  "This engagement covers the design, build, integration, testing, and launch of the systems below, " +
  "plus the training your team needs to run them confidently.";

const DELIVERABLES_BODY =
  "When this engagement is complete, {{business_name}} will own the following working assets:";

const EXCLUSIONS_BODY =
  "To keep the investment honest, here is what this engagement does not include. If you need any of " +
  "these, we quote them separately — you are never surprised by an invoice.";

const PHASES_BODY =
  "The engagement runs in structured phases with an approval gate at the end of each — you always know " +
  "where the project stands and what happens next.";

const INTEGRATIONS_BODY =
  "The system is built around the tools {{business_name}} already uses wherever practical, so your " +
  "team is not forced to relearn everything at once. Typical integration points for this engagement " +
  "include the following; the final list is confirmed at kickoff.";

function makeSections(copy: TemplateCopy): ProposalSection[] {
  return [
    { key: "executive_summary", title: "Executive Summary", body: copy.summary },
    {
      key: "current_challenges",
      title: "Where {{business_name}} Stands Today",
      body: CURRENT_CHALLENGES_BODY,
    },
    { key: "desired_outcomes", title: "What Success Looks Like", body: DESIRED_OUTCOMES_BODY },
    { key: "recommended_system", title: copy.recommendationTitle, body: copy.recommendation },
    { key: "scope", title: "Scope of Engagement", body: SCOPE_BODY, items: copy.scope },
    { key: "deliverables", title: "Deliverables", body: DELIVERABLES_BODY, items: copy.deliverables },
    { key: "exclusions", title: "What This Does Not Include", body: EXCLUSIONS_BODY, items: copy.exclusions },
    { key: "phases", title: "How the Work Unfolds", body: PHASES_BODY, items: copy.phases },
    { key: "timeline", title: "Timeline", body: copy.timeline },
    {
      key: "responsibilities",
      title: "Who Does What",
      body: RESPONSIBILITIES_BODY,
      items: RESPONSIBILITIES_ITEMS,
    },
    { key: "integrations", title: "Integrations", body: INTEGRATIONS_BODY, items: copy.integrations },
    {
      key: "security",
      title: "Security & Data Handling",
      body: copy.security ?? DEFAULT_SECURITY_BODY,
    },
    { key: "investment", title: "Investment", body: INVESTMENT_BODY },
    { key: "payment_schedule", title: "Payment Schedule", body: PAYMENT_SCHEDULE_BODY },
    { key: "support_options", title: "Support After Launch", body: copy.support, items: SUPPORT_ITEMS },
    { key: "assumptions", title: "Working Assumptions", body: ASSUMPTIONS_BODY, items: ASSUMPTIONS_ITEMS },
    { key: "next_steps", title: "Next Steps", body: NEXT_STEPS_BODY, items: NEXT_STEPS_ITEMS },
  ];
}

// ---------------------------------------------------------------------------
// Payment schedule builder
// ---------------------------------------------------------------------------

/** Deposit on approval, remainder split evenly across milestone payments (last absorbs rounding). */
function milestoneSchedule(
  totalCents: number,
  depositCents: number,
  milestones: { label: string; due: string }[],
): PaymentScheduleEntry[] {
  const total = Math.max(0, Math.round(totalCents));
  const deposit = Math.min(Math.max(0, Math.round(depositCents)), total);
  const entries: PaymentScheduleEntry[] = [];
  if (deposit > 0) {
    entries.push({ label: "Deposit", amount_cents: deposit, due: "On approval" });
  }
  const remainder = total - deposit;
  if (remainder <= 0 || milestones.length === 0) {
    return entries.length > 0
      ? entries
      : [{ label: "Total investment", amount_cents: total, due: "On approval" }];
  }
  const per = Math.floor(remainder / milestones.length);
  milestones.forEach((milestone, index) => {
    const isLast = index === milestones.length - 1;
    const amount = isLast ? remainder - per * (milestones.length - 1) : per;
    entries.push({ label: milestone.label, amount_cents: amount, due: milestone.due });
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const PROPOSAL_TEMPLATES: Record<string, ProposalTemplate> = {
  growth_systems: {
    key: "growth_systems",
    label: "Growth Systems",
    title: "Growth Systems Engagement — {{business_name}}",
    sections: makeSections({
      summary:
        "{{business_name}} is not short on demand — it is short on a system that captures, follows up " +
        "on, and converts that demand without depending on someone remembering to do it. This proposal " +
        "outlines a Growth System engineered for {{business_name}}: every inquiry answered, every lead " +
        "followed up automatically, and every opportunity visible in one pipeline. It is built directly " +
        "around the challenges you described — {{challenges}} — and structured to deliver {{outcomes}}. " +
        "The total investment is {{investment}}, paid against milestones and beginning with a " +
        "{{deposit}} deposit.",
      recommendationTitle: "The Recommended Growth System",
      recommendation:
        "We recommend a connected Growth System with four working parts: instant lead response that " +
        "answers every inquiry within seconds regardless of channel; automated follow-up sequences that " +
        "nurture every lead until they book or opt out; a single pipeline where {{business_name}} can " +
        "see every opportunity, its stage, and its next action; and reporting that shows exactly where " +
        "revenue is coming from. Each part works on its own — together they compound, because no lead " +
        "leaks between them.",
      scope: [
        {
          title: "Lead capture consolidation",
          detail:
            "Every inquiry channel — website forms, phone, text, email, and social — routed into one " +
            "system with nothing falling through.",
        },
        {
          title: "Instant response automation",
          detail:
            "Missed-call text-back and automatic first-touch replies so every lead hears from " +
            "{{business_name}} within minutes, around the clock.",
        },
        {
          title: "Follow-up sequences",
          detail:
            "Multi-step email and SMS sequences for new leads, quotes awaiting decision, and past " +
            "customers worth reactivating.",
        },
        {
          title: "Sales pipeline",
          detail:
            "A stage-based pipeline configured to how {{business_name}} actually sells, with next " +
            "actions and owner assignment on every opportunity.",
        },
        {
          title: "Booking integration",
          detail: "Self-service scheduling wired into the follow-up sequences so hot leads book themselves.",
        },
        {
          title: "Team training",
          detail: "Live working sessions plus recorded walkthroughs for everyone who touches a lead.",
        },
      ],
      deliverables: [
        { title: "A fully configured lead-management system", detail: "Owned by {{business_name}}, running on your accounts." },
        { title: "Automated response and follow-up sequences", detail: "Written, tested, and live — with editable copy your team controls." },
        { title: "A working sales pipeline", detail: "Configured stages, automations, and reporting views." },
        { title: "Lead-source reporting", detail: "A dashboard showing lead volume, response times, and conversion by source." },
        { title: "Training library", detail: "Recorded walkthroughs and written quick-reference guides in your client portal." },
      ],
      exclusions: [
        { title: "Paid advertising management", detail: "Ad campaign creation and media buying are separate engagements." },
        { title: "Website redesign", detail: "We integrate with your current site; a rebuild is quoted under our Website & Platform service." },
        { title: "Third-party subscription fees", detail: "Phone, SMS, and software platform fees are billed directly to you by the providers." },
        { title: "Ongoing copywriting", detail: "Launch copy is included; ongoing content production is available separately." },
      ],
      phases: [
        {
          title: "Phase 1 — Discovery & mapping",
          detail: "We document every lead source, current response process, and sales stage, then finalize the system design with you.",
          meta: "Week 1",
        },
        {
          title: "Phase 2 — Build & integration",
          detail: "Lead routing, automations, sequences, and the pipeline are built and connected to your existing tools.",
          meta: "Weeks 2–4",
        },
        {
          title: "Phase 3 — Launch & calibration",
          detail: "The system goes live with real leads. We monitor daily, tune response timing, and adjust sequence copy based on actual replies.",
          meta: "Week 5",
        },
        {
          title: "Phase 4 — Training & handoff",
          detail: "Your team is trained, the recorded library is published, and 30-day launch support begins.",
          meta: "Week 6",
        },
      ],
      timeline:
        "Most Growth System engagements run five to six weeks from kickoff to full launch. The single " +
        "biggest factor in hitting that window is access: when {{business_name}} provides account access " +
        "and sign-offs on schedule, the timeline holds. Your project roadmap in the client portal shows " +
        "live status at every step.",
      integrations: [
        { title: "Phone & SMS", detail: "Your business line, missed-call handling, and two-way text." },
        { title: "Website forms & chat", detail: "Every form and chat widget routed into the pipeline." },
        { title: "Email", detail: "Your existing business email for sequences and notifications." },
        { title: "Calendar & booking", detail: "Self-service scheduling synced to your team's availability." },
        { title: "Review platforms", detail: "Google Business Profile and other review destinations, if the review option is added." },
      ],
      support:
        "A growth system is not a set-and-forget purchase — lead behavior shifts, and the system should " +
        "shift with it. Launch support is included for 30 days, and ongoing optimization is available as " +
        "a recurring option below.",
    }),
    defaultOptions: [
      {
        title: "AI Phone Receptionist",
        description:
          "An AI receptionist that answers calls {{business_name}} would otherwise miss, books appointments, and logs every conversation into the pipeline. Billed monthly; cancel anytime.".replace(
            "{{business_name}}",
            "your team",
          ),
        price_cents: 39500,
        billing: "monthly",
        sort_order: 0,
      },
      {
        title: "Review & Reputation Engine",
        description:
          "Automated review requests after every completed job, routing to Google and the platforms that matter in your market, with a monitoring dashboard.",
        price_cents: 150000,
        billing: "one_time",
        sort_order: 1,
      },
      {
        title: "Quarterly Growth Optimization",
        description:
          "A structured quarterly review of sequence performance, conversion rates, and lead sources, with adjustments applied and a written report.",
        price_cents: 90000,
        billing: "quarterly",
        sort_order: 2,
      },
    ],
    buildSchedule: (totalCents, depositCents) =>
      milestoneSchedule(totalCents, depositCents, [
        { label: "System build & integration", due: "At system launch" },
        { label: "Final payment", due: "30 days after launch" },
      ]),
  },

  operations_systems: {
    key: "operations_systems",
    label: "Operations Systems",
    title: "Operations Systems Engagement — {{business_name}}",
    sections: makeSections({
      summary:
        "The work {{business_name}} delivers is strong — the friction is in everything around it: " +
        "scheduling, quoting, invoicing, and keeping everyone on the same page. This proposal outlines " +
        "an Operations System that removes that friction: one workflow from first request to paid " +
        "invoice, with nothing living in someone's head or a stack of paper. It addresses the " +
        "challenges we identified together — {{challenges}} — and is structured to deliver {{outcomes}}. " +
        "The total investment is {{investment}}, paid against milestones and beginning with a " +
        "{{deposit}} deposit.",
      recommendationTitle: "The Recommended Operations System",
      recommendation:
        "We recommend a single connected operations workflow for {{business_name}}: intake and " +
        "scheduling that puts every job on one calendar; quoting and approval flows that get customer " +
        "sign-off in hours instead of days; invoicing that generates and sends itself when work is " +
        "marked complete; and internal status tracking so anyone on the team can see where every job " +
        "stands without asking. The goal is simple — the business runs the same way whether the owner " +
        "is in the room or not.",
      scope: [
        {
          title: "Workflow mapping",
          detail:
            "We document how work actually moves through {{business_name}} today — including the " +
            "unwritten steps — before changing anything.",
        },
        {
          title: "Scheduling & dispatch",
          detail: "One shared calendar for jobs and appointments, with assignment, notifications, and change handling.",
        },
        {
          title: "Quoting & approvals",
          detail: "Professional quotes generated from templates, delivered digitally, and approved with one click.",
        },
        {
          title: "Invoicing & payment collection",
          detail: "Invoices triggered by job completion, with automatic payment reminders until paid.",
        },
        {
          title: "Job status tracking",
          detail: "A live board showing every active job, its stage, its owner, and what is blocking it.",
        },
        {
          title: "Team training",
          detail: "Role-based training for office and field staff, live and recorded.",
        },
      ],
      deliverables: [
        { title: "A configured end-to-end operations workflow", detail: "From first customer contact to paid invoice." },
        { title: "Quote and invoice template library", detail: "Branded, editable, and owned by {{business_name}}." },
        { title: "Automated reminder sequences", detail: "Appointment reminders for customers and payment reminders on open invoices." },
        { title: "Operations dashboard", detail: "Jobs in progress, revenue in pipeline, and outstanding receivables at a glance." },
        { title: "Written process documentation", detail: "Each core workflow documented so training new hires no longer depends on memory." },
      ],
      exclusions: [
        { title: "Accounting and bookkeeping services", detail: "We integrate with your accounting tools; we do not provide bookkeeping." },
        { title: "Hardware", detail: "Tablets, phones, or field devices are purchased directly by you if needed." },
        { title: "Third-party subscription fees", detail: "Platform licenses are billed directly to you by the providers." },
        { title: "Historical data cleanup", detail: "We migrate current, active records; deep historical cleanup is quoted separately if wanted." },
      ],
      phases: [
        {
          title: "Phase 1 — Workflow mapping",
          detail: "Every step from inquiry to payment is documented and the future-state workflow is approved by you.",
          meta: "Week 1",
        },
        {
          title: "Phase 2 — Core build",
          detail: "Scheduling, quoting, and job tracking are configured and connected, with your real templates and pricing.",
          meta: "Weeks 2–4",
        },
        {
          title: "Phase 3 — Invoicing & automation",
          detail: "Invoicing, payment reminders, and customer notifications go live alongside the core workflow.",
          meta: "Week 5",
        },
        {
          title: "Phase 4 — Training & handoff",
          detail: "Office and field staff are trained by role, documentation is published, and 30-day launch support begins.",
          meta: "Week 6",
        },
      ],
      timeline:
        "Most Operations System engagements run five to seven weeks from kickoff to full adoption. We " +
        "deliberately launch in stages — scheduling first, then quoting, then invoicing — so " +
        "{{business_name}} never has to absorb every change at once and daily operations are never " +
        "interrupted.",
      integrations: [
        { title: "Calendar", detail: "Your existing business calendars, synced both directions." },
        { title: "Accounting", detail: "QuickBooks or your current accounting platform for invoices and payments." },
        { title: "Payments", detail: "Card and ACH collection connected to your merchant account." },
        { title: "Phone & SMS", detail: "Appointment reminders and customer notifications from your business number." },
        { title: "Email", detail: "Quotes, invoices, and confirmations sent from your domain." },
      ],
      support:
        "An operations system earns its keep in month two, three, and twelve — when the team is using " +
        "it without thinking about it. Launch support is included for 30 days, and an ongoing care plan " +
        "is available below to keep workflows tuned as {{business_name}} grows.",
    }),
    defaultOptions: [
      {
        title: "Technician Mobile Workflows",
        description:
          "Field-ready mobile views for on-site staff: job details, photos, notes, and status updates from a phone, synced to the office in real time.",
        price_cents: 175000,
        billing: "one_time",
        sort_order: 0,
      },
      {
        title: "Customer Portal",
        description:
          "A branded portal where your customers can view quotes, approve work, see appointment status, and pay invoices without calling the office.",
        price_cents: 125000,
        billing: "one_time",
        sort_order: 1,
      },
      {
        title: "Ongoing Systems Care Plan",
        description:
          "Monthly monitoring, workflow adjustments, template updates, and priority support. Cancel anytime.",
        price_cents: 45000,
        billing: "monthly",
        sort_order: 2,
      },
    ],
    buildSchedule: (totalCents, depositCents) =>
      milestoneSchedule(totalCents, depositCents, [
        { label: "Core workflow build", due: "At workflow go-live" },
        { label: "Final payment", due: "At project completion" },
      ]),
  },

  business_systems: {
    key: "business_systems",
    label: "Business Systems",
    title: "Business Systems Engagement — {{business_name}}",
    sections: makeSections({
      summary:
        "{{business_name}} has outgrown the way it currently runs — that is a good problem, and it is " +
        "the problem this proposal solves. We propose a connected Business System spanning the full " +
        "customer journey: how leads come in, how work gets sold, how it gets delivered, and how the " +
        "numbers roll up so decisions get made on facts. It is designed around the challenges we " +
        "identified together — {{challenges}} — and structured to deliver {{outcomes}}. The total " +
        "investment is {{investment}}, paid against milestones and beginning with a {{deposit}} deposit.",
      recommendationTitle: "The Recommended Business System",
      recommendation:
        "We recommend a full-journey system built in three connected layers. The revenue layer: lead " +
        "capture, follow-up, and a sales pipeline so no opportunity leaks. The delivery layer: " +
        "scheduling, job tracking, and customer communication so sold work moves without friction. The " +
        "visibility layer: dashboards that show {{business_name}}'s pipeline, capacity, and cash " +
        "position in one place. Because all three layers share the same data, the handoff points where " +
        "most businesses lose money — sale to delivery, delivery to invoice — simply stop leaking.",
      scope: [
        {
          title: "Business systems audit",
          detail: "A complete map of current tools, workflows, and data flow across {{business_name}} before anything is built.",
        },
        {
          title: "CRM backbone",
          detail: "One system of record for every contact, lead, customer, and job — no more parallel spreadsheets.",
        },
        {
          title: "Sales pipeline & follow-up automation",
          detail: "Stage-based pipeline with automated follow-up so every opportunity gets worked.",
        },
        {
          title: "Delivery workflow",
          detail: "Scheduling, status tracking, and customer notifications from sold to complete.",
        },
        {
          title: "Executive dashboard",
          detail: "Live pipeline value, job status, revenue, and receivables in a single view.",
        },
        {
          title: "Team training & documentation",
          detail: "Role-based training plus written process documentation for every core workflow.",
        },
      ],
      deliverables: [
        { title: "A unified CRM and operations platform", detail: "Configured to {{business_name}}'s actual workflow and owned by you." },
        { title: "Automated sales follow-up sequences", detail: "Written, tested, and live." },
        { title: "Connected delivery workflow", detail: "From closed-won to completed job to invoice, without re-entering data." },
        { title: "Executive dashboard", detail: "The numbers that run the business, updated live." },
        { title: "Process documentation & training library", detail: "So the system survives staff changes and scales with hiring." },
      ],
      exclusions: [
        { title: "Paid advertising management", detail: "Campaign management is a separate engagement." },
        { title: "Accounting services", detail: "We integrate with your accounting platform; we do not replace your accountant." },
        { title: "Third-party subscription fees", detail: "Platform licenses are billed directly to you by the providers." },
        { title: "Custom software development", detail: "This engagement configures and connects proven platforms; ground-up custom builds are quoted separately." },
      ],
      phases: [
        {
          title: "Phase 1 — Audit & design",
          detail: "Current systems are mapped, gaps quantified, and the target architecture approved by you before any build begins.",
          meta: "Weeks 1–2",
        },
        {
          title: "Phase 2 — Revenue layer",
          detail: "CRM, pipeline, and follow-up automation go live first so improvements start paying for the rest of the build.",
          meta: "Weeks 3–5",
        },
        {
          title: "Phase 3 — Delivery layer",
          detail: "Scheduling, job tracking, and customer communication are connected to the revenue layer.",
          meta: "Weeks 6–8",
        },
        {
          title: "Phase 4 — Visibility, training & handoff",
          detail: "Dashboards go live, the team is trained by role, and 30-day launch support begins.",
          meta: "Weeks 9–10",
        },
      ],
      timeline:
        "A full Business Systems engagement typically runs nine to eleven weeks from kickoff to " +
        "complete handoff. It launches in layers, with each layer producing value while the next is " +
        "built — {{business_name}} does not wait until week ten to see results, and daily operations " +
        "are never interrupted.",
      integrations: [
        { title: "Email & calendar", detail: "Your existing business email and calendars, synced both directions." },
        { title: "Phone & SMS", detail: "Business line, missed-call handling, and two-way text." },
        { title: "Accounting", detail: "QuickBooks or your current platform for invoices and payment status." },
        { title: "Payments", detail: "Card and ACH collection connected to your merchant account." },
        { title: "Website", detail: "Forms, chat, and booking flows routed into the CRM." },
      ],
      support:
        "A system that touches the whole business deserves a steward. Launch support is included for 30 " +
        "days; for owners who want the system continuously improved rather than merely maintained, " +
        "fractional systems management is available as a recurring option below.",
    }),
    defaultOptions: [
      {
        title: "Executive KPI Dashboard — Advanced",
        description:
          "Extended reporting: per-crew or per-rep performance, customer lifetime value, marketing ROI by source, and monthly trend views.",
        price_cents: 200000,
        billing: "one_time",
        sort_order: 0,
      },
      {
        title: "Team Training Intensive",
        description:
          "Two additional half-day working sessions after launch, tailored by role, plus refreshed recordings for your training library.",
        price_cents: 95000,
        billing: "one_time",
        sort_order: 1,
      },
      {
        title: "Fractional Systems Management",
        description:
          "We operate as your systems department: monitoring, improvements, new automations, and priority support on a monthly basis. Cancel anytime.",
        price_cents: 85000,
        billing: "monthly",
        sort_order: 2,
      },
    ],
    buildSchedule: (totalCents, depositCents) =>
      milestoneSchedule(totalCents, depositCents, [
        { label: "Revenue layer live", due: "At revenue-layer go-live" },
        { label: "Delivery layer live", due: "At delivery-layer go-live" },
        { label: "Final payment", due: "At final handoff" },
      ]),
  },

  private_ai: {
    key: "private_ai",
    label: "Private AI",
    title: "Private AI System — {{business_name}}",
    sections: makeSections({
      summary:
        "{{business_name}} wants the leverage of AI without handing its data to a public tool — that " +
        "is exactly the system this proposal describes. We propose a private AI system built on your " +
        "data, running under your control, with access limited to the people you choose. It is scoped " +
        "around the challenges we identified together — {{challenges}} — and structured to deliver " +
        "{{outcomes}}. The total investment is {{investment}}, paid against milestones and beginning " +
        "with a {{deposit}} deposit.",
      recommendationTitle: "The Recommended Private AI System",
      recommendation:
        "We recommend a private knowledge and automation system in three parts. First, a secure " +
        "environment provisioned for {{business_name}} — isolated from other tenants, with role-based " +
        "access control from day one. Second, a knowledge layer built from your documents, procedures, " +
        "and historical records, so the assistant answers from your reality instead of internet " +
        "averages. Third, the working assistant itself: your team asks questions, drafts documents, and " +
        "triggers workflows in plain language, and every response is grounded in your own data with " +
        "sources shown. Nothing you load into the system trains anyone else's model.",
      scope: [
        {
          title: "Requirements & data inventory",
          detail: "We catalog the data sources, access rules, and use cases that matter to {{business_name}} before anything is provisioned.",
        },
        {
          title: "Secure environment provisioning",
          detail: "A dedicated, access-controlled environment with encryption at rest and in transit.",
        },
        {
          title: "Knowledge base construction",
          detail: "Your documents, procedures, and records ingested, structured, and verified for retrieval quality.",
        },
        {
          title: "Assistant configuration",
          detail: "The assistant tuned to your terminology, guardrails, and tone, with source citations on every answer.",
        },
        {
          title: "Access controls & audit",
          detail: "Role-based permissions, usage logging, and an audit trail of who asked what.",
        },
        {
          title: "Team enablement",
          detail: "Hands-on training focused on the highest-value use cases for each role.",
        },
      ],
      deliverables: [
        { title: "A provisioned private AI environment", detail: "Access-controlled and owned by {{business_name}}." },
        { title: "A structured knowledge base", detail: "Built from your data, with a documented refresh process." },
        { title: "A working AI assistant", detail: "Grounded in your knowledge base, with citations and guardrails." },
        { title: "Access control & audit configuration", detail: "Role-based permissions and usage logs." },
        { title: "Acceptable-use playbook & training library", detail: "Written guidance plus recorded walkthroughs for your team." },
      ],
      exclusions: [
        { title: "Model training from scratch", detail: "The system uses proven foundation models privately; training a bespoke model is a different class of engagement." },
        { title: "Data creation or cleanup", detail: "We structure what exists; producing new content or deep-cleaning legacy records is quoted separately." },
        { title: "Infrastructure and license fees", detail: "Hosting and model usage fees are billed directly to {{business_name}} by the providers, at cost, with no markup." },
        { title: "Legal or compliance certification", detail: "We build to security best practices; formal certifications and legal review remain with your counsel." },
      ],
      phases: [
        {
          title: "Phase 1 — Requirements & data inventory",
          detail: "Use cases prioritized, data sources cataloged, and access rules defined and approved by you.",
          meta: "Weeks 1–2",
        },
        {
          title: "Phase 2 — Environment & knowledge base",
          detail: "The secure environment is provisioned and your knowledge base is built and quality-checked against real questions.",
          meta: "Weeks 3–5",
        },
        {
          title: "Phase 3 — Assistant build & hardening",
          detail: "The assistant is configured, guardrails are tested — including what it must refuse to answer — and access controls are verified.",
          meta: "Weeks 6–7",
        },
        {
          title: "Phase 4 — Pilot, training & production",
          detail: "A pilot group works with the system daily, refinements are applied, the full team is trained, and production deployment completes.",
          meta: "Weeks 8–9",
        },
      ],
      timeline:
        "Most Private AI engagements run eight to ten weeks from kickoff to production. The pace is " +
        "deliberately gated by verification: the knowledge base is tested against real questions from " +
        "your team before the assistant goes near production, because a private AI system is only " +
        "worth having if its answers can be trusted.",
      integrations: [
        { title: "Document storage", detail: "Your existing drives and document systems as knowledge sources." },
        { title: "Email & calendar", detail: "Optional assistant access for drafting and scheduling support." },
        { title: "CRM & operations platform", detail: "Customer and job context available to the assistant, subject to your access rules." },
        { title: "Single sign-on", detail: "Team access through your existing identity provider where available." },
      ],
      support:
        "AI systems drift as your business and your data change. Launch support is included for 30 " +
        "days, and managed updates — model upgrades, knowledge refreshes, and monitoring — are " +
        "available as a recurring option below.",
      security:
        "Security is the reason this system exists, so it is engineered in rather than bolted on. Your " +
        "environment is isolated to {{business_name}}; data is encrypted in transit and at rest; access " +
        "is role-based and logged; and your data is never used to train shared or public models. We " +
        "document exactly where every piece of data lives and who can reach it, and we sign " +
        "confidentiality terms before any data access begins. If the engagement ends, your data and " +
        "your knowledge base leave with you.",
    }),
    defaultOptions: [
      {
        title: "Additional Knowledge Domain",
        description:
          "Extend the knowledge base with another major data domain — for example estimating history, HR policies, or vendor documentation — built and verified to the same standard.",
        price_cents: 225000,
        billing: "one_time",
        sort_order: 0,
      },
      {
        title: "Managed Model Updates & Monitoring",
        description:
          "Monthly knowledge refreshes, model version management, answer-quality monitoring, and priority support. Cancel anytime.",
        price_cents: 65000,
        billing: "monthly",
        sort_order: 1,
      },
      {
        title: "Workflow Automation Pack",
        description:
          "Three AI-driven workflow automations built on top of the assistant — for example drafting quotes from call notes or summarizing job files — specified with you during Phase 1.",
        price_cents: 175000,
        billing: "one_time",
        sort_order: 2,
      },
    ],
    buildSchedule: (totalCents, depositCents) =>
      milestoneSchedule(totalCents, depositCents, [
        { label: "Environment & knowledge base", due: "At environment provisioning" },
        { label: "Final payment", due: "At production deployment" },
      ]),
  },

  website_platform: {
    key: "website_platform",
    label: "Website & Platform",
    title: "Website & Platform Build — {{business_name}}",
    sections: makeSections({
      summary:
        "A website should be {{business_name}}'s hardest-working employee: on shift around the clock, " +
        "answering questions, and converting visitors into booked business. This proposal outlines a " +
        "website and platform build that does exactly that — not a brochure, but a working system with " +
        "booking, lead capture, and follow-up built in. It is designed around the challenges we " +
        "identified together — {{challenges}} — and structured to deliver {{outcomes}}. The total " +
        "investment is {{investment}}, paid against milestones and beginning with a {{deposit}} deposit.",
      recommendationTitle: "The Recommended Website & Platform",
      recommendation:
        "We recommend a conversion-focused platform in three parts: a fast, professional website built " +
        "around how {{business_name}}'s customers actually decide — clear services, proof, and a " +
        "next step on every page; working conversion machinery — forms, click-to-call, and self-service " +
        "booking wired directly into lead follow-up so inquiries get answered instead of collected; and " +
        "a technical foundation that loads fast, ranks properly, and is measured, so you know what the " +
        "site is producing rather than guessing.",
      scope: [
        {
          title: "Site architecture & messaging",
          detail: "Page structure and copy built around {{business_name}}'s services, market, and the questions customers actually ask.",
        },
        {
          title: "Design & build",
          detail: "A custom, mobile-first design implemented on a modern, fast, maintainable stack.",
        },
        {
          title: "Conversion machinery",
          detail: "Forms, click-to-call, and booking flows connected to lead capture and automated follow-up.",
        },
        {
          title: "Search foundation",
          detail: "Technical SEO, page structure, metadata, and local-search fundamentals done correctly at build time.",
        },
        {
          title: "Analytics & tracking",
          detail: "Conversion tracking configured so every call, form, and booking is attributed.",
        },
        {
          title: "Content migration & launch",
          detail: "Existing content migrated where it earns its place, redirects preserved, and a zero-downtime launch.",
        },
      ],
      deliverables: [
        { title: "A launched, custom website", detail: "Fully owned by {{business_name}} — design, content, and platform." },
        { title: "Integrated booking and lead-capture flows", detail: "Wired into follow-up automation, not just an inbox." },
        { title: "Search-ready technical foundation", detail: "Speed, structure, metadata, and local-search fundamentals in place." },
        { title: "Analytics & conversion reporting", detail: "A clear view of what the site produces each month." },
        { title: "Content management training", detail: "Your team can update pages confidently, with recorded walkthroughs to fall back on." },
      ],
      exclusions: [
        { title: "Ongoing SEO campaigns", detail: "The build includes the technical foundation; ongoing ranking campaigns are a separate engagement." },
        { title: "Paid advertising", detail: "Landing pages can be added, but campaign management is quoted separately." },
        { title: "Photography & video production", detail: "We integrate assets you provide or arrange production at cost." },
        { title: "Hosting & domain fees", detail: "Billed directly to {{business_name}} by the providers; we configure everything." },
      ],
      phases: [
        {
          title: "Phase 1 — Strategy & architecture",
          detail: "Sitemap, messaging, and page-level goals approved by you before design begins.",
          meta: "Week 1",
        },
        {
          title: "Phase 2 — Design",
          detail: "Design direction and key page designs reviewed and approved — you see the site before it is built.",
          meta: "Weeks 2–3",
        },
        {
          title: "Phase 3 — Build & integration",
          detail: "The site is built, booking and lead flows are wired in, and tracking is configured.",
          meta: "Weeks 4–6",
        },
        {
          title: "Phase 4 — Launch & handoff",
          detail: "Content is finalized, redirects verified, the site goes live, and your team is trained.",
          meta: "Week 7",
        },
      ],
      timeline:
        "Most Website & Platform builds run six to eight weeks from kickoff to launch. Content is the " +
        "most common source of delay on any website project, so we schedule content collection in week " +
        "one and flag anything at risk early — the roadmap in your portal shows exactly what is needed " +
        "and when.",
      integrations: [
        { title: "Booking & scheduling", detail: "Self-service appointment booking synced to your calendar." },
        { title: "Lead follow-up", detail: "Forms and calls routed into your CRM or follow-up system." },
        { title: "Phone tracking", detail: "Call tracking for attribution, using your existing business number." },
        { title: "Google Business Profile", detail: "Connected and consistent with the site for local search." },
        { title: "Analytics", detail: "Conversion and traffic reporting configured from day one." },
      ],
      support:
        "A website starts aging the day it launches — software updates, security patches, and content " +
        "changes never stop. Launch support is included for 30 days, and a hosting-and-care plan is " +
        "available below so {{business_name}} never has to think about maintenance again.",
    }),
    defaultOptions: [
      {
        title: "Content & Copywriting Package",
        description:
          "Professional copywriting for every core page, written from interviews with your team and structured for conversion and search.",
        price_cents: 85000,
        billing: "one_time",
        sort_order: 0,
      },
      {
        title: "Local SEO Foundation",
        description:
          "Location pages, citation cleanup, review-schema markup, and Google Business Profile optimization for the service areas that matter to you.",
        price_cents: 120000,
        billing: "one_time",
        sort_order: 1,
      },
      {
        title: "Hosting, Care & Updates",
        description:
          "Managed hosting, security updates, backups, uptime monitoring, and a monthly allowance of content changes. Cancel anytime.",
        price_cents: 25000,
        billing: "monthly",
        sort_order: 2,
      },
    ],
    buildSchedule: (totalCents, depositCents) =>
      milestoneSchedule(totalCents, depositCents, [
        { label: "Design & build", due: "At design approval" },
        { label: "Final payment", due: "At site launch" },
      ]),
  },
};

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Builds the concrete section list for a new proposal: template copy with
 * {{placeholders}} resolved, and challenges/outcomes rendered as structured
 * items on their respective sections.
 */
export function buildProposalSections(
  templateKey: string,
  seed: {
    businessName: string;
    challenges: string[];
    outcomes: string[];
    totalCents: number;
    depositCents: number;
  },
): ProposalSection[] {
  const template = PROPOSAL_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown proposal template: ${templateKey}`);
  }
  const challenges = seed.challenges.map((c) => c.trim()).filter(Boolean);
  const outcomes = seed.outcomes.map((o) => o.trim()).filter(Boolean);
  const vars: Record<string, string> = {
    business_name: seed.businessName.trim() || "your business",
    challenges: challenges.length
      ? challenges.join("; ")
      : "the priorities identified during our conversations",
    outcomes: outcomes.length
      ? outcomes.join("; ")
      : "the outcomes defined together during your consultation",
    investment: formatCents(seed.totalCents),
    deposit: formatCents(seed.depositCents),
  };

  return template.sections.map((section) => {
    const filled: ProposalSection = {
      key: section.key,
      title: fill(section.title, vars),
      body: fill(section.body, vars),
    };
    if (section.hidden) filled.hidden = section.hidden;
    if (section.items) {
      filled.items = section.items.map((item) => ({
        title: fill(item.title, vars),
        ...(item.detail !== undefined ? { detail: fill(item.detail, vars) } : {}),
        ...(item.meta !== undefined ? { meta: fill(item.meta, vars) } : {}),
      }));
    }
    if (section.key === "current_challenges" && challenges.length) {
      filled.items = challenges.map((title) => ({ title }));
    }
    if (section.key === "desired_outcomes" && outcomes.length) {
      filled.items = outcomes.map((title) => ({ title }));
    }
    return filled;
  });
}
