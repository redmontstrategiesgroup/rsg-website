import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requirePortalContext, canApproveDeliverables } from "@/lib/lifecycle/access";
import {
  approveMilestone,
  getProject,
  requestMilestoneChanges,
  updateTask,
} from "@/lib/lifecycle/projects";
import { decideApproval } from "@/lib/lifecycle/workspace";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { requireSupabase } from "@/lib/lifecycle/core";
import type { Approval, Milestone, ProjectTask } from "@/lib/lifecycle/types";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve_milestone"),
    milestoneId: z.string().uuid(),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("milestone_changes"),
    milestoneId: z.string().uuid(),
    note: z.string().min(1).max(2000).optional(),
  }),
  z.object({ action: z.literal("complete_task"), taskId: z.string().uuid() }),
  z.object({
    action: z.literal("decide_approval"),
    approvalId: z.string().uuid(),
    decision: z.enum(["approved", "changes_requested"]),
    note: z.string().max(2000).optional(),
  }),
]);

/** Load a milestone and prove it belongs to this client. */
async function ownedMilestone(
  milestoneId: string,
  clientId: string,
): Promise<Milestone | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("milestones")
    .select("*")
    .eq("id", milestoneId)
    .maybeSingle();
  if (!data) return null;
  const milestone = data as Milestone;
  const project = await getProject(milestone.project_id);
  return project && project.client_id === clientId ? milestone : null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await rateLimit(`portal-project:${ctx.client.id}:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sb = requireSupabase();

  switch (body.action) {
    case "approve_milestone":
    case "milestone_changes": {
      if (!canApproveDeliverables(ctx.user.role)) {
        return NextResponse.json(
          { error: "Only account owners and admins can approve." },
          { status: 403 },
        );
      }
      const milestone = await ownedMilestone(body.milestoneId, ctx.client.id);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      }
      if (milestone.status !== "under_review") {
        return NextResponse.json(
          { error: "This milestone isn't awaiting your review." },
          { status: 409 },
        );
      }
      if (body.action === "approve_milestone") {
        await approveMilestone(milestone.id, { approvedBy: ctx.user.name });
        await logClientActivity({
          clientId: ctx.client.id,
          projectId: milestone.project_id,
          actorType: "client",
          actorName: ctx.user.name,
          action: `Approved milestone "${milestone.name}"${body.note ? ` — "${body.note}"` : ""}`,
          entityType: "milestone",
          entityId: milestone.id,
        });
      } else {
        await requestMilestoneChanges(milestone.id, {
          note: `${ctx.user.name}: ${body.note ?? "Changes requested"}`,
        });
        await logClientActivity({
          clientId: ctx.client.id,
          projectId: milestone.project_id,
          actorType: "client",
          actorName: ctx.user.name,
          action: `Requested changes on "${milestone.name}"`,
          entityType: "milestone",
          entityId: milestone.id,
        });
      }
      return NextResponse.json({ ok: true });
    }

    case "complete_task": {
      const { data } = await sb
        .from("project_tasks")
        .select("*")
        .eq("id", body.taskId)
        .maybeSingle();
      const task = (data as ProjectTask | null) ?? null;
      if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
      const project = await getProject(task.project_id);
      if (!project || project.client_id !== ctx.client.id) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if (task.assignee_party !== "client") {
        return NextResponse.json(
          { error: "This task belongs to the Redmont team." },
          { status: 403 },
        );
      }
      await updateTask(task.id, { status: "done" });
      await logClientActivity({
        clientId: ctx.client.id,
        projectId: task.project_id,
        actorType: "client",
        actorName: ctx.user.name,
        action: `Completed "${task.title}"`,
        entityType: "task",
        entityId: task.id,
      });
      return NextResponse.json({ ok: true });
    }

    case "decide_approval": {
      if (!canApproveDeliverables(ctx.user.role)) {
        return NextResponse.json(
          { error: "Only account owners and admins can approve." },
          { status: 403 },
        );
      }
      const { data } = await sb
        .from("approvals")
        .select("*")
        .eq("id", body.approvalId)
        .eq("client_id", ctx.client.id)
        .maybeSingle();
      const approval = (data as Approval | null) ?? null;
      if (!approval) {
        return NextResponse.json({ error: "Approval not found." }, { status: 404 });
      }
      if (approval.status !== "pending") {
        return NextResponse.json({ error: "Already decided." }, { status: 409 });
      }
      await decideApproval(approval.id, {
        decision: body.decision,
        decidedByClientUserId: ctx.user.isLegacyOwner ? undefined : ctx.user.id,
        decidedByName: ctx.user.name,
        note: body.note,
      });
      await logClientActivity({
        clientId: ctx.client.id,
        projectId: approval.project_id ?? undefined,
        actorType: "client",
        actorName: ctx.user.name,
        action: `${body.decision === "approved" ? "Approved" : "Requested changes on"} "${approval.title}"`,
        entityType: "approval",
        entityId: approval.id,
      });
      return NextResponse.json({ ok: true });
    }
  }
}
