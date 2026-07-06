"use client";

import { Reveal } from "../Reveal";

const CAPABILITIES = [
  {
    index: "01",
    name: "Business Consulting",
    body: "We identify bottlenecks in operations, sales, lead flow, offers, customer communication, and internal processes.",
  },
  {
    index: "02",
    name: "AI Strategy & Implementation",
    body: "We find where AI actually makes sense, then implement it to support staff, reduce repetitive work, and improve execution.",
  },
  {
    index: "03",
    name: "Marketing & Lead Conversion",
    body: "We improve how businesses capture, follow up with, and convert opportunities across websites, calls, forms, messages, and campaigns.",
  },
  {
    index: "04",
    name: "Web Development & Digital Infrastructure",
    body: "We build the websites, landing pages, CRM systems, booking flows, dashboards, and automations that support a sharper business.",
  },
];

export function Capabilities() {
  return (
    <section id="services" className="scroll-mt-24">
      <div className="container-px py-32 sm:py-44">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">What RSG Does</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-9 text-[2.1rem] leading-[1.08] sm:text-[3rem]">
              <span className="text-white/40">
                Strategy first. Technology second.
              </span>{" "}
              Execution always.
            </h2>
          </Reveal>
        </div>

        <div className="mt-24 grid border-t border-white/[0.08] sm:grid-cols-2">
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.index} y={12} delay={(i % 2) * 0.08} className="h-full">
              <div
                className={`flex h-full flex-col border-b border-white/[0.08] py-14 sm:py-16 ${
                  i % 2 === 1 ? "sm:border-l sm:border-white/[0.08] sm:pl-14" : "sm:pr-14"
                }`}
              >
                <span className="font-display text-6xl font-medium text-white/[0.11]">
                  {c.index}
                </span>
                <h3 className="display mt-10 max-w-sm text-2xl text-white">
                  {c.name}
                </h3>
                <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-white/50">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
