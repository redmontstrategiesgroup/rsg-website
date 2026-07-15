"use client";

import { Reveal } from "../Reveal";

const PRINCIPLES = [
  "Business problems before software",
  "Strategy before implementation",
  "Systems built around real workflows",
  "AI used with a clear purpose",
  "Better follow-up, visibility, and execution",
  "Built for owners who want sharper operations",
];

export function WhyRSGSection() {
  return (
    <section id="why" className="scroll-mt-24 border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-6">
            <Reveal y={12}>
              <p className="label">Why RSG</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                Not another AI agency.
                <br />
                <span className="text-white/40">
                  A business systems partner.
                </span>
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <div className="mt-8 max-w-lg space-y-5 text-[1.02rem] leading-relaxed text-white/55">
                <p>
                  RSG does not push random AI tools or generic automation
                  packages. We diagnose the business first, identify the weak
                  points, create the plan, and build systems around the way the
                  business actually operates.
                </p>
                <p className="text-white/75">
                  AI is only useful when it solves a real business problem.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-4 lg:col-start-9 lg:pt-12">
            <Reveal y={12} delay={0.12}>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
                Principles
              </p>
              <ul className="mt-7">
                {PRINCIPLES.map((p) => (
                  <li
                    key={p}
                    className="border-t border-white/[0.08] py-[1.1rem] text-[0.95rem] text-white/70 last:border-b"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
