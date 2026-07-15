"use client";

import { Reveal } from "../Reveal";

export function Manifesto() {
  return (
    <section className="bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-7">
            <Reveal y={12}>
              <h2 className="display text-[1.85rem] leading-[1.08] sm:text-[3.4rem] sm:leading-[1.06]">
                Most businesses are not broken.
                <br />
                <span className="text-white/40">Their systems are.</span>
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-12">
            <Reveal y={12} delay={0.1}>
              <div className="space-y-6 border-t border-white/15 pt-6 text-[1.02rem] leading-relaxed text-white/55">
                <p>
                  Businesses lose time, leads, and revenue when their website,
                  follow-up, CRM, and operations work in isolation.
                </p>
                <p>
                  RSG finds the gaps and builds practical systems to close them.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
