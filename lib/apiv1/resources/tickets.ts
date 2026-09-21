// lib/apiv1/resources/tickets.ts
import { z } from "zod";
import { requireSupabase } from "@/lib/lifecycle/core";
import {
  confirmTicketClosure,
  createTicket,
  getTicket,
  reopenTicket,
} from "@/lib/lifecycle/support";
import { addMessage, listMessages } from "@/lib/lifecycle/workspace";
import { getProject } from "@/lib/lifecycle/projects";
import { TICKET_CATEGORY_LABELS, type TicketCategory } from "@/lib/lifecycle/types";
import { listTicketsPage } from "@/lib/lifecycle/paged";
import { clientOf } from "../client";
import { ApiError } from "../errors";
import { parseListParams } from "../pagination";
import { projectOwnedBy, requireOwned, requireUuid, ticketOwnedBy } from "../ownership";
import { toMessageDto, toTicketDto } from "../serializers";
import type { ApiHandler } from "../types";

const CATEGORY = Object.keys(TICKET_CATEGORY_LABELS) as [string, ...string[]];

export const listQuery = z.object({
  status: z.string().max(40).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
export const createBody = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  category: z.enum(CATEGORY).default("bug"),
  priority: z.enum(["low", "normal", "high", "urgent", "critical"]).default("normal"),
  project_id: z.string().uuid().optional(),
}).meta({ example: { subject: "Checkout page returns a 500", body: "Since 9am every order fails at the payment step. Screenshot attached in the portal.", category: "bug", priority: "high" } });
export const messageBody = z
  .object({ body: z.string().min(1).max(20_000) })
  .meta({ example: { body: "Confirmed — the fix is live on our side. Can you re-test?" } });

async function ownedTicket(id: string, clientId: string) {
  const t = await getTicket(id);
  return requireOwned(t, ticketOwnedBy(t, clientId));
}

export const listTickets: ApiHandler<undefined, z.infer<typeof listQuery>> = async ({ principal, query, request }) => {
  const c = clientOf(principal);
  const { limit, cursor } = parseListParams(new URL(request.url).searchParams);
  const page = await listTicketsPage(requireSupabase(), c.portal.client.id, { limit, cursor, status: query.status });
  return { data: page.data.map(toTicketDto), meta: { next_cursor: page.next_cursor, limit } };
};

export const getTicketHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(requireUuid(params.id), c.portal.client.id);
  const messages = await listMessages({ ticketId: t.id }, { includeInternal: false, limit: 500 });
  return { data: { ...toTicketDto(t), messages: messages.filter((m) => !m.internal).map(toMessageDto) } };
};

export const createTicketHandler: ApiHandler<z.infer<typeof createBody>, undefined> = async ({ principal, body }) => {
  const c = clientOf(principal);
  if (body.project_id) {
    const project = await getProject(body.project_id);
    if (!projectOwnedBy(project, c.portal.client.id)) {
      throw new ApiError(422, "validation_failed", "Invalid request.", { project_id: ["unknown project"] });
    }
  }
  const t = await createTicket({
    clientId: c.portal.client.id,
    projectId: body.project_id ?? null,
    category: body.category as TicketCategory,
    priority: body.priority,
    subject: body.subject,
    description: body.body,
    openedByClientUserId: null,
    openedByName: `${c.keyName} (API)`,
  });
  return { data: toTicketDto(t), status: 201 };
};

export const addTicketMessage: ApiHandler<z.infer<typeof messageBody>, undefined> = async ({ principal, params, body }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(requireUuid(params.id), c.portal.client.id);
  if (t.status === "closed") throw new ApiError(409, "conflict", "This ticket is closed. Reopen it first.");
  const m = await addMessage({
    clientId: c.portal.client.id,
    ticketId: t.id,
    projectId: t.project_id,
    authorType: "client",
    authorClientUserId: null,
    authorName: `${c.keyName} (API)`,
    body: body.body,
  });
  return { data: toMessageDto(m), status: 201 };
};

export const reopenHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(requireUuid(params.id), c.portal.client.id);
  if (!["resolved", "closed"].includes(t.status)) {
    throw new ApiError(409, "conflict", "Only resolved or closed tickets can be reopened.");
  }
  return { data: toTicketDto(await reopenTicket(t.id)) };
};

export const confirmCloseHandler: ApiHandler<undefined, undefined> = async ({ principal, params }) => {
  const c = clientOf(principal);
  const t = await ownedTicket(requireUuid(params.id), c.portal.client.id);
  if (t.status !== "resolved") throw new ApiError(409, "conflict", "Only resolved tickets can be closed.");
  return { data: toTicketDto(await confirmTicketClosure(t.id)) };
};
