"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Workflow,
  PhoneCall,
  Database,
  Megaphone,
  Target,
  PenTool,
  LineChart,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { RevealGroup, itemVariants } from "./Reveal";

const PILLARS = [
  {
    tag: "01 · Build",
    title: "AI Automation",
    blurb:
      "AI systems that handle the repetitive work your team shouldn't: answering, qualifying, routing, and booking, day and night.",
    accent: "from-crimson-dark/30",
    services: [
      {
        icon: Bot,
        name: "AI agents & assistants",
        desc: "Custom chat, SMS & voice agents trained on your business.",
      },
      {
        icon: Workflow,
        name: "Workflow automation",
        desc: "Multi-step pipelines across your CRM, calendar, and tools.",
      },
      {
        icon: PhoneCall,
        name: "AI front desk",
        desc: "Missed-call text-back, intake, and 24/7 booking.",
      },
      {
        icon: Database,
        name: "RAG & knowledge systems",
        desc: "Agents that answer from your docs, policies, and data.",
      },
    ],
  },
  {
    tag: "02 · Grow",
    title: "AI Marketing",
    blurb:
      "We turn attention into booked appointments with campaigns, lead reactivation, and content that keep your pipeline full.",
    accent: "from-crimson/30",
    services: [
      {
        icon: Target,
        name: "Lead generation & reactivation",
        desc: "Reawaken cold lists and capture new demand on autopilot.",
      },
      {
        icon: Megaphone,
        name: "Paid & social campaigns",
        desc: "AI-assisted creative, targeting, and always-on optimization.",
      },
      {
        icon: PenTool,
        name: "Content engines",
        desc: "SEO, email, and social content produced at scale, on-brand.",
      },
      {
        icon: LineChart,
        name: "Attribution & analytics",
        desc: "Dashboards that tie every automation to revenue.",
      },
    ],
  },
];

export function Services() {
  return (
    <section
      id="services"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-1/4 top-0 h-[380px] w-[620px] rounded-full bg-crimson/[0.06] blur-[120px]" />
      </div>

      <div className="container-px">
        <SectionHeading
          eyebrow="What we do"
          title={
            <>
              Automation and marketing, built to{" "}
              <span className="text-crimson">work together</span>
            </>
          }
          description="We build the automation that runs your day-to-day and the marketing that keeps new business coming in, then connect the two so leads don't slip through the cracks."
          split
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {PILLARS.map((pillar) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/20"
            >
              <div
                className={`pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-gradient-to-b ${pillar.accent} to-transparent opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70`}
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.6rem] uppercase tracking-label text-crimson-light">
                    {pillar.tag}
                  </span>
                </div>
                <h3 className="display mt-4 text-2xl font-semibold text-white sm:text-[1.7rem]">
                  {pillar.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                  {pillar.blurb}
                </p>

                <RevealGroup className="mt-8 space-y-5">
                  {pillar.services.map((s) => (
                    <motion.div
                      key={s.name}
                      variants={itemVariants}
                      className="flex gap-3.5"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                        <s.icon size={16} />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-white">{s.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/45">
                          {s.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </RevealGroup>

                <Link
                  href="/contact"
                  className="group/btn mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
                >
                  Scope an {pillar.title} project
                  <ArrowUpRight
                    size={15}
                    className="text-crimson-light transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
                  />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
