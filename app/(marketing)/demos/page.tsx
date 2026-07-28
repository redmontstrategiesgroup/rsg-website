import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import { DEMO_CONFIGS } from "@/components/demos/data";
import { DirectoryCard } from "@/components/demos/DirectoryCard";
import { BuilderShowcase } from "@/components/demos/BuilderShowcase";

const TITLE = "Industry Operating System Demos | Redmont Strategies Group";
const DESCRIPTION =
  "Explore interactive operating system demos built for retail stores, med spas, contractors, gyms, and dental offices — real workflows, pipelines, follow-up sequences, and dashboards.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/demos" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/demos",
    images: ["/og.png"],
  },
};

export default function DemosPage() {
  return (
    <PageShell>
      <section>
        <div className="container-px pb-16 pt-14 sm:pt-20">
          <Reveal>
            <span className="label">Industry demos</span>
            <h1 className="display mt-5 max-w-3xl text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              See how your business could run
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60">
              Interactive demos built around real workflows, bottlenecks, and
              follow-up sequences inside service businesses.
            </p>
            <div className="mt-9">
              <a href="#systems" className="btn-primary">
                Explore the demos
                <ArrowRight size={15} className="ml-2" aria-hidden />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-base-900/40">
        <div className="container-px py-14 sm:py-16">
          <div className="section-grid items-start">
            <Reveal className="lg:col-span-5">
              <h2 className="display text-2xl leading-tight sm:text-3xl">
                Built around how your industry actually works
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7">
              <p className="text-sm leading-relaxed text-white/55 sm:text-base">
                These demos map customer journeys, lead stages, follow-up
                sequences, and admin workflows for each industry — not generic
                automation screenshots.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="systems" className="container-px scroll-mt-24 py-14 sm:py-20">
        <Reveal>
          <span className="label">The demo systems</span>
          <h2 className="display mt-4 text-2xl sm:text-3xl">
            Five industries. Five operating systems.
          </h2>
        </Reveal>
        <div className="mt-10">
          {DEMO_CONFIGS.map((config, i) => (
            <Reveal key={config.slug} delay={0.05}>
              <DirectoryCard config={config} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.07] bg-base-900/40">
        <div className="container-px py-14 sm:py-20">
          <Reveal>
            <span className="label">Automation builder</span>
            <h2 className="display mt-4 max-w-2xl text-2xl sm:text-3xl">
              One engine, configured per industry
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
              Every workflow is a visible sequence of steps your team can
              inspect, edit, and approve. Switch industries to see the same
              builder adapt.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <BuilderShowcase configs={DEMO_CONFIGS} />
          </Reveal>
        </div>
      </section>

      <section className="container-px py-16 sm:py-24">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="display text-3xl leading-tight sm:text-4xl">
              Want a system like this for your business?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
              Redmont Strategies Group builds connected systems that help
              businesses respond faster, follow up consistently, and cut
              administrative work.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <TrackedLink
                href="/book"
                event="demo_cta_click"
                eventProps={{ demo: "landing", cta: "closing" }}
                className="btn-primary"
              >
                Book a Strategy Call
                <ArrowRight size={15} className="ml-2" aria-hidden />
              </TrackedLink>
              <TrackedLink
                href="/services/customprivateaisystems"
                event="demo_cta_click"
                eventProps={{ demo: "landing", cta: "private_ai" }}
                className="btn-ghost"
              >
                Custom Private AI Systems
              </TrackedLink>
            </div>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
