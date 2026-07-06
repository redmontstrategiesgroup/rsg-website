"use client";

import { Fragment } from "react";
import { Reveal } from "../Reveal";

const INDUSTRIES = [
  "Med spas",
  "Aesthetic clinics",
  "Gyms",
  "Fitness studios",
  "Boxing gyms",
  "Dental offices",
  "Wellness clinics",
  "Home service companies",
  "Contractors",
  "Cleaning companies",
  "Local service businesses",
  "High-ticket service providers",
];

export function IndustriesList() {
  return (
    <section id="industries" className="scroll-mt-24 border-y border-white/10 bg-base-900">
      <div className="container-px py-32 sm:py-44">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Industries</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-9 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
              Built for service businesses where speed, trust, and follow-up
              matter.
            </h2>
          </Reveal>
        </div>

        <Reveal y={12} delay={0.15}>
          <p className="mt-16 max-w-5xl font-display text-xl leading-[1.9] text-white/70 sm:text-2xl sm:leading-[1.9]">
            {INDUSTRIES.map((name, i) => (
              <Fragment key={name}>
                <span className="whitespace-nowrap transition-colors hover:text-white">
                  {name}
                </span>
                {i < INDUSTRIES.length - 1 && (
                  <>
                    {" "}
                    <span
                      aria-hidden="true"
                      className="mx-2 text-white/20 sm:mx-3"
                    >
                      /
                    </span>{" "}
                  </>
                )}
              </Fragment>
            ))}
          </p>
        </Reveal>

        <Reveal y={12} delay={0.2}>
          <p className="mt-16 max-w-md border-t border-white/10 pt-8 text-[0.95rem] leading-relaxed text-white/45">
            Businesses that live on appointments, jobs, and response time.
            That is where sharper systems pay for themselves.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
