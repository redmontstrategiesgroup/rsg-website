import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requirePortalContext } from "@/lib/lifecycle/access";
import { addMessage, createRequest, getRequest } from "@/lib/lifecycle/workspace";
import { createFileRecord, getDownloadUrl, getFile } from "@/lib/lifecycle/files";
import { getProject } from "@/lib/lifecycle/projects";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { createNotification } from "@/lib/lifecycle/automations";
import { links } from "@/lib/lifecycle/core";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_request"),
    category: z.enum([
      "question",
      "content",
      "design_revision",
      "technical_change",
      "new_feature",
      "access_credentials",
      "billing",
      "support",
      "scope_change",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    title: z.string().min(3).max(300),
    description: z.string().max(10_000).default(""),
    projectId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("message"),
    requestId: z.string().uuid(),
    body: z.string().min(1).max(10_000),
  }),
  z.object({
    action: z.literal("upload"),
    name: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    mimeType: z.string().max(200),
    projectId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
  }),
  z.object({ action: z.literal("download"), fileId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await rateLimit(`portal-ws:${ctx.client.id}:${clientIp(request)}`, 120, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  /** A project id is only usable if it belongs to this client. */
  async function ownProject(projectId: string | undefined): Promise<string | null> {
    if (!projectId) return null;
    const project = await getProject(projectId);
    return project && project.client_id === ctx!.client.id ? project.id : null;
  }

  switch (body.action) {
    case "create_request": {
      const projectId = await ownProject(body.projectId);
      const created = await createRequest({
        clientId: ctx.client.id,
        projectId: projectId ?? undefined,
        requesterType: "client",
        requesterClientUserId: ctx.user.isLegacyOwner ? undefined : ctx.user.id,
        requesterName: ctx.user.name,
        category: body.category,
        priority: body.priority,
        title: body.title,
        description: body.description,
      });
      await logClientActivity({
        clientId: ctx.client.id,
        projectId: projectId ?? undefined,
        actorType: "client",
        actorName: ctx.user.name,
        action: `Opened request #${created.number}: ${created.title}`,
        entityType: "request",
        entityId: created.id,
      });
      await createNotification({
        audience: "admin",
        kind: "request",
        title: `New request from ${ctx.client.company}: ${created.title}`,
        body: `${created.category} · ${created.priority}`,
        href: links.admin("requests"),
      }).catch(() => {});
      return NextResponse.json({ ok: true, request: created });
    }

    case "message": {
      const target = await getRequest(body.requestId);
      if (!target || target.client_id !== ctx.client.id) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }
      const message = await addMessage({
        clientId: ctx.client.id,
        requestId: target.id,
        projectId: target.project_id,
        authorType: "client",
        authorClientUserId: ctx.user.isLegacyOwner ? undefined : ctx.user.id,
        authorName: ctx.user.name,
        body: body.body,
      });
      return NextResponse.json({ ok: true, message });
    }

    case "upload": {
      const projectId = await ownProject(body.projectId);
      let requestId: string | null = null;
      if (body.requestId) {
        const target = await getRequest(body.requestId);
        if (target && target.client_id === ctx.client.id) requestId = target.id;
      }
      try {
        const result = await createFileRecord({
          clientId: ctx.client.id,
          projectId: projectId ?? undefined,
          requestId,
          uploadedByType: "client",
          uploadedById: ctx.user.id,
          uploadedByName: ctx.user.name,
          name: body.name,
          sizeBytes: body.sizeBytes,
          mimeType: body.mimeType,
        });
        await logClientActivity({
          clientId: ctx.client.id,
          projectId: projectId ?? undefined,
          actorType: "client",
          actorName: ctx.user.name,
          action: `Uploaded ${result.file.name}`,
          entityType: "file",
          entityId: result.file.id,
        });
        return NextResponse.json({ ok: true, uploadUrl: result.uploadUrl });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Upload rejected." },
          { status: 400 },
        );
      }
    }

    case "download": {
      const file = await getFile(body.fileId);
      if (!file || file.client_id !== ctx.client.id) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }
      const signed = await getDownloadUrl(file.id);
      return NextResponse.json({ ok: true, url: signed.url });
    }
  }
}
