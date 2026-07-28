/**
 * Client Lifecycle Platform — invoices, payments, and Stripe checkout.
 *
 * Stripe is integrated over raw REST (no SDK): checkout sessions are created
 * with a form-encoded POST, and webhooks are verified with the v1 signature
 * scheme (HMAC-SHA256 over "t.rawBody"). No card data ever touches this
 * module — Stripe hosts the payment page; we only store session/intent ids.
 */

import { links, newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type {
  Invoice,
  InvoiceKind,
  InvoiceLineItem,
  Payment,
  PaymentProvider,
} from "@/lib/lifecycle/types";

const STRIPE_API_BASE = "https://api.stripe.com";

// ---------------------------------------------------------------------------
// Formatting & math
// ---------------------------------------------------------------------------

/** Human-facing invoice number, e.g. number 7 → "RSG-1007". */
export function formatInvoiceNumber(n: number): string {
  return "RSG-" + String(1000 + n);
}

/** Remaining balance due on an invoice, never negative. */
export function invoiceBalanceCents(invoice: Invoice): number {
  return Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
}

function subtotalFromLineItems(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unit_cents),
    0
  );
}

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return (
    error.code === "23505" ||
    /duplicate key|payments_provider_ref_idx/i.test(error.message)
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(input: {
  clientId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  kind: InvoiceKind;
  description: string;
  lineItems: InvoiceLineItem[];
  taxCents?: number;
  dueAt?: string | null;
  createdBy?: string | null;
}): Promise<Invoice> {
  const sb = requireSupabase();
  const taxCents = Math.max(0, Math.round(input.taxCents ?? 0));
  const subtotal = subtotalFromLineItems(input.lineItems);
  const total = subtotal + taxCents;
  const now = nowIso();

  const { data, error } = await sb
    .from("invoices")
    .insert({
      client_id: input.clientId ?? null,
      opportunity_id: input.opportunityId ?? null,
      contract_id: input.contractId ?? null,
      project_id: input.projectId ?? null,
      token: newToken(),
      kind: input.kind,
      status: "open",
      currency: "usd",
      description: input.description,
      line_items: input.lineItems,
      subtotal_cents: subtotal,
      tax_cents: taxCents,
      total_cents: total,
      amount_paid_cents: 0,
      due_at: input.dueAt ?? null,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create invoice: ${error.message}`);
  return data as Invoice;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load invoice ${id}: ${error.message}`);
  return (data as Invoice) ?? null;
}

export async function getInvoiceByToken(token: string): Promise<Invoice | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    // Public page lookup: a query failure (e.g. migration not applied yet)
    // renders the friendly not-found state rather than the error boundary.
    console.warn(`getInvoiceByToken failed: ${error.message}`);
    return null;
  }
  return (data as Invoice) ?? null;
}

export async function listInvoices(filters: {
  clientId?: string;
  status?: Invoice["status"];
  kind?: InvoiceKind;
  limit?: number;
} = {}): Promise<Invoice[]> {
  const sb = requireSupabase();
  let query = sb
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list invoices: ${error.message}`);
  return (data ?? []) as Invoice[];
}

async function fetchInvoiceOrThrow(id: string): Promise<Invoice> {
  const invoice = await getInvoice(id);
  if (!invoice) throw new Error(`Invoice ${id} not found.`);
  return invoice;
}

export async function voidInvoice(id: string): Promise<Invoice> {
  const sb = requireSupabase();
  const invoice = await fetchInvoiceOrThrow(id);
  if (invoice.status === "paid" || invoice.status === "refunded") {
    throw new Error(`Invoice ${id} is ${invoice.status} and cannot be voided.`);
  }
  const { data, error } = await sb
    .from("invoices")
    .update({ status: "void", updated_at: nowIso() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to void invoice ${id}: ${error.message}`);
  return data as Invoice;
}

