import type { Metadata } from "next";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { getClientTrainingView, trainingCompletionStats } from "@/lib/lifecycle/training";
import { TrainingView } from "@/components/portal/TrainingView";
import { PageHeader } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training | Client Portal",
  robots: { index: false, follow: false },
};

export default async function TrainingPage() {
  const ctx = await requirePortalPage();
  // Tolerate a not-yet-migrated database — render calm empty states.
  const [entries, stats] = await Promise.all([
    getClientTrainingView(ctx.client.id, ctx.user.id, ctx.user.role).catch(() => []),
    trainingCompletionStats(ctx.client.id).catch(() => ({
      assigned: 0,
      required: 0,
      completedRequired: 0,
      completedTotal: 0,
    })),
  ]);

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Training"
        title="Training library"
        description="Short, practical guides to the systems we've built for you — so your whole team runs them with confidence."
      />
      <TrainingView
        entries={entries.map((e) => ({
          item: e.item,
          required: e.required,
          completed: e.completed,
          dueAt: e.dueAt,
        }))}
        stats={stats}
      />
    </PortalShell>
  );
}
