"use client";

import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";
import { HOMEPAGE_CONTROL_GRID } from "@/lib/security-center/marketing";

/**
 * Homepage security section: positions security and responsible AI as core
 * differentiators. Matches the site's dark corporate-luxury aesthetic.
 */
export function SecurityStandard({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section
      id="security"
      className="scroll-mt-24 border-y border-white/10 bg-base-900"
    >
      <div className="container-px section-y">
        <div className="section-grid">
          <div className="lg:col-span-5">
            <Reveal y={12}>
              <p className="label">
                <ShieldCheck size={13} className="text-crimson-light" />
                The RSG Secure Systems Standard
              </p>
            </Reveal>
            <Reveal y={12} delay={0.08}>
              <Heading className="display mt-6 text-[2.1rem] leading-[1.08] sm:text-[2.8rem]">
                AI automation without security is a{" "}
                <span className="text-white/40">liability.</span>
              </Heading>
            </Reveal>
            <Reveal y={12} delay={0.14}>
              <p className="mt-6 max-w-md text-[1.02rem] leading-relaxed text-white/55">
                Permissions, approvals, backups, logs, testing, and recovery are
                designed into the system from day one.
              </p>
            </Reveal>
            <Reveal y={12} delay={0.2}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/security"
                  onClick={() => trackEvent("security_cta_click", { location: "home", cta: "standard" })}
                  className="btn-primary"
                >
                  Review Our Security Standard
                </Link>
                <Link
                  href="/audit"
                  onClick={() => trackEvent("security_cta_click", { location: "home", cta: "risk_assessment" })}
                  className="link-arrow group sm:ml-2"
                >
                  Request a Risk Assessment
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal y={12} delay={0.1}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {HOMEPAGE_CONTROL_GRID.map((c, i) => (
                  <Reveal key={c} y={10} delay={(i % 4) * 0.03}>
                    <div className="flex items-center gap-2.5 border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/65">
                      <Check size={14} className="shrink-0 text-crimson-light" />
                      {c}
                    </div>
                  </Reveal>
                ))}
              </div>
              <p className="mt-5 text-sm leading-relaxed text-white/40">
                Controls are selected to fit each project. Informed by NIST and
                OWASP guidance — never sold as a compliance badge.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
