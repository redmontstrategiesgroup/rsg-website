/**
 * Shared 503/401/403 preamble for the API-platform key-management routes
 * (`app/api/portal/apikeys/**`, `app/api/admin/apikeys/**`). Centralized so
 * the four route files can't drift on status codes or messages.
 */
import { NextResponse } from "next/server";
import { requirePortalContext, canManageTeam, type PortalContext } from "@/lib/lifecycle/access";
import { isAdminContext, requireAdmin, type AdminContext } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";

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
  return ctx;
}
