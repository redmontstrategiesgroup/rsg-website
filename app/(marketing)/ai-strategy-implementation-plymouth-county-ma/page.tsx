import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "ai-strategy-implementation-plymouth-county-ma",
  label: "AI Strategy & Implementation · Plymouth County, MA",
  h1: "AI Strategy & Implementation in Plymouth County, MA",
  intro: [
    "If you are comparing AI consultants in Plymouth County, most of what you will find is tool demos and hype. The pitch is usually a product, not a plan.",
    "RSG works the other way. We study how your business runs first, then apply AI only where it removes real work: lead follow-up, missed calls, intake, drafting, and reporting.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "AI Strategy & Implementation",
  problemHeading: "Why most AI projects go nowhere",
  problem: [
    "Most owners have already tried an AI tool or two. A chatbot that annoyed customers, a subscription nobody opened after the first week. The tool was rarely the problem.",
    "AI fails when it is bolted onto a business nobody has mapped. If lead flow, follow-up, and intake are undefined, automating them just produces faster confusion.",
  ],
  helpHeading: "Review first, then build",
  help: [
    "We start with a review of how the business actually operates: where leads come from, who answers them, what gets typed twice, and what falls through. No AI recommendation happens before that.",
    "Then we build. Most service businesses need two or three well-chosen tools wired into how the business already runs, not a stack of new software. We implement them, connect them to your existing systems, and train your team to use them.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "AI readiness review of your current operations",
    "A clear map of where AI helps and where it does not",
    "Automated lead follow-up and missed call response",
    "Client intake and scheduling assistance",
    "Drafting and reporting support for admin work",
    "Tool selection, setup, and team training",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owners curious about AI but wary of the hype",
    "Service businesses buried in repetitive admin work",
    "Teams losing leads to slow follow-up and missed calls",
    "Businesses that bought AI tools nobody actually uses",
  ],
  serviceArea:
    "RSG builds AI strategies for service businesses across Plymouth County and the South Shore of Massachusetts, including Hanover, Norwell, and Scituate.",
  faqs: [
    {
      q: "Do I need to understand AI to work with RSG?",
      a: "No, and that is the point of the engagement. You explain how your business runs, and we handle the technical side. You should never have to learn a tool to benefit from it.",
    },
    {
      q: "What can AI realistically do for a service business?",
      a: "The practical wins are unglamorous: responding when a call is missed, following up with new leads before they go cold, handling intake questions, and drafting routine admin work. Anything promising more than that deserves skepticism. We only recommend what we can point to inside your own operation.",
    },
    {
      q: "Will AI replace my staff?",
      a: "No. The goal is to take repetitive work off their plates, not to remove people. Your team ends up spending more time with customers and less time retyping the same information.",
    },
    {
      q: "Which AI tools do you use?",
      a: "It depends on the business, and that is deliberate. We choose tools per case after the review, never the other way around. If your existing software already covers a need, we use it instead of adding something new.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We look at how the business runs today, identify where AI would genuinely remove work, and lay out what a build would involve before you commit to anything.",
    },
  ],
  related: [
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
    {
      label: "Operations Consulting",
      href: "/operations-consulting-plymouth-county-ma",
    },
    {
      label: "Web Development & Digital Infrastructure",
      href: "/web-development-digital-infrastructure-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "AI Strategy & Implementation",
    serviceDescription:
      "AI strategy and implementation consulting for service businesses in Plymouth County and the South Shore of Massachusetts, covering lead follow-up, missed call response, intake, and administrative automation.",
    serviceType: "AI strategy consulting",
  },
};

export const metadata: Metadata = {
  title: "AI Strategy & Implementation in Plymouth County, MA | RSG",
  description:
    "Practical AI strategy and implementation for service businesses on the South Shore. RSG finds where AI genuinely helps, then builds it into daily operations.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "AI Strategy & Implementation in Plymouth County, MA | RSG",
    description:
      "Practical AI strategy and implementation for service businesses on the South Shore. RSG finds where AI genuinely helps, then builds it into daily operations.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
