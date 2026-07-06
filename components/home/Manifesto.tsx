"use client";

import { Reveal } from "../Reveal";

export function Manifesto() {
  return (
    <section className="bg-base-900">
      <div className="container-px py-32 sm:py-44">
        <div className="section-grid">
          <div className="lg:col-span-7">
            <Reveal y={12}>
              <h2 className="display text-[2.3rem] leading-[1.06] sm:text-[3.4rem]">
                Most businesses are not broken.
                <br />
                <span className="text-white/40">Their systems are.</span>
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pt-24">
            <Reveal y={12} delay={0.1}>
              <div className="space-y-6 border-t border-white/15 pt-9 text-[1.02rem] leading-relaxed text-white/55">
                <p>
                  Businesses rarely lose because of one single problem. They
                  lose because their lead flow, follow-up, website, sales
                  process, operations, and internal tools are disconnected.
                </p>
                <p>
                  RSG works with business owners to identify where time, money,
                  and opportunities are being lost, then builds the strategy
                  and systems needed to close the gaps.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
