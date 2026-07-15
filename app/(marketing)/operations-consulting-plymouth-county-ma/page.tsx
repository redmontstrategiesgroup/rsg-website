import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "operations-consulting-plymouth-county-ma",
  label: "Operations Consulting · Plymouth County, MA",
  h1: "Operations Consulting in Plymouth County, MA",
  intro: [
    "If you are searching for an operations consultant in Plymouth County, most of what you will find is written for companies with a COO and a project office. Very little of it fits a business where the owner is still in the work every day.",
    "RSG does operations consulting for service businesses. We map how work actually moves through your business, find the bottlenecks, and build workflows and reporting your team runs without you in the middle.",
  ],
  parent: { label: "Services", href: "/services" },
  breadcrumbLabel: "Operations Consulting",
  problemHeading: "When everything routes through the owner",
  problem: [
    "The business works, but only because you are in the middle of it. Scheduling, quotes, follow-up, and staff questions all wait on one person, and the day fills with decisions someone else could make.",
    "That ceiling shows up as slow quotes, missed follow-up, and jobs that stall the moment you are unavailable. Hiring more people rarely fixes it, because new hires inherit the same undocumented process and the same line outside your door.",
  ],
  helpHeading: "Review first, then build",
  help: [
    "We start with a review, not a template. We trace how a job moves from first contact to done and mark where it waits, gets rehandled, or depends on your memory.",
    "Then we standardize the repeatable parts and build the workflows, handoffs, and reporting around them. The aim is operational efficiency that fits a small team, not a factory playbook forced onto one.",
  ],
  includesHeading: "What an engagement can include",
  includes: [
    "Workflow and process mapping",
    "Bottleneck review across scheduling, quoting, and follow-up",
    "Standard procedures for the repeatable parts of the work",
    "Role and handoff definitions so work moves without the owner",
    "Simple reporting you can check weekly",
    "Tooling and automation only where it removes real work",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owners who have become the bottleneck in their own business",
    "Service businesses where quotes and scheduling wait on one person",
    "Teams that check with the owner before finishing routine work",
    "Businesses preparing to add staff without adding chaos",
  ],
  serviceArea:
    "RSG provides operations consulting to service businesses across Plymouth County and the South Shore of Massachusetts, including East Bridgewater, West Bridgewater, and Halifax.",
  faqs: [
    {
      q: "What does an operations consultant actually do?",
      a: "We map how work flows through your business, from first contact to completed job, and find where it slows down or depends on one person. Then we standardize the repeatable parts and build workflows and reporting your team actually uses. The result is a business that runs on process instead of memory.",
    },
    {
      q: "How is this different from hiring an operations manager?",
      a: "An operations manager is a salary, and without defined processes they spend their first year inventing them from scratch. We build the system the team runs, which is a project rather than permanent payroll. Many businesses eventually do both, and the system makes that hire far more effective.",
    },
    {
      q: "Do you work with small teams?",
      a: "Yes. Owner-operated businesses are the focus, usually teams small enough that everything still routes through the owner. The work is scaled to that reality, not to a corporate org chart.",
    },
    {
      q: "What usually changes first?",
      a: "Whatever the review shows is the highest-cost bottleneck, which is commonly follow-up or scheduling. Fixing the most expensive constraint first frees up time and builds momentum for the rest of the work.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We look at how the business runs now, then walk through where the bottlenecks are and what fixing them would involve. Scope depends on what the review finds, and the call makes that clear before any commitment.",
    },
  ],
  related: [
    {
      label: "Business Consulting",
      href: "/business-consulting-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crm-pipeline-systems-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "Operations Consulting",
    serviceDescription:
      "Operations consulting for service businesses in Plymouth County and the South Shore of Massachusetts, covering workflow mapping, bottleneck removal, standard procedures, and reporting.",
    serviceType: "Operations consulting",
  },
};

export const metadata: Metadata = {
  title: "Operations Consulting in Plymouth County, MA | Redmont Strategies Group",
  description:
    "Operations consulting for service businesses in Plymouth County. RSG maps your workflows, removes bottlenecks, and builds systems your team actually uses.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Operations Consulting in Plymouth County, MA | Redmont Strategies Group",
    description:
      "Operations consulting for service businesses in Plymouth County. RSG maps your workflows, removes bottlenecks, and builds systems your team actually uses.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
