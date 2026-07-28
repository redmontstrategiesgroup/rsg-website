import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "crmsystems",
  managedService: "crm_automation",
  label: "CRM & Pipeline Systems · Plymouth County, MA",
  h1: "CRM & Pipeline Systems in Plymouth County, MA",
  intro: [
    "If you are searching for CRM setup or a sales pipeline consultant in Plymouth County, you have probably noticed the pattern: everyone wants to sell you software, and nobody wants to make it match how you actually sell.",
    "RSG designs the pipeline first, then sets up the CRM around it. We wire in lead capture, booking, and follow-up so every lead is tracked from first contact to closed job, and the team actually uses the system.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "CRM & Pipeline Systems",
  problemHeading: "Where leads go to die",
  problem: [
    "In most service businesses, leads live in four places at once: a phone, an inbox, a notebook, and someone's memory. Nobody can say how many open opportunities exist right now, or which ones are waiting on a reply.",
    "Sometimes a CRM was already bought. It sits half configured, the team logs into it for a week, then everyone drifts back to texts and sticky notes. The tool was never the problem, the system around it was never built.",
  ],
  helpHeading: "How RSG builds it",
  help: [
    "We start with a review of how you actually sell: where leads come from, who touches them, what a deal looks like from inquiry to paid. Only then do we design the pipeline stages, and only then do we pick or fix the CRM.",
    "From there we build: the CRM configured to your sales process, forms and booking connected so leads land in it automatically, follow-up sequences for the ones that go quiet, and a setup simple enough that the team keeps using it after we leave.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "Sales process review and pipeline design",
    "CRM selection, setup, or cleanup of an existing one",
    "Website forms, calls, and booking wired into the CRM",
    "Automated follow-up sequences for new and stalled leads",
    "Unified customer profiles with full purchase history",
    "Loyalty segmentation and VIP customer identification",
    "Retention and win-back workflows for customers going quiet",
    "Customer lifetime value tracking, so you know who to keep",
    "Pipeline reporting the owner can read at a glance",
    "Team training and a rollout plan built for adoption",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owners tracking leads in a phone, an inbox, and memory",
    "Teams with a CRM nobody actually uses",
    "Businesses losing deals to slow or forgotten follow-up",
    "Retail stores and ecommerce brands whose customers buy once and vanish",
    "Operations ready to grow but blind to their own pipeline",
  ],
  serviceArea:
    "RSG builds CRM and pipeline systems for service businesses across Plymouth County and the South Shore of Massachusetts.",
  faqs: [
    {
      q: "Which CRM do you recommend?",
      a: "Honestly, it depends on the business. The right CRM for a two person contractor is wrong for a med spa with a front desk, so we choose per case based on how you sell, who uses it, and what it needs to connect to. We never start with the tool.",
    },
    {
      q: "We already bought a CRM and nobody uses it. Can you fix that?",
      a: "Usually, yes. In most cases the software is fine and the problem is design and adoption: stages that do not match how deals actually move, too many required fields, no clear routine for the team. We rebuild the setup around your real process and train the team on a version they can keep up with.",
    },
    {
      q: "What is pipeline design?",
      a: "Pipeline design is mapping the real stages a lead moves through, from first inquiry to paid, and defining what happens at each one: who owns it, what the next action is, and when follow-up fires. Once the stages are defined, the CRM is configured to match them, not the other way around.",
    },
    {
      q: "Do you connect the website, forms, and booking to the CRM?",
      a: "Yes. Website forms, call tracking, and booking tools all feed the CRM so a lead is captured the moment it arrives, not when someone remembers to type it in. The goal is one system from capture to close.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We look at how leads flow through your business today, then walk you through what a working pipeline would look like and what the build involves. Scope and cost depend on what we find, and the call makes both clear.",
    },
  ],
  related: [
    {
      label: "Business Systems Audit",
      href: "/systemsaudit",
    },
    {
      label: "AI Automation",
      href: "/aiautomation",
    },
    {
      label: "Web Development & Digital Infrastructure",
      href: "/webdevelopment",
    },
    {
      label: "Operations Consulting",
      href: "/operationsconsulting",
    },
    {
      label: "Retail & Multi-Location Systems",
      href: "/industries/retail",
    },
    {
      label: "Interactive Retail Demo",
      href: "/demos/retail",
    },
  ],
  schema: {
    serviceName: "CRM & Pipeline Systems",
    serviceDescription:
      "CRM setup, sales pipeline design, lead capture integration, and follow-up systems for service businesses in Plymouth County and the South Shore of Massachusetts.",
    serviceType: "CRM implementation",
  },
};

export const metadata: Metadata = {
  title: "CRM & Pipeline Systems in Plymouth County, MA | RSG",
  description:
    "CRM setup, sales pipeline design, lead management, and follow-up systems for service businesses in Plymouth County, MA. Every lead tracked, nothing slips.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "CRM & Pipeline Systems in Plymouth County, MA | RSG",
    description:
      "CRM setup, sales pipeline design, lead management, and follow-up systems for service businesses in Plymouth County, MA. Every lead tracked, nothing slips.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
