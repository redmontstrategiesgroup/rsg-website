// lib/apiv1/resources/projects.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import {
  approveMilestone,
  computeHealth,
  computeProgress,
  getProjectWithDetail,
  requestMilestoneChanges,
  updateTask,
} from "@/lib/lifecycle/projects";
import { decideApproval, listApprovalsForClient } from "@/lib/lifecycle/workspace";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { listProjectsPage } from "@/lib/lifecycle/paged";
import type { Approval, Milestone, ProjectTask } from "@/lib/lifecycle/types";
import { clientOf } from "../client";
import { ApiError } from "../errors";
import { parseListParams } from "../pagination";
import { approvalOwnedBy, projectOwnedBy, requireOwned, requireUuid } from "../ownership";
import { toApprovalDto, toMilestoneDto, toProjectDto, toTaskDto } from "../serializers";
import type { ApiHandler } from "../types";

export const listQuery = z.object({
  status: z.string().max(40).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
export const noteBody = z.object({ note: z.string().max(2000).optional() });
export const changesBody = z.object({ note: z.string().min(1).max(2000) });
export const decideBody = z.object({
  decision: z.enum(["approved", "changes_requested"]),
  note: z.string().max(2000).optional(),
});

export const listProjects: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listProjectsPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toProjectDto), meta: { next_cursor: page.next_cursor, limit } };
};

async function ownedProjectDetail(projectId: string, clientId: string) {
  const detail = await getProjectWithDetail(requireUuid(projectId));
  return requireOwned(detail, projectOwnedBy(detail?.project ?? null, clientId));
}

export const getProject: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const detail = await ownedProjectDetail(params.id!, c.portal.client.id);
  const approvals = (await listApprovalsForClient(c.portal.client.id)).filter(
    (a) => a.project_id === detail.project.id && a.status === "pending",
  );
  return {
    data: {
      ...toProjectDto(detail.project),
      progress: computeProgress(detail.milestones),
      health: computeHealth(detail.milestones),
      milestones: detail.milestones.map(toMilestoneDto),
      tasks: detail.tasks.map(toTaskDto),
      open_approvals: approvals.map(toApprovalDto),
    },
  };
};

async function ownedMilestone(projectId: string, milestoneId: string, clientId: string): Promise<Milestone> {
  const detail = await ownedProjectDetail(projectId, clientId);
  const m = detail.milestones.find((x) => x.id === requireUuid(milestoneId)) ?? null;
  return requireOwned(m, m !== null);
}

export const approveMilestoneHandler: ApiHandler<z.infer<typeof noteBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const m = await ownedMilestone(params.id!, params.mid!, c.portal.client.id);
  if (m.status !== "under_review" || !m.approval_required) {
    throw new ApiError(409, "conflict", "This milestone isn't awaiting review.");
  }
  const r = await approveMilestone(m.id, { approvedBy: c.keyName });
  await logClientActivity({
    clientId: c.portal.client.id,
    projectId: m.project_id,
    actorType: "client",
    actorName: `${c.keyName} (API)`,
    action: `Approved milestone "${m.name}"${body.note ? `: "${body.note}"` : ""}`,
    entityType: "milestone",
    entityId: m.id,
  });
  return { data: toMilestoneDto(r.milestone) };
};

export const requestChangesHandler: ApiHandler<z.infer<typeof changesBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const m = await ownedMilestone(params.id!, params.mid!, c.portal.client.id);
  if (m.status !== "under_review") throw new ApiError(409, "conflict", "This milestone isn't awaiting review.");
  const r = await requestMilestoneChanges(m.id, { note: `${c.keyName} (API): ${body.note}` });
  await logClientActivity({
    clientId: c.portal.client.id,
    projectId: m.project_id,
    actorType: "client",
    actorName: `${c.keyName} (API)`,
    action: `Requested changes on "${m.name}"`,
    entityType: "milestone",
    entityId: m.id,
  });
  return { data: toMilestoneDto(r.milestone) };
};

export const completeTaskHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const detail = await ownedProjectDetail(params.id!, c.portal.client.id);
  const task = detail.tasks.find((t) => t.id === requireUuid(params.tid)) ?? null;
  const owned = requireOwned<ProjectTask>(task, task !== null);
  if (owned.assignee_party !== "client") throw new ApiError(409, "conflict", "This task belongs to the Redmont team.");
  if (owned.status === "done") return { data: toTaskDto(owned) };
  const updated = await updateTask(owned.id, { status: "done" });
  await logClientActivity({
    clientId: c.portal.client.id,
    projectId: owned.project_id,
    actorType: "client",
    actorName: `${c.keyName} (API)`,
    action: `Completed "${owned.title}"`,
    entityType: "task",
    entityId: owned.id,
  });
  return { data: toTaskDto(updated) };
};

export const decideApprovalHandler: ApiHandler<z.infer<typeof decideBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const all = await listApprovalsForClient(c.portal.client.id);
  const a = all.find((x) => x.id === requireUuid(params.id)) ?? null;
  const owned = requireOwned<Approval>(a, approvalOwnedBy(a, c.portal.client.id));
  if (owned.status !== "pending") throw new ApiError(409, "conflict", "This approval has already been decided.");
  const decided = await decideApproval(owned.id, {
    decision: body.decision,
    decidedByClientUserId: null,
    decidedByName: `${c.keyName} (API)`,
    note: body.note,
  });
  await logClientActivity({
    clientId: c.portal.client.id,
    projectId: owned.project_id ?? undefined,
    actorType: "client",
    actorName: `${c.keyName} (API)`,
    action: `${body.decision === "approved" ? "Approved" : "Requested changes on"} "${owned.title}"`,
    entityType: "approval",
    entityId: owned.id,
  });
  return { data: toApprovalDto(decided) };
};
