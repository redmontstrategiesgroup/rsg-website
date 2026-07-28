"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { DEPLOYMENT_OPTIONS } from "@/lib/private-ai/content";
import type { DeploymentModelId } from "@/lib/private-ai/types";

const COMPARE_ROWS: {
  key: keyof (typeof DEPLOYMENT_OPTIONS)[number];
  label: string;
}[] = [
  { key: "privacy", label: "Privacy level" },
  { key: "ownership", label: "Infrastructure ownership" },
  { key: "internet", label: "Internet dependency" },
  { key: "scalability", label: "Scalability" },
  { key: "setup", label: "Estimated setup complexity" },
  { key: "maintenance", label: "Maintenance responsibility" },
  { key: "bestFit", label: "Best-fit business types" },
  { key: "pricing", label: "Investment" },
];

export function DeploymentCompare() {
  const [active, setActive] = useState<DeploymentModelId>("private_cloud");
  const current =
    DEPLOYMENT_OPTIONS.find((d) => d.id === active) ?? DEPLOYMENT_OPTIONS[2]!;

  return (
    <section id="deployment" className="scroll-mt-24 border-b border-white/[0.08]">
      <div className="container-px py-20 sm:py-28">
        <Reveal y={12}>
          <p className="label">Deployment options</p>
        </Reveal>
        <Reveal y={12} delay={0.06}>
          <h2 className="display mt-5 max-w-3xl text-[1.85rem] leading-tight sm:text-[2.4rem]">
            Choose how private your AI infrastructure needs to be.
          </h2>
        </Reveal>
        <Reveal y={12} delay={0.1}>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/50">
            Systems can run fully local on company-owned hardware, on-premise in
            your facility, inside your private cloud, in a secure RSG-managed
            environment, or as a hybrid. Fully isolated from public AI services
            when required.
          </p>
        </Reveal>

        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Deployment models">
          {DEPLOYMENT_OPTIONS.map((opt) => {
            const selected = opt.id === active;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(opt.id)}
                className={`rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                  selected
                    ? "border-crimson/45 bg-crimson/10 text-white"
                    : "border-white/10 text-white/50 hover:border-white/25 hover:text-white"
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>

        <Reveal y={12} delay={0.08} className="mt-8">
          <div
            role="tabpanel"
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
          >
            <h3 className="display text-2xl text-white">{current.name}</h3>
            <p className="mt-3 max-w-3xl text-[0.98rem] leading-relaxed text-white/55">
              {current.summary}
            </p>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                  Suitable for
                </p>
                <ul className="mt-3 space-y-2">
                  {current.suitable.map((item) => (
                    <li key={item} className="text-sm text-white/65">
                      <span className="mr-2 text-crimson-light">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="space-y-3">
                {COMPARE_ROWS.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-1 border-b border-white/[0.06] pb-3 sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/35">
                      {row.label}
                    </dt>
                    <dd className="text-sm text-white/70">
                      {String(current[row.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
