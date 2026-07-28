"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import {
  annualPriceCents,
  formatCents,
  formatMonthlyPrice,
} from "@/lib/managed-services/content";

/**
 * A single managed-service plan rendered as a quiet agreement card.
 * Pricing always comes from the plan object — never hard-coded.
 */
export function PlanCard({
  plan,
  highlight = false,
}: {
  plan: ManagedServicePlan;
  highlight?: boolean;
}) {
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeId = useId();

  const annual = annualPriceCents(plan);
  const grossAnnual =
    plan.monthlyPriceCents != null ? plan.monthlyPriceCents * 12 : null;
  const savePct =
    annual != null && grossAnnual != null && grossAnnual > annual
      ? Math.round((1 - annual / grossAnnual) * 100)
      : null;

  const meta: { label: string; value: string }[] = [
    {
      label: "Included service hours",
      value:
        plan.includedHours != null
          ? `${plan.includedHours} hrs/mo`
          : "Custom — as agreed",
    },
    ...(plan.additionalHourlyRateCents != null
      ? [
          {
            label: "Additional work",
            value: `${formatCents(plan.additionalHourlyRateCents)}/hr`,
          },
        ]
      : []),
    {
      label: "Minimum commitment",
      value: `${plan.minimumCommitmentMonths} months`,
    },
    { label: "Cancellation", value: plan.cancellationTerms },
  ];

  return (
    <article
      className={`flex h-full flex-col border p-6 sm:p-7 ${
        highlight
          ? "border-crimson/45 bg-crimson/[0.05]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="display text-xl text-white">{plan.name}</h3>
        {plan.recommended ? (
          <span className="mt-0.5 inline-flex shrink-0 items-center border border-crimson/45 bg-crimson/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-crimson-light">
            Recommended
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/40">
        {plan.bestFit}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-white/55">
        {plan.description}
      </p>

      <div className="mt-6 border-t border-white/[0.08] pt-6">
        <p className="display text-[1.35rem] text-white">
          {formatMonthlyPrice(plan)}
        </p>
        {!plan.customPricing && annual != null ? (
          <p className="mt-1.5 text-xs text-white/40">
            or {formatCents(annual)}/yr
            {savePct != null && savePct > 0 ? ` — save ${savePct}%` : ""}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-white/60">{plan.supportLevel}</p>
        <p className="mt-1 text-xs text-white/40">{plan.responseTime}</p>
      </div>

      <ul className="mt-6 space-y-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="text-sm leading-relaxed text-white/60">
            <span className="mr-2 text-crimson-light">—</span>
            {feature}
          </li>
        ))}
      </ul>

      <dl className="mt-7 space-y-2.5 border-t border-white/[0.08] pt-6">
        {meta.map((item) => (
          <div key={item.label} className="text-xs leading-relaxed">
            <dt className="uppercase tracking-[0.14em] text-white/35">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-white/55">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <button
          type="button"
          aria-expanded={scopeOpen}
          aria-controls={scopeId}
          onClick={() => setScopeOpen((open) => !open)}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          {scopeOpen ? "Hide detailed scope" : "View detailed scope"}
          <ChevronDown
            size={15}
            aria-hidden
            className={`transition-transform duration-300 ${
              scopeOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <ul
          id={scopeId}
          hidden={!scopeOpen}
          className="mt-4 space-y-2 border-l border-white/[0.08] pl-4"
        >
          {plan.detailedScope.map((item) => (
            <li key={item} className="text-[0.83rem] leading-relaxed text-white/50">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-8">
        <Link
          href={`/book?plan=${plan.key}`}
          className="btn-primary w-full px-6 py-3.5 text-center"
        >
          {plan.customPricing ? "Request Custom Pricing" : `Choose ${plan.name}`}
        </Link>
      </div>
    </article>
  );
}
