import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { getVerticals } from "@/lib/industries/store";
import { VERTICAL_ROUTES } from "@/lib/industries/types";

export const revalidate = 300;

const TITLE = "Industries: Home Services, Health & Wellness, Real Estate | RSG";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "RSG builds automation and AI systems for three verticals it knows deeply: home service and trade businesses, health and wellness practices, and residential real estate.",
  alternates: { canonical: "/industries" },
  openGraph: {
    title: TITLE,
    description:
      "Deep systems for home services, health and wellness, and residential real estate; with interactive demos, workflow maps, and industry-specific assessments.",
    url: "/industries",
    images: ["/og.png"],
  },
};

const VERTICAL_BLURBS: Record<string, string> = {
  "home-services":
    "Missed-call recovery, scheduling and dispatch, estimate follow-up, and invoicing that collects itself; for the trades that live on inbound calls.",
  "health-wellness":
    "An AI front desk, no-show reduction, treatment-plan follow-up, and lapsed-client reactivation, built around your booking platform and privacy-aware from the first design call.",
  "real-estate":
    "Speed-to-lead response, showing coordination, contingency deadline tracking, and past-client referral nurture; for residential brokerages and agent teams.",
};

/**
 * Industries hub: three deeply-specialized verticals, and nothing else. No
 * industry gets listed here unless its page carries real workflows, a
 * working demo, and an assessment.
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
              Three industries. Known deeply, not twenty known thinly.
            </h1>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-7 text-[1rem] leading-relaxed text-white/55">
              RSG is a specialized technology, automation, and AI partner for home service
              businesses, health and wellness practices, and residential brokerages. Each
              vertical below carries its own workflows, working demo, assessment, and compliance
              practices, because a dispatch board, a treatment-room schedule, and a closing-deadline
              calendar are not the same problem with different logos.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-px py-10 sm:py-16">
        <div className="space-y-6">
          {verticals.map((v, i) => (
            <Reveal key={v.slug} y={16} delay={i * 0.06}>
              <article className="group grid gap-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/25 sm:p-10 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <h2 className="display text-[1.7rem] leading-[1.1] text-white sm:text-[2.1rem]">
                    <Link
                      href={VERTICAL_ROUTES[v.slug]}
                      className="inline-block min-h-11 transition-colors group-hover:text-white"
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
                    href={VERTICAL_ROUTES[v.slug]}
                    className="link-arrow group/link text-white"
                  >
                    Explore the {v.shortName.toLowerCase()} systems
                    <ArrowRight size={14} className="transition-transform group-hover/link:translate-x-1" aria-hidden />
                  </Link>
                  <Link
                    href={`/demos/${v.demoSlug}`}
                    className="inline-flex min-h-11 items-center gap-2.5 text-sm text-white/55 transition-colors hover:text-white lg:min-h-0"
                  >
                    <MousePointerClick size={14} aria-hidden />
                    Open the interactive demo
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal y={12} delay={0.1}>
          <div className="mt-9 sm:mt-14 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-dashed border-white/15 bg-transparent px-8 py-7">
            <div>
              <h2 className="font-display text-lg text-white">Not in one of these industries?</h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/50">
                We take a limited number of projects outside our primary verticals, only when the
                problem matches a system we&apos;ve already built. An assessment tells both of us
                quickly whether the overlap is real.
              </p>
            </div>
            <Link href="/book" className="btn-ghost shrink-0">
              Request an evaluation
              <ArrowRight size={14} className="ml-2" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
