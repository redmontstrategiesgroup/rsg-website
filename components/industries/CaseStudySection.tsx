import { ArrowRight, Info } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/**
 * One clearly-labeled scenario per vertical. Until an admin marks a verified
 * case study (with approved metrics and disclosures), the illustrative label
 * and projection note are always rendered — no fabricated names, quotes, or
 * results ever appear here.
 */
export function CaseStudySection({ vertical }: { vertical: IndustryVertical }) {
  const cs = vertical.caseStudy;

  return (
    <section id="case-study" className="scroll-mt-24">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">{cs.verified ? "Case study" : "Example implementation"}</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">
              What an engagement actually looks like.
            </h2>
          </Reveal>
          {!cs.verified && (
            <Reveal y={12} delay={0.14}>
              <p className="mt-6 inline-flex items-start gap-2.5 rounded-lg border border-white/12 bg-white/[0.03] px-4 py-3 text-[0.8rem] leading-relaxed text-white/50">
                <Info size={15} aria-hidden className="mt-0.5 shrink-0 text-white/35" />
                {cs.label}
              </p>
            </Reveal>
          )}
        </div>

        <Reveal y={14} delay={0.1}>
          <div className="mt-14 overflow-hidden rounded-xl border border-white/10">
            {/* Profile strip */}
            <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
              <ProfileCell label="Business" value={cs.businessType} />
              <ProfileCell label="Size" value={cs.size} />
              <ProfileCell label="Implementation timeline" value={cs.timeline} />
              <ProfileCell label="Current stack" value={cs.currentStack.join(" · ")} />
            </div>

            <div className="border-t border-white/[0.08] bg-base-900 p-7 sm:p-9">
              <p className="font-mono text-[0.55rem] uppercase tracking-label text-crimson-light/80">
                The operational problem
              </p>
              <p className="mt-3 max-w-3xl text-[0.95rem] leading-relaxed text-white/60">{cs.problem}</p>

              {/* Before / after */}
              <div className="mt-10 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                    Workflow before
                  </p>
                  <ol className="mt-4 space-y-3">
                    {cs.beforeWorkflow.map((step, i) => (
                      <li key={step} className="flex gap-3 text-sm leading-relaxed text-white/50">
                        <span className="font-mono text-[0.62rem] text-white/30">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-xl border border-crimson/30 bg-crimson/[0.05] p-6">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-crimson-light">
                    Workflow after
                  </p>
                  <ol className="mt-4 space-y-3">
                    {cs.afterWorkflow.map((step, i) => (
                      <li key={step} className="flex gap-3 text-sm leading-relaxed text-white/65">
                        <span className="font-mono text-[0.62rem] text-crimson-light/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Implementation + KPIs + projections */}
              <div className="mt-10 grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                    Proposed RSG implementation
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {cs.implementation.map((step) => (
                      <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                        <ArrowRight size={13} aria-hidden className="mt-1 shrink-0 text-crimson-light/60" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-3">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                    KPIs monitored
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {cs.kpis.map((k) => (
                      <li
                        key={k}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.72rem] text-white/55"
                      >
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-4">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                    {cs.verified ? "Results" : "Projected outcomes"}
                  </p>
                  <dl className="mt-4 space-y-3">
                    {cs.projections.map((p) => (
                      <div
                        key={p.label}
                        className="flex items-baseline justify-between gap-4 border-b border-dashed border-white/10 pb-2.5"
                      >
                        <dt className="text-[0.82rem] text-white/50">{p.label}</dt>
                        <dd className="font-display text-sm text-white/85">{p.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {!cs.verified && (
                    <p className="mt-4 text-[0.7rem] leading-relaxed text-white/35">{cs.projectionNote}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProfileCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-900 px-6 py-5">
      <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">{label}</p>
      <p className="mt-1.5 text-sm leading-snug text-white/75">{value}</p>
    </div>
  );
}
