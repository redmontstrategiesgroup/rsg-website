"use client";

import { Check } from "lucide-react";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import {
  COMPARISON_CATEGORIES,
  comparisonCell,
} from "@/lib/managed-services/content";

function Cell({ plan, categoryKey }: { plan: ManagedServicePlan; categoryKey: string }) {
  const cell = comparisonCell(plan.comparison[categoryKey]);
  if (!cell.included) {
    return (
      <span aria-label="Not included" className="text-white/25">
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-2">
      <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-crimson-light" />
      {cell.label ? (
        <span className="text-[0.82rem] leading-snug text-white/65">
          {cell.label}
        </span>
      ) : (
        <span className="sr-only">Included</span>
      )}
    </span>
  );
}

/**
 * Plan comparison: real table on md+ with a sticky first column,
 * stacked per-plan cards on mobile.
 */
export function ComparisonTable({ plans }: { plans: ManagedServicePlan[] }) {
  return (
    <div>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <caption className="sr-only">
            Managed-service plan comparison by category
          </caption>
          <thead>
            <tr className="border-b border-white/10">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-base py-4 pr-6 align-bottom text-xs font-medium uppercase tracking-[0.14em] text-white/35"
              >
                Category
              </th>
              {plans.map((plan) => (
                <th
                  scope="col"
                  key={plan.id}
                  className={`px-4 py-4 align-bottom ${
                    plan.recommended ? "bg-crimson/[0.06]" : ""
                  }`}
                >
                  <span className="display block text-base text-white">
                    {plan.name}
                  </span>
                  {plan.recommended ? (
                    <span className="mt-1.5 inline-flex border border-crimson/45 bg-crimson/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-crimson-light">
                      Recommended
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_CATEGORIES.map((category) => (
              <tr key={category.key} className="border-b border-white/[0.06]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-base py-4 pr-6 align-top font-normal"
                >
                  <span className="block text-sm text-white/70">
                    {category.label}
                  </span>
                  {category.hint ? (
                    <span className="mt-0.5 block text-xs text-white/35">
                      {category.hint}
                    </span>
                  ) : null}
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.id}
                    className={`px-4 py-4 align-top text-sm ${
                      plan.recommended ? "bg-crimson/[0.06]" : ""
                    }`}
                  >
                    <Cell plan={plan} categoryKey={category.key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked per-plan cards */}
      <div className="space-y-4 md:hidden">
        {plans.map((plan) => (
          <section
            key={plan.id}
            aria-label={`${plan.name} plan comparison`}
            className={`border p-5 ${
              plan.recommended
                ? "border-crimson/45 bg-crimson/[0.05]"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="display text-lg text-white">{plan.name}</h3>
              {plan.recommended ? (
                <span className="mt-0.5 inline-flex shrink-0 border border-crimson/45 bg-crimson/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-crimson-light">
                  Recommended
                </span>
              ) : null}
            </div>
            <dl className="mt-4 space-y-3">
              {COMPARISON_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs uppercase tracking-[0.12em] text-white/40">
                    {category.label}
                  </dt>
                  <dd className="text-right text-sm text-white/65">
                    <Cell plan={plan} categoryKey={category.key} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
