import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { listRenewalsForClient, listExpansionItems } from "@/lib/lifecycle/growth";
import { EXPANSION_STATUS_LABELS } from "@/lib/lifecycle/types";
import { formatCents } from "@/lib/lifecycle/types";
import {
  EmptyState,
  MetaRow,
  PageHeader,
  SectionCard,
  StatusPill,
} from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap | Client Portal",
  robots: { index: false, follow: false },
};

export default async function RoadmapPage() {
  const ctx = await requirePortalPage();
  // Tolerate a not-yet-migrated database — render calm empty states.
  const [renewals, expansion] = await Promise.all([
    listRenewalsForClient(ctx.client.id).catch(() => []),
    listExpansionItems(ctx.client.id, {}).catch(() => []),
  ]);

  // Clients see recommendations that are at least at the "recommended" stage —
  // internal "identified" ideas stay internal until they're worth your time.
  const visibleExpansion = expansion.filter((e) => e.status !== "identified");
  const activeRenewals = renewals.filter((r) => !["lapsed", "cancelled"].includes(r.status));

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Strategic planning"
        title="Your roadmap"
        description="Where your systems go next — grounded in your actual results, discussed at your strategy reviews, never a sales pitch."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {visibleExpansion.length === 0 ? (
            <div className="card">
              <EmptyState
                title="Roadmap under construction"
                description="As your systems produce real data, we add recommended next steps here — each tied to a concrete business problem, with expected outcomes and honest investment ranges."
              />
            </div>
          ) : (
            visibleExpansion.map((item) => (
              <SectionCard
                key={item.id}
                title={item.title}
                actions={
                  <StatusPill status={item.status} label={EXPANSION_STATUS_LABELS[item.status]} />
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                      The problem
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/70">{item.problem}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/35">
                      What we recommend
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/70">{item.solution}</p>
                  </div>
                </div>
                {item.expected_outcome && (
                  <p className="mt-4 border-l-2 border-crimson/40 pl-3 text-sm leading-relaxed text-white/60">
                    Expected outcome: {item.expected_outcome}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.68rem] text-white/40">
                  <span>Priority: {item.priority}</span>
                  {item.timing && <span>Suggested timing: {item.timing}</span>}
                  {item.investment_range && <span>Investment: {item.investment_range}</span>}
                  {item.dependencies && <span>Depends on: {item.dependencies}</span>}
                </div>
              </SectionCard>
            ))
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="Renewals & reviews" eyebrow="Key dates">
            {activeRenewals.length === 0 ? (
              <p className="text-xs leading-relaxed text-white/40">
                Contract and subscription renewal dates appear here, with
                reminders well before anything renews.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {activeRenewals.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white/80">{r.name}</p>
                      <StatusPill status={r.status} />
                    </div>
                    <MetaRow label="Renews">
                      {new Date(r.renews_on).toLocaleDateString("en-US", { dateStyle: "long" })}
                    </MetaRow>
                    {r.value_cents != null && (
                      <MetaRow label="Value">{formatCents(r.value_cents)}</MetaRow>
                    )}
                    {r.term && <MetaRow label="Term">{r.term}</MetaRow>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Talk it through">
            <p className="text-xs leading-relaxed text-white/50">
              Roadmap items are decided together at your strategy reviews —
              nothing here moves forward without you.
            </p>
            <Link
              href="/book/client-strategy-call"
              className="btn-ghost mt-4 inline-flex !px-5 !py-2.5 text-sm"
            >
              Book a strategy call
            </Link>
          </SectionCard>
        </div>
      </div>
    </PortalShell>
  );
}
