"use client";

import { useState } from "react";
import { AutomationFlow } from "./sections";
import type { IndustryConfig } from "./types";

/**
 * Landing-page automation builder preview — the flow re-renders per
 * selected industry so visitors see the system adapt to their world.
 */
export function BuilderShowcase({ configs }: { configs: IndustryConfig[] }) {
  const [activeSlug, setActiveSlug] = useState(configs[0]?.slug);
  const active = configs.find((c) => c.slug === activeSlug) ?? configs[0];

  return (
    <div className="rounded-xl border border-white/10 bg-base-900/60">
      <div
        className="flex overflow-x-auto border-b border-white/[0.08] no-scrollbar"
        role="tablist"
        aria-label="Select an industry workflow"
      >
        {configs.map((c) => {
          const selected = c.slug === active.slug;
          return (
            <button
              key={c.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveSlug(c.slug)}
              className={`whitespace-nowrap border-b-2 px-5 py-3.5 text-xs transition-colors focus:outline-none focus-visible:bg-white/[0.05] ${
                selected
                  ? "border-crimson text-white"
                  : "border-transparent text-white/45 hover:text-white/80"
              }`}
            >
              {c.industry}
            </button>
          );
        })}
      </div>
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-xs text-white/45">
          <span className="font-medium text-white/70">{active.builderFlow.title}</span> — the same
          engine, configured for {active.industry.toLowerCase()}.
        </p>
        <AutomationFlow flow={active.builderFlow} />
      </div>
    </div>
  );
}
