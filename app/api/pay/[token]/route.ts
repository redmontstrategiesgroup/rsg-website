import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createStripeCheckout,
  formatInvoiceNumber,
  getInvoiceByToken,
  invoiceBalanceCents,
  stripeEnabled,
} from "@/lib/lifecycle/billing";
import { invoiceContact } from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  }
  if (!(await rateLimit(`pay-get:${clientIp(request)}`, 60, 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice || invoice.status === "draft") {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({
    invoice: {
      number: formatInvoiceNumber(invoice.number),
      kind: invoice.kind,
      status: invoice.status,
      description: invoice.description,
      lineItems: invoice.line_items,
      subtotalCents: invoice.subtotal_cents,
      taxCents: invoice.tax_cents,
      totalCents: invoice.total_cents,
      amountPaidCents: invoice.amount_paid_cents,
      balanceCents: invoiceBalanceCents(invoice),
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
    },
    stripeEnabled: stripeEnabled(),
  });
}

const postSchema = z.object({ action: z.literal("checkout") });

export async function POST(request: Request, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available right now." }, { status: 503 });
  }
  if (!(await rateLimit(`pay-post:${clientIp(request)}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice || invoice.status === "draft") {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  try {
    postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "This invoice is already paid." }, { status: 409 });
  }
  if (invoice.status === "void" || invoice.status === "refunded") {
    return NextResponse.json(
      { error: `This invoice is ${invoice.status}.` },
      { status: 409 },
    );
  }
  if (!stripeEnabled()) {
    return NextResponse.json(
      {
        error:
          "Online payment isn't enabled yet. Reply to the invoice email and we'll arrange bank transfer or another method.",
      },
      { status: 503 },
    );
  }

  try {
    const contact = await invoiceContact(invoice);
    const checkout = await createStripeCheckout(invoice, {
      customerEmail: contact?.email,
    });
    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (error) {
    console.error("[pay] checkout create failed", error);
    return NextResponse.json(
      { error: "We couldn't start the secure checkout. Please try again." },
      { status: 500 },
    );
  }
}
