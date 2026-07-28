import type { Metadata } from "next";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { listTicketsForClient } from "@/lib/lifecycle/support";
import { listMessages } from "@/lib/lifecycle/workspace";
import { SupportView } from "@/components/portal/SupportView";
import { PageHeader } from "@/components/portal/ui";
import type { Message } from "@/lib/lifecycle/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support | Client Portal",
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  const ctx = await requirePortalPage();
  // Tolerate a not-yet-migrated database — render calm empty states.
  const tickets = await listTicketsForClient(ctx.client.id, { limit: 100 }).catch(
    () => [],
  );

  const threads: Record<string, Message[]> = {};
  await Promise.all(
    tickets.slice(0, 25).map(async (t) => {
      threads[t.id] = await listMessages(
        { ticketId: t.id },
        { includeInternal: false, limit: 100 },
      );
    }),
  );

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Something not working, or a question about your systems? Open a ticket and track it to resolution."
      />
      <SupportView tickets={tickets} threads={threads} userName={ctx.user.name} />
    </PortalShell>
  );
}
