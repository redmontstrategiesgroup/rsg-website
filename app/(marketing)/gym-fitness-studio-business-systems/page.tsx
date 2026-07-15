import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "gym-fitness-studio-business-systems",
  label: "Industry · Gyms & Fitness Studios",
  h1: "Business Systems for Gyms & Fitness Studios",
  intro: [
    "If you are searching for a consultant who understands how gyms and fitness studios actually operate, most of what you will find is either generic marketing advice or another software subscription.",
    "RSG builds the business side of the gym: follow-up systems that turn trials into members, missed call recovery, win-back campaigns for lapsed members, and reporting that shows what actually converts.",
  ],
  parent: { label: "Industries", href: "/industries" },
  breadcrumbLabel: "Gyms & Fitness Studios",
  problemHeading: "Where gyms lose members before they join",
  problem: [
    "A trial visitor takes a class, says it was great, and never comes back. Nobody follows up because the owner was coaching, the front desk was busy, and there is no system that does it automatically. The same thing happens to drop-ins, day passes, and people who called once and got voicemail mid-class.",
    "Cancellations are just as quiet: a member stops showing up, the payment eventually fails, and no one reaches out. Class packs and upsells depend on whoever remembers to mention them. The owner coaches all day, does admin all night, and growth stalls anyway.",
  ],
  helpHeading: "How RSG approaches it",
  help: [
    "We start with a review, not a pitch. We look at how leads and trials come in, what happens after a first visit, how missed calls are handled, what your membership software already tracks, and where members quietly fall out of the business.",
    "Then we build the systems that close those gaps: trial-to-member follow-up sequences, missed call recovery, a clean membership pipeline, win-back outreach for lapsed members, and a review engine. The goal is growth from the demand already walking through the door, not more ad spend.",
  ],
  includesHeading: "What an engagement can include",
  includes: [
    "Trial and drop-in follow-up sequences",
    "Missed call recovery with automatic text-back",
    "Membership pipeline from inquiry to signed member",
    "Win-back campaigns for cancelled and lapsed members",
    "Review engine to build local reputation",
    "Simple reporting on what converts and what does not",
  ],
  whoHeading: "Who this is for",
  who: [
    "Owner-operated gyms, fitness studios, and boxing gyms",
    "Studios whose trial visitors ghost after one class",
    "Gyms losing calls and inquiries during coaching hours",
    "Owners handling admin at night because the day is spent on the floor",
  ],
  serviceArea:
    "RSG works with gyms and fitness studios across Plymouth County and the South Shore of Massachusetts, including Plymouth, Bridgewater, and Rockland.",
  faqs: [
    {
      q: "How do you grow a gym without more ad spend?",
      a: "Most gyms already have enough interest walking in: trials, drop-ins, calls, and DMs. The problem is that too much of it leaks out through slow follow-up and quiet cancellations. We fix conversion and retention first, so the demand you already generate turns into members before you pay for more.",
    },
    {
      q: "Can this work with our membership software?",
      a: "Usually yes. We start by integrating with what you already use rather than forcing a platform switch. If the current setup genuinely cannot support what the business needs, we will say so and explain the tradeoffs before anything changes.",
    },
    {
      q: "Do you help with retention or just new leads?",
      a: "Both. New member systems only matter if the back door is closed, so engagements include win-back campaigns for lapsed members and check-in systems that catch people before they cancel. Keeping a member is part of the same pipeline as signing one.",
    },
    {
      q: "Is this only for big gyms?",
      a: "No. Owner-operated gyms and studios are the focus, the ones where the owner coaches, sells, and does admin. Those businesses feel missed follow-up the most and get the most back from fixing it.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We review how leads, trials, and members currently move through your business, then walk through where the gaps are and what fixing them would look like. Scope and cost depend on what the review finds.",
    },
  ],
  related: [
    {
      label: "Operations Consulting",
      href: "/operations-consulting-plymouth-county-ma",
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
    serviceName: "Business Systems for Gyms & Fitness Studios",
    serviceDescription:
      "Follow-up, booking, and member retention systems for gyms and fitness studios in Plymouth County and the South Shore of Massachusetts.",
    serviceType: "Business consulting for gyms and fitness studios",
  },
};

export const metadata: Metadata = {
  title: "Business Systems for Gyms & Fitness Studios | RSG",
  description:
    "Follow-up, booking, and retention systems for gyms and fitness studios. Turn trial interest into memberships with better follow-up and cleaner operations.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Business Systems for Gyms & Fitness Studios | RSG",
    description:
      "Follow-up, booking, and retention systems for gyms and fitness studios. Turn trial interest into memberships with better follow-up and cleaner operations.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
