import type { Metadata } from "next";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { listReports } from "@/lib/lifecycle/reporting";
import { periodLabel } from "@/lib/lifecycle/core";
import { ReportDetail } from "@/components/portal/ReportDetail";
import { EmptyState, PageHeader, SectionCard, StatusPill } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports | Client Portal",
  robots: { index: false, follow: false },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const ctx = await requirePortalPage();
  const { id } = await searchParams;

  // Tolerate a not-yet-migrated database — render calm empty states.
  const reports = (
    await listReports(ctx.client.id, { limit: 24 }).catch(() => [])
  ).filter((r) => r.status === "published");
  const selected = (id && reports.find((r) => r.id === id)) || reports[0];

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Performance"
        title="Monthly reports"
        description="What your systems produced, measured against your goals — with honest labels on every number."
      />

      {reports.length === 0 ? (
        <div className="card mt-8">
          <EmptyState
            title="Your first report is coming"
            description="Monthly performance reports appear here once your systems have been live long enough to measure honestly."
          />
        </div>
      ) : (
        <div className="mt-8 gap-6 lg:grid lg:grid-cols-[240px_1fr] lg:items-start">
          <div className="mb-6 lg:mb-0">
            <SectionCard padded={false}>
              <ul className="divide-y divide-white/[0.06]">
                {reports.map((r) => (
                  <li key={r.id}>
                    <a
                      href={`/portal/reports?id=${r.id}`}
                      className={`flex items-center justify-between gap-2 px-4 py-3 text-sm transition ${
                        selected?.id === r.id
                          ? "bg-crimson/[0.07] text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                    >
                      {periodLabel(r.period_month)}
                      <StatusPill status={r.status} />
                    </a>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
          {selected && <ReportDetail report={selected} periodLabelText={periodLabel(selected.period_month)} />}
        </div>
      )}
    </PortalShell>
  );
}
