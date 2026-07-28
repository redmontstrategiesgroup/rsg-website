/**
 * Public proposal acceptance endpoint.
 *
 * All amounts are resolved server-side from the proposal and plan rows —
 * the request body only carries identity, scope selection, plan choice
 * (validated against the proposal's own plan list), and billing frequency.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import {
  getProposalByToken,
  linkProposalSubscription,
  proposalIsAcceptable,
  recordProposalAcceptance,
} from "@/lib/managed-services/proposals";
import {
  createSubscription,
  getClientStripeCustomerId,
  getPlanById,
  recordSubscriptionEvent,
  setClientStripeCustomerId,
} from "@/lib/managed-services/store";
import {
  createOneTimeCheckout,
  createSubscriptionCheckout,
  ensureStripeCustomer,
  isStripeConfigured,
} from "@/lib/managed-services/billing";
import {
  annualPriceCents,
  formatCents,
} from "@/lib/managed-services/content";
import type { ClientSubscription } from "@/lib/managed-services/types";
import { sendAdminEmail } from "@/lib/managed-services/emails";
import { getClientById } from "@/lib/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  acceptImplementation: z.boolean(),
  acceptPlan: z.boolean(),
  planId: z.string().uuid().optional(),
  billingFrequency: z.enum(["monthly", "annual"]).optional(),
});

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const ip = clientIp(request);
  if (!(await rateLimit(`proposal-accept:${ip}`, 10, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  const { token } = await ctx.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your name and email and try again." },
      { status: 400 }
    );
  }
  const { name, email, acceptImplementation, acceptPlan, planId, billingFrequency } =
    parsed.data;

  const proposal = await getProposalByToken(token);
  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }
  if (!proposalIsAcceptable(proposal)) {
    return NextResponse.json(
      { error: "This proposal is no longer open." },
      { status: 409 }
    );
  }

  // Scope-by-kind validation.
  if (proposal.kind === "implementation" && acceptPlan) {
    return NextResponse.json(
      { error: "This proposal does not include a monthly plan." },
      { status: 400 }
    );
  }
  if (proposal.kind === "monthly_service" && acceptImplementation) {
    return NextResponse.json(
      { error: "This proposal does not include implementation work." },
      { status: 400 }
    );
  }
  if (!acceptImplementation && !acceptPlan) {
    return NextResponse.json(
      { error: "Select at least one part of the proposal to accept." },
      { status: 400 }
    );
  }

  // Plan resolution — economics come from the proposal/plan rows only.
  let chosenPlanId: string | null = null;
  let plan: Awaited<ReturnType<typeof getPlanById>> = null;
  let frequency: "monthly" | "annual" = proposal.billingFrequency;
  let monthly: number | null = null;
  let recurringAmount: number | null = null;
  let setupFee = 0;

  if (acceptPlan) {
    chosenPlanId = planId ?? proposal.planId;
    if (
      !chosenPlanId ||
      (chosenPlanId !== proposal.planId &&
        !proposal.alternativePlanIds.includes(chosenPlanId))
    ) {
      return NextResponse.json(
        { error: "That plan is not offered on this proposal." },
        { status: 400 }
      );
    }
    plan = await getPlanById(chosenPlanId);
    if (!plan || !plan.active) {
      return NextResponse.json(
        { error: "That plan is no longer available." },
        { status: 400 }
      );
    }

    frequency = billingFrequency ?? proposal.billingFrequency;
    monthly =
      (chosenPlanId === proposal.planId ? proposal.monthlyPriceCents : null) ??
      plan.monthlyPriceCents;
    recurringAmount =
      frequency === "annual"
        ? chosenPlanId === proposal.planId && proposal.annualPriceCents != null
          ? proposal.annualPriceCents
          : annualPriceCents({
              monthlyPriceCents: monthly,
              annualPriceCents: plan.annualPriceCents,
              annualDiscountPct: plan.annualDiscountPct,
              customPricing: plan.customPricing,
            })
        : monthly;
    setupFee = proposal.setupFeeCents || plan.setupFeeCents;
  }

  // Atomically claim the acceptance BEFORE creating subscriptions or
  // checkout sessions — a concurrent duplicate submission gets a 409 here
  // instead of a second subscription and a second Stripe checkout.
  const accepted = await recordProposalAcceptance({
    proposal,
    scope: {
      implementation: acceptImplementation,
      plan: acceptPlan,
      ...(acceptPlan && chosenPlanId ? { planId: chosenPlanId } : {}),
      ...(acceptPlan ? { billingFrequency: frequency } : {}),
    },
    name,
    email,
  });
  if (!accepted) {
    return NextResponse.json(
      { error: "This proposal is no longer open." },
      { status: 409 }
    );
  }

  let sub: ClientSubscription | null = null;
  let checkoutUrl: string | undefined;
  let checkoutFailed = false;

  if (acceptPlan && plan && chosenPlanId && proposal.clientId) {
    sub = await createSubscription({
      clientId: proposal.clientId,
      planId: chosenPlanId,
      status:
        isStripeConfigured() && recurringAmount ? "awaiting_payment" : "pending",
      billingFrequency: frequency,
      monthlyPriceCents: monthly ?? 0,
      annualPriceCents:
        frequency === "annual" ? recurringAmount : plan.annualPriceCents,
      setupFeeCents: setupFee,
      source: proposal.kind === "project_completion" ? "completion" : "proposal",
      proposalId: proposal.id,
    });

    if (sub) {
      // Link the subscription back onto the acceptance record.
      await linkProposalSubscription(proposal.id, sub.id);
      await recordSubscriptionEvent({
        subscriptionId: sub.id,
        clientId: proposal.clientId,
        type: "proposal.accepted",
        description: proposal.title,
        actor: `client:${email}`,
      });

      if (isStripeConfigured() && recurringAmount && !plan.customPricing) {
        try {
          const client = await getClientById(proposal.clientId);
          if (client) {
            const customerId = await ensureStripeCustomer({
              clientId: proposal.clientId,
              email: client.email,
              name: client.name,
              company: client.company,
              existingCustomerId: await getClientStripeCustomerId(
                proposal.clientId
              ),
            });
            if (customerId) {
              await setClientStripeCustomerId(proposal.clientId, customerId);
              const co = await createSubscriptionCheckout({
                customerId,
                clientId: proposal.clientId,
                subscriptionId: sub.id,
                plan: { key: plan.key, name: plan.name },
                billingFrequency: frequency,
                recurringAmountCents: recurringAmount,
                setupFeeCents: setupFee,
                proposalId: proposal.id,
              });
              checkoutUrl = co?.url;
            }
          }
        } catch (err) {
          // Keep the acceptance — admin follows up on billing manually.
          checkoutFailed = true;
          console.error("[proposals] Stripe checkout creation failed.", err);
        }
      }
    }
  }
  // Lead proposals (no clientId) create no subscription — admin follows up.

  let depositUrl: string | undefined;
  const depositCents = proposal.implementation.depositCents ?? 0;
  if (acceptImplementation && depositCents > 0 && isStripeConfigured()) {
    try {
      const site = siteUrl();
      const deposit = await createOneTimeCheckout({
        customerEmail: email,
        amountCents: depositCents,
        description: `${proposal.title} — implementation deposit`,
        metadata: { rsg_proposal_id: proposal.id, kind: "implementation_deposit" },
        successUrl: `${site}/proposal/${token}?deposit=paid`,
        cancelUrl: `${site}/proposal/${token}`,
      });
      depositUrl = deposit?.url;
    } catch (err) {
      console.error("[proposals] deposit checkout creation failed.", err);
    }
  }

  const rows: [string, string][] = [
    ["Proposal", proposal.title],
    ["Accepted by", `${name} (${email})`],
    ["Prepared for", proposal.preparedFor || "—"],
    ["Kind", proposal.kind.replaceAll("_", " ")],
    [
      "Scope accepted",
      [
        acceptImplementation ? "implementation" : null,
        acceptPlan ? "monthly plan" : null,
      ]
        .filter(Boolean)
        .join(" + ") || "—",
    ],
    ...(acceptImplementation
      ? ([
          [
            "One-time cost",
            proposal.implementation.costCents != null
              ? formatCents(proposal.implementation.costCents)
              : "—",
          ],
          ["Deposit", depositCents > 0 ? formatCents(depositCents) : "—"],
        ] as [string, string][])
      : []),
    ...(acceptPlan && plan
      ? ([
          ["Plan", plan.name],
          ["Billing", frequency],
          [
            "Recurring amount",
            recurringAmount != null
              ? `${formatCents(recurringAmount)} / ${frequency === "annual" ? "year" : "month"}`
              : "Custom pricing — set up billing manually",
          ],
          ["Setup fee", formatCents(setupFee)],
          ["Subscription created", sub ? sub.id : "No — lead proposal, follow up to onboard"],
          [
            "Next step",
            checkoutUrl
              ? "Client sent to Stripe checkout"
              : checkoutFailed
                ? "Stripe checkout FAILED — set up billing manually"
                : sub
                  ? "No online checkout — set up billing manually"
                  : "Create the client account, then set up their subscription",
          ],
        ] as [string, string][])
      : []),
  ];
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 16px;">Proposal accepted</h2>
      <table style="border-collapse: collapse; width: 100%;">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding: 8px 12px 8px 0; color: #888; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: top; white-space: nowrap;">${esc(label)}</td>
            <td style="padding: 8px 0; font-size: 15px; color: #111;">${esc(value)}</td>
          </tr>`
          )
          .join("")}
      </table>
    </div>`;
  const text = rows.map(([l, v]) => `${l}: ${v}`).join("\n");
  await sendAdminEmail(`Proposal accepted: ${proposal.title}`, html, text);

  return NextResponse.json({ ok: true, checkoutUrl, depositUrl });
}
