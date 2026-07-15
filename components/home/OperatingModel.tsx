"use client";

import { Reveal } from "../Reveal";

const PILLARS = [
  {
    group: "Demand",
    caption: "How the business gets found",
    items: ["Lead Flow", "Website Conversion", "Reviews"],
  },
  {
    group: "Conversion",
    caption: "How inquiries become customers",
    items: ["Sales Process", "Customer Follow-Up", "CRM / Pipeline"],
  },
  {
    group: "Execution",
    caption: "How the work gets done",
    items: ["Staff Workflows", "AI Implementation", "Reporting"],
  },
];

export function OperatingModel() {
  return (
    <section className="border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">Operating Model</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                A business is only as strong as the systems underneath it.
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <p className="mt-6 max-w-md text-[1.02rem] leading-relaxed text-white/55">
                Most businesses run on scattered pieces. RSG connects the core
                parts of the operation into one model, so leads, customers,
                staff, and data move through the same system instead of around
                it.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal y={12} delay={0.12}>
              {/* Consulting diagram: one rule, three stems, ten pillars */}
              <div className="border-t border-white/20">
                <div className="grid gap-x-8 sm:grid-cols-3">
                  {PILLARS.map((p) => (
                    <div key={p.group}>
                      <span className="block h-8 w-px bg-white/25" />
                      <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-white/70">
                        {p.group}
                      </p>
                      <p className="mt-1.5 text-xs leading-snug text-white/35">
                        {p.caption}
                      </p>
                      <ul className="mt-8">
                        {p.items.map((item) => (
                          <li
                            key={item}
                            className="border-t border-white/[0.07] py-4 text-[0.95rem] text-white/65"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
