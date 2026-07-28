import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requirePortalContext } from "@/lib/lifecycle/access";
import {
  confirmTicketClosure,
  createTicket,
  getTicket,
  reopenTicket,
  updateTicket,
} from "@/lib/lifecycle/support";
import { addMessage } from "@/lib/lifecycle/workspace";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { onTicketCreated } from "@/lib/lifecycle/orchestrate";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    category: z.enum([
      "outage",
      "bug",
      "access",
      "integration",
      "automation",
      "data_reporting",
      "website_update",
      "training",
      "feature",
      "billing",
      "security",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent", "critical"]).default("normal"),
    subject: z.string().min(3).max(300),
    description: z.string().min(10).max(10_000),
  }),
  z.object({
    action: z.literal("reply"),
    ticketId: z.string().uuid(),
    body: z.string().min(1).max(10_000),
  }),
  z.object({ action: z.literal("confirm_close"), ticketId: z.string().uuid() }),
  z.object({ action: z.literal("reopen"), ticketId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await rateLimit(`portal-support:${ctx.client.id}:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "create") {
    const ticket = await createTicket({
      clientId: ctx.client.id,
      category: body.category,
      priority: body.priority,
      subject: body.subject,
      description: body.description,
      openedByClientUserId: ctx.user.isLegacyOwner ? undefined : ctx.user.id,
      openedByName: ctx.user.name,
    });
    await logClientActivity({
      clientId: ctx.client.id,
      actorType: "client",
      actorName: ctx.user.name,
      action: `Opened ticket #${ticket.number}: ${ticket.subject}`,
      entityType: "ticket",
      entityId: ticket.id,
    });
    try {
      await onTicketCreated(ticket, {
        id: ctx.client.id,
        name: ctx.user.name,
        email: ctx.user.email,
        businessName: ctx.client.company,
      });
    } catch (error) {
      console.error("[portal/support] ticket notification failed", error);
    }
    return NextResponse.json({ ok: true, ticket });
  }

  // All remaining actions target an existing ticket — ownership first.
  const ticket = await getTicket(body.ticketId);
  if (!ticket || ticket.client_id !== ctx.client.id) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  switch (body.action) {
    case "reply": {
      if (ticket.status === "closed") {
        return NextResponse.json(
          { error: "This ticket is closed — open a new one and reference it." },
          { status: 409 },
        );
      }
      const message = await addMessage({
        clientId: ctx.client.id,
        ticketId: ticket.id,
        projectId: ticket.project_id,
        authorType: "client",
        authorClientUserId: ctx.user.isLegacyOwner ? undefined : ctx.user.id,
        authorName: ctx.user.name,
        body: body.body,
      });
      // A client reply while we wait on them puts the ball back on our side.
      if (ticket.status === "waiting_on_client" || ticket.status === "resolved") {
        await updateTicket(ticket.id, { status: "in_progress" });
      } else {
        await updateTicket(ticket.id, {});
      }
      return NextResponse.json({ ok: true, message });
    }

    case "confirm_close": {
      if (ticket.status !== "resolved") {
        return NextResponse.json(
          { error: "Only resolved tickets can be closed." },
          { status: 409 },
        );
      }
      const closed = await confirmTicketClosure(ticket.id);
      await logClientActivity({
        clientId: ctx.client.id,
        actorType: "client",
        actorName: ctx.user.name,
        action: `Confirmed closure of ticket #${ticket.number}`,
        entityType: "ticket",
        entityId: ticket.id,
      });
      return NextResponse.json({ ok: true, ticket: closed });
    }

    case "reopen": {
      if (!["resolved", "closed"].includes(ticket.status)) {
        return NextResponse.json({ error: "Ticket is already open." }, { status: 409 });
      }
      const reopened = await reopenTicket(ticket.id);
      await logClientActivity({
        clientId: ctx.client.id,
        actorType: "client",
        actorName: ctx.user.name,
        action: `Reopened ticket #${ticket.number}`,
        entityType: "ticket",
        entityId: ticket.id,
      });
      return NextResponse.json({ ok: true, ticket: reopened });
    }
  }
}
