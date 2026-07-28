"use client";

import { useState } from "react";
import { FormFlow } from "@/components/lifecycle/FormFlow";
import { QUALIFICATION_SECTIONS } from "@/lib/lifecycle/qualification-content";
import { postJson } from "@/lib/api";


type Outcome = {
  next: "assessment" | "book";
  url: string;
  bookUrl?: string;
};

export function StartFlow() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  if (outcome) {
    const isAssessment = outcome.next === "assessment";
    return (
      <div className="animate-fade-up border border-white/10 bg-white/[0.02] px-6 py-10 text-center sm:px-10">
        <p className="label justify-center">Received</p>
        <h2 className="display mt-4 text-2xl sm:text-3xl">
          {isAssessment ? "You're a strong fit." : "Thank you — we have what we need."}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/55">
          {isAssessment
            ? "Based on what you shared, the next step is your Business Systems Assessment — about 10–15 minutes, saved as you go. It gives our team a precise picture of how your business runs before we ever get on a call. A link is also in your inbox."
            : "The most useful next step is a short consultation — a practical conversation about where you are and what would genuinely help. No preparation needed, and you'll leave with clear direction either way."}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={outcome.url} className="btn-primary">
            {isAssessment ? "Start your assessment" : "Book your consultation"}
          </a>
          {isAssessment && outcome.bookUrl && (
            <a href={outcome.bookUrl} className="btn-ghost">
              Prefer to book a call first?
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <FormFlow
      sections={QUALIFICATION_SECTIONS}
      submitLabel="See my next step"
      onSubmit={async (answers) => {
        const res = await postJson("/api/start", {
          answers,
          attribution:
            typeof window !== "undefined"
              ? {
                  pageUrl: window.location.href.slice(0, 500),
                  referrer: document.referrer.slice(0, 500) || undefined,
                }
              : undefined,
        });
        const data = (await res.json()) as Partial<Outcome> & { error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }
        setOutcome({
          next: data.next === "assessment" ? "assessment" : "book",
          url: data.url,
          bookUrl: data.bookUrl,
        });
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      footer={
        <p className="mt-8 text-center text-[0.68rem] leading-relaxed text-white/30">
          Everything you share stays confidential and is only used to prepare
          recommendations for your business.
        </p>
      }
    />
  );
}
