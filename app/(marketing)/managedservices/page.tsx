import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { PlanGrid } from "@/components/managed-services/PlanGrid";
import { ComparisonTable } from "@/components/managed-services/ComparisonTable";
import { listPlans } from "@/lib/managed-services/store";
import {
  HOW_IT_WORKS,
  MANAGED_SERVICES_FAQS,
  MANAGED_SERVICES_HEADLINE,
  MANAGED_SERVICES_SUBHEAD,
  PARTNERSHIP_LINE,
  WHY_ONGOING,
} from "@/lib/managed-services/content";
import { PHONE_DISPLAY, PHONE_TEL, SITE_URL } from "@/lib/site";

export const revalidate = 300;

const PAGE_PATH = "/managedservices";

export const metadata: Metadata = {
  title: "Managed Services | Redmont Strategies Group",
  description: MANAGED_SERVICES_SUBHEAD,
  alternates: { canonical: `${SITE_URL}${PAGE_PATH}` },
  openGraph: {
    title: "Managed Services | Redmont Strategies Group",
    description: MANAGED_SERVICES_SUBHEAD,
    url: `${SITE_URL}${PAGE_PATH}`,
    siteName: "Redmont Strategies Group",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Managed Services | Redmont Strategies Group",
    description: MANAGED_SERVICES_SUBHEAD,
  },
  robots: { index: true, follow: true },
};

