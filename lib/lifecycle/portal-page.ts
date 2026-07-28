import { redirect } from "next/navigation";
import { requirePortalContext, type PortalContext } from "@/lib/lifecycle/access";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Guard for portal PAGES (server components). API routes use
 * requirePortalContext directly and return 401 instead.
 * Every caller receives a context whose client.id scopes all queries.
 */
export async function requirePortalPage(): Promise<PortalContext> {
  // Lifecycle sub-pages are database-backed; without Supabase the classic
  // dashboard at /portal is the only meaningful destination.
  if (!isSupabaseConfigured()) redirect("/portal");
  const ctx = await requirePortalContext();
  if (!ctx) redirect("/login");
  return ctx;
}
