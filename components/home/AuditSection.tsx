"use client";

import Link from "next/link";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";

const AUDIT_AREAS = [
  "Lead flow",
  "Website conversion",
  "Sales process",
  "Customer follow-up",
  "Staff workflows",
  "CRM / pipeline",
  "Marketing systems",
  "Missed opportunities",
  "AI implementation opportunities",
  "Operational bottlenecks",
];

export function AuditSection() {
  return (
    <section id="audit" className="scroll-mt-24">
      <div className="container-px py-24 sm:py-32">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">Business Systems Audit</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-9 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                Start with a Business Systems Audit
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <p className="mt-8 max-w-md text-[1.02rem] leading-relaxed text-white/55">
                Before we build anything, we identify where your business is
                losing time, leads, and revenue opportunities.
              </p>
            </Reveal>
            <Reveal y={12} delay={0.22}>
              <Link
                href="/contact"
                onClick={() =>
                  trackEvent("business_systems_audit_click", { location: "audit_section" })
                }
                className="btn-primary mt-10"
              >
                Get a Business Systems Audit
              </Link>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal y={12} delay={0.12}>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
                What the audit covers
              </p>
              <div className="mt-6 grid gap-x-10 sm:grid-cols-2">
                {AUDIT_AREAS.map((area) => (
                  <div
                    key={area}
                    className="border-t border-white/[0.08] py-4 text-[0.95rem] text-white/70"
                  >
                    {area}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
