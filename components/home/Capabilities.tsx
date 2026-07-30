"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";

const CAPABILITIES = [
  {
    name: "Business Consulting",
    body: "We find the bottlenecks across operations, sales, and lead flow, then fix them.",
    href: "/businessconsulting",
  },
  {
    name: "AI Strategy & Implementation",
    body: "We use AI only where it removes real work and speeds up execution.",
    href: "/aistrategy",
  },
  {
    name: "Custom Private AI Systems",
    body: "AI built around your workflows, data, and security—local, private cloud, or managed.",
    href: "/services/customprivateaisystems",
  },
  {
    name: "Web Development & Digital Infrastructure",
    body: "We build the websites, CRMs, booking flows, and dashboards the business runs on.",
    href: "/webdevelopment",
  },
];

export function Capabilities({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id="services" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">What RSG Does</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <Heading className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[3rem]">
              <span className="text-white/40">
                Strategy first. Technology second.
              </span>{" "}
              Execution always.
            </Heading>
          </Reveal>
        </div>

        <div className="mt-10 sm:mt-24 grid border-t border-white/[0.08] sm:grid-cols-2">
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.name} y={12} delay={(i % 2) * 0.08} className="h-full">
              <div
                className={`flex h-full flex-col border-b border-white/[0.08] py-10 sm:py-16 ${
                  i % 2 === 1 ? "sm:border-l sm:border-white/[0.08] sm:pl-14" : "sm:pr-14"
                }`}
              >
                <h3 className="display max-w-sm text-2xl text-white">
                  {c.name}
                </h3>
                <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-white/50">
                  {c.body}
                </p>
                <Link
                  href={c.href}
                  className="link-arrow group mt-6 sm:mt-7"
                >
                  Learn more
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
