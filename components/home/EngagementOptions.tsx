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
    includes:
      "Business systems review, website and lead-flow review, operations review, AI opportunity map, growth recommendations, and implementation roadmap.",
    cta: "Start with an audit",
  },
  {
    index: "02",
    name: "Growth Systems Build",
    fit: "For businesses ready to improve lead capture, follow-up, marketing, and operations.",
    includes:
      "Strategy audit, website or landing page improvements, lead follow-up system, CRM and pipeline setup, AI automation setup, review system, staff notifications, and marketing workflow improvements.",
    cta: "Book a strategy call",
  },
  {
    index: "03",
    name: "Full Business Operating System",
    fit: "For businesses that want deeper consulting and implementation support.",
    includes:
      "Custom automation architecture, advanced dashboards, multi-channel lead management, custom AI workflows, ongoing optimization, marketing system support, monthly strategy calls, and priority implementation.",
    cta: "Discuss a custom build",
  },
];

export function EngagementOptions() {
  return (
    <section id="engagements" className="scroll-mt-24">
      <div className="container-px py-32 sm:py-44">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Engagement Options</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-9 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
              Consulting and implementation support built around the business.
            </h2>
          </Reveal>
        </div>

        <div className="mt-24">
          {ENGAGEMENTS.map((e, i) => (
            <Reveal key={e.name} y={12} delay={i * 0.06}>
              <article className="grid gap-8 border-t border-white/[0.08] py-14 last:border-b sm:py-16 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-4">
                  <span className="font-display text-sm text-white/30">
                    {e.index}
                  </span>
                  <h3 className="display mt-4 max-w-xs text-2xl text-white">
                    {e.name}
                  </h3>
                </div>
                <div className="lg:col-span-6">
                  <p className="text-[0.98rem] font-medium text-white/80">
                    {e.fit}
                  </p>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/45">
                    <span className="text-white/60">Includes:</span>{" "}
                    {e.includes}
                  </p>
                </div>
                <div className="lg:col-span-2 lg:pt-1 lg:text-right">
                  <Link
                    href="/contact"
                    onClick={() =>
                      trackEvent(
                        e.index === "01"
                          ? "business_systems_audit_click"
                          : "book_strategy_call_click",
                        { location: `engagement_${e.index}` }
                      )
                    }
                    className="group inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-white transition-colors hover:text-crimson-light"
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
