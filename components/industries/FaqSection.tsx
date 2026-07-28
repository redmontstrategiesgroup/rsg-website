import { Plus } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { IndustryVertical } from "@/lib/industries/types";

/** Vertical FAQs — the same content feeds the FAQPage JSON-LD. */
export function FaqSection({ vertical }: { vertical: IndustryVertical }) {
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="container-px py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal y={12}>
              <p className="label">Common questions</p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-6 text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
                Asked by {vertical.shortName.toLowerCase()} owners.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-8">
            <Reveal y={12} delay={0.1}>
              <div className="border-t border-white/[0.08]">
                {vertical.faqs.map((f) => (
                  <details key={f.q} className="group border-b border-white/[0.08]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                      <span className="font-display text-[1.02rem] leading-snug text-white/85">
                        {f.q}
                      </span>
                      <Plus
                        size={16}
                        aria-hidden
                        className="shrink-0 text-white/35 transition-transform group-open:rotate-45"
                      />
                    </summary>
                    <p className="max-w-3xl pb-7 text-sm leading-relaxed text-white/50">{f.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
