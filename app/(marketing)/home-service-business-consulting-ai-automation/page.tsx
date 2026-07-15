import type { Metadata } from "next";
import { LocalPage, type LocalPageContent } from "@/components/local/LocalPage";

const content: LocalPageContent = {
  slug: "home-service-business-consulting-ai-automation",
  label: "Industry · Home Service Companies",
  h1: "Consulting & AI Automation for Home Service Companies",
  intro: [
    "If you are comparing consultants or AI automation companies for a home service business on the South Shore, most of what you will find is either software with a sales pitch or advice that never touches the schedule.",
    "RSG works with HVAC, plumbing, electrical, landscaping, cleaning, and similar companies. We find where leads and hours are being lost, then build systems that answer, quote, follow up, and keep jobs moving.",
  ],
  parent: { label: "Industries", href: "/industries" },
  breadcrumbLabel: "Home Services",
  problemHeading: "The jobs you never hear about",
  problem: [
    "When you are on a roof or under a sink, the phone still rings. The caller who gets voicemail dials the next company on the list, and that job is gone before you park the truck.",
    "Estimates go out and nobody chases them. Scheduling lives in text threads and memory, the office loses evenings to admin, and the swing between the busy season and the quiet season makes all of it worse.",
  ],
  helpHeading: "Review first, then build",
  help: [
    "We start with a review of how work actually flows: how calls come in, how estimates go out, what happens after the job, and where the software you already pay for is not pulling its weight.",
    "Then we build only what the review justifies. That usually means missed-call text back, fast lead response, follow-up that runs on its own, and a pipeline that shows every job from first call to paid invoice.",
  ],
  includesHeading: "What the engagement can include",
  includes: [
    "Missed-call text back and instant lead response",
    "Estimate and quote follow-up sequences",
    "Job pipeline from inquiry to invoice",
    "Scheduling and booking flow cleanup",
    "Review requests after completed jobs",
    "Quiet-season reactivation campaigns",
  ],
  whoHeading: "Who this is for",
  who: [
    "HVAC, plumbing, electrical, landscaping, and cleaning companies",
    "Crews that miss calls because everyone is on a job",
    "Owners who quote fast but rarely have time to follow up",
    "Offices running on texts, sticky notes, and memory",
  ],
  serviceArea:
    "RSG works with home service companies across Plymouth County and the South Shore of Massachusetts, including Marshfield, Pembroke, and Whitman.",
  faqs: [
    {
      q: "We miss calls while we are on jobs. What fixes that?",
      a: "Missed-call text back sends the caller an immediate text so they know you saw them, and instant lead response does the same for web forms. A caller who gets a reply within moments rarely keeps dialing down the list. We set both up so they run without anyone touching a phone.",
    },
    {
      q: "Can you automate estimate follow-up?",
      a: "Yes. We build sequences that follow up on open quotes at set intervals, so nobody has to remember to chase them. You still close the job, the system just makes sure the conversation never goes quiet.",
    },
    {
      q: "Will this work with our field service software?",
      a: "Usually, yes. We integrate with what you already use before recommending anything new, whether that is a field service platform, a calendar, or a spreadsheet. Replacing software is a last resort, not a starting point.",
    },
    {
      q: "How much admin time does this actually save?",
      a: "It depends on your call volume and how much of the current process is manual, so we will not invent a number. The audit maps where the hours go and puts a real figure on what automation would recover. You see that before committing to anything.",
    },
    {
      q: "How do we start?",
      a: "Book a strategy call. We look at how leads, quotes, and jobs move through your business today, then walk through where the gaps are and what closing them would involve.",
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
      label: "Operations Consulting",
      href: "/operations-consulting-plymouth-county-ma",
    },
    {
      label: "Business Systems Audit",
      href: "/business-systems-audit-plymouth-county-ma",
    },
  ],
  schema: {
    serviceName: "Consulting & AI Automation for Home Service Companies",
    serviceDescription:
      "Consulting and AI automation for home service companies in Plymouth County and on the South Shore of Massachusetts, covering lead response, estimate follow-up, scheduling, job pipelines, and admin automation.",
    serviceType: "Business consulting for home service companies",
  },
};

export const metadata: Metadata = {
  title: "Home Service Business Consulting & AI Automation | RSG",
  description:
    "For home service companies on the South Shore: answer every lead, quote faster, follow up automatically, and keep jobs moving without more admin work.",
  alternates: { canonical: `/${content.slug}` },
  openGraph: {
    title: "Home Service Business Consulting & AI Automation | RSG",
    description:
      "For home service companies on the South Shore: answer every lead, quote faster, follow up automatically, and keep jobs moving without more admin work.",
    url: `/${content.slug}`,
    images: ["/og.png"],
  },
};

export default function Page() {
  return <LocalPage content={content} />;
}
