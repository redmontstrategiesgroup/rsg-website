import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { CtaLink } from "@/components/local/CtaLink";
import { PHONE_DISPLAY, PHONE_TEL, SITE_URL } from "@/lib/site";

const AUDIT_SLUG = "business-systems-audit-plymouth-county-ma";

/**
 * Shared renderer for local SEO service and industry pages.
 *
 * One typed content object drives BOTH the visible page and the JSON-LD
 * (Service, BreadcrumbList, FAQPage), so structured data can never drift
 * from what a visitor actually sees. Copy rules enforced by review, not
 * markup: no hidden text, no keyword lists, no "top/best" claims.
 */

export type LocalPageContent = {
  /** URL slug without leading slash, e.g. "business-consulting-plymouth-county-ma". */
  slug: string;
  /** Small eyebrow label above the H1. */
  label: string;
  h1: string;
  /** 1-2 short intro paragraphs. */
  intro: string[];
  /** Breadcrumb parent (Services or Industries hub). */
  parent: { label: string; href: string };
  /** Short name for this page in the breadcrumb. */
  breadcrumbLabel: string;
  problemHeading: string;
  problem: string[];
  helpHeading: string;
  help: string[];
  includesHeading: string;
  includes: string[];
  whoHeading: string;
  who: string[];
  /** One natural sentence naming the service area and 2-3 towns. */
  serviceArea: string;
  faqs: { q: string; a: string }[];
  related: { label: string; href: string }[];
  schema: {
    serviceName: string;
    serviceDescription: string;
    serviceType: string;
  };
};

const PROCESS_STEPS = [
  { name: "Diagnose", note: "Review the business end to end" },
  { name: "Map", note: "Pinpoint where value is being lost" },
  { name: "Strategize", note: "Build a practical plan" },
  { name: "Build", note: "Implement the systems" },
  { name: "Optimize", note: "Refine as the business grows" },
];

