import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "aiautomation",
  label: "AI Automation · Plymouth County, MA",
  h1: "AI Automation for Service Businesses in Plymouth County, MA",
  intro: [
    "If you are searching for an AI automation company in Plymouth County, most of what you will find is either software with no strategy behind it or big promises with no build.",
    "RSG designs and installs automation for the moments where service businesses lose revenue: missed calls, slow follow-up, quiet past customers, and reviews that never get asked for.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "AI Automation",
  problemHeading: "Where the revenue actually leaks",
  problem: [
    "A call goes unanswered while the team is on a job, and the caller books with whoever picks up next. A form submission sits until the evening, and by then the lead has moved on.",
    "Past customers who would happily come back never hear from you. Happy customers leave without being asked for a review. None of this is a marketing problem, it is a follow-through problem.",
  ],
  helpHeading: "How RSG approaches automation",
  help: [
    "We review before we build. That means looking at how calls, forms, and messages actually flow through your business, where responses stall, and which moments cost you the most.",
    "Then we build automation around those specific gaps: an instant text back when a call is missed, a response to every form within minutes, reactivation messages to past customers, and review requests that go out on time. Wherever possible we build around the tools you already use.",
  ],
  includesHeading: "What automation can include",
  includes: [
    "Missed call text back",
    "Instant follow-up for form submissions and inquiries",
    "Past customer reactivation messages",
    "Customer win-back campaigns for retail and ecommerce",
    "Automated review requests",
    "Product recommendation assistants that answer shopper questions",
    "Low-stock notifications for retail inventory",
    "CRM and pipeline automation",
    "Customer communication flows with human handoff",
    "Daily owner summaries for retail stores",
  ],
  whoHeading: "Who this is for",
  who: [
    "Service businesses that miss calls while on jobs or with clients",
    "Teams where follow-up depends on whoever remembers",
    "Businesses paying for leads that go cold before anyone responds",
    "Retail stores and ecommerce brands fielding the same shopper questions every day",
    "Owners who want automation without losing the personal touch",
  ],
  serviceArea:
    "RSG builds AI automation for service businesses across Plymouth County and the South Shore of Massachusetts.",
  faqs: [
    {
      q: "What can actually be automated in a service business?",
      a: "More than most owners expect: missed call text back, instant responses to form submissions, appointment reminders, review requests, reactivation messages to past customers, and CRM updates that currently happen by hand. The judgment calls stay human. The repetitive follow-through is what gets automated.",
    },
    {
      q: "Will automation feel robotic to my customers?",
      a: "Not if it is built well. Every message is written to sound like your business, and every flow includes a handoff point where a real person takes over. Customers notice a fast, helpful response far more than they notice how it was sent.",
    },
    {
      q: "Does an AI receptionist or chatbot make sense for a local business?",
      a: "Sometimes, depending on call volume and what callers actually need. For some businesses a simple missed call text back covers most of the gap, and a full AI receptionist would be overkill. We tell you which one fits before anything gets built.",
    },
    {
      q: "What does setup involve?",
      a: "It starts with a review of how leads and communication move through your business today. From there we build around your existing tools where possible rather than forcing a platform switch. You approve the messaging before anything goes live.",
    },
    {
      q: "Where do we start?",
      a: "Book a strategy call. We look at where your business is losing calls, leads, and repeat customers, then map out which automations would close those gaps and in what order.",
    },
  ],
  related: [
    {
      label: "Custom Private AI Systems",
      href: "/services/customprivateaisystems",
    },
    {
      label: "AI Strategy & Implementation",
      href: "/aistrategy",
    },
    {
      label: "Web Development & Digital Infrastructure",
      href: "/webdevelopment",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crmsystems",
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
    serviceName: "AI Automation",
    serviceDescription:
      "AI automation services for service businesses in Plymouth County and the South Shore of Massachusetts, covering missed call response, lead follow-up, review requests, customer reactivation, and CRM automation.",
    serviceType: "AI automation services",
  },
};

export const metadata: Metadata = {
  title: "AI Automation for Businesses in Plymouth County, MA | RSG",
  description:
    "AI automation for lead follow-up, missed calls, reviews, and customer communication. Built for service businesses across Plymouth County and the South Shore.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "AI Automation for Businesses in Plymouth County, MA | RSG",
    description:
      "AI automation for lead follow-up, missed calls, reviews, and customer communication. Built for service businesses across Plymouth County and the South Shore.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
