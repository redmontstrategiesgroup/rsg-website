"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";

const ENGAGEMENTS = [
  {
    index: "01",
    name: "Strategy Audit",
    fit: "For businesses that need clarity before building.",
    includes: [
      "Business systems review",
      "Website and lead-flow review",
      "AI opportunity map",
      "Implementation roadmap",
    ],
    cta: "Book a Strategy Call",
  },
  {
    index: "02",
    name: "Growth Systems Build",
    fit: "For businesses ready to improve lead capture, follow-up, and operations.",
    includes: [
      "Website and lead-flow improvements",
      "Follow-up and CRM setup",
      "AI automation setup",
      "Review and referral system",
    ],
    cta: "Book a Strategy Call",
  },
  {
    index: "03",
    name: "Full Business Operating System",
    fit: "For businesses that want deeper consulting and implementation support.",
    includes: [
      "Custom automation architecture",
      "Advanced dashboards and reporting",
      "Custom AI workflows",
      "Ongoing optimization and strategy",
    ],
    cta: "Book a Strategy Call",
  },
];

export function EngagementOptions() {
  return (
    <section id="engagements" className="scroll-mt-24">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Engagement Options</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
              Consulting and implementation support built around the business.
            </h2>
          </Reveal>
        </div>

        <div className="mt-24">
          {ENGAGEMENTS.map((e, i) => (
            <Reveal key={e.name} y={12} delay={i * 0.06}>
              <article className="grid gap-8 border-t border-white/[0.08] py-14 last:border-b sm:py-16 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-4">
                  <h3 className="display max-w-xs text-2xl text-white">
                    {e.name}
                  </h3>
                </div>
                <div className="lg:col-span-6">
                  <p className="text-[0.98rem] font-medium text-white/80">
                    {e.fit}
                  </p>
                  <ul className="mt-5 max-w-xl space-y-2 text-sm text-white/50">
                    {e.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-2 lg:pt-1 lg:text-right">
                  <Link
                    href="/book"
                    onClick={() =>
                      trackEvent(
                        e.index === "01"
                          ? "business_systems_audit_click"
                          : "book_strategy_call_click",
                        { location: `engagement_${e.index}` }
                      )
                    }
                    className="group inline-flex items-center gap-2.5 text-sm font-medium text-white transition-colors hover:text-crimson-light"
                  >
                    {e.cta}
                    <ArrowRight
                      size={15}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