export function LocalPage({ content }: { content: LocalPageContent }) {
  const c = content;
  const pageUrl = `${SITE_URL}/${c.slug}`;
  const isAuditPage = c.slug === AUDIT_SLUG;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: c.schema.serviceName,
    description: c.schema.serviceDescription,
    serviceType: c.schema.serviceType,
    url: pageUrl,
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
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: c.parent.label,
        item: `${SITE_URL}${c.parent.href}`,
      },
      { "@type": "ListItem", position: 3, name: c.breadcrumbLabel, item: pageUrl },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Header */}
      <section className="container-px pb-14 pt-12 sm:pb-20 sm:pt-14">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[0.62rem] uppercase tracking-label text-white/35"
        >
          <Link href="/" className="transition-colors hover:text-white">
            Home
          </Link>
          <span aria-hidden="true" className="mx-2 text-white/20">
            /
          </span>
          <Link href={c.parent.href} className="transition-colors hover:text-white">
            {c.parent.label}
          </Link>
          <span aria-hidden="true" className="mx-2 text-white/20">
            /
          </span>
          <span className="text-white/55">{c.breadcrumbLabel}</span>
        </nav>

        <Reveal y={12}>
          <p className="label mt-12">{c.label}</p>
        </Reveal>
        <Reveal y={12} delay={0.08}>
          <h1 className="display mt-6 max-w-3xl text-[2.4rem] leading-[1.05] sm:text-[3.3rem]">
            {c.h1}
          </h1>
        </Reveal>
        <Reveal y={12} delay={0.16}>
          <div className="mt-6 max-w-2xl space-y-5 text-[1.05rem] leading-relaxed text-white/55">
            {c.intro.map((p) => (
              <p key={p.slice(0, 32)}>{p}</p>
            ))}
          </div>
        </Reveal>
        <Reveal y={12} delay={0.22}>
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
            <CtaLink
              href="/book"
              page={c.slug}
              cta="book_call_hero"
              event="book_strategy_call_click"
              className="btn-primary"
            >
              Book a Strategy Call
            </CtaLink>
            {!isAuditPage && (
              <CtaLink
                href="/book"
                page={c.slug}
                cta="audit_hero"
                event="business_systems_audit_click"
                className="link-underline"
              >
                Get a Business Systems Audit
              </CtaLink>
            )}
          </div>
          <p className="mt-6 text-sm text-white/45">
            Prefer to call?{" "}
            <a
              href={`tel:${PHONE_TEL}`}
              className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
            >
              {PHONE_DISPLAY}
            </a>
          </p>
        </Reveal>
      </section>

      {/* Problem */}
      <section className="border-y border-white/[0.08] bg-base-900">
        <div className="container-px py-20 sm:py-28">
          <div className="section-grid">
            <div className="lg:col-span-5">
              <Reveal y={12}>
                <h2 className="display max-w-md text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
                  {c.problemHeading}
                </h2>
              </Reveal>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <Reveal y={12} delay={0.1}>
                <div className="space-y-5 border-t border-white/15 pt-8 text-[1.02rem] leading-relaxed text-white/55 lg:border-t-0 lg:pt-1">
                  {c.problem.map((p) => (
                    <p key={p.slice(0, 32)}>{p}</p>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* How RSG helps */}
      <section className="container-px py-20 sm:py-28">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <h2 className="display max-w-md text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
                {c.helpHeading}
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal y={12} delay={0.1}>
              <div className="space-y-5 text-[1.02rem] leading-relaxed text-white/55 lg:pt-1">
                {c.help.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Includes + who it's for */}
      <section className="border-y border-white/[0.08] bg-base-900">
        <div className="container-px py-20 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
            <Reveal y={12}>
              <div>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
                  {c.includesHeading}
                </p>
                <div className="mt-6">
                  {c.includes.map((item) => (
                    <div
                      key={item}
                      className="border-t border-white/[0.08] py-4 text-[0.95rem] text-white/70 last:border-b"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <div>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
                  {c.whoHeading}
                </p>
                <div className="mt-6">
                  {c.who.map((item) => (
                    <div
                      key={item}
                      className="border-t border-white/[0.08] py-4 text-[0.95rem] text-white/70 last:border-b"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Process strip */}
      <section className="container-px py-20 sm:py-28">
        <Reveal y={12}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="display max-w-md text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
              How an engagement runs
            </h2>
            <Link
              href="/process"
              className="group inline-flex items-center gap-2.5 text-sm font-medium text-white transition-colors hover:text-crimson-light"
            >
              See the full process
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <div className="mt-12 grid gap-x-8 border-t border-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.name} className="py-6">
                <span className="font-mono text-[0.62rem] text-white/25">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-[1.02rem] font-medium text-white">
                  {step.name}
                </p>
                <p className="mt-1.5 text-sm leading-snug text-white/45">
                  {step.note}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="border-y border-white/[0.08] bg-base-900">
        <div className="container-px py-20 sm:py-28">
          <div className="section-grid">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-36">
                <Reveal y={12}>
                  <h2 className="display max-w-md text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
                    Common questions
                  </h2>
                </Reveal>
              </div>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {c.faqs.map((item, i) => (
                <Reveal key={item.q} y={12} delay={i * 0.04}>
                  <details className="group border-t border-white/[0.08] last:border-b">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                      <h3 className="display text-[1.08rem] font-normal leading-snug text-white">
                        {item.q}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 font-mono text-white/40 transition-transform duration-300 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="max-w-xl pb-7 text-[0.98rem] leading-relaxed text-white/55">
                      {item.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service area + CTA */}
      <section className="container-px py-20 sm:py-28">
        <Reveal y={12}>
          <div className="max-w-3xl">
            <h2 className="display text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
              The next step is a conversation.
            </h2>
            <p className="mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-white/55">
              {c.serviceArea}
            </p>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
              <CtaLink
                href="/book"
                page={c.slug}
                cta="book_call_footer"
                event="book_strategy_call_click"
                className="btn-primary"
              >
                Book a Strategy Call
              </CtaLink>
              <p className="text-sm text-white/45">
                Or call{" "}
                <a
                  href={`tel:${PHONE_TEL}`}
                  className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
                >
                  {PHONE_DISPLAY}
                </a>
              </p>
            </div>
            {!isAuditPage && (
              <p className="mt-8 max-w-2xl text-sm leading-relaxed text-white/45">
                Not ready for a call? Start with a{" "}
                <Link
                  href="/book"
                  className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
                >
                  Business Systems Audit
                </Link>{" "}
                and see exactly where the business is losing time, leads, and
                revenue.
              </p>
            )}
          </div>
        </Reveal>

        {/* Related pages */}
        <Reveal y={12} delay={0.08}>
          <div className="mt-16 border-t border-white/[0.08] pt-8">
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-white/35">
              Related
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {c.related.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/55 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
