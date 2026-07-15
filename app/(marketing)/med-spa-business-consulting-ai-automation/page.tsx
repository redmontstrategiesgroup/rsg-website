import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "med-spa-business-consulting-ai-automation",
  label: "Industry · Med Spas & Aesthetic Clinics",
  h1: "Business Systems & AI Automation for Med Spas",
  intro: [
    "If you are comparing consultants who work with med spas and aesthetic clinics, most of what you will find is either generic marketing advice or software pitched as a fix for everything.",
    "RSG builds the business systems behind the treatment room: fast follow-up on every consult request, a working pipeline from inquiry to booked treatment, reminder flows that protect the calendar, and AI used only where it removes real work.",
  ],
  parent: { label: "Industries", href: "/industries" },
  breadcrumbLabel: "Med Spas",
  problemHeading: "Where med spas lose revenue",
  problem: [
    "Consult requests arrive by DM, form, and phone while the front desk is answering calls, checking clients out, and turning treatment rooms. A high-value inquiry that sits unanswered for a few hours often books somewhere else, and nobody notices it happened.",
    "The leaks compound from there. No-shows leave holes in a fully staffed calendar, past clients quietly lapse without a reason to return, and reviews trail the actual quality of the work because nobody asks at the right moment.",
  ],
  helpHeading: "How RSG approaches it",
  help: [
    "We start with a review, not a pitch. We look at how inquiries come in, what happens in the first hour, how consults move to booked treatments, and where the calendar and follow-up break down.",
    "Then we build in order of impact. That usually means instant follow-up on every inquiry first, then a consult pipeline your team actually uses, reminder flows that cut no-shows, and reactivation for clients who have gone quiet.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "Instant follow-up on every consult inquiry",
    "A consult pipeline built in a CRM",
    "Booking and reminder flows that reduce no-shows",
    "Lapsed-client reactivation campaigns",
    "Review generation tied to visits",
    "AI support for intake and common questions",
  ],
  whoHeading: "Who this is for",
  who: [
    "Med spas and aesthetic clinics with a busy front desk and no follow-up system",
    "Practices spending on ads while consult requests sit unanswered",
    "Owners watching no-shows and lapsed clients erode the calendar",
    "Teams whose reviews do not reflect the quality of their work",
  ],
  serviceArea:
    "RSG works with med spas and aesthetic clinics across Plymouth County and the South Shore of Massachusetts, including Hingham, Duxbury, and Cohasset.",
  faqs: [
    {
      q: "Which systems matter most for a med spa?",
      a: "Speed to lead and consult follow-up usually come first, because that is where high-value inquiries go cold. After that, reminder flows that protect the calendar and reactivation for lapsed clients tend to return the most.",
    },
    {
      q: "Can you work with our existing booking software?",
      a: "Usually, yes. We integrate around what you already use before recommending a replacement, and we only suggest switching when the current tool is the actual bottleneck.",
    },
    {
      q: "How does AI help without feeling impersonal?",
      a: "AI handles timing and admin: instant responses, reminders, intake questions, and routing. The voice stays yours, and a human takes over the moment a conversation turns live.",
    },
    {
      q: "Do you also handle marketing?",
      a: "No, RSG is not a marketing agency. We build the systems side: follow-up, booking, CRM, and AI automation, so the inquiries you already get stop leaking. Those systems also make whatever marketing you run elsewhere work harder.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review how your practice handles inquiries, consults, and bookings, then walk through the gaps and what fixing them would look like. Scope and cost depend on what the review finds, and the call makes both clear.",
    },
  ],
  related: [
    {
      label: "AI Automation",
      href: "/ai-automation-plymouth-county-ma",
    },
    {
      label: "CRM & Pipeline Systems",
      href: "/crm-pipeline-systems-plymouth-county-ma",
    },
    {
      label: "Web Development & Digital Infrastructure",
      href: "/web-development-digital-infrastructure-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "Business Consulting & AI Automation for Med Spas",
    serviceDescription:
      "Business consulting and AI automation for med spas and aesthetic clinics in Plymouth County and the South Shore of Massachusetts, covering lead follow-up, consult pipelines, booking and reminder flows, client reactivation, and review generation.",
    serviceType: "Business consulting for med spas",
  },
};

export const metadata: Metadata = {
  title: "Med Spa Consulting & AI Automation | Redmont Strategies Group",
  description:
    "Business systems for med spas and aesthetic clinics: faster lead follow-up, booking flows that convert, review generation, and AI used with a real purpose.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Med Spa Consulting & AI Automation | Redmont Strategies Group",
    description:
      "Business systems for med spas and aesthetic clinics: faster lead follow-up, booking flows that convert, review generation, and AI used with a real purpose.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
