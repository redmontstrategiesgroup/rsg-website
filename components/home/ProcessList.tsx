"use client";

import Link from "next/link";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";

const STEPS = [
  {
    name: "Audit",
    body: "A Business Systems Audit of the whole business: offer, website, lead flow, sales, follow-up, and operations. Nothing gets built before this.",
  },
  {
    name: "Map",
    body: "We pinpoint where time, leads, and revenue are being lost.",
  },
  {
    name: "Strategize",
    body: "We build a practical plan to close the gaps.",
  },
  {
    name: "Build",
    body: "We build the systems and infrastructure to execute it.",
  },
  {
    name: "Optimize",
    body: "We refine it over time so the business keeps improving.",
  },
];

export function ProcessList({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id="process" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-36">
              <Reveal y={12}>
                <p className="label">Process</p>
              </Reveal>
              <Reveal y={12} delay={0.08}>
                <Heading className="display mt-6 max-w-md text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                  A practical framework for improving how the business runs.
                </Heading>
              </Reveal>
              <Reveal y={12} delay={0.16}>
                <Link
                  href="/book"
                  onClick={() =>
                    trackEvent("business_systems_audit_click", { location: "process_section" })
                  }
                  className="btn-primary mt-8"
                >
                  Get a Business Systems Audit
                </Link>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {STEPS.map((step, i) => (
              <Reveal key={step.name} y={12} delay={i * 0.05}>
                <div className="border-t border-white/8 py-7 last:border-b sm:py-12">
                  <p className="label">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="display mt-3 text-[1.35rem] text-white">
                    {step.name}
                  </h3>
                  <p className="mt-3.5 max-w-md text-[0.98rem] leading-relaxed text-white/50">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
