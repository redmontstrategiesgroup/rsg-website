"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const PRINCIPLES = [
  "Strategy first — we build the system your business actually needs, not a demo.",
  "Outcomes over output — every automation ties to a metric you care about.",
  "You own everything — accounts, data, and workflows stay yours.",
  "Human-in-the-loop — AI handles volume; your team keeps the judgment calls.",
];

const STACK = [
  { k: "AI / ML", v: "Agents, RAG, fine-tuning, evals" },
  { k: "Automation", v: "Orchestration, integrations, APIs" },
  { k: "Marketing", v: "Paid, SEO, lifecycle, CRO" },
  { k: "Web / Data", v: "Full-stack apps, dashboards, pipelines" },
];

export function About() {
  return (
    <section
      id="about"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-fade-b" />
      </div>

      <div className="container-px grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="Your AI consultant"
            title="A partner who ships, not just advises"
          />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl leading-relaxed text-white/55">
              Most agencies hand you a slide deck. Redmont Strategies Group hands
              you working systems. I combine hands-on AI engineering with growth
              marketing, so the strategy and the build come from the same place —
              and actually connect.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 max-w-xl leading-relaxed text-white/55">
              From your first automation to a fully instrumented growth engine,
              you get a single accountable partner who measures success the way
              you do: booked revenue and hours reclaimed.
            </p>
          </Reveal>

          <ul className="mt-8 space-y-4">
            {PRINCIPLES.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-crimson/15 text-crimson-light">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-white/70">{p}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Capability card */}
        <Reveal delay={0.1}>
          <div className="gradient-border relative overflow-hidden rounded-3xl p-8 shadow-card">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-crimson/15 blur-3xl" />
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-crimson-light">
              // Where I go deep
            </p>
            <div className="mt-6 space-y-4">
              {STACK.map((s) => (
                <div
                  key={s.k}
                  className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4 last:border-0 last:pb-0"
                >
                  <span className="font-display text-base font-semibold text-white">
                    {s.k}
                  </span>
                  <span className="text-right text-sm text-white/50">{s.v}</span>
                </div>
              ))}
            </div>

            <p className="mt-8 rounded-xl border border-white/10 bg-base-900/60 p-4 text-sm leading-relaxed text-white/55">
              One accountable partner across strategy, engineering, and
              marketing — so nothing falls between vendors, and you always know
              who owns the outcome.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
