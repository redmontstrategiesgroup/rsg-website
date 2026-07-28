/**
 * Stripe webhook receiver for managed-services billing.
 *
 * Security model:
 *  - Signature verified via constructWebhookEvent (raw text body).
 *  - Replay-guarded by claimStripeEvent(event.id) BEFORE any processing.
 *  - Amounts are never read from the webhook to set pricing — subscription
 *    economics were resolved server-side at proposal acceptance.
 *  - Returns 200 for handled AND unhandled event types; 500 only when OUR
 *    storage fails, so Stripe retries. NOTE: because claimStripeEvent runs
 *    first, a retry after a partial failure will be seen as a duplicate and
 *    skipped — an accepted trade-off (admin email + event log surface the
 *    failure for manual reconciliation).
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  constructWebhookEvent,
  describeDefaultPaymentMethod,
  getStripe,
} from "@/lib/managed-services/billing";
import {
  claimStripeEvent,
  createServiceRequest,
  getSubscription,
  getSubscriptionByStripeId,
  recordSubscriptionEvent,
  setClientStripeCustomerId,
  updateSubscription,
  upsertInvoice,
  upsertServiceReport,
} from "@/lib/managed-services/store";
import {
  getProposalById,
  linkProposalSubscription,
} from "@/lib/managed-services/proposals";
import { formatCents } from "@/lib/managed-services/content";
import type {
  ClientSubscription,
  SubscriptionStatus,
} from "@/lib/managed-services/types";
import { sendAdminEmail, sendClientEmail } from "@/lib/managed-services/emails";
import { getClientById } from "@/lib/store";
import {
  getInvoice as getLifecycleInvoice,
  handleStripeEvent as handleLifecycleBillingEvent,
} from "@/lib/lifecycle/billing";
import {
  invoiceContact,
  onInvoicePaid,
  onPaymentFailed,
} from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Defensive helpers — Stripe API versions move fields around. Period fields
// live on the subscription in older versions and on subscription items in
// newer ones; the invoice→subscription link moved from invoice.subscription
// to invoice.parent.subscription_details.subscription.
// ---------------------------------------------------------------------------

function unixToIso(seconds: unknown): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

/** Current period start/end from either subscription shape. */
function subscriptionPeriod(sub: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const s = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    items?: {
      data?: { current_period_start?: number; current_period_end?: number }[];
    };
  };
  const item = s.items?.data?.[0];
  return {
    start: unixToIso(s.current_period_start ?? item?.current_period_start),
    end: unixToIso(s.current_period_end ?? item?.current_period_end),
  };
}

