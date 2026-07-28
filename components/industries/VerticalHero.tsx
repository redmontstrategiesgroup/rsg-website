import Link from "next/link";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Vertical page hero: outcome headline, industry-specific interface preview,
 * and a plain designed-for statement. The preview visual is passed in so each
 * vertical renders its own product surface — never a shared dashboard.
 */
export function VerticalHero({
  vertical,
  visual,
}: {
  vertical: IndustryVertical;
  visual: React.ReactNode;
}) {
  const { hero } = vertical;
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-[0.25]" />
        <div className="absolute left-[12%] top-[-20%] h-[420px] w-[680px] rounded-full bg-crimson/[0.07] blur-[130px]" />
      </div>

      <div className="container-px grid items-center gap-14 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-24">
        <div className="lg:col-span-6 xl:col-span-6">
          <Reveal y={12}>
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
              <span className="text-white/55">{vertical.shortName}</span>
            </nav>
          </Reveal>

          <Reveal y={12} delay={0.06}>
            <p className="label mt-10">{hero.eyebrow}</p>
          </Reveal>
          <Reveal y={14} delay={0.12}>
            <h1 className="display mt-6 text-[2.3rem] leading-[1.05] sm:text-[3.1rem] xl:text-[3.4rem]">
              {hero.headline}
            </h1>
          </Reveal>
          <Reveal y={14} delay={0.18}>
            <p className="mt-7 max-w-xl text-[1.02rem] leading-relaxed text-white/55">
              {hero.subheadline}
            </p>
          </Reveal>

          <Reveal y={12} delay={0.24}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href={hero.primaryCta.href} className="btn-primary">
                {hero.primaryCta.label}
                <ArrowRight size={15} className="ml-2" aria-hidden />
              </a>
              <Link href={hero.demoCta.href} className="btn-ghost">
                <MousePointerClick size={15} className="mr-2" aria-hidden />
                {hero.demoCta.label}
              </Link>
            </div>
          </Reveal>

          <Reveal y={12} delay={0.3}>
            <p className="mt-9 max-w-xl border-l-2 border-crimson/50 pl-4 text-sm leading-relaxed text-white/45">
              {hero.designedFor}
            </p>
          </Reveal>

          <Reveal y={12} delay={0.34}>
            <ul className="mt-7 flex flex-wrap gap-2">
              {vertical.audience.map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.68rem] text-white/55"
                >
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="lg:col-span-6 xl:col-span-6">
          <Reveal y={20} delay={0.2}>
            {visual}
            <p className="mt-3 text-right font-mono text-[0.55rem] uppercase tracking-label text-white/25">
              Simulated interface — sample data only
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
