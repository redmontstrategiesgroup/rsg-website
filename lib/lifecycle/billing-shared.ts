import type { Invoice } from "./types.ts";

/** Pure billing helpers safe for client components (no server imports). */

export function formatInvoiceNumber(n: number): string {
  return `RSG-${String(1000 + n)}`;
}

export function invoiceBalanceCents(invoice: Invoice): number {
  return Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
}
