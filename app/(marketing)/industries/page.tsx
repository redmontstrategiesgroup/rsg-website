import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { getVerticals } from "@/lib/industries/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Industries: Home Services, Dental & Retail Systems | RSG",
  description:
    "RSG builds technology, automation, and AI systems for three verticals it actually knows: home service & trade businesses, dental & specialty healthcare practices, and retail & multi-location businesses.",
  alternates: { canonical: "/industries" },
  openGraph: {
    title: "Industries: Home Services, Dental & Retail Systems | RSG",
    description:
      "Deep systems for home services, dental & specialty healthcare, and retail — with interactive demos, workflow maps, and industry-specific calculators.",
    url: "/industries",
    images: ["/og.png"],
  },
};

const VERTICAL_BLURBS: Record<string, string> = {
  "home-services":
    "Missed-call recovery, scheduling and dispatch, estimate follow-up, and invoicing that collects itself — for the trades that live on inbound calls.",
  "dental-practices":
    "An AI front desk, no-show reduction, treatment-plan follow-up, and recall reactivation — built around your PMS and HIPAA-aware from the first design call.",
  retail:
    "Inventory visibility, abandoned-cart recovery, loyalty, and one report across every location — for retailers selling in-store and online.",
};

/**
 * Industries hub: three deeply-specialized verticals presented as the main
 * event, with everything else honestly routed through the additional-
 * industries page. No industry gets listed here unless its page carries
 * real workflows, demos, and calculators.
 */
export default async function IndustriesPage() {
  const verticals = (await getVerticals()).filter((v) => v.status === "published");

  return (
    <PageShell>
      <section className="container-px pb-4 pt-12 sm:pt-14">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Industries</p>
          </Reveal>
          <Reveal y={14} delay={0.08}>
            <h1 className="display mt-6 text-[2.2rem] leading-[1.08] sm:text-[3rem]">
              Three industries. Known deeply — not twenty known thinly.
            </h1>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-7 text-[1rem] leading-relaxed text-white/55">
              RSG is a specialized technology, automation, and AI partner for home service
              businesses, dental and specialty healthcare practices, and retail operations. Each
              vertical below carries its own workflows, working demo, calculators, and compliance
              practices — because a dispatch board and an operatory schedule are not the same
              problem with different logos.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-px py-14 sm:py-16">
        <div className="space-y-6">
          {verticals.map((v, i) => (
            <Reveal key={v.slug} y={16} delay={i * 0.06}>
              <article className="group grid gap-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/25 sm:p-10 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <div className="flex flex-wrap gap-2">
                    {v.audience.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.65rem] text-white/50"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <h2 className="display mt-6 text-[1.7rem] leading-[1.1] text-white sm:text-[2.1rem]">
                    <Link
                      href={`/industries/${v.slug}`}
                      className="transition-colors group-hover:text-white"
                    >
                      {v.name}
                    </Link>
                  </h2>
                  <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-white/55">
                    {VERTICAL_BLURBS[v.slug] ?? v.hero.subheadline}
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-3 lg:col-span-4 lg:border-l lg:border-white/[0.08] lg:pl-8">
                  <Link
                    href={`/industries/${v.slug}`}
                    className="group/link inline-flex items-center gap-2.5 text-sm font-medium text-white transition-colors hover:text-crimson-light"
                  >
                    Explore the {v.shortName.toLowerCase()} systems
                    <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-1" aria-hidden />
                  </Link>
                  <Link
                    href={`/demos/${v.demoSlug}`}
                    className="inline-flex items-center gap-2.5 text-sm text-white/55 transition-colors hover:text-white"
                  >
                    <MousePointerClick size={14} aria-hidden />
                    Open the interactive demo
                  </Link>
                  <Link
                    href={`/industries/${v.slug}#assessment`}
                    className="inline-flex items-center gap-2.5 text-sm text-white/55 transition-colors hover:text-white"
                  >
                    Take the {v.shortName.toLowerCase()} assessment
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal y={12} delay={0.1}>
          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-dashed border-white/15 bg-transparent px-8 py-7">
            <div>
              <h2 className="font-display text-lg text-white">Not in one of these industries?</h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/50">
                We take a limited number of projects outside our primary verticals — only when the
                problem matches a system we&apos;ve already built.
              </p>
            </div>
            <Link href="/industries/additional" className="btn-ghost shrink-0">
              Additional industries
              <ArrowRight size={14} className="ml-2" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
