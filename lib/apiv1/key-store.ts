import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors.ts";
import { generateApiKey, type ApiKeyRow } from "./keys.ts";

export const MAX_ACTIVE_KEYS = 10;

export type KeyOwner = { type: "client" | "admin"; id: string };

export type ApiKeyDto = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  requests_30d: number;
};

export function toApiKeyDto(row: ApiKeyRow, requests30d: number): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    scopes: [...row.scopes],
    created_by: row.created_by,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    requests_30d: requests30d,
  };
}

async function activeRows(sb: SupabaseClient, owner: KeyOwner): Promise<ApiKeyRow[]> {
  const { data, error } = await sb
    .from("api_keys")
    .select("*")
    .eq("principal_type", owner.type)
    .eq("principal_id", owner.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listApiKeys: ${error.message}`);
  return (data ?? []) as ApiKeyRow[];
}

async function requests30dByKeyId(sb: SupabaseClient, keyIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (keyIds.length === 0) return counts;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const { data } = await sb
    .from("api_requests")
    .select("key_id")
    .in("key_id", keyIds)
    .gte("created_at", since);
  for (const r of (data ?? []) as { key_id: string }[]) {
    counts.set(r.key_id, (counts.get(r.key_id) ?? 0) + 1);
  }
  return counts;
}

export async function createApiKey(
  sb: SupabaseClient,
  input: { owner: KeyOwner; name: string; scopes: string[]; createdBy: string },
): Promise<{ key: ApiKeyDto; plaintext: string }> {
  if (input.scopes.length === 0) {
    throw new ApiError(422, "validation_failed", "Choose at least one scope.", { scopes: ["required"] });
  }
  const existing = await activeRows(sb, input.owner);
  if (existing.length >= MAX_ACTIVE_KEYS) {
    throw new ApiError(
      409,
      "conflict",
      `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`,
    );
  }
  const gen = generateApiKey();
  const { data, error } = await sb
    .from("api_keys")
    .insert({
      principal_type: input.owner.type,
      principal_id: input.owner.id,
      name: input.name,
      key_prefix: gen.prefix,
      key_hash: gen.hash,
      scopes: input.scopes,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createApiKey: ${error?.message ?? "no row"}`);
  return { key: toApiKeyDto(data as ApiKeyRow, 0), plaintext: gen.plaintext };
}

export async function listApiKeys(sb: SupabaseClient, owner: KeyOwner): Promise<ApiKeyDto[]> {
  const rows = await activeRows(sb, owner);
  if (rows.length === 0) return [];
  const counts = await requests30dByKeyId(sb, rows.map((r) => r.id));
  return rows.map((r) => toApiKeyDto(r, counts.get(r.id) ?? 0));
}

export async function revokeApiKey(sb: SupabaseClient, owner: KeyOwner, id: string): Promise<boolean> {
  const { data, error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("principal_type", owner.type)
    .eq("principal_id", owner.id)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`revokeApiKey: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Every active admin key across all admin principals (manage_team admins only). */
export async function listAllAdminKeys(
  sb: SupabaseClient,
): Promise<(ApiKeyDto & { principal_id: string })[]> {
  const { data, error } = await sb
    .from("api_keys")
    .select("*")
    .eq("principal_type", "admin")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAllAdminKeys: ${error.message}`);
  const rows = (data ?? []) as ApiKeyRow[];
  if (rows.length === 0) return [];
  const counts = await requests30dByKeyId(sb, rows.map((r) => r.id));
  return rows.map((r) => ({ ...toApiKeyDto(r, counts.get(r.id) ?? 0), principal_id: r.principal_id }));
}

/** Revoke any admin key by id, regardless of which admin owns it (manage_team admins only). */
export async function revokeAnyAdminKey(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("principal_type", "admin")
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`revokeAnyAdminKey: ${error.message}`);
  return (data ?? []).length > 0;
}
