"use client";

import { Reveal } from "../Reveal";
import { ContactForm } from "../ContactForm";

export function FinalCTA() {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="container-px py-32 sm:py-44">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-36">
              <Reveal y={12}>
                <p className="label">Contact</p>
              </Reveal>
              <Reveal y={12} delay={0.08}>
                <h2 className="display mt-9 text-[2.3rem] leading-[1.04] sm:text-[3.2rem]">
                  Build a smarter business
                  <br />
                  <span className="text-white/40">
                    before your competitors do.
                  </span>
                </h2>
              </Reveal>
              <Reveal y={12} delay={0.16}>
                <p className="mt-9 max-w-md text-[1.02rem] leading-relaxed text-white/55">
                  Work with Redmont Strategies Group to modernize your
                  operations, improve lead conversion, and implement AI with a
                  real business purpose.
                </p>
              </Reveal>
              <Reveal y={12} delay={0.22}>
                <p className="mt-10 max-w-md border-t border-white/10 pt-7 text-sm leading-relaxed text-white/45">
                  Every engagement starts with a strategy call. We review the
                  business first, so the conversation is about your operation,
                  not our pitch.
                </p>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal y={12} delay={0.12}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
