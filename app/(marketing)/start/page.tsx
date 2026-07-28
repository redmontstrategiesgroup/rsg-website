import type { Metadata } from "next";
import { StartFlow } from "@/components/lifecycle/StartFlow";
import { QUALIFICATION_ESTIMATED_MINUTES } from "@/lib/lifecycle/qualification-content";

export const metadata: Metadata = {
  title: "Start Here | Redmont Strategies Group",
  description:
    "Tell us about your business in a few minutes and get a clear, personalized next step — an assessment or a consultation with Redmont Strategies Group.",
};

export default function StartPage() {
  return (
    <main className="relative overflow-hidden pb-24 pt-28 sm:pt-32">
      <div className="container-px relative">
        <div className="mx-auto max-w-2xl">
          <p className="label mb-4">Start here</p>
          <h1 className="display text-3xl sm:text-5xl">
            Let&rsquo;s see what your business needs.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55">
            About {QUALIFICATION_ESTIMATED_MINUTES} minutes, in plain English.
            You&rsquo;ll get a clear next step — not a sales pitch.
          </p>
          <div className="mt-12">
            <StartFlow />
          </div>
        </div>
      </div>
    </main>
  );
}
