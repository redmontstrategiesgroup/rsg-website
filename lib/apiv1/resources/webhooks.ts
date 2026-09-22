import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import {
  createEndpoint,
  deleteEndpoint,
  getOwnedEndpoint,
  listDeliveriesPage,
  listEndpoints,
  replayDelivery,
  rotateSecret,
  toEndpointDto,
  updateEndpoint,
  type Owner,
} from "@/lib/webhooks/endpoints";
import { EVENTS, eventsFor } from "@/lib/webhooks/events";
import { sendTestEvent } from "@/lib/webhooks/emit";
import { auditVia } from "../admin.ts";
import { ApiError } from "../errors.ts";
import { requireUuid } from "../ownership.ts";
import { parseListParams } from "../pagination.ts";
import type { Principal } from "../principal.ts";
import type { ApiHandler } from "../types.ts";

/**
 * Webhook management for BOTH principal types (`auth: "any"`,
 * scope `webhooks:manage`). The owner is the principal: a client key manages
 * its client's endpoints, an admin key the admin's own.
 */

export function ownerOf(principal: Principal | null): Owner {
  if (!principal) throw new ApiError(401, "unauthenticated", "Missing API key.");
  return principal.type === "client"
    ? { type: "client", id: principal.portal.client.id }
    : { type: "admin", id: principal.adminId };
}

/**
 * URL policy for this deployment. `allowPrivate` is a dev-only escape hatch
 * (local end-to-end delivery tests) and is ignored in production even when
 * the env var is set.
 */
export function urlOpts(): { allowHttp: boolean; allowPrivate: boolean } {
  const dev = process.env.NODE_ENV !== "production";
  return { allowHttp: dev, allowPrivate: dev && process.env.WEBHOOK_URL_ALLOW_PRIVATE === "1" };
}

type WebhookAction = "webhook.create" | "webhook.update" | "webhook.delete" | "webhook.rotate_secret" | "webhook.replay";

export async function audit(principal: Principal, action: WebhookAction, endpointId: string, metadata?: Record<string, unknown>): Promise<void> {
  if (principal.type === "admin") {
    await auditVia(principal, { action, entityType: "webhook_endpoint", entityId: endpointId, metadata });
    return;
  }
  await logClientActivity({
    clientId: principal.portal.client.id,
    actorType: "client",
    actorName: `${principal.keyName} (API)`,
    action,
    entityType: "webhook_endpoint",
    entityId: endpointId,
    metadata,
  });
}

export const createBody = z.object({
  url: z.string().max(2048),
  events: z.array(z.string()).min(1).max(30),
  description: z.string().max(200).optional(),
}).meta({ example: { url: "https://hooks.example.com/rsg", events: ["ticket.created", "ticket.replied"], description: "Ticket sync" } });

export const patchBody = z
  .object({
    url: z.string().max(2048).optional(),
    events: z.array(z.string()).min(1).max(30).optional(),
    description: z.string().max(200).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Empty patch.")
  .meta({ example: { enabled: false } });

export const deliveriesQuery = z.object({
  status: z.enum(["pending", "sending", "delivered", "failed", "dead"]).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export const listWebhooks: ApiHandler<undefined, undefined> = async ({ principal }) => {
  const owner = ownerOf(principal);
  return { data: await listEndpoints(requireSupabase(), owner) };
};

export const createWebhook: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body }) => {
  const owner = ownerOf(principal);
  const { endpoint, secret } = await createEndpoint(
    requireSupabase(),
    owner,
    { url: body.url, events: body.events, description: body.description, apiKeyId: principal!.keyId },
    urlOpts(),
  );
  await audit(principal!, "webhook.create", endpoint.id, { events: endpoint.events });
  // The only response that ever carries the secret besides rotate.
  return { status: 201, data: { ...endpoint, secret } };
};

export const getWebhook: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const owner = ownerOf(principal);
  const row = await getOwnedEndpoint(requireSupabase(), owner, requireUuid(params.id));
  return { data: toEndpointDto(row) };
};

export const patchWebhook: ApiHandler<z.infer<typeof patchBody>, undefined> = async ({ principal, params, body }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  const endpoint = await updateEndpoint(requireSupabase(), owner, id, body, urlOpts());
  await audit(principal!, "webhook.update", id, { fields: Object.keys(body) });
  return { data: endpoint };
};

export const deleteWebhook: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  await deleteEndpoint(requireSupabase(), owner, id);
  await audit(principal!, "webhook.delete", id);
  return { data: { id, deleted: true } };
};

export const rotateWebhookSecret: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  const { secret } = await rotateSecret(requireSupabase(), owner, id);
  await audit(principal!, "webhook.rotate_secret", id);
  return { data: { id, secret } };
};

export const testWebhook: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  await getOwnedEndpoint(requireSupabase(), owner, id);
  const { queued } = await sendTestEvent(id);
  return { status: 202, data: { queued } };
};

export const listWebhookDeliveries: ApiHandler<undefined, z.infer<typeof deliveriesQuery>> = async ({ principal, params, query, request }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listDeliveriesPage(requireSupabase(), owner, id, { limit, cursor, status: query.status });
  return { data: page.data, meta: { next_cursor: page.next_cursor, limit } };
};

export const replayWebhookDelivery: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const owner = ownerOf(principal);
  const id = requireUuid(params.id);
  const did = requireUuid(params.did);
  const delivery = await replayDelivery(requireSupabase(), owner, id, did);
  await audit(principal!, "webhook.replay", id, { delivery_id: did });
  return { data: delivery };
};

export const listWebhookEvents: ApiHandler<undefined, undefined> = async ({ principal }) => {
  const owner = ownerOf(principal);
  return {
    data: eventsFor(owner.type).map((type) => ({
      type,
      description: EVENTS[type].description,
      audience: EVENTS[type].audience,
    })),
  };
};
