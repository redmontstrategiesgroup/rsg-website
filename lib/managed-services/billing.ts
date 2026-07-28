/**
 * Stripe billing integration (server-only).
 *
 * Everything here is gated on STRIPE_SECRET_KEY. When Stripe is not
 * configured the rest of the managed-services system still works — plans,
 * subscriptions, requests, and reporting run on manual/invoiced billing and
 * the UI hides online-payment actions.
 *
 * Prices are always resolved server-side from the plan/subscription rows.
 * Nothing pricing-related is ever trusted from the client.
 */

import Stripe from "stripe";
import type { BillingFrequency, ManagedServicePlan } from "./types";

let cachedStripe: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return cachedStripe;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Find or create the Stripe customer for a portal client. */
export async function ensureStripeCustomer(input: {
  clientId: string;
  email: string;
  name: string;
  company?: string;
  existingCustomerId?: string | null;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  if (input.existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(input.existingCustomerId);
      if (customer && !customer.deleted) return customer.id;
    } catch {
      // Fall through and create a fresh customer.
    }
  }

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: {
      rsg_client_id: input.clientId,
      rsg_company: input.company ?? "",
    },
  });
  return customer.id;
}

/**
 * Find or create the Stripe product for a plan. Products are keyed by
 * metadata so re-pricing in the admin portal never orphans them.
 */
async function ensurePlanProduct(
  stripe: Stripe,
  planKey: string,
  planName: string
): Promise<string> {
  try {
    const found = await stripe.products.search({
      query: `metadata['rsg_plan_key']:'${planKey.replace(/'/g, "")}' AND active:'true'`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
  } catch {
    // Search unavailable on some accounts — fall back to list + filter.
    try {
      const all = await stripe.products.list({ limit: 100, active: true });
      const match = all.data.find((p) => p.metadata?.rsg_plan_key === planKey);
      if (match) return match.id;
    } catch {
      // Fall through to create.
    }
  }
  const product = await stripe.products.create({
    name: `RSG Managed Services — ${planName}`,
    metadata: { rsg_plan_key: planKey },
  });
  return product.id;
}

export type SubscriptionCheckoutInput = {
  customerId: string;
  clientId: string;
  subscriptionId: string;
  plan: Pick<ManagedServicePlan, "key" | "name">;
  billingFrequency: BillingFrequency;
  /** Recurring amount in cents for the chosen frequency. */
  recurringAmountCents: number;
  setupFeeCents?: number;
  proposalId?: string | null;
};

/**
 * Create a Stripe Checkout session for a managed-service subscription.
 * Setup/onboarding fees ride along as a one-time line item on the first
 * invoice. The payment method is saved for automatic renewal invoicing.
 */
export async function createSubscriptionCheckout(
  input: SubscriptionCheckoutInput
): Promise<{ url: string; sessionId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (input.recurringAmountCents <= 0) {
    throw new Error("Recurring amount must be positive for checkout.");
  }

  const productId = await ensurePlanProduct(stripe, input.plan.key, input.plan.name);
  const interval: "month" | "year" =
    input.billingFrequency === "annual" ? "year" : "month";

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        product: productId,
        recurring: { interval },
        unit_amount: input.recurringAmountCents,
      },
    },
  ];
  if (input.setupFeeCents && input.setupFeeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        product_data: { name: `${input.plan.name} — onboarding & setup` },
        unit_amount: input.setupFeeCents,
      },
    });
  }

  const metadata: Record<string, string> = {
    rsg_client_id: input.clientId,
    rsg_subscription_id: input.subscriptionId,
    rsg_plan_key: input.plan.key,
  };
  if (input.proposalId) metadata.rsg_proposal_id = input.proposalId;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items: lineItems,
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: false,
    billing_address_collection: "auto",
    success_url: `${siteUrl()}/portal?billing=success`,
    cancel_url: `${siteUrl()}/portal?billing=cancelled`,
  });
  if (!session.url) return null;
  return { url: session.url, sessionId: session.id };
}

