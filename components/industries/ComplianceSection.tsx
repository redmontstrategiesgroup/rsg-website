import { ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Industry-specific compliance and risk practices. Describes safeguards RSG
 * designs around — never certification claims, never legal/medical advice
 * (the disclaimer is part of the vertical's content and always rendered).
 */
export function ComplianceSection({
  vertical,
  emphasized = false,
}: {
  vertical: IndustryVertical;
  /** Dental gets the elevated treatment — compliance before systems. */
  emphasized?: boolean;
}) {
  const { title, intro, disclaimer, items } = vertical.compliance;

  return (
    <section
      id="compliance"
      className={`scroll-mt-24 ${emphasized ? "border-y border-crimson/20 bg-crimson/[0.03]" : ""}`}
    >
      <div className="container-px section-y">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Reveal y={12}>
              <p className="label flex items-center gap-2">
                <ShieldCheck size={13} aria-hidden className={emphasized ? "text-crimson-light" : ""} />
                Compliance &amp; risk
              </p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">{title}</h2>
            </Reveal>
            <Reveal y={12} delay={0.14}>
              <p className="mt-6 text-[0.95rem] leading-relaxed text-white/55">{intro}</p>
            </Reveal>
            <Reveal y={12} delay={0.2}>
              <p className="mt-8 border-l-2 border-white/15 pl-4 text-[0.78rem] leading-relaxed text-white/40">
                {disclaimer}
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <div className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] sm:grid-cols-2">
              {items.map((item, i) => (
                <div key={item.title} className="bg-base-900 p-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[0.7rem] sm:text-[0.55rem] text-crimson-light/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-[0.98rem] leading-snug text-white">{item.title}</h3>
                  </div>
                  <p className="mt-2.5 text-[0.82rem] leading-relaxed text-white/50">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
