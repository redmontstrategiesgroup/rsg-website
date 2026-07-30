"use client";

import Link from "next/link";
import { ArrowRight, MousePointerClick, PlayCircle, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { BuildSystemCta } from "@/components/demos/BuildSystemCta";
import { demoBySlug } from "@/components/demos/data";
import { trackEvent } from "@/lib/events";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Entry point to the vertical's own interactive demo — what the simulated
 * system contains, what a visitor can run, and the honesty banner. Links out
 * to the full DemoOS at /demos/[slug]; nothing here touches real data.
 */
export function DemoSection({ vertical }: { vertical: IndustryVertical }) {
  const demoConfig = demoBySlug(vertical.demoSlug);
  const demoHref = `/demos/${vertical.demoSlug}`;

  return (
    <section id="demo" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">Interactive demo</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.4rem]">
                {vertical.demo.title}
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.14}>
              <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">
                {vertical.demo.description}
              </p>
            </Reveal>
            <Reveal y={12} delay={0.2}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href={demoHref}
                  className="btn-primary"
                  onClick={() =>
                    trackEvent("demo_cta_click", {
                      demo: vertical.demoSlug,
                      cta: "vertical_demo_section",
                      source: `vertical_${vertical.slug}`,
                    })
                  }
                >
                  <MousePointerClick size={15} className="mr-2" aria-hidden />
                  Open the working demo
                </Link>
                {demoConfig && (
                  <BuildSystemCta
                    config={demoConfig}
                    source={`vertical_${vertical.slug}_demo_section`}
                    className="btn-ghost"
                    label="Build This System"
                  />
                )}
              </div>
            </Reveal>
            <Reveal y={12} delay={0.26}>
              <p className="mt-8 flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-[0.78rem] leading-relaxed text-white/45">
                <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-white/35" />
                {vertical.demo.disclaimer}
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Reveal y={14} delay={0.12} className="h-full">
                <div className="h-full rounded-xl border border-white/10 bg-base-900/70 p-6">
                  <p className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                    Inside the system
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {vertical.demo.highlights.map((h) => (
                      <li key={h} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                        <span aria-hidden className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-white/30" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal y={14} delay={0.18} className="h-full">
                <div className="h-full rounded-xl border border-crimson/25 bg-crimson/[0.04] p-6">
                  <p className="flex items-center gap-2 font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-crimson-light">
                    <PlayCircle size={13} aria-hidden />
                    Run these yourself
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {vertical.demo.simulations.map((s) => (
                      <li key={s} className="flex gap-2.5 text-sm leading-relaxed text-white/60">
                        <ArrowRight size={13} aria-hidden className="mt-1 shrink-0 text-crimson-light/60" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
