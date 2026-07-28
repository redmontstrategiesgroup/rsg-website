import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { canViewBilling } from "@/lib/lifecycle/access";
import { PortalShell } from "@/components/portal/PortalShell";
import { listInvoices, listPaymentsForClient } from "@/lib/lifecycle/billing";
import { formatInvoiceNumber, invoiceBalanceCents } from "@/lib/lifecycle/billing-shared";
import { formatCents } from "@/lib/lifecycle/types";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusPill,
} from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Billing | Client Portal",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  const ctx = await requirePortalPage();
  if (!canViewBilling(ctx.user.role)) redirect("/portal");

  // Tolerate a not-yet-migrated database — render calm empty states.
  const [invoices, payments] = await Promise.all([
    listInvoices({ clientId: ctx.client.id, limit: 100 }).catch(() => []),
    listPaymentsForClient(ctx.client.id).catch(() => []),
  ]);
  const visible = invoices.filter((i) => i.status !== "draft");
  const outstanding = visible.filter((i) => ["open", "processing"].includes(i.status));
  const outstandingCents = outstanding.reduce((sum, i) => sum + invoiceBalanceCents(i), 0);
  const paidCents = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_cents - p.refunded_cents, 0);

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Billing"
        title="Invoices & payments"
        description="Every invoice, payment, and receipt in one place. Card details never touch our systems — payments run through Stripe's secure checkout."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Outstanding balance"
          value={formatCents(outstandingCents)}
          tone={outstandingCents > 0 ? "warning" : "success"}
          sub={outstanding.length > 0 ? `${outstanding.length} open invoice${outstanding.length === 1 ? "" : "s"}` : "All settled"}
        />
        <StatCard label="Paid to date" value={formatCents(paidCents)} />
      </div>

      <div className="mt-6">
        <SectionCard title="Invoices" padded={false}>
          {visible.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Deposits, milestone payments, and any recurring services appear here with clear statuses."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                    <th className="px-5 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visible.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-5 py-3 font-mono text-xs text-white/60">
                        {formatInvoiceNumber(invoice.number)}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-white/75">
                        {invoice.description}
                      </td>
                      <td className="px-4 py-3 text-white">{formatCents(invoice.total_cents)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={invoice.status} />
                      </td>
                      <td className="px-4 py-3 text-white/55">
                        {invoice.due_at
                          ? new Date(invoice.due_at).toLocaleDateString("en-US", { dateStyle: "medium" })
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {["open", "processing"].includes(invoice.status) && (
                          <a
                            href={`/pay/${invoice.token}`}
                            className="link-underline text-xs text-crimson-light"
                          >
                            Pay now
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {payments.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Payment history" padded={false}>
            <ul className="divide-y divide-white/[0.06]">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm text-white/80">
                      {formatCents(p.amount_cents)}
                      {p.method_summary && (
                        <span className="ml-2 text-xs text-white/40">{p.method_summary}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-white/35">
                      {p.received_at
                        ? new Date(p.received_at).toLocaleDateString("en-US", { dateStyle: "long" })
                        : new Date(p.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
                      {p.provider !== "stripe" && ` · recorded ${p.provider}`}
                      {p.refunded_cents > 0 && ` · ${formatCents(p.refunded_cents)} refunded`}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </PortalShell>
  );
}
