import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reveal } from "@/components/Reveal";
import { getSecondaryIndustries } from "@/lib/industries/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Additional Industries | Redmont Strategies Group",
  description:
    "RSG specializes in home services, dental & specialty healthcare, and retail. Outside those verticals, we take a limited number of projects where the problem matches a system we've already built.",
  alternates: { canonical: "/industries/additional" },
  openGraph: {
    title: "Additional Industries | Redmont Strategies Group",
    description:
      "RSG takes a limited number of projects outside its primary verticals when the operational problem closely matches a system we have already developed.",
    url: "/industries/additional",
    images: ["/og.png"],
  },
};

/**
 * Honest secondary-industry page: a short list of industries RSG can
 * evaluate, with the operational overlap stated plainly. Deliberately not a
 * set of fully-developed pages — no specialized claims, systems, or case
 * studies exist for these until RSG has a verified offering.
 */
export default async function AdditionalIndustriesPage() {
  const industries = await getSecondaryIndustries();

  return (
    <PageShell>
      <section className="container-px pb-16 pt-12 sm:pt-14">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[0.62rem] uppercase tracking-label text-white/35"
        >
          <Link href="/" className="transition-colors hover:text-white">
            Home
          </Link>
          <span className="mx-2 text-white/20">/</span>
          <Link href="/industries" className="transition-colors hover:text-white">
            Industries
          </Link>
          <span className="mx-2 text-white/20">/</span>
          <span className="text-white/55">Additional industries</span>
        </nav>

        <div className="mt-12 max-w-3xl">
          <Reveal y={12}>
            <p className="label">Outside our primary verticals</p>
          </Reveal>
          <Reveal y={14} delay={0.08}>
            <h1 className="display mt-6 text-[2.2rem] leading-[1.08] sm:text-[3rem]">
              We specialize deliberately. Here&apos;s what that means for everyone else.
            </h1>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-7 text-[1rem] leading-relaxed text-white/55">
              RSG&apos;s primary verticals are{" "}
              <Link href="/industries/homeservices" className="link-underline text-white/80">
                home service &amp; trade businesses
              </Link>
              ,{" "}
              <Link href="/industries/dentalpractices" className="link-underline text-white/80">
                dental &amp; specialty healthcare practices
              </Link>
              , and{" "}
              <Link href="/industries/retail" className="link-underline text-white/80">
                retail &amp; multi-location businesses
              </Link>
              . That focus is why those pages carry real workflows, demos, and calculators instead
              of swapped-out headlines.
            </p>
          </Reveal>
          <Reveal y={12} delay={0.22}>
            <p className="mt-5 border-l-2 border-crimson/50 pl-4 text-[0.95rem] leading-relaxed text-white/50">
              RSG accepts a limited number of projects outside its primary verticals when the
              operational problem closely matches a system we have already developed. We won&apos;t
              claim specialized expertise we don&apos;t have — an assessment tells both of us
              quickly whether the overlap is real.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-base-900">
        <div className="container-px py-16 sm:py-20">
          <Reveal y={12}>
            <p className="label">Industries we can evaluate</p>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] sm:grid-cols-2">
            {industries.map((ind) => (
              <article key={ind.name} className="bg-base-900 p-7">
                <h2 className="font-display text-[1.05rem] text-white">{ind.name}</h2>
                <p className="mt-2.5 text-[0.85rem] leading-relaxed text-white/50">{ind.overlap}</p>
              </article>
            ))}
          </div>
          <Reveal y={10} delay={0.08}>
            <p className="mt-8 max-w-3xl text-[0.78rem] leading-relaxed text-white/40">
              No specialized system names, case studies, or results exist for these industries yet —
              and none are invented here. If we take your project, it&apos;s because an existing,
              proven system maps onto your problem.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-px py-20 text-center sm:py-24">
        <Reveal y={12}>
          <h2 className="display mx-auto max-w-2xl text-[1.8rem] leading-[1.1] sm:text-[2.3rem]">
            Not sure the overlap is there? That&apos;s exactly what an assessment is for.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-white/50">
            Tell us how work moves through your business. If one of our existing systems fits,
            we&apos;ll show you exactly which one — and if it doesn&apos;t, we&apos;ll say so.
          </p>
        </Reveal>
        <Reveal y={12} delay={0.16}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link href="/book" className="btn-primary">
              Request an evaluation
              <ArrowRight size={15} className="ml-2" aria-hidden />
            </Link>
            <Link href="/industries" className="btn-ghost">
              See our primary verticals
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
