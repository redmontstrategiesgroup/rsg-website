"use client";

/**
 * Proposal acceptance form (client side of the public proposal page).
 * Display-only pricing — the accept endpoint re-resolves every amount
 * server-side from the proposal/plan rows.
 */

import { useMemo, useState } from "react";
import { postJson } from "@/lib/api";
import { annualPriceCents, formatCents } from "@/lib/managed-services/content";
import type { BillingFrequency, ProposalKind } from "@/lib/managed-services/types";

export type ProposalPlanCard = {
  id: string;
  key: string;
  name: string;
  tagline: string;
  features: string[];
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  annualDiscountPct: number;
  customPricing: boolean;
  supportLevel: string;
  responseTime: string;
  minimumCommitmentMonths: number;
  cancellationTerms: string;
  businessCritical: boolean;
};

export type ProposalViewModel = {
  token: string;
  kind: ProposalKind;
  title: string;
  status: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  expired: boolean;
  acceptable: boolean;
  stripeConfigured: boolean;
  billingFrequency: BillingFrequency;
  /** Proposal-level price overrides (apply to the primary plan only). */
  proposalMonthlyPriceCents: number | null;
  proposalAnnualPriceCents: number | null;
  primaryPlan: ProposalPlanCard | null;
  alternativePlans: ProposalPlanCard[];
  hasImplementationScope: boolean;
  hasPlanScope: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProposalView({ vm }: { vm: ProposalViewModel }) {
  const plans = useMemo(
    () =>
      [vm.primaryPlan, ...vm.alternativePlans].filter(
        (p): p is ProposalPlanCard => p != null
      ),
    [vm.primaryPlan, vm.alternativePlans]
  );

  const implementationOnly = vm.kind === "implementation";
  const planOnly = vm.kind === "monthly_service";

  const [acceptImplementation, setAcceptImplementation] = useState(
    vm.hasImplementationScope
  );
  const [acceptPlan, setAcceptPlan] = useState(vm.hasPlanScope);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    vm.primaryPlan?.id ?? plans[0]?.id ?? ""
  );
  const [frequency, setFrequency] = useState<BillingFrequency>(
    vm.billingFrequency
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [authority, setAuthority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [accepted, setAccepted] = useState<{ depositUrl?: string } | null>(null);

  const monthlyFor = (plan: ProposalPlanCard): number | null =>
    (plan.id === vm.primaryPlan?.id ? vm.proposalMonthlyPriceCents : null) ??
    plan.monthlyPriceCents;

  const annualFor = (plan: ProposalPlanCard): number | null => {
    if (plan.id === vm.primaryPlan?.id && vm.proposalAnnualPriceCents != null) {
      return vm.proposalAnnualPriceCents;
    }
    return annualPriceCents({
      monthlyPriceCents: monthlyFor(plan),
      annualPriceCents: plan.annualPriceCents,
      annualDiscountPct: plan.annualDiscountPct,
      customPricing: plan.customPricing,
    });
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const annualAvailable = selectedPlan ? annualFor(selectedPlan) != null : false;
  const effectiveFrequency: BillingFrequency = annualAvailable
    ? frequency
    : "monthly";

  // -------------------------------------------------------------------------
  // Closed states — banner only, no form.
  // -------------------------------------------------------------------------
  if (declined || vm.status === "declined") {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-6">
        <p className="text-sm text-white/70">
          This proposal has been declined
          {vm.declinedAt ? ` on ${formatDate(vm.declinedAt)}` : ""}. If that was
          a mistake or you&apos;d like to revisit it, just reach out and
          we&apos;ll reopen the conversation.
        </p>
      </div>
    );
  }

  if (vm.status === "accepted") {
    return (
      <div className="border border-emerald-500/25 bg-emerald-500/[0.06] p-6">
        <p className="text-sm text-emerald-200/90">
          Accepted{vm.acceptedAt ? ` on ${formatDate(vm.acceptedAt)}` : ""}.
          We&apos;ll be in touch within one business day to begin onboarding.
        </p>
      </div>
    );
  }

  if (!vm.acceptable) {
    return (
      <div className="border border-amber-500/25 bg-amber-500/[0.06] p-6">
        <p className="text-sm text-amber-200/90">
          This proposal has expired. Contact us and we&apos;ll prepare an
          updated version for you.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Success panel (accepted just now, no checkout redirect).
  // -------------------------------------------------------------------------
  if (accepted) {
    return (
      <div className="border border-emerald-500/25 bg-emerald-500/[0.06] p-6">
        <p className="text-sm text-emerald-200/90">
          Agreement accepted — we&apos;ll be in touch within one business day.
        </p>
        {accepted.depositUrl ? (
          <a
            href={accepted.depositUrl}
            className="btn-primary mt-5 text-xs uppercase tracking-[0.14em]"
          >
            Pay implementation deposit
          </a>
        ) : null}
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="border border-white/10 bg-white/[0.02] p-6">
        <p className="text-sm text-white/70">Redirecting to secure checkout…</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Acceptance form
  // -------------------------------------------------------------------------
  async function handleAccept() {
    setError(null);
    if (!acceptImplementation && !acceptPlan) {
      setError("Select at least one part of the proposal to accept.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!authority) {
      setError("Please confirm you have authority to accept this agreement.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await postJson(`/api/proposals/${vm.token}/accept`, {
        name: name.trim(),
        email: email.trim(),
        acceptImplementation,
        acceptPlan,
        ...(acceptPlan && selectedPlanId ? { planId: selectedPlanId } : {}),
        ...(acceptPlan ? { billingFrequency: effectiveFrequency } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
        depositUrl?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (data.checkoutUrl) {
        setRedirecting(true);
        window.location.assign(data.checkoutUrl);
        return;
      }
      setAccepted({ depositUrl: data.depositUrl });
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (
      !window.confirm(
        "Decline this proposal? You can always reach out later if you change your mind."
      )
    ) {
      return;
    }
    try {
      const res = await postJson(`/api/proposals/${vm.token}/decline`, {});
      if (res.ok) {
        setDeclined(true);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not decline the proposal. Please try again.");
      }
    } catch {
      setError("Could not decline the proposal. Please try again.");
    }
  }

  return (
    <div className="border border-white/10 bg-white/[0.02] p-6 sm:p-8">
      <span className="label">Accept this proposal</span>

      {/* Scope selection */}
      <div className="mt-6 space-y-3">
        {vm.hasImplementationScope ? (
          <label
            className={`flex items-start gap-3 border border-white/10 p-4 ${
              implementationOnly ? "opacity-80" : "cursor-pointer hover:border-white/25"
            }`}
          >
            <input
              type="checkbox"
              checked={acceptImplementation}
              disabled={implementationOnly}
              onChange={(e) => setAcceptImplementation(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-white"
            />
            <span className="text-sm text-white/80">
              {vm.kind === "project_completion"
                ? "Confirm the completed implementation work"
                : "Accept the one-time implementation work"}
            </span>
          </label>
        ) : null}
        {vm.hasPlanScope && plans.length > 0 ? (
          <label
            className={`flex items-start gap-3 border border-white/10 p-4 ${
              planOnly ? "opacity-80" : "cursor-pointer hover:border-white/25"
            }`}
          >
            <input
              type="checkbox"
              checked={acceptPlan}
              disabled={planOnly}
              onChange={(e) => setAcceptPlan(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-white"
            />
            <span className="text-sm text-white/80">
              Start the ongoing management plan
            </span>
          </label>
        ) : null}
      </div>

      {/* Plan choice */}
      {acceptPlan && plans.length > 0 ? (
        <div className="mt-8">
          <span className="label">Choose your plan</span>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const monthly = monthlyFor(plan);
              const selected = plan.id === selectedPlanId;
              return (
                <label
                  key={plan.id}
                  className={`cursor-pointer border p-5 transition-colors ${
                    selected
                      ? "border-white/40 bg-white/[0.04]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="proposal-plan"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setSelectedPlanId(plan.id)}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-white">
                      {plan.name}
                    </span>
                    {plan.id === vm.primaryPlan?.id ? (
                      <span className="text-[0.62rem] uppercase tracking-[0.18em] text-white/40">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {plan.tagline}
                  </p>
                  <p className="mt-3 text-sm text-white/85">
                    {plan.customPricing || monthly == null
                      ? "Custom pricing"
                      : `${formatCents(monthly)} / month`}
                  </p>
                </label>
              );
            })}
          </div>

          {/* Billing frequency */}
          {annualAvailable && selectedPlan ? (
            <div className="mt-6">
              <span className="label">Billing</span>
              <div className="mt-3 inline-flex border border-white/10">
                {(["monthly", "annual"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`px-5 py-2.5 text-xs uppercase tracking-[0.14em] transition-colors ${
                      effectiveFrequency === f
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {f === "monthly"
                      ? `Monthly${
                          monthlyFor(selectedPlan) != null
                            ? ` — ${formatCents(monthlyFor(selectedPlan)!)}/mo`
                            : ""
                        }`
                      : `Annual — ${formatCents(annualFor(selectedPlan)!)}/yr`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Identity */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="proposal-name"
            className="block text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/40"
          >
            Full name
          </label>
          <input
            id="proposal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="mt-2 w-full border border-white/15 bg-transparent px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
            placeholder="Your name"
          />
        </div>
        <div>
          <label
            htmlFor="proposal-email"
            className="block text-[0.68rem] font-medium uppercase tracking-[0.22em] text-white/40"
          >
            Email
          </label>
          <input
            id="proposal-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full border border-white/15 bg-transparent px-4 py-3 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
            placeholder="you@company.com"
          />
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={authority}
          onChange={(e) => setAuthority(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-white"
        />
        <span className="text-sm text-white/70">
          I have authority to accept this agreement
        </span>
      </label>

      {error ? (
        <p className="mt-5 border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200/90">
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={handleAccept}
          disabled={submitting}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Accepting…" : "Accept proposal"}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="text-xs text-white/35 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/60"
        >
          Decline this proposal
        </button>
      </div>
    </div>
  );
}
