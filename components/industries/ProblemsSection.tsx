import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * Operational problems, rendered differently per vertical so no two pages
 * share a layout: "ticket" cards for home services, a front-desk ledger for
 * dental, and a tile wall for retail.
 */
export function ProblemsSection({
  vertical,
  variant,
  heading,
}: {
  vertical: IndustryVertical;
  variant: "tickets" | "ledger" | "tiles";
  heading: string;
}) {
  const { problems, problemsIntro } = vertical;

  return (
    <section id="problems" className="scroll-mt-24 border-y border-white/[0.08] bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Where it breaks</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">{heading}</h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">{problemsIntro}</p>
          </Reveal>
        </div>

        {variant === "tickets" && (
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p, i) => (
              <Reveal key={p.id} y={14} delay={(i % 3) * 0.06} className="h-full">
                <article className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
                  <span className="font-mono text-[0.55rem] uppercase tracking-label text-crimson-light/70">
                    Ticket {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-display text-lg leading-snug text-white">{p.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">{p.detail}</p>
                  {p.cost && (
                    <p className="mt-4 border-t border-dashed border-white/10 pt-3 text-[0.72rem] leading-relaxed text-crimson-light/80">
                      {p.cost}
                    </p>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        )}

        {variant === "ledger" && (
          <div className="mt-16 border-t border-white/[0.08]">
            {problems.map((p, i) => (
              <Reveal key={p.id} y={10} delay={Math.min(i * 0.03, 0.2)}>
                <article className="grid gap-3 border-b border-white/[0.08] py-7 sm:grid-cols-12 sm:gap-8">
                  <div className="sm:col-span-4 lg:col-span-3">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[0.62rem] text-crimson-light/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display text-lg leading-snug text-white">{p.title}</h3>
                    </div>
                  </div>
                  <div className="sm:col-span-8 lg:col-span-6">
                    <p className="text-sm leading-relaxed text-white/50">{p.detail}</p>
                  </div>
                  {p.cost && (
                    <div className="lg:col-span-3">
                      <p className="text-[0.72rem] leading-relaxed text-crimson-light/80 lg:text-right">
                        {p.cost}
                      </p>
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        )}

        {variant === "tiles" && (
          <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
            {problems.map((p, i) => (
              <article
                key={p.id}
                className="group flex flex-col bg-base-900 p-6 transition-colors hover:bg-base-800"
              >
                <span className="font-mono text-[0.55rem] uppercase tracking-label text-white/30 transition-colors group-hover:text-crimson-light/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-[1.02rem] leading-snug text-white">
                  {p.title}
                </h3>
                <p className="mt-2.5 flex-1 text-[0.8rem] leading-relaxed text-white/45">
                  {p.detail}
                </p>
                {p.cost && (
                  <p className="mt-3.5 text-[0.68rem] leading-relaxed text-crimson-light/75">{p.cost}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
