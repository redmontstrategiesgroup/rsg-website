"use client";

import { Reveal } from "../Reveal";

const STEPS = [
  {
    name: "Diagnose",
    body: "We review the whole business: offer, website, lead flow, and operations.",
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
      <div className="container-px py-20 sm:py-28">
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
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {STEPS.map((step, i) => (
              <Reveal key={step.name} y={12} delay={i * 0.05}>
                <div className="border-t border-white/[0.08] py-10 last:border-b sm:py-12">
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