export async function updateInvoice(
  id: string,
  patch: {
    description?: string;
    lineItems?: InvoiceLineItem[];
    taxCents?: number;
    dueAt?: string | null;
    status?: "draft" | "open";
  }
): Promise<Invoice> {
  const sb = requireSupabase();
  const current = await fetchInvoiceOrThrow(id);
  if (
    current.status === "paid" ||
    current.status === "void" ||
    current.status === "refunded"
  ) {
    throw new Error(`Invoice ${id} is ${current.status} and cannot be edited.`);
  }

  const lineItems = patch.lineItems ?? current.line_items;
  const taxCents =
    patch.taxCents !== undefined
      ? Math.max(0, Math.round(patch.taxCents))
      : current.tax_cents;
  const subtotal = subtotalFromLineItems(lineItems);
  const total = subtotal + taxCents;

  const update: Record<string, unknown> = {
    line_items: lineItems,
    subtotal_cents: subtotal,
    tax_cents: taxCents,
    total_cents: total,
    updated_at: nowIso(),
  };
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await sb
    .from("invoices")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update invoice ${id}: ${error.message}`);
  return data as Invoice;
}

/**
 * Applies a successful payment amount to an invoice: bumps amount_paid_cents
 * and flips the invoice to paid (with paid_at) once the total is covered.
 */
async function applyPaymentToInvoice(
  invoice: Invoice,
  amountCents: number,
  extra: Record<string, unknown> = {}
): Promise<Invoice> {
  const sb = requireSupabase();
  const newPaid = invoice.amount_paid_cents + amountCents;
  const paidInFull = newPaid >= invoice.total_cents;
  const { data, error } = await sb
    .from("invoices")
    .update({
      amount_paid_cents: newPaid,
      status: paidInFull ? "paid" : "open",
      paid_at: paidInFull ? invoice.paid_at ?? nowIso() : invoice.paid_at,
      updated_at: nowIso(),
      ...extra,
    })
    .eq("id", invoice.id)
    .select("*")
    .single();
  if (error) {
    throw new Error(
      `Failed to apply payment to invoice ${invoice.id}: ${error.message}`
    );
  }
  return data as Invoice;
}

// ---------------------------------------------------------------------------
// Payments (manual / ACH / check) & refunds
// ---------------------------------------------------------------------------

export async function recordManualPayment(
  invoiceId: string,
  input: {
    provider: Exclude<PaymentProvider, "stripe">;
    providerRef?: string;
    amountCents: number;
    methodSummary?: string;
    recordedBy: string;
  }
): Promise<{ invoice: Invoice; payment: Payment }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Payment amount must be a positive integer of cents.");
  }
  const sb = requireSupabase();
  const invoice = await fetchInvoiceOrThrow(invoiceId);
  if (invoice.status === "void" || invoice.status === "refunded") {
    throw new Error(
      `Invoice ${invoiceId} is ${invoice.status}; payments cannot be recorded.`
    );
  }

  const { data: paymentData, error: paymentError } = await sb
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      provider: input.provider,
      provider_ref: input.providerRef ?? null,
      status: "succeeded",
      amount_cents: input.amountCents,
      currency: invoice.currency,
      method_summary: input.methodSummary ?? null,
      received_at: nowIso(),
      recorded_by: input.recordedBy,
    })
    .select("*")
    .single();
  if (paymentError) {
    throw new Error(
      `Failed to record payment on invoice ${invoiceId}: ${paymentError.message}`
    );
  }

  const updated = await applyPaymentToInvoice(invoice, input.amountCents);
  return { invoice: updated, payment: paymentData as Payment };
}

export async function recordRefund(
  paymentId: string,
  input: { amountCents: number; reason?: string }
): Promise<{ payment: Payment; invoice: Invoice | null }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Refund amount must be a positive integer of cents.");
  }
  const sb = requireSupabase();
  const { data: existing, error: loadError } = await sb
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (loadError) {
    throw new Error(`Failed to load payment ${paymentId}: ${loadError.message}`);
  }
  const payment = existing as Payment | null;
  if (!payment) throw new Error(`Payment ${paymentId} not found.`);
  if (
    payment.status !== "succeeded" &&
    payment.status !== "partially_refunded" &&
    payment.status !== "refunded"
  ) {
    throw new Error(
      `Payment ${paymentId} is ${payment.status} and cannot be refunded.`
    );
  }

  const remaining = payment.amount_cents - payment.refunded_cents;
  if (input.amountCents > remaining) {
    throw new Error(
      `Refund of ${input.amountCents} cents exceeds remaining refundable ${remaining} cents on payment ${paymentId}.`
    );
  }

  const newRefunded = payment.refunded_cents + input.amountCents;
  const fullyRefunded = newRefunded >= payment.amount_cents;
  const update: Record<string, unknown> = {
    refunded_cents: newRefunded,
    status: fullyRefunded ? "refunded" : "partially_refunded",
  };
  // The payments table has no dedicated refund-reason column; keep the note
  // in failure_reason (the only free-text status field) with a clear prefix.
  if (input.reason) update.failure_reason = `refund: ${input.reason}`;

  const { data: updatedPayment, error: updateError } = await sb
    .from("payments")
    .update(update)
    .eq("id", paymentId)
    .select("*")
    .single();
  if (updateError) {
    throw new Error(
      `Failed to record refund on payment ${paymentId}: ${updateError.message}`
    );
  }

  let invoice: Invoice | null = null;
  if (payment.invoice_id) {
    invoice = await getInvoice(payment.invoice_id);
    if (invoice) {
      const invoicePayments = await listPaymentsForInvoice(invoice.id);
      const totalCollected = invoicePayments
        .filter(
          (p) =>
            p.status === "succeeded" ||
            p.status === "refunded" ||
            p.status === "partially_refunded"
        )
        .reduce((sum, p) => sum + p.amount_cents, 0);
      const totalRefunded = invoicePayments.reduce(
        (sum, p) => sum + p.refunded_cents,
        0
      );
      if (totalCollected > 0 && totalRefunded >= totalCollected) {
        const { data: refundedInvoice, error: invoiceError } = await sb
          .from("invoices")
          .update({ status: "refunded", updated_at: nowIso() })
          .eq("id", invoice.id)
          .select("*")
          .single();
        if (invoiceError) {
          throw new Error(
            `Failed to mark invoice ${invoice.id} refunded: ${invoiceError.message}`
          );
        }
        invoice = refundedInvoice as Invoice;
      }
    }
  }

  return { payment: updatedPayment as Payment, invoice };
}

export async function listPaymentsForClient(clientId: string): Promise<Payment[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `Failed to list payments for client ${clientId}: ${error.message}`
    );
  }
  return (data ?? []) as Payment[];
}

export async function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `Failed to list payments for invoice ${invoiceId}: ${error.message}`
    );
  }
  return (data ?? []) as Payment[];
}

// ---------------------------------------------------------------------------
// Payment reminders
// ---------------------------------------------------------------------------

/**
 * Open invoices that are past due (or unpaid deposits, which are due on
 * receipt), still under the reminder cap, and not touched within the window.
 * Never-reminded invoices use created_at as the reference so a freshly
 * created invoice is not nagged immediately.
 */
export async function findInvoicesNeedingReminder(opts: {
  olderThanMinutes: number;
  maxReminders: number;
}): Promise<Invoice[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq("status", "open")
    .lt("reminder_count", opts.maxReminders)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    throw new Error(`Failed to find invoices needing reminder: ${error.message}`);
  }

  const now = Date.now();
  const cutoff = now - opts.olderThanMinutes * 60_000;
  return ((data ?? []) as Invoice[]).filter((invoice) => {
    if (invoiceBalanceCents(invoice) <= 0) return false;
    const pastDue =
      invoice.due_at !== null && Date.parse(invoice.due_at) < now;
    const unpaidDeposit = invoice.kind === "deposit";
    if (!pastDue && !unpaidDeposit) return false;
    const reference = invoice.last_reminded_at ?? invoice.created_at;
    return Date.parse(reference) < cutoff;
  });
}

export async function markInvoiceReminded(id: string): Promise<Invoice> {
  const sb = requireSupabase();
  const invoice = await fetchInvoiceOrThrow(id);
  const now = nowIso();
  const { data, error } = await sb
    .from("invoices")
    .update({
      reminder_count: invoice.reminder_count + 1,
      last_reminded_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to mark invoice ${id} reminded: ${error.message}`);
  }
  return data as Invoice;
}

