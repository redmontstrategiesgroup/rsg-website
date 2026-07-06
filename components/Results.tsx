"use client";

import { motion } from "framer-motion";
import {
  Clock,
  CalendarCheck,
  RefreshCw,
  Coins,
  Timer,
  LineChart,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

/**
 * Honest, capability-based outcomes — the metrics we design systems to move.
 * No fabricated client figures or testimonials.
 */
const OUTCOMES = [
  {
    icon: Clock,
    metric: "Response time",
    goal: "Seconds, not hours",
    body: "Every inbound call, form, and DM gets an instant, on-brand reply — the single biggest lever on conversion.",
  },
  {
    icon: CalendarCheck,
    metric: "Booked appointments",
    goal: "More, with less effort",
    body: "Qualified leads are guided to book themselves, or routed to your team with full context attached.",
  },
  {
    icon: RefreshCw,
    metric: "Lead reactivation",
    goal: "Revenue from your existing list",
    body: "Dormant contacts are re-engaged with personalized sequences — often the fastest ROI in the engagement.",
  },
  {
    icon: Timer,
    metric: "Hours reclaimed",
    goal: "Off your team's plate",
    body: "Repetitive follow-up, data entry, and routing run automatically so staff focus on high-value work.",
  },
  {
    icon: Coins,
    metric: "Cost per acquisition",
    goal: "Lower, over time",
    body: "AI-assisted targeting and always-on optimization reduce waste across paid and organic channels.",
  },
  {
    icon: LineChart,
    metric: "Attribution clarity",
    goal: "Know what's working",
    body: "Every automation is instrumented and tied to pipeline, so decisions are made on data, not guesses.",
  },
];

export function Results() {
  return (
    <section
      id="results"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/3 h-[360px] w-[560px] rounded-full bg-crimson/[0.06] blur-[120px]" />
      </div>

      <div className="container-px">
        <SectionHeading
          eyebrow="Outcomes"
          title="How we measure success"
          description="Every system we build is tied to a number you actually care about, and instrumented so you can watch it move inside your client portal."
          split
        />

        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {OUTCOMES.map((o, i) => (
            <motion.div
              key={o.metric}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (i % 2) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                <o.icon size={18} />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  {o.metric}
                </h3>
                <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
                  {o.goal}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{o.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-white/45">
          We don&rsquo;t publish inflated case-study numbers. What we commit to is
          a clear baseline, a target, and a dashboard that shows the real
          movement — reviewed with you every month.
        </p>
      </div>
    </section>
  );
}
