import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requirePortalContext, type PortalContext } from "@/lib/lifecycle/access";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * App-mount context — the single auth + tenant-scoping entry point every mounted
 * app (Observatory, Forge, NEXUS, ...) uses, so no app re-implements the rule.
 *
 * The tenant is the signed-in portal client: `clientId` is what EVERY app query
 * and every ai_usage row must be scoped by. Never trust a client_id from the
 * request body — always take it from here.
 *
 *   API route:  const auth = await requireAppApi();
 *               if (!isAppContext(auth)) return auth;   // 401/503 already shaped
 *               // ... use auth.clientId ...
 *
 *   Server page: const { clientId, ctx } = await requireAppPage();  // redirects if signed out
 */

export type AppContext = { clientId: string; ctx: PortalContext };

/**
 * For app API routes. Returns AppContext, or a NextResponse (503 if Supabase is
 * not configured, 401 if not signed in) that the caller returns as-is.
 */
export async function requireAppApi(): Promise<AppContext | NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  const ctx = await requirePortalContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return { clientId: ctx.client.id, ctx };
}

/** Narrow requireAppApi()'s result to a successful AppContext. */
export function isAppContext(value: AppContext | NextResponse): value is AppContext {
  return "clientId" in value;
}

/**
 * For app server pages. Returns AppContext, or redirects to /login and never
 * returns when signed out.
 */
export async function requireAppPage(): Promise<AppContext> {
  const ctx = await requirePortalContext();
  if (!ctx) redirect("/login");
  return { clientId: ctx.client.id, ctx };
}
