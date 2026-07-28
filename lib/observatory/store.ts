import { requireSupabase, nowIso } from "@/lib/lifecycle/core";
import type { ScenarioSpec, StoredScenario } from "./types";

/**
 * Observatory server store — per-tenant scenario persistence, replacing the
 * app's single-browser obs_store_v1 localStorage. Every query is scoped by
 * clientId; the service-role key bypasses RLS, so the .eq("client_id", ...)
 * filter is the ONLY thing preventing a cross-tenant read — never omit it.
 */

const TABLE = "obs_scenarios";
const COLS = "id, spec_id, name, status, spec, created_at, updated_at";

type Row = {
  id: string;
  spec_id: string;
  name: string;
  status: string;
  spec: ScenarioSpec;
  created_at: string;
  updated_at: string;
};

function toStored(r: Row): StoredScenario {
  return {
    id: r.id,
    specId: r.spec_id,
    name: r.name,
    status: r.status,
    spec: r.spec,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listScenarios(clientId: string): Promise<StoredScenario[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select(COLS)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`obs_scenarios list failed: ${error.message}`);
  return ((data ?? []) as Row[]).map(toStored);
}

export async function getScenario(clientId: string, id: string): Promise<StoredScenario | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select(COLS)
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`obs_scenarios get failed: ${error.message}`);
  return data ? toStored(data as Row) : null;
}

/** Upsert a scenario for this tenant, keyed by (client_id, spec.id). */
export async function saveScenario(clientId: string, spec: ScenarioSpec): Promise<StoredScenario> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .upsert(
      {
        client_id: clientId,
        spec_id: spec.id,
        name: spec.name,
        status: spec.status,
        spec,
        updated_at: nowIso(),
      },
      { onConflict: "client_id,spec_id" },
    )
    .select(COLS)
    .single();
  if (error || !data) {
    throw new Error(`obs_scenarios save failed: ${error?.message ?? "no row returned"}`);
  }
  return toStored(data as Row);
}

export async function deleteScenario(clientId: string, id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(TABLE).delete().eq("id", id).eq("client_id", clientId);
  if (error) throw new Error(`obs_scenarios delete failed: ${error.message}`);
}
