"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Calculator, Info } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { computeRoi, formatRoiValue, type RoiValues } from "@/lib/industries/roi";
import type { IndustryVertical, RoiInput } from "@/lib/industries/types";

/**
 * Vertical-specific ROI estimator. Inputs and assumption rates come from the
 * vertical's (admin-editable) config; the math lives in lib/industries/roi.ts.
 * Every render carries the estimates-only disclaimer and ends with the
 * recommended system + assessment CTA.
 */
export function RoiCalculator({ vertical }: { vertical: IndustryVertical }) {
  const { roi } = vertical;
  const [values, setValues] = useState<RoiValues>(() =>
    Object.fromEntries(roi.inputs.map((i) => [i.id, i.defaultValue]))
  );

  const results = useMemo(
    () => computeRoi(vertical.slug, values, roi.assumptions),
    [vertical.slug, values, roi.assumptions]
  );
  const annual = results.find((r) => r.id === "annual-opportunity");
  const lines = results.filter((r) => r.id !== "annual-opportunity");
  const recommended = vertical.systems.find((s) => s.id === roi.recommendedSystemId);

  const setValue = (input: RoiInput, raw: number) => {
    const clamped = Math.min(input.max, Math.max(input.min, raw));
    setValues((prev) => ({ ...prev, [input.id]: Number.isFinite(clamped) ? clamped : input.min }));
  };

  return (
    <section id="roi" className="scroll-mt-24 border-y border-white/[0.08] bg-base-900">
      <div className="container-px py-20 sm:py-28">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label flex items-center gap-2">
              <Calculator size={13} aria-hidden />
              Opportunity calculator
            </p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.5rem]">{roi.title}</h2>
          </Reveal>
          <Reveal y={12} delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-white/55">{roi.intro}</p>
          </Reveal>
        </div>

        <Reveal y={14} delay={0.1}>
          <div className="mt-14 grid gap-6 lg:grid-cols-12">
            {/* Inputs */}
            <div className="rounded-xl border border-white/10 bg-base/60 p-7 lg:col-span-7">
              <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                Your numbers
              </p>
              <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {roi.inputs.map((input) => (
                  <div key={input.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label
                        htmlFor={`roi-${vertical.slug}-${input.id}`}
                        className="text-[0.82rem] leading-snug text-white/60"
                      >
                        {input.label}
                      </label>
                      <output className="shrink-0 font-display text-sm text-white">
                        {formatInputValue(input, values[input.id] ?? input.defaultValue)}
                      </output>
                    </div>
                    <input
                      id={`roi-${vertical.slug}-${input.id}`}
                      type="range"
                      min={input.min}
                      max={input.max}
                      step={input.step}
                      value={values[input.id] ?? input.defaultValue}
                      onChange={(e) => setValue(input, Number(e.target.value))}
                      className="roi-slider mt-3 block w-full"
                      aria-label={input.label}
                    />
                    {input.helper && (
                      <p className="mt-1.5 text-[0.68rem] leading-relaxed text-white/35">{input.helper}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            <div className="flex flex-col rounded-xl border border-crimson/30 bg-crimson/[0.05] p-7 lg:col-span-5">
              <p className="font-mono text-[0.55rem] uppercase tracking-label text-crimson-light">
                Estimated opportunity
              </p>
              <dl className="mt-6 space-y-4">
                {lines.map((line) => (
                  <div key={line.id} className="border-b border-dashed border-white/10 pb-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-[0.82rem] leading-snug text-white/60">{line.label}</dt>
                      <dd className="shrink-0 font-display text-[1.05rem] text-white">
                        {formatRoiValue(line)}
                        <span className="ml-1.5 font-sans text-[0.6rem] uppercase tracking-wide text-white/35">
                          {line.period === "monthly" ? "/mo" : line.period === "annual" ? "/yr" : "pool"}
                        </span>
                      </dd>
                    </div>
                    {line.detail && (
                      <p className="mt-1 text-[0.66rem] leading-relaxed text-white/35">{line.detail}</p>
                    )}
                  </div>
                ))}
              </dl>
              {annual && (
                <div className="mt-6">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/40">
                    {annual.label}
                  </p>
                  <p className="mt-1 font-display text-[2.2rem] leading-none text-crimson-light">
                    {formatRoiValue(annual)}
                  </p>
                </div>
              )}

              <p className="mt-6 flex items-start gap-2 text-[0.68rem] leading-relaxed text-white/40">
                <Info size={13} aria-hidden className="mt-0.5 shrink-0" />
                {roi.disclaimer}
              </p>

              {recommended && (
                <div className="mt-7 border-t border-white/[0.08] pt-6">
                  <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/40">
                    Where we&apos;d start
                  </p>
                  <p className="mt-2 font-display text-[1.02rem] text-white">{recommended.name}</p>
                  <p className="mt-1.5 text-[0.8rem] leading-relaxed text-white/50">
                    {recommended.outcome}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href="#assessment" className="btn-primary !px-4 !py-2.5 text-[0.8rem]">
                      Request a systems assessment
                      <ArrowRight size={14} className="ml-2" aria-hidden />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function formatInputValue(input: RoiInput, value: number): string {
  if (input.format === "currency") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (input.format === "percent") return `${Math.round(value)}%`;
  return Math.round(value).toLocaleString("en-US");
}
