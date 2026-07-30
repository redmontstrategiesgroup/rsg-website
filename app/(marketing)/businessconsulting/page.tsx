import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "businessconsulting",
  label: "Business Consulting · Plymouth County, MA",
  h1: "Business Consulting in Plymouth County, MA",
  intro: [
    "If you are comparing business consultants in Plymouth County, most options fall into two camps: generic advice with no execution, or software sold as the answer to everything.",
    "RSG is a consulting firm for service businesses. We review how the business runs, find where time, leads, and revenue are being lost, and build practical systems to close the gaps.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "Business Consulting",
  problemHeading: "Why service businesses stall",
  problem: [
    "Most owners are not short on effort. They are short on systems. Leads arrive through calls, forms, and messages, and some never get a response.",
    "Follow-up depends on memory. The website looks fine but does not convert. The CRM is half used or missing entirely. Growth stalls because the operation cannot absorb more volume.",
  ],
  helpHeading: "How RSG works",
  help: [
    "We start by understanding the business, not by selling a tool. The first step is a review of your operations, lead flow, website, follow-up, and current systems.",
    "From there we build a plan and implement it: cleaner workflows, reliable follow-up, a CRM your team uses, and AI only where it removes real work.",
  ],
  includesHeading: "What consulting can include",
  includes: [
    "Business systems review",
    "Lead flow and website review",
    "Operations and workflow mapping",
    "Growth plan and implementation roadmap",
    "Follow-up and CRM improvements",
    "AI implementation where it fits",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owner-operated service businesses",
    "Teams handling leads across calls, forms, and DMs",
    "Businesses spending on marketing but losing leads to slow follow-up",
    "Operations that still run on memory and spreadsheets",
  ],
  serviceArea:
    "RSG works with service businesses across Plymouth County and the South Shore of Massachusetts.",
  faqs: [
    {
      q: "What does a business consultant at RSG do?",
      a: "We diagnose where the business is losing time, leads, and revenue, then build a plan and the systems to fix it. That covers operations, lead flow, follow-up, CRM, website conversion, and AI implementation.",
    },
    {
      q: "How is RSG different from a marketing agency?",
      a: "A marketing agency sells more traffic. We fix what happens to the demand you already have: response time, follow-up, sales process, and operations. More marketing comes after the systems can support it.",
    },
    {
      q: "What does business consulting cost?",
      a: "It depends on scope. Some businesses only need a Strategy Audit, others need a full systems build. The first step is a strategy call so the scope is clear before any commitment.",
    },
    {
      q: "Do you only work with certain industries?",
      a: "We focus on service businesses: med spas, gyms, dental and wellness offices, contractors, home service companies, and other appointment or job based operations.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review your business first, then walk through where the gaps are and what fixing them would look like.",
    },
  ],
  related: [
    {
      label: "Business Systems Audit",
      href: "/systemsaudit",
    },
    {
      label: "Operations Consulting",
      href: "/operationsconsulting",
    },
    {
      label: "AI Automation",
      href: "/aiautomation",
    },
    {
      label: "AI Strategy & Implementation",
      href: "/aistrategy",
    },
  ],
  schema: {
    serviceName: "Business Consulting",
    serviceDescription:
      "Business consulting for service businesses in Plymouth County and the South Shore of Massachusetts, covering operations, lead flow, follow-up, CRM systems, and AI implementation.",
    serviceType: "Business consulting",
  },
};

export const metadata: Metadata = {
  title: "Business Consulting in Plymouth County, MA | Redmont Strategies Group",
  description:
    "Business consulting for service businesses in Plymouth County and the South Shore. RSG reviews operations, lead flow, and systems, then builds a practical plan for growth.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Business Consulting in Plymouth County, MA | Redmont Strategies Group",
    description:
      "Business consulting for service businesses in Plymouth County and the South Shore. RSG reviews operations, lead flow, and systems, then builds a practical plan for growth.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
