/**
 * Admin auth helpers: live session + role resolution for RBAC.
 */

import { NextResponse } from "next/server";
import { getAdminSession, requireLiveAdminSession } from "@/lib/auth";
import { getAdminById } from "@/lib/store";
import {
  can,
  type SchedulingPermission,
  type SchedulingRole,
} from "@/lib/scheduling/permissions";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import type { AdminRecord } from "@/lib/types";

export type AdminContext = {
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>;
  admin: AdminRecord;
  role: SchedulingRole;
};

export async function resolveAdminContext(): Promise<AdminContext | null> {
  const session = await requireLiveAdminSession();
  if (!session) return null;
  const admin = await getAdminById(session.sub);
  if (!admin) {
    // Env admin cookie with id rsg-env-admin / legacy rsg-admin
    if (session.sub === "rsg-env-admin" || session.sub === "rsg-admin") {
      const fallback: AdminRecord = {
        id: session.sub,
        name: "RSG Administrator",
        email: session.email,
        passwordHash: "",
        role: "owner",
        mfaEnabled: false,
      };
      return { session, admin: fallback, role: "owner" };
    }
    return null;
  }
  return { session, admin, role: admin.role };
}

export async function requireAdmin(
  permission?: SchedulingPermission
): Promise<AdminContext | NextResponse> {
  const ctx = await resolveAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (permission && !can(permission, ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return ctx;
}

export function isAdminContext(
  value: AdminContext | NextResponse
): value is AdminContext {
  return !(value instanceof NextResponse);
}

/** Rate-limit authenticated admin mutators per admin id / IP. */
export async function rateLimitAdminMutator(
  request: Request,
  adminId: string
): Promise<Response | null> {
  const ip = clientIp(request);
  const ok = await rateLimit(`admin-mut:${adminId}:${ip}`, 120, 10 * 60_000);
  if (!ok) return rateLimitResponse();
  return null;
}