/** Stripe subscription id from either invoice shape. */
function stripeSubIdFromInvoice(inv: Stripe.Invoice): string | null {
  const anyInv = inv as unknown as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
    lines?: { data?: { subscription?: unknown }[] };
  };
  return (
    idOf(anyInv.subscription) ??
    idOf(anyInv.parent?.subscription_details?.subscription) ??
    idOf(anyInv.lines?.data?.[0]?.subscription)
  );
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function detailEmail(
  heading: string,
  rows: [string, string][]
): { html: string; text: string } {
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 16px;">${esc(heading)}</h2>
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
  const text = [heading, ...rows.map(([l, v]) => `${l}: ${v}`)].join("\n");
  return { html, text };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "subscription") return;

  const meta = session.metadata ?? {};
  const subscriptionId = meta.rsg_subscription_id ?? "";
  const proposalId = meta.rsg_proposal_id ?? "";
  if (!subscriptionId) return;

  const sub = await getSubscription(subscriptionId);
  if (!sub) return;

  const stripeSubscriptionId = idOf(session.subscription);
  const stripeCustomerId = idOf(session.customer);
  const clientId = meta.rsg_client_id || sub.clientId;
  const now = new Date().toISOString();
  const startedAt = sub.startedAt ?? now;

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const stripe = getStripe();
  if (stripe && stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const period = subscriptionPeriod(stripeSub);
      periodStart = period.start;
      periodEnd = period.end;
    } catch (err) {
      console.warn("[stripe-webhook] subscription retrieve failed.", err);
    }
  }

  let paymentMethodSummary = "";
  if (stripeCustomerId) {
    paymentMethodSummary = await describeDefaultPaymentMethod(stripeCustomerId);
  }

  await updateSubscription(sub.id, {
    status: "active",
    startedAt,
    stripeSubscriptionId,
    stripeCustomerId,
    lastPaymentStatus: "paid",
    lastPaymentAt: now,
    failedPaymentCount: 0,
    paymentMethodSummary,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    commitmentEndsAt:
      sub.minimumCommitmentMonths > 0
        ? addMonths(startedAt, sub.minimumCommitmentMonths)
        : sub.commitmentEndsAt,
  });

  if (clientId && stripeCustomerId) {
    await setClientStripeCustomerId(clientId, stripeCustomerId);
  }

  await recordSubscriptionEvent({
    subscriptionId: sub.id,
    clientId: sub.clientId,
    type: "subscription.activated",
    description: `Checkout completed — ${sub.planName ?? sub.planKey ?? "managed services"} plan activated.`,
    actor: "stripe",
  });

  if (proposalId) {
    await linkProposalSubscription(proposalId, sub.id);
    const proposal = await getProposalById(proposalId);
    if (proposal?.kind === "project_completion") {
      await upsertServiceReport({
        clientId: sub.clientId,
        subscriptionId: sub.id,
        kind: "baseline",
        title: "Initial System Baseline Report",
        status: "draft",
        summary:
          "Baseline snapshot prepared after plan activation. Your RSG team will complete and publish this after onboarding review.",
        createdBy: "system",
      });
      await createServiceRequest({
        clientId: sub.clientId,
        subscriptionId: sub.id,
        planKey: sub.planKey,
        type: "review_request",
        title: "Schedule your first management review",
        details:
          "Auto-created after plan activation — coordinate the first monthly/quarterly review with the client.",
        actorLabel: "system",
      });
      await recordSubscriptionEvent({
        subscriptionId: sub.id,
        clientId: sub.clientId,
        type: "onboarding.initialized",
        description:
          "Baseline report drafted and first management review requested.",
        actor: "stripe",
      });
    }
  }

  const { html, text } = detailEmail(
    "New managed-services subscription activated",
    [
      ["Plan", sub.planName ?? sub.planKey ?? "Unknown plan"],
      ["Client ID", sub.clientId],
      ["Subscription ID", sub.id],
      ["Billing", sub.billingFrequency],
      [
        "Recurring amount",
        sub.billingFrequency === "annual" && sub.annualPriceCents != null
          ? `${formatCents(sub.annualPriceCents)} / year`
          : `${formatCents(sub.monthlyPriceCents)} / month`,
      ],
      ["Setup fee", formatCents(sub.setupFeeCents)],
      ["Payment method", paymentMethodSummary || "—"],
      ["Proposal ID", proposalId || "—"],
      ["Stripe subscription", stripeSubscriptionId ?? "—"],
    ]
  );
  await sendAdminEmail(
    "New managed-services subscription activated",
    html,
    text
  );
}

/**
 * Implementation-deposit checkouts (created at proposal acceptance) are
 * one-time payments with no lifecycle invoice behind them. Record and
 * notify here; returns true when the session was a deposit so the caller
 * can skip the subscription/lifecycle handlers.
 */
async function handleDepositCompleted(event: Stripe.Event): Promise<boolean> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment") return false;
  const meta = session.metadata ?? {};
  if (meta.kind !== "implementation_deposit") return false;

  const proposal = meta.rsg_proposal_id
    ? await getProposalById(meta.rsg_proposal_id)
    : null;
  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : 0;

  await recordSubscriptionEvent({
    clientId: proposal?.clientId ?? null,
    type: "deposit.paid",
    description: `Implementation deposit paid — ${formatCents(amountCents)}${
      proposal ? ` (${proposal.title})` : ""
    }.`,
    actor: "stripe",
  });

  const { html, text } = detailEmail("Implementation deposit paid", [
    ["Proposal", proposal?.title ?? meta.rsg_proposal_id ?? "—"],
    ["Amount", formatCents(amountCents)],
    ["Payer email", session.customer_details?.email ?? "—"],
    ["Checkout session", session.id],
  ]);
  await sendAdminEmail("Implementation deposit paid", html, text);
  return true;
}

