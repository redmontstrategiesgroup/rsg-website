import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "webdevelopment",
  managedService: "website",
  label: "Web Development & Digital Infrastructure · Plymouth County, MA",
  h1: "Web Development & Digital Infrastructure in Plymouth County, MA",
  intro: [
    "If you are comparing web developers in Plymouth County, most of what you will find is design work: a site that looks better but books no more work than the old one did.",
    "RSG treats a website as infrastructure, not decoration. We build conversion-focused sites and landing pages wired into booking, CRM, and follow-up, so a visit turns into an appointment or a quote request.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "Web Development",
  problemHeading: "Why most business websites underperform",
  problem: [
    "Most service business sites are built as brochures. They describe the company, list the services, and leave the visitor to figure out the next step on their own.",
    "The bigger problem is what happens after the click. Forms land in an inbox nobody watches, booking lives in a separate tool, and nothing follows up when a lead goes quiet. The site is disconnected from the operation it is supposed to feed.",
  ],
  helpHeading: "How RSG approaches web development",
  help: [
    "We do not start with a mockup. We start with a review of your current site: where traffic comes from, what visitors actually do, and what happens to a lead after they reach out.",
    "Then we build to close the gaps: a fast site with clear offers and real proof, landing pages for specific services, and every form and booking flow connected to your CRM and follow-up. Tools you already use stay in place if they work, and get replaced only when they are the problem.",
  ],
  includesHeading: "What a build can include",
  includes: [
    "Conversion-focused website design and build",
    "Retail storefronts and ecommerce",
    "Landing pages for specific services and offers",
    "Booking flows connected to your calendar",
    "Online ordering with in-store pickup and local delivery",
    "Product reservations and gift cards",
    "Product search and live inventory visibility",
    "Forms and calls routed into a CRM with follow-up",
    "Dashboards and client portals where they earn their place",
    "Site speed, tracking, and technical SEO fundamentals",
  ],
  whoHeading: "Who this is for",
  who: [
    "Service businesses whose site gets traffic but few inquiries",
    "Retail stores and ecommerce brands selling in-store and online",
    "Owners replacing an outdated or DIY website",
    "Teams whose booking, forms, and CRM do not talk to each other",
    "Businesses that want reporting they can actually read",
  ],
  serviceArea:
    "RSG builds websites and digital infrastructure for service businesses across Plymouth County and the South Shore of Massachusetts.",
  faqs: [
    {
      q: "Do you redesign existing sites or build new ones?",
      a: "Both. The review decides which makes sense: some sites need a full rebuild, others need targeted fixes to structure, speed, and the paths that lead to a booking. We recommend the smaller job when the smaller job solves it.",
    },
    {
      q: "What makes a business website actually convert?",
      a: "Clarity about what you do and who it is for, fast load times, visible proof, and one obvious next step on every page. Just as important is what happens after the form is submitted: a site converts reliably when follow-up is wired in behind it.",
    },
    {
      q: "Can you integrate my booking system or CRM?",
      a: "Usually, yes. We connect to what you already use first, and we only recommend replacing a tool when the tool itself is causing the losses. The review makes that call before anything gets built.",
    },
    {
      q: "Do you build dashboards or client portals?",
      a: "Yes, when there is a real job for them. A dashboard fits when you need leads, bookings, and revenue visible in one place, and a portal fits when clients need a cleaner way to work with you. We do not build either as decoration.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review your current site and systems first, then walk through what we found and what a build or a fix would involve. Scope and cost depend on what the review turns up, and the call makes both clear.",
    },
  ],
  related: [
    {
      label: "Operations Consulting",
      href: "/operationsconsulting",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crmsystems",
    },
    {
      label: "AI Automation",
      href: "/aiautomation",
    },
    {
      label: "Business Systems Audit",
      href: "/systemsaudit",
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
    serviceName: "Web Development & Digital Infrastructure",
    serviceDescription:
      "Web development and digital infrastructure for service businesses in Plymouth County and the South Shore of Massachusetts, covering conversion-focused websites, landing pages, booking flows, CRM integration, dashboards, and client portals.",
    serviceType: "Web development",
  },
};

export const metadata: Metadata = {
  title: "Web Development & Digital Infrastructure in Plymouth County, MA | RSG",
  description:
    "Conversion-focused websites, landing pages, booking flows, CRMs, and dashboards for service businesses in Plymouth County and across the South Shore.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Web Development & Digital Infrastructure in Plymouth County, MA | RSG",
    description:
      "Conversion-focused websites, landing pages, booking flows, CRMs, and dashboards for service businesses in Plymouth County and across the South Shore.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
