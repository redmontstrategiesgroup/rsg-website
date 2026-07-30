"use client";

import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import {
  SECURITY_VARIANTS,
  type SecurityVariant,
} from "@/lib/security-center/service-controls";

/**
 * Reusable "Security Included" section. The controls shown adapt to the kind
 * of project via `variant`. Links to the full Secure Systems Standard.
 */
export function SecurityIncluded({
  variant,
  className = "",
}: {
  variant: SecurityVariant;
  className?: string;
}) {
  const def = SECURITY_VARIANTS[variant];
  return (
    <section
      id="security-included"
      className={`scroll-mt-24 border-y border-white/[0.08] bg-base-900 ${className}`}
    >
      <div className="container-px section-y">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">
                <ShieldCheck size={13} className="text-crimson-light" />
                {def.eyebrow}
              </p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <h2 className="display mt-5 max-w-md text-[1.8rem] leading-tight sm:text-[2.3rem]">
                {def.title}
              </h2>
            </Reveal>
            <Reveal y={12} delay={0.12}>
              <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-white/55">
                {def.intro}
              </p>
            </Reveal>
            <Reveal y={12} delay={0.16}>
              <Link
                href="/security"
                className="link-arrow group mt-6 sm:mt-7"
              >
                Review the RSG Secure Systems Standard
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="grid gap-2 sm:grid-cols-2">
              {def.controls.map((c, i) => (
                <Reveal key={c} y={10} delay={(i % 4) * 0.03}>
                  <div className="flex items-start gap-2.5 border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/65">
                    <Check size={14} className="mt-0.5 shrink-0 text-crimson-light" />
                    {c}
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/40">
              Controls are selected to fit the project. Informed by NIST and
              OWASP guidance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
