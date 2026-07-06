"use client";

import { motion } from "framer-motion";
import {
  Check,
  ArrowUpRight,
  Clock,
  Tag,
  FileText,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

const INCLUDED = [
  "Full funnel & tooling audit — calls, DMs, forms, CRM, ads",
  "Opportunities scored across automation, marketing & build",
  "ROI and effort estimate for every opportunity",
  "A prioritized 90-day roadmap that you own",
  "60-minute walkthrough call with your strategist",
];

type Priority = "Now" | "Next" | "Later";

const OPPORTUNITIES: {
  name: string;
  priority: Priority;
  score: number;
  roi: string;
  effort: string;
}[] = [
  { name: "Missed-call text-back", priority: "Now", score: 9.4, roi: "+$6–9k/mo", effort: "Low" },
  { name: "Dormant lead reactivation", priority: "Now", score: 8.9, roi: "+$10–15k/mo", effort: "Low" },
  { name: "AI intake & booking agent", priority: "Next", score: 8.2, roi: "+$5–8k/mo", effort: "Med" },
  { name: "Paid social optimization", priority: "Next", score: 7.6, roi: "−15–25% CPA", effort: "Med" },
  { name: "Review & referral loop", priority: "Later", score: 7.1, roi: "+$2–4k/mo", effort: "Low" },
];

const PRIORITY_STYLE: Record<Priority, string> = {
  Now: "bg-crimson/15 text-crimson-light",
  Next: "bg-amber-400/10 text-amber-300",
  Later: "bg-white/[0.06] text-white/50",
};

export function ProductizedOffer() {
  return (
    <section
      id="offer"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-fade-b" />
        <div className="absolute left-1/2 top-0 h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-crimson/[0.08] blur-[130px]" />
      </div>

      <div className="container-px">
        <SectionHeading
          eyebrow="Start here"
          title={
            <>
              Don&rsquo;t buy hours. Buy a{" "}
              <span className="text-crimson">defined outcome.</span>
            </>
          }
          description="Every engagement starts with one fixed-scope offer — a two-week AI Opportunity Audit. You walk away with a scored, ROI-estimated roadmap you own, whether or not we build it together."
          split
        />

        {/* Productized badges */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          {[
            { icon: Tag, label: "Fixed scope" },
            { icon: Clock, label: "Two weeks" },
            { icon: FileText, label: "Concrete deliverable" },
          ].map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-label text-white/60 backdrop-blur"
            >
              <b.icon size={13} className="text-crimson-light" />
              {b.label}
            </span>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-stretch">
          {/* Offer card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="gradient-border relative flex flex-col overflow-hidden rounded-3xl p-8 shadow-glow"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-crimson/15 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <span className="font-mono text-[0.6rem] uppercase tracking-label text-crimson-light">
                Productized offer
              </span>
              <span className="rounded-full bg-crimson px-3 py-1 font-mono text-[0.52rem] uppercase tracking-label text-white shadow-glow-sm">
                Best first step
              </span>
            </div>

            <h3 className="display mt-5 text-[1.9rem] font-semibold text-white sm:text-[2.1rem]">
              AI Opportunity Audit
            </h3>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-4xl font-semibold text-white">
                Two weeks
              </span>
              <span className="text-sm text-white/45">fixed scope</span>
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-label text-emerald-300">
              <ShieldCheck size={13} />
              Scoped &amp; quoted to your business
            </p>

            <p className="mt-5 text-sm leading-relaxed text-white/55">
              A two-week deep dive into where AI moves the needle fastest in your
              business — scored, quantified, and prioritized.
            </p>

            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-crimson/15 text-crimson-light">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-white/70">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/contact" className="btn-primary group px-7 py-3.5">
                Book the Audit
                <ArrowUpRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
              <span className="text-xs text-white/40">
                No open-ended retainers. Cancel anytime after.
              </span>
            </div>
          </motion.div>

          {/* Deliverable preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col rounded-3xl border border-white/10 bg-base-900/70 p-6 backdrop-blur-sm sm:p-7"
          >
            {/* Deliverable header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-crimson-light">
                  <Gauge size={17} />
                </span>
                <div className="leading-tight">
                  <p className="font-display text-sm font-semibold text-white">
                    AI Opportunity Roadmap
                  </p>
                  <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                    The deliverable · scored & ranked
                  </p>
                </div>
              </div>
              <span className="hidden rounded-full border border-white/10 px-2.5 py-1 font-mono text-[0.5rem] uppercase tracking-label text-white/40 sm:inline">
                PDF + call
              </span>
            </div>

            {/* Column labels */}
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 px-1 font-mono text-[0.5rem] uppercase tracking-label text-white/30">
              <span>Opportunity</span>
              <span>Impact score</span>
            </div>

            {/* Scored rows */}
            <div className="mt-2 space-y-2.5">
              {OPPORTUNITIES.map((o, i) => (
                <motion.div
                  key={o.name}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.09 }}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-label ${PRIORITY_STYLE[o.priority]}`}
                      >
                        {o.priority}
                      </span>
                      <span className="truncate text-sm font-medium text-white">
                        {o.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-display text-sm font-semibold text-crimson-light">
                      {o.score.toFixed(1)}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${o.score * 10}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.25 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-crimson-dark to-crimson-light"
                    />
                  </div>

                  <div className="mt-2.5 flex items-center gap-4 font-mono text-[0.56rem] uppercase tracking-label text-white/45">
                    <span className="text-emerald-300/80">{o.roi}</span>
                    <span>Effort · {o.effort}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-crimson/25 bg-crimson-soft px-4 py-3">
              <span className="font-mono text-[0.56rem] uppercase tracking-label text-white/60">
                Est. combined impact
              </span>
              <span className="font-display text-base font-semibold text-white">
                $23–41k <span className="text-sm font-normal text-white/50">/ mo</span>
              </span>
            </div>
            <p className="mt-3 font-mono text-[0.52rem] uppercase tracking-label text-white/30">
              Illustrative — your roadmap is built from your real numbers
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
