"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";

/**
 * Homepage industries section. RSG specializes in three verticals — each
 * with its own deep page, demo, and calculators — and says so plainly
 * instead of listing twenty industries it knows thinly.
 */
const VERTICALS = [
  {
    name: "Home service & trade businesses",
    detail: "HVAC, plumbing, electrical, roofing, landscaping, contracting",
    outcome: "Turn more service calls into scheduled, completed, collected jobs.",
    href: "/industries/homeservices",
  },
  {
    name: "Dental & specialty healthcare practices",
    detail: "General & cosmetic dentistry, orthodontics, oral surgery, med spas",
    outcome: "Reduce front-desk work while increasing patient bookings.",
    href: "/industries/dentalpractices",
  },
  {
    name: "Retail & multi-location businesses",
    detail: "Specialty retail, local chains, franchises, showrooms, hybrid in-store + online",
    outcome: "Connect your stores, inventory, customers, and marketing.",
    href: "/industries/retail",
  },
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
              Specialized in three industries — with the workflows, demos, and
              systems to prove it.
            </Heading>
          </Reveal>
        </div>

        <div className="mt-16 grid border-t border-white/[0.08] lg:grid-cols-3">
          {VERTICALS.map((v, i) => (
            <Reveal key={v.name} y={12} delay={i * 0.08} className="h-full">
              <Link
                href={v.href}
                className={`group flex h-full flex-col border-b border-white/[0.08] py-12 pr-8 transition-colors lg:border-b-0 ${
                  i > 0 ? "lg:border-l lg:border-white/[0.08] lg:pl-10" : ""
                }`}
              >
                <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/35">
                  {v.detail}
                </p>
                <h3 className="display mt-5 text-[1.35rem] leading-snug text-white transition-colors group-hover:text-crimson-light">
                  {v.name}
                </h3>
                <p className="mt-4 flex-1 text-[0.92rem] leading-relaxed text-white/50">
                  {v.outcome}
                </p>
                <span className="mt-7 inline-flex items-center gap-2.5 text-sm font-medium text-white/70 transition-colors group-hover:text-crimson-light">
                  Explore the systems
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal y={10} delay={0.12}>
          <p className="mt-12 text-sm leading-relaxed text-white/45">
            Outside these verticals, RSG accepts a limited number of projects when the problem
            matches a system we&apos;ve already built.{" "}
            <Link
              href="/industries/additional"
              className="link-underline text-white/70 transition-colors hover:text-white"
            >
              See additional industries
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
