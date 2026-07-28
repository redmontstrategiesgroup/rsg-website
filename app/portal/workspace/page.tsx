import type { Metadata } from "next";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { listRequestsForClient, listMessages } from "@/lib/lifecycle/workspace";
import { listFilesFor } from "@/lib/lifecycle/files";
import { listProjectsForClient } from "@/lib/lifecycle/projects";
import { WorkspaceView } from "@/components/portal/WorkspaceView";
import { PageHeader } from "@/components/portal/ui";
import type { Message } from "@/lib/lifecycle/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Requests & Files | Client Portal",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage() {
  const ctx = await requirePortalPage();

  // Tolerate a not-yet-migrated database — render calm empty states.
  const [requests, files, projects] = await Promise.all([
    listRequestsForClient(ctx.client.id, { limit: 100 }).catch(() => []),
    listFilesFor({ clientId: ctx.client.id }, { limit: 100 }).catch(() => []),
    listProjectsForClient(ctx.client.id).catch(() => []),
  ]);

  // Threads for open requests (client-visible messages only — internal
  // notes are filtered at the query layer, never in the browser).
  const threads: Record<string, Message[]> = {};
  await Promise.all(
    requests.slice(0, 25).map(async (r) => {
      threads[r.id] = await listMessages(
        { requestId: r.id },
        { includeInternal: false, limit: 100 },
      );
    }),
  );

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Workspace"
        title="Requests, messages & files"
        description="One organized place for everything — no more digging through email threads or text messages."
      />
      <WorkspaceView
        requests={requests}
        threads={threads}
        files={files}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        userName={ctx.user.name}
      />
    </PortalShell>
  );
}
