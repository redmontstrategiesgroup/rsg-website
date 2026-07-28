import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Closing CTA band. Vertical-specific language only — never a bare
 * "Book a Call" — with the secondary paths as quieter options.
 */
export function VerticalCtaBand({ vertical }: { vertical: IndustryVertical }) {
  const { primary, secondary } = vertical.ctas;
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crimson/[0.08] blur-[120px]" />
      </div>
      <div className="container-px py-24 text-center sm:py-32">
        <Reveal y={14}>
          <h2 className="display mx-auto max-w-3xl text-[2rem] leading-[1.08] sm:text-[2.7rem]">
            {primary.label}
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-[0.95rem] leading-relaxed text-white/50">
            The assessment takes a few minutes, shows you a recommended starting point immediately,
            and turns into a short written read on where your operation is losing the most — before
            you ever get on a call.
          </p>
        </Reveal>
        <Reveal y={12} delay={0.18}>
          <div className="mt-10 flex justify-center">
            <CtaLink cta={primary} className="btn-primary" />
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {secondary.map((s) => (
              <li key={s.label}>
                <CtaLink
                  cta={s}
                  className="group inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-crimson-light"
                  arrow
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function CtaLink({
  cta,
  className,
  arrow = false,
}: {
  cta: { label: string; href: string };
  className: string;
  arrow?: boolean;
}) {
  const inner = (
    <>
      {cta.label}
      <ArrowRight
        size={arrow ? 14 : 15}
        className={arrow ? "transition-transform group-hover:translate-x-1" : "ml-2"}
        aria-hidden
      />
    </>
  );
  // Anchor links must not use Next's <Link> scroll reset.
  if (cta.href.startsWith("#")) {
    return (
      <a href={cta.href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={cta.href} className={className}>
      {inner}
    </Link>
  );
}
