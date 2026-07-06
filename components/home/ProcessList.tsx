"use client";

import { Reveal } from "../Reveal";

const STEPS = [
  {
    name: "Diagnose",
    body: "We review the business, offer, website, lead flow, follow-up, operations, and current systems.",
  },
  {
    name: "Map",
    body: "We identify where time, money, leads, and opportunities are being lost.",
  },
  {
    name: "Strategize",
    body: "We create a practical plan around growth, operations, customer communication, and AI implementation.",
  },
  {
    name: "Build",
    body: "We build the systems, workflows, automations, websites, and digital infrastructure needed to execute the plan.",
  },
  {
    name: "Optimize",
    body: "We improve the system over time so the business continues operating sharper.",
  },
];

export function ProcessList() {
  return (
    <section id="process" className="scroll-mt-24">
      <div className="container-px py-32 sm:py-44">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-36">
              <Reveal y={12}>
                <p className="label">Process</p>
              </Reveal>
              <Reveal y={12} delay={0.08}>
                <h2 className="display mt-9 max-w-md text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                  A practical framework for building smarter businesses.
                </h2>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {STEPS.map((step, i) => (
              <Reveal key={step.name} y={12} delay={i * 0.05}>
                <div className="grid grid-cols-[72px_1fr] gap-6 border-t border-white/[0.08] py-10 last:border-b sm:grid-cols-[104px_1fr] sm:py-12">
                  <span className="font-display text-3xl font-medium text-white/[0.15] sm:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="display text-[1.35rem] text-white">
                      {step.name}
                    </h3>
                    <p className="mt-3.5 max-w-md text-[0.98rem] leading-relaxed text-white/50">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
