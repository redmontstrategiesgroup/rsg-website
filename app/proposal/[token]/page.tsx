/**
 * Public tokenized proposal page — a standalone document (outside the
 * marketing layout group, so no Navbar/Footer). Everything shown here is
 * resolved server-side from the proposal and plan rows; the client component
 * only collects the acceptance.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProposalByToken,
  markProposalViewed,
  proposalIsAcceptable,
  proposalIsExpired,
} from "@/lib/managed-services/proposals";
import { getPlanById } from "@/lib/managed-services/store";
import { isStripeConfigured } from "@/lib/managed-services/billing";
import { annualPriceCents, formatCents } from "@/lib/managed-services/content";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import {
  ProposalView,
  type ProposalPlanCard,
  type ProposalViewModel,
} from "@/components/proposals/ProposalView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { token: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  return {
    title:
      proposal && proposal.status !== "draft"
        ? `${proposal.title} — Redmont Strategies Group`
        : "Proposal — Redmont Strategies Group",
    robots: { index: false, follow: false },
  };
}

function toCard(plan: ManagedServicePlan): ProposalPlanCard {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    tagline: plan.tagline,
    features: plan.features,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    annualDiscountPct: plan.annualDiscountPct,
    customPricing: plan.customPricing,
    supportLevel: plan.supportLevel,
    responseTime: plan.responseTime,
    minimumCommitmentMonths: plan.minimumCommitmentMonths,
    cancellationTerms: plan.cancellationTerms,
    businessCritical: plan.businessCritical,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function PlanCard({
  plan,
  recommended,
}: {
  plan: ProposalPlanCard;
  recommended: boolean;
}) {
  return (
    <div
      className={`border p-6 ${
        recommended
          ? "border-white/25 bg-white/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium text-white">{plan.name}</h3>
        {recommended ? (
          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-white/40">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{plan.tagline}</p>
      <p className="mt-4 text-lg text-white">
        {plan.customPricing || plan.monthlyPriceCents == null
          ? "Custom pricing"
          : `${formatCents(plan.monthlyPriceCents)} / month`}
      </p>
      <ul className="mt-5 space-y-2 border-t border-white/10 pt-5">
        {plan.features.slice(0, 6).map((feature) => (
          <li key={feature} className="flex gap-2 text-sm text-white/55">
            <span aria-hidden className="text-white/30">
              —
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-white/40">
        {plan.supportLevel}
        {plan.responseTime ? ` · ${plan.responseTime}` : ""}
      </p>
    </div>
  );
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal || proposal.status === "draft") notFound();

  try {
    await markProposalViewed(proposal);
  } catch (err) {
    console.warn("[proposal-page] markProposalViewed failed.", err);
  }

  const primary = proposal.planId ? await getPlanById(proposal.planId) : null;
  const alternatives = (
    await Promise.all(proposal.alternativePlanIds.map((id) => getPlanById(id)))
  ).filter((p): p is ManagedServicePlan => p != null && p.active);

  const hasImplementationScope = [
    "implementation",
    "implementation_plus_monthly",
    "project_completion",
  ].includes(proposal.kind);
  const hasPlanScope =
    [
      "monthly_service",
      "implementation_plus_monthly",
      "project_completion",
    ].includes(proposal.kind) &&
    (primary != null || alternatives.length > 0);

  const expired = proposalIsExpired(proposal);
  const acceptable = proposalIsAcceptable(proposal);

  const vm: ProposalViewModel = {
    token: proposal.token,
    kind: proposal.kind,
    title: proposal.title,
    status: proposal.status,
    acceptedAt: proposal.acceptedAt,
    declinedAt: proposal.declinedAt,
    expired,
    acceptable,
    stripeConfigured: isStripeConfigured(),
    billingFrequency: proposal.billingFrequency,
    proposalMonthlyPriceCents: proposal.monthlyPriceCents,
    proposalAnnualPriceCents: proposal.annualPriceCents,
    primaryPlan: primary ? toCard(primary) : null,
    alternativePlans: alternatives.map(toCard),
    hasImplementationScope,
    hasPlanScope,
  };

  const impl = proposal.implementation;
  const isCompletion = proposal.kind === "project_completion";

  // Recurring pricing summary — proposal-level overrides win.
  const monthlyDisplay = proposal.monthlyPriceCents ?? primary?.monthlyPriceCents ?? null;
  const annualDisplay =
    proposal.annualPriceCents ??
    (primary
      ? annualPriceCents({
          monthlyPriceCents: monthlyDisplay,
          annualPriceCents: primary.annualPriceCents,
          annualDiscountPct: primary.annualDiscountPct,
          customPricing: primary.customPricing,
        })
      : null);
  const annualSavings =
    monthlyDisplay != null && annualDisplay != null
      ? monthlyDisplay * 12 - annualDisplay
      : null;
  const setupFee = proposal.setupFeeCents || primary?.setupFeeCents || 0;
  const includedSupport = proposal.includedSupport || primary?.supportLevel || "";
  const serviceLevel = proposal.serviceLevel || primary?.responseTime || "";
  const commitmentMonths =
    proposal.minimumCommitmentMonths || primary?.minimumCommitmentMonths || 0;
  const cancellationTerms = primary?.cancellationTerms ?? "";

  const pricingRows: [string, string][] = [
    [
      "Monthly investment",
      monthlyDisplay != null ? `${formatCents(monthlyDisplay)} / month` : "Custom pricing",
    ],
    ...(annualDisplay != null
      ? ([
          [
            "Annual option",
            `${formatCents(annualDisplay)} / year${
              annualSavings != null && annualSavings > 0
                ? ` — save ${formatCents(annualSavings)}`
                : ""
            }`,
          ],
        ] as [string, string][])
      : []),
    ["Setup & onboarding", setupFee > 0 ? formatCents(setupFee) : "Included"],
    ...(includedSupport ? ([["Included support", includedSupport]] as [string, string][]) : []),
    ...(serviceLevel ? ([["Service level", serviceLevel]] as [string, string][]) : []),
    ...(commitmentMonths > 0
      ? ([["Minimum commitment", `${commitmentMonths} months`]] as [string, string][])
      : []),
    ...(cancellationTerms
      ? ([["Cancellation terms", cancellationTerms]] as [string, string][])
      : []),
  ];

  return (
    <div className="min-h-screen bg-base text-white">
      {/* Minimal standalone top bar */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <span className="text-sm font-medium tracking-[0.14em] text-white uppercase">
            Redmont Strategies Group
          </span>
          <span className="text-xs text-white/40">
            Prepared for {proposal.preparedFor || "you"}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10 sm:pt-20">
        {/* Title */}
        <span className="label">Proposal</span>
        <h1 className="display mt-5 text-3xl sm:text-4xl">{proposal.title}</h1>
        {proposal.summary ? (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55">
            {proposal.summary}
          </p>
        ) : null}

        {expired ? (
          <p className="mt-6 border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/90">
            This proposal expired
            {proposal.validUntil ? ` on ${formatDate(proposal.validUntil)}` : ""}.
            Contact us for an updated version.
          </p>
        ) : proposal.validUntil ? (
          <p className="mt-6 text-xs uppercase tracking-[0.14em] text-white/35">
            This proposal is valid through {formatDate(proposal.validUntil)}
          </p>
        ) : null}

        {/* Implementation scope */}
        {hasImplementationScope ? (
          <section className="mt-14 border-t border-white/10 pt-10">
            <span className="label">
              {isCompletion ? "What was delivered" : "Implementation"}
            </span>

            {!isCompletion && impl.summary ? (
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/55">
                {impl.summary}
              </p>
            ) : null}

            {(isCompletion ? impl.delivered : impl.items)?.length ? (
              <div className="mt-6 space-y-4">
                {(isCompletion ? impl.delivered! : impl.items!).map((item) => (
                  <div
                    key={item.title}
                    className="border border-white/10 bg-white/[0.02] p-5"
                  >
                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                    {item.detail ? (
                      <p className="mt-2 text-sm leading-relaxed text-white/55">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!isCompletion && impl.timeline ? (
              <p className="mt-6 text-sm text-white/55">
                <span className="text-white/40">Timeline — </span>
                {impl.timeline}
              </p>
            ) : null}

            {isCompletion && impl.ownershipNotes ? (
              <div className="mt-10">
                <span className="label">Ownership &amp; responsibilities</span>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
                  {impl.ownershipNotes}
                </p>
              </div>
            ) : null}

            {isCompletion ? (
              <div className="mt-10">
                <span className="label">What happens without ongoing management</span>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
                  Without an active management plan, software updates, security
                  patching, backups, uptime monitoring, and ongoing improvements
                  become your responsibility. Systems age without them —
                  dependencies fall behind, integrations drift, and small issues
                  compound over time into outages and rework.
                </p>
              </div>
            ) : null}

            {(impl.costCents ?? 0) > 0 || (impl.depositCents ?? 0) > 0 ? (
              <dl className="mt-10 divide-y divide-white/10 border border-white/10 bg-white/[0.02]">
                {(impl.costCents ?? 0) > 0 ? (
                  <div className="flex items-baseline justify-between gap-4 px-5 py-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/40">
                      One-time implementation cost
                    </dt>
                    <dd className="text-sm text-white">
                      {formatCents(impl.costCents!)}
                    </dd>
                  </div>
                ) : null}
                {(impl.depositCents ?? 0) > 0 ? (
                  <div className="flex items-baseline justify-between gap-4 px-5 py-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/40">
                      Deposit due to begin
                    </dt>
                    <dd className="text-sm text-white">
                      {formatCents(impl.depositCents!)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>
        ) : null}

        {/* Recurring scope */}
        {hasPlanScope ? (
          <section className="mt-14 border-t border-white/10 pt-10">
            <span className="label">Recommended monthly plan</span>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {vm.primaryPlan ? (
                <PlanCard plan={vm.primaryPlan} recommended />
              ) : null}
              {vm.alternativePlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} recommended={false} />
              ))}
            </div>

            <dl className="mt-8 divide-y divide-white/10 border border-white/10 bg-white/[0.02]">
              {pricingRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4"
                >
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/40">
                    {label}
                  </dt>
                  <dd className="text-sm text-white/85">{value}</dd>
                </div>
              ))}
            </dl>

            {proposal.addons.length > 0 ? (
              <div className="mt-10">
                <span className="label">Available add-ons</span>
                <ul className="mt-4 space-y-3">
                  {proposal.addons.map((addon) => (
                    <li
                      key={addon.key || addon.name}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border border-white/10 bg-white/[0.02] px-5 py-4"
                    >
                      <div>
                        <p className="text-sm text-white">{addon.name}</p>
                        {addon.description ? (
                          <p className="mt-1 text-xs text-white/45">
                            {addon.description}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm text-white/70">
                        {addon.monthlyPriceCents != null
                          ? `${formatCents(addon.monthlyPriceCents)} / month`
                          : "Quoted"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {proposal.contractTerms ? (
              <div className="mt-10">
                <span className="label">Contract terms</span>
                <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-white/55">
                  {proposal.contractTerms}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Acceptance */}
        <section className="mt-14 border-t border-white/10 pt-10">
          <ProposalView vm={vm} />
        </section>
      </main>
    </div>
  );
}
