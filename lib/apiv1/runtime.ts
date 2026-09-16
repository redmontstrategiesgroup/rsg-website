import { getSupabase } from "@/lib/supabase";
import { apiPlatformEnabled } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security";
import { getAdminById, getClientById } from "@/lib/store";
import { resolveApiKey, type ApiKeyRow } from "./keys";
import { resolvePrincipal } from "./principal";
import { optionsHandler, withApi, type PipelineDeps } from "./pipeline";
import type { ApiConfig, ApiHandler, RouteHandler } from "./types";

async function findByHash(hash: string): Promise<ApiKeyRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from("api_keys").select("*").eq("key_hash", hash).maybeSingle();
  return (data as ApiKeyRow | null) ?? null;
}

async function touch(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

export const realDeps: PipelineDeps = {
  enabled: apiPlatformEnabled,
  resolveKey: (bearer) => resolveApiKey(bearer, { findByHash, touch }),
  resolvePrincipal: (key) =>
    resolvePrincipal(key, {
      getClient: async (id) => {
        const c = await getClientById(id);
        if (!c) return null;
        const status = typeof (c as unknown as { status?: unknown }).status === "string" ? ((c as unknown as { status: string }).status) : "active";
        return { id: c.id, name: c.name, company: c.company, email: c.email, status };
      },
      getAdmin: async (id) => {
        const a = await getAdminById(id);
        return a ? { id: a.id, email: a.email, role: a.role } : null;
      },
    }),
  rateLimit,
  clientIp,
  get idempotency() { return getSupabase(); },
  get usage() { return getSupabase(); },
};

export function api<B = undefined, Q = undefined>(method: string, config: ApiConfig<B, Q>, handler: ApiHandler<B, Q>): RouteHandler {
  return withApi(method, config, handler, realDeps);
}

export const options = optionsHandler();