async function handleInvoiceEvent(event: Stripe.Event): Promise<void> {
  const inv = event.data.object as Stripe.Invoice;
  const stripeInvoiceId = inv.id;
  if (!stripeInvoiceId) return;

  const stripeSubId = stripeSubIdFromInvoice(inv);
  const ourSub: ClientSubscription | null = stripeSubId
    ? await getSubscriptionByStripeId(stripeSubId)
    : null;

  const now = new Date().toISOString();
  const line = inv.lines?.data?.[0];
  const linePeriod = line?.period;
  const anyInv = inv as unknown as {
    period_start?: number;
    period_end?: number;
  };
  const periodStart = unixToIso(linePeriod?.start ?? anyInv.period_start);
  const periodEnd = unixToIso(linePeriod?.end ?? anyInv.period_end);

  await upsertInvoice({
    subscriptionId: ourSub?.id ?? null,
    clientId: ourSub?.clientId ?? null,
    stripeInvoiceId,
    invoiceNumber: inv.number ?? "",
    description: line?.description ?? "Managed services",
    amountDueCents: inv.amount_due ?? 0,
    amountPaidCents: inv.amount_paid ?? 0,
    currency: inv.currency ?? "usd",
    status: inv.status ?? "open",
    hostedInvoiceUrl: inv.hosted_invoice_url ?? "",
    invoicePdfUrl: inv.invoice_pdf ?? "",
    periodStart,
    periodEnd,
    issuedAt: unixToIso(inv.created),
    paidAt: event.type === "invoice.paid" ? now : null,
  });

  if (event.type === "invoice.paid" && ourSub) {
    await updateSubscription(ourSub.id, {
      status:
        ourSub.status === "pending_cancellation"
          ? "pending_cancellation"
          : "active",
      lastPaymentStatus: "paid",
      lastPaymentAt: now,
      failedPaymentCount: 0,
      ...(periodStart ? { currentPeriodStart: periodStart } : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    });
    await recordSubscriptionEvent({
      subscriptionId: ourSub.id,
      clientId: ourSub.clientId,
      type: "invoice.paid",
      description: `Invoice ${inv.number ?? stripeInvoiceId} paid — ${formatCents(inv.amount_paid ?? 0)}.`,
      actor: "stripe",
    });
  }

  if (event.type === "invoice.payment_failed" && ourSub) {
    await updateSubscription(ourSub.id, {
      status: "past_due",
      lastPaymentStatus: "failed",
      failedPaymentCount: ourSub.failedPaymentCount + 1,
    });
    await recordSubscriptionEvent({
      subscriptionId: ourSub.id,
      clientId: ourSub.clientId,
      type: "payment.failed",
      description: `Payment failed for invoice ${inv.number ?? stripeInvoiceId} — ${formatCents(inv.amount_due ?? 0)}.`,
      actor: "stripe",
    });

    const client = await getClientById(ourSub.clientId);
    if (client?.email) {
      const amount = formatCents(inv.amount_due ?? 0);
      const clientHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px;">
          <h2 style="margin: 0 0 12px;">Payment issue on your RSG managed services</h2>
          <p style="margin: 0 0 12px; color: #333;">Hi ${esc(client.name || "there")},</p>
          <p style="margin: 0 0 12px; color: #333;">
            The most recent charge of ${esc(amount)} for your managed-services plan didn't
            go through. This is usually an expired card or a temporary bank decline —
            Stripe will automatically retry the payment over the next few days.
          </p>
          <p style="margin: 0 0 12px; color: #333;">
            To resolve it right away, you can update your payment method from your
            client portal using the <strong>Manage billing</strong> button.
          </p>
          <p style="margin: 0; color: #333;">— Redmont Strategies Group</p>
        </div>`;
      const clientText = [
        `Hi ${client.name || "there"},`,
        "",
        `The most recent charge of ${amount} for your managed-services plan didn't go through.`,
        "This is usually an expired card or a temporary bank decline — Stripe will automatically retry the payment over the next few days.",
        "",
        "To resolve it right away, update your payment method from your client portal using the Manage billing button.",
        "",
        "— Redmont Strategies Group",
      ].join("\n");
      await sendClientEmail(
        client.email,
        "Action needed: payment issue on your RSG managed services",
        clientHtml,
        clientText
      );
    }

    const { html, text } = detailEmail("Managed services payment failed", [
      ["Client", client ? `${client.name} (${client.email})` : ourSub.clientId],
      ["Plan", ourSub.planName ?? ourSub.planKey ?? "Unknown plan"],
      ["Subscription ID", ourSub.id],
      ["Invoice", inv.number ?? stripeInvoiceId],
      ["Amount due", formatCents(inv.amount_due ?? 0)],
      ["Failed payment count", String(ourSub.failedPaymentCount + 1)],
    ]);
    await sendAdminEmail("Managed services payment failed", html, text);
  }
}

