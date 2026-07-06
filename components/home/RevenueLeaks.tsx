"use client";

import Link from "next/link";
import { Reveal, RevealGroup, itemVariants } from "../Reveal";
import { motion } from "framer-motion";

const LEAKS = [
  "A lead calls and nobody answers.",
  "A form gets submitted and nobody follows up.",
  "A DM sits unread.",
  "A quote never gets chased.",
  "A past customer never gets reactivated.",
  "A happy customer never gets asked for a review.",
  "A website visitor leaves without taking action.",
  "A staff member forgets the next step.",
];

export function RevenueLeaks() {
  return (
    <section className="border-y border-white/[0.08] bg-base-900">
      <div className="container-px py-24 sm:py-32">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Revenue Leaks</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-9 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
              Revenue leaks usually hide in plain sight.
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-8 max-w-xl text-[1.02rem] leading-relaxed text-white/55">
              Most businesses do not need more noise. They need better systems
              around the opportunities they already have.
            </p>
          </Reveal>
        </div>

        <RevealGroup className="mt-16 grid gap-x-12 sm:grid-cols-2" stagger={0.05}>
          {LEAKS.map((leak, i) => (
            <motion.div
              key={leak}
              variants={itemVariants}
              className="flex items-baseline gap-5 border-t border-white/[0.08] py-5"
            >
              <span className="font-mono text-[0.62rem] text-white/25">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-[1.02rem] leading-snug text-white/75">{leak}</p>
            </motion.div>
          ))}
        </RevealGroup>

        <Reveal y={12} delay={0.1}>
          <div className="mt-14 flex flex-col gap-8 border-t border-white/[0.08] pt-10 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-2xl text-[0.98rem] leading-relaxed text-white/50">
              RSG helps identify these gaps and build practical systems around
              lead capture, follow-up, customer communication, CRM visibility,
              automation, and website conversion.
            </p>
            <Link href="/contact" className="btn-ghost shrink-0">
              Find the Leaks in Your Business
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