// ---------------------------------------------------------------------------
// Stripe — checkout sessions (raw REST, form-encoded)
// ---------------------------------------------------------------------------

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripePost(
  path: string,
  params: [string, string][]
): Promise<Record<string, unknown>> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY is missing).");
  }
  const body = new URLSearchParams();
  for (const [key, value] of params) body.append(key, value);

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!response.ok) {
    const stripeError = payload?.error as
      | { message?: string; type?: string }
      | undefined;
    throw new Error(
      `Stripe ${path} failed (${response.status}): ${
        stripeError?.message || stripeError?.type || "unknown error"
      }`
    );
  }
  if (!payload) {
    throw new Error(`Stripe ${path} returned an unreadable response.`);
  }
  return payload;
}

export async function createStripeCheckout(
  invoice: Invoice,
  opts: { customerEmail?: string } = {}
): Promise<{ url: string; sessionId: string }> {
  const balance = invoiceBalanceCents(invoice);
  if (balance <= 0) {
    throw new Error(`Invoice ${invoice.id} has no balance due.`);
  }
  if (invoice.status !== "open" && invoice.status !== "processing") {
    throw new Error(
      `Invoice ${invoice.id} is ${invoice.status} and cannot be checked out.`
    );
  }

  const productName =
    invoice.description || `Invoice ${formatInvoiceNumber(invoice.number)}`;
  const payUrl = links.pay(invoice.token);

  const params: [string, string][] = [
    ["mode", "payment"],
    ["payment_method_types[0]", "card"],
    ["line_items[0][price_data][currency]", invoice.currency],
    ["line_items[0][price_data][product_data][name]", productName],
    ["line_items[0][price_data][unit_amount]", String(balance)],
    ["line_items[0][quantity]", "1"],
    ["success_url", `${payUrl}?paid=1`],
    ["cancel_url", payUrl],
    ["metadata[invoice_id]", invoice.id],
  ];
  if (process.env.STRIPE_ACH_ENABLED === "1") {
    params.splice(2, 0, ["payment_method_types[1]", "us_bank_account"]);
  }
  if (opts.customerEmail) params.push(["customer_email", opts.customerEmail]);

  const session = await stripePost("/v1/checkout/sessions", params);
  const sessionId = typeof session.id === "string" ? session.id : "";
  const url = typeof session.url === "string" ? session.url : "";
  if (!sessionId || !url) {
    throw new Error("Stripe checkout session response was missing id or url.");
  }

  const sb = requireSupabase();
  const { error } = await sb
    .from("invoices")
    .update({
      stripe_checkout_session_id: sessionId,
      status: "processing",
      updated_at: nowIso(),
    })
    .eq("id", invoice.id);
  if (error) {
    throw new Error(
      `Failed to persist checkout session on invoice ${invoice.id}: ${error.message}`
    );
  }

  return { url, sessionId };
}