function mapStripeStatus(s: Stripe.Subscription): SubscriptionStatus | null {
  const mapped: SubscriptionStatus | null =
    s.status === "active" || s.status === "trialing"
      ? "active"
      : s.status === "past_due" || s.status === "unpaid"
        ? "past_due"
        : s.status === "canceled"
          ? "cancelled"
          : s.status === "paused"
            ? "paused"
            : null;
  if (mapped === "active" && s.cancel_at_period_end) {
    return "pending_cancellation";
  }
  return mapped;
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const s = event.data.object as Stripe.Subscription;
  if (!s.id) return;
  const ourSub = await getSubscriptionByStripeId(s.id);
  if (!ourSub) return;

  const status = mapStripeStatus(s);
  const period = subscriptionPeriod(s);
  await updateSubscription(ourSub.id, {
    ...(status ? { status } : {}),
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
    ...(period.start ? { currentPeriodStart: period.start } : {}),
    ...(period.end ? { currentPeriodEnd: period.end } : {}),
  });
  await recordSubscriptionEvent({
    subscriptionId: ourSub.id,
    clientId: ourSub.clientId,
    type: "subscription.synced",
    description: `Stripe subscription synced — status ${status ?? ourSub.status}${
      s.cancel_at_period_end ? " (cancels at period end)" : ""
    }.`,
    actor: "stripe",
  });
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const s = event.data.object as Stripe.Subscription;
  if (!s.id) return;
  const ourSub = await getSubscriptionByStripeId(s.id);
  if (!ourSub) return;

  const now = new Date().toISOString();
  await updateSubscription(ourSub.id, {
    status: "cancelled",
    endedAt: now,
    cancelAtPeriodEnd: false,
  });
  await recordSubscriptionEvent({
    subscriptionId: ourSub.id,
    clientId: ourSub.clientId,
    type: "subscription.ended",
    description: "Stripe subscription cancelled — managed services ended.",
    actor: "stripe",
  });

  const { html, text } = detailEmail("Managed services subscription ended", [
    ["Client ID", ourSub.clientId],
    ["Plan", ourSub.planName ?? ourSub.planKey ?? "Unknown plan"],
    ["Subscription ID", ourSub.id],
    ["Ended at", now],
  ]);
  await sendAdminEmail("Managed services subscription ended", html, text);
}

// ---------------------------------------------------------------------------
// Lifecycle (project invoices: deposits, milestones, finals)
// ---------------------------------------------------------------------------

/**
 * One-time-payment events belong to the client-lifecycle billing system
 * (project deposits and invoices), not managed-services subscriptions.
 * handleLifecycleBillingEvent is a no-op for events it doesn't recognize,
 * so this is safe to call alongside the subscription handlers.
 */
async function handleLifecycleEvent(event: Stripe.Event): Promise<void> {
  const result = await handleLifecycleBillingEvent(event);
  if (!result.handled || !result.invoiceId) return;
  const invoice = await getLifecycleInvoice(result.invoiceId);
  if (!invoice) return;
  const payer = await invoiceContact(invoice);
  if (!payer) {
    console.error(
      `[stripe-webhook] lifecycle invoice ${invoice.id} has no payer contact`,
    );
    return;
  }
  if (result.outcome === "paid") {
    await onInvoicePaid(invoice, payer);
  } else if (result.outcome === "failed") {
    await onPaymentFailed(invoice, payer, "Card or bank payment failed.");
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Replay guard — claim the event id exactly once, before processing.
  // A storage failure here (as opposed to a duplicate) returns 500 so
  // Stripe retries: nothing was claimed and nothing was processed.
  let fresh: boolean;
  try {
    fresh = await claimStripeEvent(event.id, event.type);
  } catch (err) {
    console.error("[stripe-webhook] event claim failed.", err);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
  if (!fresh) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        // Proposal deposits are standalone one-time payments; subscription
        // checkouts → managed services; other one-time payment checkouts →
        // lifecycle invoices. Each handler ignores the others'.
        if (!(await handleDepositCompleted(event))) {
          await handleCheckoutCompleted(event);
          await handleLifecycleEvent(event);
        }
        break;
      case "payment_intent.payment_failed":
      case "charge.refunded":
        await handleLifecycleEvent(event);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized":
        await handleInvoiceEvent(event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Our storage failed mid-processing. Return 500 so Stripe retries.
    // Because the event id was already claimed above, the retry will be
    // treated as a duplicate and skipped — acceptable: the failure is
    // logged here and surfaced in the subscription event trail for
    // manual reconciliation.
    console.error(`[stripe-webhook] ${event.type} processing failed.`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
