import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { writeAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/apiv1/errors";
import { UUID_RE, parseListParams } from "@/lib/apiv1/pagination";
import { createBody, deliveriesQuery, patchBody, urlOpts } from "@/lib/apiv1/resources/webhooks";
import type { AdminContext } from "@/lib/admin-auth";
import type { PortalContext } from "@/lib/lifecycle/access";
import {
  createEndpoint,
  deleteEndpoint,
  listDeliveriesPage,
  listEndpoints,
  replayDelivery,
  rotateSecret,
  updateEndpoint,
  getOwnedEndpoint,
  type Owner,
} from "./endpoints";
import { EVENTS, eventsFor } from "./events";
import { sendTestEvent } from "./emit";

/**
 * Shared implementation for the cookie-authenticated webhook routes
 * (`/api/portal/webhooks/**`, `/api/admin/webhooks/**`). The route files only
 * run their guard, build a `WebhookCtx`, and delegate here, so the portal and
 * admin surfaces cannot drift.
 */

export type WebhookCtx = {
  owner: Owner;
  audit: (action: string, endpointId: string, metadata?: Record<string, unknown>) => Promise<void>;
};

export function portalWebhookCtx(ctx: PortalContext): WebhookCtx {
  return {
    owner: { type: "client", id: ctx.client.id },
    audit: async (action, endpointId, metadata) => {
      await logClientActivity({
        clientId: ctx.client.id,
        actorType: "client",
        actorName: ctx.user.name,
        action,
        entityType: "webhook_endpoint",
        entityId: endpointId,
        metadata,
      });
    },
  };
}

export function adminWebhookCtx(ctx: AdminContext): WebhookCtx {
  return {
    owner: { type: "admin", id: ctx.admin.id },
    audit: async (action, endpointId, metadata) => {
      await writeAuditEvent({
        actorType: "admin",
        actorId: ctx.admin.id,
        actorEmail: ctx.admin.email,
        action,
        entityType: "webhook_endpoint",
        entityId: endpointId,
        metadata,
      });
    },
  };
}

function fail(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code, details: err.details }, { status: err.status });
  }
  console.error("[webhooks] cookie route failed", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

function requireId(id: string | undefined): string | NextResponse {
  return id && UUID_RE.test(id) ? id : NextResponse.json({ error: "Endpoint not found.", code: "not_found" }, { status: 404 });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleList(ctx: WebhookCtx): Promise<NextResponse> {
  try {
    const endpoints = await listEndpoints(requireSupabase(), ctx.owner);
    const events = eventsFor(ctx.owner.type).map((type) => ({ type, description: EVENTS[type].description }));
    return NextResponse.json({ endpoints, events });
  } catch (err) {
    return fail(err);
  }
}

export async function handleCreate(ctx: WebhookCtx, request: Request): Promise<NextResponse> {
  const parsed = createBody.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 422 });
  try {
    const { endpoint, secret } = await createEndpoint(requireSupabase(), ctx.owner, parsed.data, urlOpts());
    await ctx.audit("webhook.create", endpoint.id, { events: endpoint.events });
    return NextResponse.json({ endpoint, secret }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function handlePatch(ctx: WebhookCtx, request: Request, rawId: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  const parsed = patchBody.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 422 });
  try {
    const endpoint = await updateEndpoint(requireSupabase(), ctx.owner, id, parsed.data, urlOpts());
    await ctx.audit("webhook.update", id, { fields: Object.keys(parsed.data) });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return fail(err);
  }
}

export async function handleDelete(ctx: WebhookCtx, rawId: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  try {
    await deleteEndpoint(requireSupabase(), ctx.owner, id);
    await ctx.audit("webhook.delete", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

export async function handleRotate(ctx: WebhookCtx, rawId: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  try {
    const { secret } = await rotateSecret(requireSupabase(), ctx.owner, id);
    await ctx.audit("webhook.rotate_secret", id);
    return NextResponse.json({ secret });
  } catch (err) {
    return fail(err);
  }
}

export async function handleTest(ctx: WebhookCtx, rawId: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  try {
    await getOwnedEndpoint(requireSupabase(), ctx.owner, id);
    const { queued } = await sendTestEvent(id);
    return NextResponse.json({ queued }, { status: 202 });
  } catch (err) {
    return fail(err);
  }
}

export async function handleDeliveries(ctx: WebhookCtx, request: Request, rawId: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  const sp = new URL(request.url).searchParams;
  const q = deliveriesQuery.safeParse({ status: sp.get("status") ?? undefined });
  if (!q.success) return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  try {
    const { limit, cursor } = parseListParams(sp);
    const page = await listDeliveriesPage(requireSupabase(), ctx.owner, id, { limit, cursor, status: q.data.status });
    return NextResponse.json({ data: page.data, meta: { next_cursor: page.next_cursor, limit } });
  } catch (err) {
    return fail(err);
  }
}

export async function handleReplay(ctx: WebhookCtx, rawId: string | undefined, rawDid: string | undefined): Promise<NextResponse> {
  const id = requireId(rawId);
  if (id instanceof NextResponse) return id;
  const did = requireId(rawDid);
  if (did instanceof NextResponse) return did;
  try {
    const delivery = await replayDelivery(requireSupabase(), ctx.owner, id, did);
    await ctx.audit("webhook.replay", id, { delivery_id: did });
    return NextResponse.json({ delivery });
  } catch (err) {
    return fail(err);
  }
}

// Re-exported so route files need a single import.
export { z };
