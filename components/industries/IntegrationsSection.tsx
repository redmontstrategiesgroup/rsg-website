import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Vertical-relevant integrations. Every entry explains what it connects —
 * never a bare logo wall — and the section carries the availability
 * disclaimer (no claimed official partnerships).
 */
export function IntegrationsSection({ vertical }: { vertical: IndustryVertical }) {
  const { items, intro, disclaimer } = vertical.integrations;
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <section id="integrations" className="scroll-mt-24 border-y border-white/[0.08] bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Connects to your stack</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">
              Integrations that matter to {vertical.shortName.toLowerCase()}.
            </h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">{intro}</p>
          </Reveal>
        </div>

        <div className="mt-14 space-y-10">
          {categories.map((cat, ci) => (
            <Reveal key={cat} y={12} delay={Math.min(ci * 0.05, 0.2)}>
              <div>
                <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/35">{cat}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items
                    .filter((i) => i.category === cat)
                    .map((i) => (
                      <article
                        key={i.name}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
                      >
                        <h3 className="font-display text-[0.98rem] text-white">{i.name}</h3>
                        <p className="mt-2 text-[0.8rem] leading-relaxed text-white/50">{i.connects}</p>
                      </article>
                    ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal y={10} delay={0.1}>
          <p className="mt-12 max-w-3xl border-l-2 border-white/15 pl-4 text-[0.78rem] leading-relaxed text-white/40">
            {disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