// ---------------------------------------------------------------------------
// Stripe — event handling
// ---------------------------------------------------------------------------
// (Webhook signature verification lives in the live route via the Stripe SDK's
//  constructEvent — see app/api/stripe/webhook/route.ts. A hand-rolled verifier
//  formerly here was dead code and was removed. audit L5)

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function findInvoiceByColumn(
  column: "stripe_checkout_session_id" | "stripe_payment_intent_id",
  value: string
): Promise<Invoice | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up invoice by ${column}: ${error.message}`);
  }
  return (data as Invoice) ?? null;
}

/**
 * Processes a verified Stripe event. Idempotent: replayed events hit the
 * unique (provider, provider_ref) index and are treated as already handled.
 * Only ids are ever logged — never payloads.
 */
export async function handleStripeEvent(
  event: unknown
): Promise<{ handled: boolean; invoiceId?: string; outcome?: "paid" | "failed" | "refunded" }> {
  const shaped = event as {
    type?: unknown;
    data?: { object?: Record<string, unknown> };
  } | null;
  const type = asString(shaped?.type);
  const object = shaped?.data?.object;
  if (!type || !object || typeof object !== "object") {
    return { handled: false };
  }

  if (type === "checkout.session.completed") {
    return handleCheckoutCompleted(object);
  }
  if (type === "payment_intent.payment_failed") {
    return handlePaymentFailed(object);
  }
  if (type === "charge.refunded") {
    return handleChargeRefunded(object);
  }
  return { handled: false };
}

async function handleCheckoutCompleted(
  session: Record<string, unknown>
): Promise<{ handled: boolean; invoiceId?: string; outcome?: "paid" }> {
  const sb = requireSupabase();
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const metadataInvoiceId = asString(metadata.invoice_id);
  const sessionId = asString(session.id);
  const paymentIntentId = asString(session.payment_intent);

  let invoice: Invoice | null = null;
  if (metadataInvoiceId) invoice = await getInvoice(metadataInvoiceId);
  if (!invoice && sessionId) {
    invoice = await findInvoiceByColumn("stripe_checkout_session_id", sessionId);
  }
  if (!invoice) {
    console.error(
      "[billing] checkout.session.completed: no matching invoice",
      { sessionId, metadataInvoiceId }
    );
    return { handled: false };
  }

  const providerRef = paymentIntentId ?? sessionId;
  if (!providerRef) return { handled: false };

  const amountCents =
    typeof session.amount_total === "number" && session.amount_total > 0
      ? Math.round(session.amount_total)
      : invoiceBalanceCents(invoice);
  const methodTypes = Array.isArray(session.payment_method_types)
    ? session.payment_method_types.filter((t): t is string => typeof t === "string")
    : [];
  const currency = asString(session.currency) ?? invoice.currency;

  const { error: paymentError } = await sb
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      provider: "stripe",
      provider_ref: providerRef,
      status: "succeeded",
      amount_cents: amountCents,
      currency,
      method_summary: methodTypes.length > 0 ? methodTypes.join(", ") : null,
      received_at: nowIso(),
      recorded_by: null,
    })
    .select("id")
    .single();

  if (paymentError) {
    if (isUniqueViolation(paymentError)) {
      // Replayed webhook — this payment was already recorded.
      return { handled: true, invoiceId: invoice.id, outcome: "paid" };
    }
    throw new Error(
      `Failed to record Stripe payment for invoice ${invoice.id}: ${paymentError.message}`
    );
  }

  await applyPaymentToInvoice(invoice, amountCents, {
    stripe_payment_intent_id:
      paymentIntentId ?? invoice.stripe_payment_intent_id,
    stripe_checkout_session_id:
      invoice.stripe_checkout_session_id ?? sessionId,
  });

  return { handled: true, invoiceId: invoice.id, outcome: "paid" };
}

async function handlePaymentFailed(
  paymentIntent: Record<string, unknown>
): Promise<{ handled: boolean; invoiceId?: string; outcome?: "failed" }> {
  const sb = requireSupabase();
  const intentId = asString(paymentIntent.id);
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  const metadataInvoiceId = asString(metadata.invoice_id);

  let invoice: Invoice | null = null;
  if (metadataInvoiceId) invoice = await getInvoice(metadataInvoiceId);
  if (!invoice && intentId) {
    invoice = await findInvoiceByColumn("stripe_payment_intent_id", intentId);
  }
  if (!invoice || !intentId) {
    return { handled: false };
  }

  const lastError = paymentIntent.last_payment_error as
    | { message?: unknown }
    | undefined;
  const failureReason =
    asString(lastError?.message) ?? "Payment failed at the payment provider.";
  const amountCents =
    typeof paymentIntent.amount === "number"
      ? Math.round(paymentIntent.amount)
      : invoiceBalanceCents(invoice);

  const { error: paymentError } = await sb
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      provider: "stripe",
      provider_ref: intentId,
      status: "failed",
      amount_cents: amountCents,
      currency: asString(paymentIntent.currency) ?? invoice.currency,
      failure_reason: failureReason,
      recorded_by: null,
    })
    .select("id")
    .single();

  if (paymentError && !isUniqueViolation(paymentError)) {
    throw new Error(
      `Failed to record failed Stripe payment for invoice ${invoice.id}: ${paymentError.message}`
    );
  }

  // Re-open the invoice so the client can retry (never downgrade a paid one).
  if (invoice.status === "processing" || invoice.status === "open") {
    const { error: invoiceError } = await sb
      .from("invoices")
      .update({ status: "open", updated_at: nowIso() })
      .eq("id", invoice.id);
    if (invoiceError) {
      throw new Error(
        `Failed to reopen invoice ${invoice.id} after payment failure: ${invoiceError.message}`
      );
    }
  }

  return { handled: true, invoiceId: invoice.id, outcome: "failed" };
}

async function handleChargeRefunded(
  charge: Record<string, unknown>
): Promise<{ handled: boolean; invoiceId?: string; outcome?: "refunded" }> {
  const sb = requireSupabase();
  const refs = [asString(charge.payment_intent), asString(charge.id)].filter(
    (ref): ref is string => ref !== null
  );
  if (refs.length === 0) return { handled: false };

  const { data, error } = await sb
    .from("payments")
    .select("*")
    .eq("provider", "stripe")
    .in("provider_ref", refs)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to find payment for Stripe refund (${refs[0]}): ${error.message}`
    );
  }
  const payment = data as Payment | null;
  if (!payment) return { handled: false };

  const totalRefunded =
    typeof charge.amount_refunded === "number"
      ? Math.round(charge.amount_refunded)
      : 0;
  // amount_refunded is cumulative on the charge; apply only the delta so
  // webhook replays and successive partial refunds stay idempotent.
  const delta = Math.min(
    totalRefunded - payment.refunded_cents,
    payment.amount_cents - payment.refunded_cents
  );
  if (delta <= 0) {
    return {
      handled: true,
      invoiceId: payment.invoice_id ?? undefined,
      outcome: "refunded",
    };
  }

  const { invoice } = await recordRefund(payment.id, { amountCents: delta });
  return {
    handled: true,
    invoiceId: invoice?.id ?? payment.invoice_id ?? undefined,
    outcome: "refunded",
  };
}
