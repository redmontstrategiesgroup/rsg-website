import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "dental-wellness-office-ai-strategy",
  label: "Industry · Dental & Wellness Offices",
  h1: "AI Strategy for Dental & Wellness Offices",
  intro: [
    "If you are comparing AI consultants for a dental or wellness practice in Plymouth County, most of what you will find is either generic software or advice from someone who has never watched a front desk on a busy morning.",
    "RSG builds practical AI and follow-up systems for dental and wellness offices: recall sequences, missed-call recovery, appointment reminders, and review requests that run without adding work for your staff.",
  ],
  parent: { label: "Industries", href: "/industries" },
  breadcrumbLabel: "Dental & Wellness",
  problemHeading: "Where practices lose patients",
  problem: [
    "The front desk is doing three jobs at once. A patient is checking out at the counter, the phone is ringing, and a new-patient inquiry just arrived through the website. Something has to wait, and usually it is the caller.",
    "Meanwhile the recall list sits untouched, no-shows leave gaps in the schedule, and reviews lag behind the actual quality of care. None of that is a staffing problem. It is a systems problem.",
  ],
  helpHeading: "How RSG approaches it",
  help: [
    "We start with a review of how the practice actually runs: how calls are handled, what happens after a missed call, how recall works today, and where new-patient inquiries go. No tools get proposed until the gaps are clear.",
    "Then we build the systems that close them: recall and reactivation sequences, missed-call text-back, reminder flows, and AI support for routine questions. Everything is designed so the front desk carries less, not more.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "Recall and reactivation sequences",
    "Missed-call recovery and text-back",
    "Appointment reminder and confirmation flows",
    "New-patient inquiry follow-up",
    "Review request systems",
    "AI support for routine scheduling questions",
  ],
  whoHeading: "Who this is for",
  who: [
    "Dental practices where the front desk is stretched thin",
    "Wellness clinics and offices that book by appointment",
    "Practices with a long recall list and no time to work it",
    "Owners who want fewer no-shows and faster response to new patients",
  ],
  serviceArea:
    "RSG works with dental and wellness offices across Plymouth County and the South Shore of Massachusetts, including Hanover, Kingston, and Sandwich.",
  faqs: [
    {
      q: "How does AI actually help a dental or wellness office?",
      a: "The biggest wins are unglamorous: working the recall list consistently, texting back missed calls, sending reminders that reduce no-shows, and answering routine questions about hours, parking, and scheduling. The result is a fuller schedule and a front desk that spends its time on patients instead of chasing.",
    },
    {
      q: "What about patient privacy?",
      a: "We keep the scope deliberately narrow. RSG works within your existing practice systems and does not build systems that store patient health records. The automation handles scheduling, reminders, and follow-up, not clinical information.",
    },
    {
      q: "Will patients notice they are talking to automation?",
      a: "For routine scheduling and reminders, yes, and most patients expect it. A confirmation text does not need to come from a person. Anything clinical or sensitive routes to your staff.",
    },
    {
      q: "Does this replace the front desk?",
      a: "No. Your front desk is the first impression of the practice, and no system replaces that. It takes the repetitive load off them, the recall calls, the missed-call chasing, the reminder texts, so they can focus on the patient in the room.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review how your practice handles calls, recall, and follow-up today, then walk through what closing the gaps would look like. Scope and cost depend on what the review finds, so the call comes before any commitment.",
    },
  ],
  related: [
    {
      label: "AI Strategy & Implementation",
      href: "/ai-strategy-implementation-plymouth-county-ma",
    },
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crm-pipeline-systems-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "AI Strategy for Dental & Wellness Offices",
    serviceDescription:
      "AI strategy and implementation for dental and wellness offices in Plymouth County and the South Shore of Massachusetts, covering recall, missed-call recovery, appointment reminders, review requests, and front-desk automation.",
    serviceType: "AI strategy for dental and wellness offices",
  },
};

export const metadata: Metadata = {
  title: "AI Strategy for Dental & Wellness Offices | RSG",
  description:
    "Practical AI and business systems for dental and wellness offices: recall and follow-up, missed-call recovery, reviews, and front-desk automation that helps staff.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "AI Strategy for Dental & Wellness Offices | RSG",
    description:
      "Practical AI and business systems for dental and wellness offices: recall and follow-up, missed-call recovery, reviews, and front-desk automation that helps staff.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
