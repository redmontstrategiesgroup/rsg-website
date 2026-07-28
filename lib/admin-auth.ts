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
  // getAdminById resolves both DB admins and the env bootstrap owner (it
  // returns envAdminRecord() for rsg-env-admin / rsg-admin). If it returns
  // null the account no longer exists — including an env admin whose
  // ADMIN_EMAIL/ADMIN_PASSWORD was removed — so we fail closed rather than
  // synthesizing an owner, which would leave old sessions un-revocable.
  const admin = await getAdminById(session.sub);
  if (!admin) return null;
  return { session, admin, role: admin.role };
}

/** True when the security settings enforce MFA for this admin and they have
 *  not enrolled yet. The env bootstrap admin is exempt (it cannot enroll —
 *  MFA requires a DB admin row) so enforcement can never lock out recovery. */
export async function isMfaSetupRequired(ctx: AdminContext): Promise<boolean> {
  if (ctx.admin.mfaEnabled) return false;
  if (ctx.admin.id === "rsg-env-admin" || ctx.admin.id === "rsg-admin") {
    return false;
  }
  try {
    const { getSecuritySettings } = await import("@/lib/security-center/store");
    const settings = await getSecuritySettings();
    return settings.mfaRequiredRoles.includes(ctx.role);
  } catch {
    return false;
  }
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
  // MFA enforcement: when enabled for this admin's role, every permission-
  // gated action is blocked server-side until they enroll — except MFA setup
  // itself, so they can complete enrollment.
  if (permission && permission !== "manage_mfa") {
    if (await isMfaSetupRequired(ctx)) {
      return NextResponse.json(
        {
          error:
            "Multifactor authentication is required for your role. Set up MFA from the Security tab to continue.",
          code: "mfa_required",
        },
        { status: 403 }
      );
    }
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
