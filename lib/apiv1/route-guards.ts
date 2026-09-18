/**
 * Shared 503/401/403 preamble for the API-platform key-management routes
 * (`app/api/portal/apikeys/**`, `app/api/admin/apikeys/**`). Centralized so
 * the four route files can't drift on status codes or messages.
 */
import { NextResponse } from "next/server";
import { requirePortalContext, canManageTeam, type PortalContext } from "@/lib/lifecycle/access";
import { isAdminContext, requireAdmin, isMfaSetupRequired, type AdminContext } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { UUID_RE } from "@/lib/apiv1/pagination";

function platformUnavailable(): NextResponse | null {
  if (!apiPlatformEnabled() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  return null;
}

/** Portal key routes: owner/admin portal roles only. */
export async function portalKeyGuard(): Promise<PortalContext | NextResponse> {
  const unavailable = platformUnavailable();
  if (unavailable) return unavailable;
  const ctx = await requirePortalContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!canManageTeam(ctx.user.role)) {
    return NextResponse.json(
      { error: "Only account owners and admins can manage API keys." },
      { status: 403 },
    );
  }
  return ctx;
}

/** Admin key routes: any admin (requireAdmin() with no permission arg). */
export async function adminKeyGuard(): Promise<AdminContext | NextResponse> {
  const unavailable = platformUnavailable();
  if (unavailable) return unavailable;
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  if (await isMfaSetupRequired(ctx)) {
    return NextResponse.json(
      {
        error:
          "Multifactor authentication is required for your role. Set up MFA from the Security tab to continue.",
        code: "mfa_required",
      },
      { status: 403 },
    );
  }
  // The env bootstrap admin has no database row (id "rsg-env-admin" /
  // "rsg-admin", not a UUID); api_keys.principal_id is uuid so letting it
  // through would 500 on cast. Fail closed instead.
  if (!UUID_RE.test(ctx.admin.id)) {
    return NextResponse.json(
      { error: "The bootstrap admin can't own API keys; sign in as a database admin.", code: "bootstrap_admin" },
      { status: 403 },
    );
  }
  return ctx;
}
