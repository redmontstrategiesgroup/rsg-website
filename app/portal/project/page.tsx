import type { Metadata } from "next";
import { requirePortalPage } from "@/lib/lifecycle/portal-page";
import { PortalShell } from "@/components/portal/PortalShell";
import { getProjectWithDetail, listProjectsForClient } from "@/lib/lifecycle/projects";
import { listApprovalsForClient } from "@/lib/lifecycle/workspace";
import { listFilesFor } from "@/lib/lifecycle/files";
import { ProjectView } from "@/components/portal/ProjectView";
import { EmptyState, PageHeader } from "@/components/portal/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project | Client Portal",
  robots: { index: false, follow: false },
};

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const ctx = await requirePortalPage();
  const { id } = await searchParams;

  // Tolerate a not-yet-migrated database — render calm empty states.
  const projects = await listProjectsForClient(ctx.client.id).catch((error) => {
    console.warn("[portal/project] load failed", error);
    return [];
  });
  const selected =
    (id && projects.find((p) => p.id === id)) ||
    projects.find((p) => !["completed", "archived"].includes(p.status)) ||
    projects[0];

  let content: React.ReactNode;
  if (!selected) {
    content = (
      <div className="card mt-10">
        <EmptyState
          title="No active project yet"
          description="When your engagement begins, your full project roadmap — phases, milestones, and approvals — lives here."
        />
      </div>
    );
  } else {
    // Scope check: listProjectsForClient already filters by client_id, and
    // `selected` comes only from that list — cross-client access is impossible.
    const detail = await getProjectWithDetail(selected.id);
    const approvals = await listApprovalsForClient(ctx.client.id, {
      status: "pending",
    });
    const files = await listFilesFor({ projectId: selected.id }, { limit: 12 });
    content = detail ? (
      <ProjectView
        project={detail.project}
        milestones={detail.milestones}
        tasks={detail.tasks}
        approvals={approvals}
        files={files}
        canApprove={ctx.user.role !== "member"}
        projects={projects.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      />
    ) : null;
  }

  return (
    <PortalShell company={ctx.client.company} userName={ctx.user.name} role={ctx.user.role}>
      <PageHeader
        eyebrow="Project"
        title={selected ? selected.name : "Your project"}
        description={
          selected
            ? "Live progress, what's next, and anything waiting on your side — always current, never a status meeting away."
            : undefined
        }
      />
      {content}
    </PortalShell>
  );
}
