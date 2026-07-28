import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  canManageTeam,
  createTeamInvite,
  removeTeamMember,
  requirePortalContext,
  updateTeamMember,
} from "@/lib/lifecycle/access";
import { requireSupabase, links, firstNameOf } from "@/lib/lifecycle/core";
import { logClientActivity } from "@/lib/lifecycle/activity";
import { sendTemplatedEmail } from "@/lib/scheduling/notifications";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    name: z.string().min(2).max(200),
    email: z.string().email().max(320),
    title: z.string().max(200).optional(),
    role: z.enum(["admin", "member"]),
  }),
  z.object({ action: z.literal("deactivate"), userId: z.string().uuid() }),
  z.object({
    action: z.literal("update"),
    userId: z.string().uuid(),
    role: z.enum(["admin", "member"]).optional(),
    title: z.string().max(200).optional(),
  }),
]);

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) {
    return NextResponse.json(
      { error: "Only account owners and admins can manage the team." },
      { status: 403 },
    );
  }
  if (!(await rateLimit(`portal-team:${ctx.client.id}:${clientIp(request)}`, 30, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "invite") {
    try {
      const { user, inviteToken } = await createTeamInvite({
        clientId: ctx.client.id,
        email: body.email,
        name: body.name,
        title: body.title,
        role: body.role,
        invitedBy: ctx.user.name,
      });
      try {
        await sendTemplatedEmail({
          templateKey: "lc_team_invite",
          to: body.email,
          vars: {
            first_name: firstNameOf(body.name),
            inviter_name: ctx.user.name,
            business_name: ctx.client.company,
            invite_url: links.invite(inviteToken),
          },
        });
      } catch (error) {
        console.error("[portal/team] invite email failed", error);
      }
      await logClientActivity({
        clientId: ctx.client.id,
        actorType: "client",
        actorName: ctx.user.name,
        action: `Invited ${body.name} (${body.role}) to the portal`,
        entityType: "client_user",
        entityId: user.id,
        visibleToClient: false,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Couldn't send the invite." },
        { status: 400 },
      );
    }
  }

  // Ownership check: the target user must belong to this client.
  const sb = requireSupabase();
  const { data: target } = await sb
    .from("client_users")
    .select("id, client_id, role, name")
    .eq("id", body.userId)
    .maybeSingle();
  if (!target || target.client_id !== ctx.client.id) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "The account owner can't be modified here." },
      { status: 403 },
    );
  }

  if (body.action === "deactivate") {
    await removeTeamMember(body.userId);
    await logClientActivity({
      clientId: ctx.client.id,
      actorType: "client",
      actorName: ctx.user.name,
      action: `Removed portal access for ${target.name}`,
      entityType: "client_user",
      entityId: body.userId,
      visibleToClient: false,
    });
    return NextResponse.json({ ok: true });
  }

  await updateTeamMember(body.userId, { role: body.role, title: body.title });
  return NextResponse.json({ ok: true });
}
