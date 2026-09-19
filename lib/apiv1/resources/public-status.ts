// lib/apiv1/resources/public-status.ts
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
// The `with { type: "json" }` import attribute is required by Node's
// native ESM loader (used by `node --test`); Next.js's bundler and tsc's
// `resolveJsonModule` both accept it too, so one import works everywhere.
import pkg from "@/package.json" with { type: "json" };
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
  // process.env.npm_package_version is normally absent under Next.js/Vercel
  // (npm only sets it when npm itself spawns the process), so it always
  // read "unknown" in every deployed environment. package.json's `version`
  // is bundled at build time via resolveJsonModule and always resolves.
  const data = { status, version: pkg.version ?? "unknown", checks: { database } };
  return database === "unreachable" ? { data, status: 503 } : { data };
};
