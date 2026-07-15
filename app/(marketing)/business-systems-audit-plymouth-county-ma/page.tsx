import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "business-systems-audit-plymouth-county-ma",
  label: "Business Systems Audit · Plymouth County, MA",
  h1: "Business Systems Audit in Plymouth County, MA",
  intro: [
    "If you are comparing consultants or software for your business in Plymouth County, start with a harder question: do you actually know what is broken? Most owners are working from a guess.",
    "RSG runs a structured audit of your lead flow, website conversion, follow-up, CRM, and operations. The result is a clear map of where the business is losing time, leads, and revenue, plus a roadmap to fix it.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "Business Systems Audit",
  problemHeading: "Buying fixes before finding the problem",
  problem: [
    "When growth stalls, most owners buy something: more ads, a new website, another piece of software. The purchase feels like progress, but it is aimed at a symptom, not a diagnosis.",
    "Meanwhile the real leaks stay open. Leads that never get a reply, quotes that never get chased, a CRM nobody trusts, and hours of admin work a system should be doing. Nobody has traced where the losses actually happen.",
  ],
  helpHeading: "Diagnosis before prescription",
  help: [
    "The audit is a review, not a pitch. We walk through how leads come in, what your website does with them, how sales and follow-up actually run, where your team's time goes, and where AI could remove real work.",
    "You get a written map of the gaps, ranked by what they cost you, and an implementation roadmap. Whether RSG builds it or someone else does, you know exactly what to fix and in what order.",
  ],
  includesHeading: "What the audit can include",
  includes: [
    "Lead flow review, from first contact to booked work",
    "Website conversion review",
    "Sales process and follow-up review",
    "CRM and pipeline assessment",
    "AI and automation opportunity mapping",
    "Written findings and an implementation roadmap",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owners who suspect leads are slipping but cannot see where",
    "Businesses about to spend on marketing, software, or a rebuild",
    "Teams juggling calls, forms, and DMs with no single system",
    "Operations that have outgrown spreadsheets and memory",
  ],
  serviceArea:
    "RSG runs systems audits for service businesses across Plymouth County and the South Shore of Massachusetts, including Duxbury, Marshfield, and Kingston.",
  faqs: [
    {
      q: "What exactly does the audit review?",
      a: "It covers lead flow, website conversion, sales process, customer follow-up, CRM and pipeline, and day to day operations. We also flag where AI or automation could remove real work. The goal is one complete picture of how the business runs.",
    },
    {
      q: "What do I get at the end of the audit?",
      a: "A written map of where the business is losing time, leads, and revenue, with the gaps ranked by impact. Alongside it you get an implementation roadmap that lays out what to fix and in what order.",
    },
    {
      q: "Do I have to hire RSG for the build afterward?",
      a: "No. The roadmap is yours, and it is written so you can hand it to your team or another vendor. Many clients do ask RSG to implement it, but the audit stands on its own.",
    },
    {
      q: "How is this different from a free marketing audit?",
      a: "A free marketing audit is usually a sales pitch for ad spend, so it only looks at marketing. This audit covers the whole operating system of the business: lead handling, sales, follow-up, CRM, and operations. The findings are the product, not a setup for a media budget.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We talk through the business, confirm the audit is the right fit, and set the scope before you commit to anything.",
    },
  ],
  related: [
    {
      label: "Business Consulting",
      href: "/business-consulting-plymouth-county-ma",
    },
    {
      label: "Operations Consulting",
      href: "/operations-consulting-plymouth-county-ma",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crm-pipeline-systems-plymouth-county-ma",
    },
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "Business Systems Audit",
    serviceDescription:
      "A structured business systems audit for service businesses in Plymouth County and the South Shore of Massachusetts, reviewing lead flow, website conversion, follow-up, CRM, and operations.",
    serviceType: "Business systems audit",
  },
};

export const metadata: Metadata = {
  title: "Business Systems Audit in Plymouth County, MA | RSG",
  description:
    "A structured audit of your lead flow, website conversion, follow-up, CRM, and operations. See where your Plymouth County business is losing time, leads, and revenue.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Business Systems Audit in Plymouth County, MA | RSG",
    description:
      "A structured audit of your lead flow, website conversion, follow-up, CRM, and operations. See where your Plymouth County business is losing time, leads, and revenue.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
