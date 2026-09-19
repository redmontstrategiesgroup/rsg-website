// lib/apiv1/resources/public-status.ts
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ApiHandler } from "../types.ts";

type DatabaseCheck = "ok" | "unconfigured" | "unreachable";

async function pingDatabase(): Promise<DatabaseCheck> {
  if (!isSupabaseConfigured()) return "unconfigured";
  const sb = getSupabase();
  if (!sb) return "unconfigured";
  try {
    await sb.from("clients").select("id", { count: "exact", head: true });
    return "ok";
  } catch {
    return "unreachable";
  }
}

export const getStatus: ApiHandler<undefined, undefined> = async () => {
  const database = await pingDatabase();
  const status = database === "ok" ? "ok" : "degraded";
  const data = { status, version: process.env.npm_package_version ?? "unknown", checks: { database } };
  return database === "unreachable" ? { data, status: 503 } : { data };
};
