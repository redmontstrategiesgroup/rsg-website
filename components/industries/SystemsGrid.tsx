"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { MobileReveal } from "@/components/MobileReveal";
import { BuildSystemCta } from "@/components/demos/BuildSystemCta";
import { demoBySlug } from "@/components/demos/data";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Named RSG systems for one vertical. Every card carries the outcome,
 * capabilities, timeline, pricing basis, compatible integrations, a link to
 * the vertical's demo, and the Build-This-System dialog (which submits with
 * full demo context).
 */
export function SystemsGrid({ vertical }: { vertical: IndustryVertical }) {
  const demoConfig = demoBySlug(vertical.demoSlug);
  const flagship = vertical.systems.find((s) => s.flagship);
  const rest = vertical.systems.filter((s) => !s.flagship);

  return (
    <section id="systems" className="scroll-mt-24 border-y border-white/[0.08] bg-base-900">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Recommended systems</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">
              Built for {vertical.shortName.toLowerCase()} — not adapted to it.
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">{vertical.systemsIntro}</p>
          </Reveal>
        </div>

        {flagship && (
          <Reveal y={14} delay={0.1}>
            <article className="mt-10 sm:mt-16 overflow-hidden rounded-xl border border-crimson/30 bg-crimson/[0.04]">
              <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <p className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-crimson-light">
                    Flagship system
                  </p>
                  <h3 className="display mt-4 text-2xl text-white sm:text-[1.7rem]">{flagship.name}</h3>
                  <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-white/60">
                    {flagship.outcome}
                  </p>
                  <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
                    {flagship.capabilities.map((c) => (
                      <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                        <Check size={14} aria-hidden className="mt-1 shrink-0 text-crimson-light/70" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-between gap-8 lg:col-span-5 lg:border-l lg:border-white/[0.08] lg:pl-8">
                  <dl className="grid grid-cols-2 gap-5">
                    <div>
                      <dt className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                        Typical timeline
                      </dt>
                      <dd className="mt-1.5 font-display text-lg text-white/85">{flagship.timeline}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                        Pricing
                      </dt>
                      <dd className="mt-1.5 font-display text-lg text-white/85">{flagship.pricing}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-mono text-[0.7rem] sm:text-[0.55rem] uppercase tracking-label text-white/35">
                        Works with
                      </dt>
                      <dd className="mt-2 flex flex-wrap gap-1.5">
                        {flagship.integrations.map((n) => (
                          <span
                            key={n}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[0.75rem] sm:text-[0.68rem] text-white/55"
                          >
                            {n}
                          </span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-3">
                    {demoConfig && (
                      <BuildSystemCta
                        config={demoConfig}
                        source={`vertical_${vertical.slug}_flagship`}
                        label="Build This System"
                      />
                    )}
                    <Link
                      href={`/demos/${vertical.demoSlug}`}
                      className="link-arrow group"
                    >
                      See it in the demo
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        )}

        <MobileReveal
          className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          previewCount={3}
          label={`Show all ${rest.length} systems`}
        >
          {rest.map((s, i) => (
            <Reveal key={s.id} y={14} delay={(i % 3) * 0.06} className="h-full">
              <article className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-colors hover:border-white/20">
                <h3 className="font-display text-[1.12rem] leading-snug text-white">{s.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{s.outcome}</p>
                <ul className="mt-5 space-y-2">
                  {s.capabilities.slice(0, 4).map((c) => (
                    <li key={c} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-white/50">
                      <Check size={13} aria-hidden className="mt-[3px] shrink-0 text-crimson-light/60" />
                      {c}
                    </li>
                  ))}
                </ul>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.08] pt-5">
                  <div>
                    <dt className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
                      Timeline
                    </dt>
                    <dd className="mt-1 text-sm text-white/75">{s.timeline}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
                      Pricing
                    </dt>
                    <dd className="mt-1 text-sm text-white/75">{s.pricing}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.integrations.slice(0, 4).map((n) => (
                    <span
                      key={n}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[0.74rem] sm:text-[0.65rem] text-white/50"
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex flex-1 flex-wrap items-end gap-x-5 gap-y-3">
                  {demoConfig && (
                    <BuildSystemCta
                      config={demoConfig}
                      source={`vertical_${vertical.slug}_${s.id}`}
                      className="link-arrow group text-crimson-light hover:text-white"
                    >
                      Build This System
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden />
                    </BuildSystemCta>
                  )}
                  <Link
                    href={`/demos/${vertical.demoSlug}`}
                    className="inline-flex min-h-11 items-center text-sm text-white/45 transition-colors hover:text-white lg:min-h-0"
                  >
                    View demo
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </MobileReveal>
      </div>
    </section>
  );
}
