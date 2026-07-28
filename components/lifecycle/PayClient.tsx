"use client";

import { useState } from "react";
import type { Invoice } from "@/lib/lifecycle/types";
import { formatCents } from "@/lib/lifecycle/types";
import { Banner, Button, MetaRow, StatusPill } from "@/components/portal/ui";
import { formatInvoiceNumber, invoiceBalanceCents } from "@/lib/lifecycle/billing-shared";
import { postJson } from "@/lib/api";

export function PayClient({
  token,
  invoice,
  stripeReady,
  justPaid,
}: {
  token: string;
  invoice: Invoice;
  stripeReady: boolean;
  justPaid: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = invoiceBalanceCents(invoice);
  const paid = invoice.status === "paid";
  const processing = invoice.status === "processing";

  async function checkout() {
    setError(null);
    setBusy(true);
    try {
      const res = await postJson(`/api/pay/${token}`, { action: "checkout" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Couldn't start checkout.");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {paid && (
        <Banner tone="success" title="Payment received — thank you.">
          A receipt is in your inbox
          {invoice.kind === "deposit" &&
            ", and your client portal welcome email follows shortly with your first steps"}
          .
        </Banner>
      )}
      {!paid && justPaid && (
        <Banner tone="info" title="Payment processing.">
          Your payment is being confirmed — this page updates automatically
          once the confirmation lands (usually under a minute). Your receipt
          arrives by email.
        </Banner>
      )}

      <div className="card px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              Invoice {formatInvoiceNumber(invoice.number)}
            </p>
            <p className="mt-1.5 text-sm text-white/80">{invoice.description}</p>
          </div>
          <StatusPill status={invoice.status} />
        </div>

        <div className="mt-5 space-y-1 border-t border-white/10 pt-4">
          {invoice.line_items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-sm text-white/65">
                {item.label}
                {item.detail && (
                  <span className="block text-xs text-white/35">{item.detail}</span>
                )}
              </span>
              <span className="shrink-0 text-sm text-white/85">
                {formatCents(item.unit_cents * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          {invoice.tax_cents > 0 && (
            <>
              <MetaRow label="Subtotal">{formatCents(invoice.subtotal_cents)}</MetaRow>
              <MetaRow label="Tax">{formatCents(invoice.tax_cents)}</MetaRow>
            </>
          )}
          <MetaRow label="Total">{formatCents(invoice.total_cents)}</MetaRow>
          {invoice.amount_paid_cents > 0 && (
            <MetaRow label="Paid">{formatCents(invoice.amount_paid_cents)}</MetaRow>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-3">
            <span className="text-sm text-white/60">Balance due</span>
            <span className="font-display text-2xl font-medium text-white">
              {formatCents(balance)}
            </span>
          </div>
          {invoice.due_at && !paid && (
            <p className="mt-2 text-right text-xs text-white/40">
              Due {new Date(invoice.due_at).toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          )}
        </div>

        {!paid && balance > 0 && (
          <div className="mt-6">
            {stripeReady ? (
              <>
                <Button className="w-full" onClick={checkout} busy={busy}>
                  Pay {formatCents(balance)} securely
                </Button>
                <p className="mt-3 text-center text-[0.65rem] leading-relaxed text-white/35">
                  Card and bank payments are processed by Stripe on a secure,
                  PCI-compliant page. Redmont never sees or stores your payment
                  details.
                </p>
              </>
            ) : (
              <Banner tone="info" title="Bank transfer / other arrangements">
                Online card payment isn&rsquo;t enabled for this invoice. Reply
                to the invoice email and we&rsquo;ll provide bank-transfer
                details or another arrangement — your project timeline is
                unaffected.
              </Banner>
            )}
            {processing && (
              <p className="mt-3 text-center text-xs text-white/45">
                A previous payment attempt is still confirming — if you already
                paid, no further action is needed.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-center text-xs text-crimson-light">
                {error}
              </p>
            )}
          </div>
        )}

        {paid && invoice.kind === "deposit" && (
          <div className="mt-6 text-center">
            <a href="/portal" className="btn-primary">
              Continue to your client portal
            </a>
          </div>
        )}
      </div>

      <p className="text-center text-[0.65rem] text-white/30">
        Questions about this invoice? Reply to the email it arrived in — a
        person answers, quickly.
      </p>
    </div>
  );
}
