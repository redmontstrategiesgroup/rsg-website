"use client";

import { motion } from "framer-motion";
import {
  MessageSquareText,
  Phone,
  BrainCircuit,
  GitBranch,
  Megaphone,
  BarChart4,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const CAPS = [
  {
    icon: MessageSquareText,
    title: "Conversational AI",
    desc: "Chat, SMS, and DM agents that answer, qualify, and book — trained on your business.",
  },
  {
    icon: Phone,
    title: "Voice AI",
    desc: "AI that answers calls, handles common questions, and schedules in real time.",
  },
  {
    icon: BrainCircuit,
    title: "Custom AI & RAG",
    desc: "Agents grounded in your own documents, policies, and product data.",
  },
  {
    icon: GitBranch,
    title: "Workflow automation",
    desc: "Pipelines that move data between your CRM, calendar, and the tools you already use.",
  },
  {
    icon: Megaphone,
    title: "Growth marketing",
    desc: "Lead generation, reactivation, and lifecycle campaigns that keep your pipeline full.",
  },
  {
    icon: BarChart4,
    title: "Analytics",
    desc: "Dashboards that connect each automation to pipeline and revenue.",
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-28"
    >
      <div className="container-px">
        <SectionHeading
          eyebrow="Capabilities"
          title="What we build"
          description="Strategy and engineering from one partner — so you get a system that runs your growth, not a stack of disconnected tools."
          split
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {CAPS.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (i % 2) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                <cap.icon size={18} />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  {cap.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                  {cap.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