/** One-time payment checkout (implementation deposits, setup fees). */
export async function createOneTimeCheckout(input: {
  customerId?: string | null;
  customerEmail?: string;
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  if (input.amountCents <= 0) {
    throw new Error("Amount must be positive for checkout.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(input.customerId
      ? { customer: input.customerId }
      : input.customerEmail
        ? { customer_email: input.customerEmail }
        : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: input.description },
          unit_amount: input.amountCents,
        },
      },
    ],
    metadata: input.metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) return null;
  return { url: session.url, sessionId: session.id };
}

let cachedPortalConfigId: string | null = null;

/**
 * Find or create a restricted billing-portal configuration: payment-method
 * updates and invoice history only. Cancellation and plan changes are
 * deliberately disabled — those flow through our own portal actions, which
 * enforce the business-critical managed-transition guard. The account's
 * default portal configuration may allow self-serve cancellation, which
 * would bypass that guard.
 */
async function ensureRestrictedPortalConfiguration(
  stripe: Stripe
): Promise<string | null> {
  if (cachedPortalConfigId) return cachedPortalConfigId;
  try {
    const existing = await stripe.billingPortal.configurations.list({
      limit: 100,
    });
    const match = existing.data.find(
      (c) => c.active && c.metadata?.rsg_portal === "client_restricted"
    );
    if (match) {
      cachedPortalConfigId = match.id;
      return match.id;
    }
    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Redmont Strategies Group — managed services billing",
      },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
      },
      metadata: { rsg_portal: "client_restricted" },
    });
    cachedPortalConfigId = created.id;
    return created.id;
  } catch (err) {
    console.warn(
      "[billing] restricted portal configuration unavailable — falling back to the account default.",
      err
    );
    return null;
  }
}

/** Stripe-hosted billing portal (payment methods, invoices). */
export async function createBillingPortalSession(
  customerId: string
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const configuration = await ensureRestrictedPortalConfiguration(stripe);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/portal`,
    ...(configuration ? { configuration } : {}),
  });
  return session.url;
}

/**
 * Change the recurring price on an existing Stripe subscription
 * (upgrade/downgrade), prorated. Amount comes from the server-side plan row.
 */
export async function changeStripeSubscriptionPrice(input: {
  stripeSubscriptionId: string;
  plan: Pick<ManagedServicePlan, "key" | "name">;
  billingFrequency: BillingFrequency;
  recurringAmountCents: number;
}): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const sub = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error("Stripe subscription has no items.");

  const productId = await ensurePlanProduct(stripe, input.plan.key, input.plan.name);
  const interval: "month" | "year" =
    input.billingFrequency === "annual" ? "year" : "month";

  await stripe.subscriptions.update(input.stripeSubscriptionId, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: "usd",
          product: productId,
          recurring: { interval },
          unit_amount: input.recurringAmountCents,
        },
      },
    ],
    proration_behavior: "create_prorations",
    metadata: { rsg_plan_key: input.plan.key },
  });
}

/** Set or clear cancel-at-period-end on a Stripe subscription. */
export async function setStripeCancelAtPeriodEnd(
  stripeSubscriptionId: string,
  cancel: boolean
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");
  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: cancel,
  });
}

/** Immediately cancel a Stripe subscription (admin only). */
export async function cancelStripeSubscriptionNow(
  stripeSubscriptionId: string
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");
  await stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Verify and parse a webhook payload. Signature verification (with Stripe's
 * built-in timestamp tolerance) plus our subscription_events unique
 * stripe_event_id claim give replay protection.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    throw new Error("Stripe webhook is not configured.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Human-readable payment method summary for display ("Visa •••• 4242"). */
export async function describeDefaultPaymentMethod(
  customerId: string
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) return "";
  try {
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    const card = methods.data[0]?.card;
    if (!card) return "";
    const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
    return `${brand} •••• ${card.last4}`;
  } catch {
    return "";
  }
}
