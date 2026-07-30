"use client";

import Link from "next/link";
import { Reveal } from "../Reveal";
import { trackEvent } from "@/lib/events";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";

export function FinalCTA({
  headingAs: Heading = "h2",
}: {
  headingAs?: "h1" | "h2";
}) {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="container-px section-y">
        <div className="max-w-3xl">
          <Reveal y={12}>
            <p className="label">Next step</p>
          </Reveal>
          <Reveal y={12} delay={0.08}>
            <Heading className="display mt-6 text-[2.3rem] leading-[1.04] sm:text-[3.2rem]">
              Start with a strategy call
            </Heading>
          </Reveal>
          <Reveal y={12} delay={0.16}>
            <p className="mt-6 max-w-md text-[1.02rem] leading-relaxed text-white/55">
              Every engagement starts with a strategy call. We review the
              business first, so the conversation is about your operation, not
              our pitch.
            </p>
          </Reveal>
          <Reveal y={12} delay={0.22}>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
              <Link
                href="/book"
                onClick={() =>
                  trackEvent("book_strategy_call_click", {
                    location: "final_cta",
                  })
                }
                className="btn-primary"
              >
                Book a Strategy Call
              </Link>
              <p className="text-sm text-white/45">
                Prefer to call?{" "}
                <a
                  href={`tel:${PHONE_TEL}`}
                  className="text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
                >
                  {PHONE_DISPLAY}
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
