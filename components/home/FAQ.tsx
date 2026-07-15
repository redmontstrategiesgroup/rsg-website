"use client";

import { Plus } from "lucide-react";
import { Reveal } from "../Reveal";

const FAQS = [
  {
    q: "Is RSG just an AI automation agency?",
    a: "No. RSG is a business consulting and strategy company. AI, automation, and web systems are tools we use to fix operations, lead flow, and follow-up. They are not the product itself.",
  },
  {
    q: "What does the first step look like?",
    a: "A Business Systems Audit. We review your operations, lead flow, and follow-up, then map where time, leads, and revenue are being lost.",
  },
  {
    q: "Do I need to understand AI?",
    a: "No. You focus on the business. We handle the strategy and implementation, and only use AI where it solves a real problem.",
  },
  {
    q: "Can RSG work with my current website, CRM, or booking tools?",
    a: "In most cases, yes. We improve and connect what you already use where it makes sense, and replace tools only when they are holding the business back.",
  },
  {
    q: "Does this replace employees?",
    a: "No. The goal is to remove repetitive work and give your team better systems, so their time goes where it actually matters.",
  },
  {
    q: "What if my business is already getting leads?",
    a: "Then the opportunity is usually in follow-up, conversion, and visibility. Most businesses lose more revenue to weak systems than to a shortage of leads.",
  },
];

export function FAQ({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id="faq" className="scroll-mt-24 border-y border-white/10 bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-36">
              <Reveal y={12}>
                <p className="label">FAQ</p>
              </Reveal>
              <Reveal y={12} delay={0.08}>
                <Heading className="display mt-6 max-w-md text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                  Straight answers before we talk.
                </Heading>
              </Reveal>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {FAQS.map((item, i) => (
              <Reveal key={item.q} y={12} delay={i * 0.04}>
                <details className="group border-t border-white/[0.08] last:border-b">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 [&::-webkit-details-marker]:hidden">
                    <span className="display text-[1.15rem] leading-snug text-white">
                      {item.q}
                    </span>
                    <Plus
                      size={18}
                      className="mt-1 shrink-0 text-white/40 transition-transform duration-300 group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-xl pb-8 text-[0.98rem] leading-relaxed text-white/55">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