export default async function ManagedServicesPage() {
  const plans = await listPlans();

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Managed Services",
    description: MANAGED_SERVICES_SUBHEAD,
    serviceType: "Managed technology services",
    provider: {
      "@type": "Organization",
      name: "Redmont Strategies Group",
      url: SITE_URL,
      telephone: PHONE_TEL,
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Plymouth County, Massachusetts" },
      { "@type": "AdministrativeArea", name: "South Shore, Massachusetts" },
    ],
    url: `${SITE_URL}${PAGE_PATH}`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Managed Services",
        item: `${SITE_URL}${PAGE_PATH}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: MANAGED_SERVICES_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-25%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-crimson/[0.08] blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[280px] w-[420px] rounded-full bg-white/[0.03] blur-[100px]" />
        </div>
        <div className="container-px pb-16 pt-14 sm:pb-24 sm:pt-20">
          <Reveal y={12}>
            <p className="label">Managed Services</p>
          </Reveal>
          <Reveal y={12} delay={0.06}>
            <h1 className="display text-gradient mt-6 max-w-3xl text-[2.15rem] leading-[1.08] tracking-tight sm:text-[3.1rem]">
              {MANAGED_SERVICES_HEADLINE}
            </h1>
          </Reveal>
          <Reveal y={12} delay={0.12}>
            <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-white/55">
              {MANAGED_SERVICES_SUBHEAD}
            </p>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-5 max-w-2xl border-l-2 border-crimson/60 pl-5 text-[0.98rem] leading-relaxed text-white/70">
              {PARTNERSHIP_LINE}
            </p>
          </Reveal>
          <Reveal y={12} delay={0.2}>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#plans" className="btn-primary px-6 py-3.5">
                Choose Your Management Plan
              </a>
              <Link href="/book" className="btn-ghost px-6 py-3.5">
                Schedule a Systems Review
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why ongoing management */}
      <section className="border-b border-white/[0.08]">
        <div className="container-px py-20 sm:py-28">
          <Reveal y={12}>
            <p className="label">Why ongoing management</p>
          </Reveal>
          <Reveal y={12} delay={0.06}>
            <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
              Systems left alone don&apos;t stay still — they decay.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {WHY_ONGOING.map((item, i) => (
              <Reveal key={item.title} y={12} delay={(i % 2) * 0.05}>
                <article className="h-full border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                  <h3 className="display text-lg text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/55">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-24 border-y border-white/10 bg-base-900">
        <div className="container-px py-20 sm:py-28">
          <Reveal y={12}>
            <p className="label">Management plans</p>
          </Reveal>
          <Reveal y={12} delay={0.06}>
            <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
              Four levels of ongoing partnership.
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.1}>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/50">
              Every plan is a defined service agreement — what&apos;s included,
              response targets, and terms are stated up front. Upgrade any time as
              your systems grow.
            </p>
          </Reveal>
          <div className="mt-14">
            <PlanGrid plans={plans} />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-b border-white/[0.08]">
        <div className="container-px py-20 sm:py-28">
          <Reveal y={12}>
            <p className="label">Plan comparison</p>
          </Reveal>
          <Reveal y={12} delay={0.06}>
            <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
              What each plan covers, side by side.
            </h2>
          </Reveal>
          <div className="mt-12">
            <ComparisonTable plans={plans} />
          </div>
        </div>
      </section>

      {/* How recurring service works */}
      <section className="border-b border-white/[0.08]">
        <div className="container-px py-20 sm:py-28">
          <div className="section-grid">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-36">
                <Reveal y={12}>
                  <p className="label">How recurring service works</p>
                </Reveal>
                <Reveal y={12} delay={0.08}>
                  <h2 className="display mt-6 max-w-md text-[1.85rem] leading-tight sm:text-[2.4rem]">
                    A defined process, from review to roadmap.
                  </h2>
                </Reveal>
                <Reveal y={12} delay={0.12}>
                  <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-white/50">
                    Managed service isn&apos;t a retainer that disappears into a
                    black box. Every month follows the same accountable rhythm —
                    reviewed, logged, and reported in your client portal.
                  </p>
                </Reveal>
              </div>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <ol className="space-y-3">
                {HOW_IT_WORKS.map((stage, i) => (
                  <Reveal key={stage.step} y={10} delay={i * 0.04}>
                    <li className="flex gap-5 border border-white/10 bg-white/[0.02] p-5 sm:p-6">
                      <span className="font-mono text-sm text-crimson-light">
                        {stage.step}
                      </span>
                      <div>
                        <h3 className="font-medium text-white">{stage.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/50">
                          {stage.body}
                        </p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-y border-white/10 bg-base-900">
        <div className="container-px py-20 sm:py-28">
          <div className="section-grid">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-36">
                <Reveal y={12}>
                  <p className="label">FAQ</p>
                </Reveal>
                <Reveal y={12} delay={0.08}>
                  <h2 className="display mt-6 max-w-md text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                    Straight answers about ongoing management.
                  </h2>
                </Reveal>
              </div>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {MANAGED_SERVICES_FAQS.map((item, i) => (
                <Reveal key={item.q} y={12} delay={i * 0.03}>
                  <details className="group border-t border-white/[0.08] last:border-b">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 [&::-webkit-details-marker]:hidden">
                      <span className="display text-[1.15rem] leading-snug text-white">
                        {item.q}
                      </span>
                      <Plus
                        size={18}
                        className="mt-1 shrink-0 text-white/40 transition-transform duration-300 group-open:rotate-45"
                      />
                    </summary>
                    <p className="max-w-xl pb-8 text-[0.98rem] leading-relaxed text-white/55">
                      {item.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-b border-white/[0.08]">
        <div className="container-px py-20 sm:py-28">
          <Reveal y={12}>
            <p className="label">Next step</p>
          </Reveal>
          <Reveal y={12} delay={0.06}>
            <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
              Put your systems under active management.
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.1}>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#plans" className="btn-primary px-6 py-3.5">
                Choose Your Management Plan
              </a>
              <Link href="/book" className="btn-ghost px-6 py-3.5">
                Schedule a Systems Review
              </Link>
            </div>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-10 text-sm text-white/40">
              Prefer to talk it through?{" "}
              <a
                href={`tel:${PHONE_TEL}`}
                className="font-medium text-white/70 transition-colors hover:text-crimson-light"
              >
                {PHONE_DISPLAY}
              </a>
            </p>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
