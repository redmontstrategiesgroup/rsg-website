import "server-only";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type DashboardRecord = Record<string, unknown> & { id: string };

export type DashboardData = {
  configured: boolean;
  error?: string;
  briefs: DashboardRecord[];
  actions: DashboardRecord[];
  opportunities: DashboardRecord[];
  risks: DashboardRecord[];
  intelligence: DashboardRecord[];
  ideas: DashboardRecord[];
  sources: DashboardRecord[];
  notifications: DashboardRecord[];
  integrations: DashboardRecord[];
  ingestionLogs: DashboardRecord[];
};

const EMPTY: DashboardData = {
  configured: false,
  briefs: [], actions: [], opportunities: [], risks: [], intelligence: [],
  ideas: [], sources: [], notifications: [], integrations: [], ingestionLogs: [],
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) return EMPTY;
  const db = getSupabase();
  if (!db) return EMPTY;

  const requests = [
    db.from("briefs").select("*").order("brief_date", { ascending: false }).limit(100),
    db.from("action_items").select("*, briefs(title)").order("created_at", { ascending: false }).limit(200),
    db.from("opportunities").select("*, briefs(title)").order("total_score", { ascending: false }).limit(200),
    db.from("risks").select("*, briefs(title)").order("created_at", { ascending: false }).limit(200),
    db.from("intelligence_items").select("*, briefs(title), sources(title,url,publisher)").order("date_observed", { ascending: false }).limit(200),
    db.from("ideas").select("*, briefs(title)").order("created_at", { ascending: false }).limit(200),
    db.from("sources").select("*").order("accessed_at", { ascending: false }).limit(200),
    db.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("integrations").select("id,integration_type,name,status,settings,last_success_at,last_failure_at,failure_message,created_at,updated_at").order("created_at", { ascending: false }).limit(50),
    db.from("ingestion_logs").select("id,request_identifier,idempotency_key,status,brief_id,error_message,received_at,processed_at").order("received_at", { ascending: false }).limit(100),
  ];
  const results = await Promise.all(requests);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return { ...EMPTY, configured: true, error: "Dashboard tables are not ready. Apply the included Supabase migration." };
  }
  return {
    configured: true,
    briefs: (results[0].data ?? []) as DashboardRecord[],
    actions: (results[1].data ?? []) as DashboardRecord[],
    opportunities: (results[2].data ?? []) as DashboardRecord[],
    risks: (results[3].data ?? []) as DashboardRecord[],
    intelligence: (results[4].data ?? []) as DashboardRecord[],
    ideas: (results[5].data ?? []) as DashboardRecord[],
    sources: (results[6].data ?? []) as DashboardRecord[],
    notifications: (results[7].data ?? []) as DashboardRecord[],
    integrations: (results[8].data ?? []) as DashboardRecord[],
    ingestionLogs: (results[9].data ?? []) as DashboardRecord[],
  };
}
