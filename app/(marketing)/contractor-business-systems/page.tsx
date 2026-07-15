import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "contractor-business-systems",
  label: "Industry · Contractors",
  h1: "Business Systems for Contractors",
  intro: [
    "If you are comparing consultants who work with contracting businesses in Plymouth County, most of what you will find is ads and logos, not systems that book jobs.",
    "RSG builds the business side for contractors: lead capture that responds instantly, estimate follow-up that does not quit, a job pipeline you can see, and a website built to produce estimate requests.",
  ],
  parent: { label: "Industries", href: "/industries" },
  breadcrumbLabel: "Contractors",
  problemHeading: "Where contracting businesses lose work",
  problem: [
    "Jobs are won on response speed. A homeowner calls three contractors, and the first one to answer usually gets the walkthrough. Slow follow-up quietly hands work to the next name on the list.",
    "Estimates go out and die in silence because nobody follows up. Job status lives in the owner's head, the website is outdated and produces nothing, and referrals carry the business while nothing captures them systematically.",
  ],
  helpHeading: "How RSG works with contractors",
  help: [
    "We start with a review, not a pitch. We look at how leads come in, what happens after an estimate goes out, how jobs are tracked, and what the website actually produces.",
    "Then we build what the review shows is missing: instant lead response, follow-up on every estimate, a pipeline CRM sized for a trade business, and a review engine that runs after completed jobs.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "Lead capture with instant response to calls and forms",
    "Estimate follow-up sequences that run automatically",
    "Job pipeline CRM from first call to final invoice",
    "A website built to produce booked estimates",
    "Review requests after completed jobs",
    "A simple way to capture and track referrals",
  ],
  whoHeading: "Who this is for",
  who: [
    "General contractors and remodelers",
    "Trade businesses: HVAC, electrical, plumbing, roofing",
    "Contractors quoting more work than they can track by memory",
    "Owners who want the office side handled without hiring for it",
  ],
  serviceArea:
    "RSG works with contractors, remodelers, and trade businesses across Plymouth County and the South Shore of Massachusetts, including Wareham, Bourne, and Middleborough.",
  faqs: [
    {
      q: "Most of my work is referrals. Why do systems matter?",
      a: "Referrals still call, text, and compare you against whoever else they were given. Capture and response speed decide which name on that list wins the job. Systems make sure the referrals you already earn actually turn into work.",
    },
    {
      q: "Can you rebuild my website too?",
      a: "Yes. We build contractor websites around one job: producing estimate requests. That means clear services, proof of work, and a fast path to booking, not decoration.",
    },
    {
      q: "What is estimate follow-up automation?",
      a: "When a quote goes out, a scheduled sequence of texts, emails, or reminders follows it until the homeowner responds. Most contractors send the estimate and wait. The follow-up is usually where the job is won or lost.",
    },
    {
      q: "Do I need a CRM as a small contractor?",
      a: "Not always on day one. Once open quotes start overlapping active jobs, memory stops scaling and things slip. We size the system to the business, which sometimes means a simple pipeline rather than heavy software.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review how leads, estimates, and jobs currently move through your business, then walk through where work is being lost and what fixing it would look like.",
    },
  ],
  related: [
    {
      label: "CRM & Pipeline Systems",
      href: "/crm-pipeline-systems-plymouth-county-ma",
    },
    {
      label: "Web Development & Digital Infrastructure",
      href: "/web-development-digital-infrastructure-plymouth-county-ma",
    },
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "Business Systems for Contractors",
    serviceDescription:
      "Business systems for contractors, remodelers, and trade businesses in Plymouth County and the South Shore of Massachusetts, covering lead capture, estimate follow-up, CRM, and website conversion.",
    serviceType: "Business consulting for contractors",
  },
};

export const metadata: Metadata = {
  title: "Contractor Business Systems | Redmont Strategies Group",
  description:
    "Business systems for contractors in Plymouth County: lead capture, estimate follow-up, CRM, and a website that turns visits into booked jobs.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Contractor Business Systems | Redmont Strategies Group",
    description:
      "Business systems for contractors in Plymouth County: lead capture, estimate follow-up, CRM, and a website that turns visits into booked jobs.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
