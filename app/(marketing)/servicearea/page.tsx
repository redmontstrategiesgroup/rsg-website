import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "servicearea",
  label: "Service Area · Plymouth County & the South Shore",
  h1: "Business Consulting & AI Strategy Across Plymouth County and the South Shore",
  intro: [
    "RSG is a business consulting and AI strategy firm built for the service businesses that keep this region running: the practices, gyms, trades, and local operators that live on calls, appointments, and jobs.",
    "The work is the same everywhere we go. Understand how the business actually runs, find where time and revenue are being lost, and build practical systems to close the gaps.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "Service Area",
  problemHeading: "The problems we get called about",
  problem: [
    "A phone that rings while everyone is with a customer. Leads arriving through calls, forms, and messages with no single place to land. Quotes and consult requests that go out and never get chased.",
    "A website that looks fine but produces little. A CRM that was bought and abandoned. An owner who is the scheduling system, the follow-up system, and the reporting system all at once.",
  ],
  helpHeading: "How RSG works across the region",
  help: [
    "Every engagement starts the same way regardless of town: a strategy call, then a Business Systems Audit that maps where your specific business is losing time, leads, and revenue.",
    "From there we build what the audit shows is worth building: follow-up systems, CRM and pipeline, booking flows, websites that convert, and AI automation where it removes real work.",
  ],
  includesHeading: "Types of businesses RSG works with",
  includes: [
    "Med spas and aesthetic clinics",
    "Gyms and fitness studios",
    "Dental and wellness offices",
    "Home service companies and contractors",
    "Cleaning companies and local service businesses",
    "High-ticket service providers",
  ],
  whoHeading: "Problems RSG helps fix",
  who: [
    "Missed calls and slow follow-up",
    "Leads scattered across phone, forms, and DMs",
    "Websites that get visits but not bookings",
    "Operations that run on memory and spreadsheets",
  ],
  serviceArea:
    "Redmont Strategies Group works with service businesses across Plymouth County and the South Shore, including communities such as Plymouth, Pembroke, Duxbury, Marshfield, Hanover, Kingston, Hingham, Scituate, Norwell, and nearby areas.",
  faqs: [
    {
      q: "Does RSG work with businesses in my town?",
      a: "If you run a service business in Plymouth County or on the South Shore, yes. The engagement is built around how your business runs, not where the town line falls.",
    },
    {
      q: "How do engagements work across the area?",
      a: "Everything starts with a strategy call. The audit and systems work happen in and around the tools your business already uses, so distance is rarely a factor.",
    },
    {
      q: "What kinds of businesses fit RSG?",
      a: "Appointment and job based service businesses: med spas, gyms, dental and wellness offices, home services, contractors, cleaning companies, and other local operators where speed and follow-up decide who wins the work.",
    },
    {
      q: "What is the Business Systems Audit?",
      a: "A structured review of your lead flow, website conversion, follow-up, CRM, and operations. You get a ranked map of where the business is leaking and a roadmap for what to fix first.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review the business first, then walk through what we found and what fixing it would look like. The conversation is about your operation, not a pitch.",
    },
  ],
  related: [
    {
      label: "Business Consulting",
      href: "/businessconsulting",
    },
    {
      label: "Business Systems Audit",
      href: "/systemsaudit",
    },
    { label: "AI Automation", href: "/aiautomation" },
    { label: "Industries", href: "/industries" },
  ],
  schema: {
    serviceName: "Business Consulting & AI Strategy",
    serviceDescription:
      "Business consulting and AI strategy for service businesses across Plymouth County and the South Shore of Massachusetts, covering operations, follow-up systems, CRM, websites, and AI automation.",
    serviceType: "Business consulting",
  },
};

export const metadata: Metadata = {
  title: "Serving Plymouth County & the South Shore | Redmont Strategies Group",
  description:
    "RSG works with service businesses across Plymouth County and the South Shore of Massachusetts: consulting, systems, and AI implementation built around how local businesses actually run.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Serving Plymouth County & the South Shore | Redmont Strategies Group",
    description:
      "RSG works with service businesses across Plymouth County and the South Shore of Massachusetts: consulting, systems, and AI implementation built around how local businesses actually run.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
