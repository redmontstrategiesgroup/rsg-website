"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Reveal } from "../Reveal";

const INDUSTRIES: { name: string; href?: string }[] = [
  {
    name: "Med spas and aesthetic clinics",
    href: "/med-spa-business-consulting-ai-automation",
  },
  {
    name: "Gyms and fitness studios",
    href: "/gym-fitness-studio-business-systems",
  },
  {
    name: "Dental and wellness offices",
    href: "/dental-wellness-office-ai-strategy",
  },
  {
    name: "Home service companies",
    href: "/home-service-business-consulting-ai-automation",
  },
  { name: "Contractors", href: "/contractor-business-systems" },
  { name: "Local service businesses" },
  { name: "High-ticket service providers" },
];

export function IndustriesList({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id="industries" className="scroll-mt-24 border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Industries</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <Heading className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
              Built for service businesses where speed, trust, and follow-up
              matter.
            </Heading>
          </Reveal>
        </div>

        <Reveal y={12} delay={0.15}>
          <p className="mt-16 max-w-5xl font-display text-xl leading-[1.9] text-white/70 sm:text-2xl sm:leading-[1.9]">
            {INDUSTRIES.map((industry, i) => (
              <Fragment key={industry.name}>
                {industry.href ? (
                  <Link
                    href={industry.href}
                    className="underline decoration-white/15 underline-offset-[6px] transition-colors hover:text-white hover:decoration-white/40"
                  >
                    {industry.name}
                  </Link>
                ) : (
                  <span className="transition-colors hover:text-white">
                    {industry.name}
                  </span>
                )}
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
      </div>
    </section>
  );
}
