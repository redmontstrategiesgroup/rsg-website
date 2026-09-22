import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, notFound } from "../apiv1/errors.ts";
import { applyCursor, pageResult, type Cursor } from "../apiv1/pagination.ts";
import { isEventType, visibleTo, type EventType } from "./events.ts";
import { checkWebhookUrl, type UrlCheckOptions } from "./url-check.ts";

/**
 * Owned webhook endpoints (`webhook_endpoints.kind = 'client'`) and their
 * deliveries. Every function takes the Supabase client so it can be tested
 * hermetically, and every read is scoped by owner so an endpoint id alone
 * never reaches another principal's rows.
 *
 * `events` is a jsonb array of strings (not text[]); it is read and written
 * as a plain JS array and never filtered with PostgREST array operators.
 */

export const MAX_ENDPOINTS = 10;
/** Consecutive dead letters before an endpoint is auto-disabled. */
export const AUTO_DISABLE_AFTER = 20;

export type Owner = { type: "client" | "admin"; id: string };

export type EndpointRow = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  kind: string;
  description: string | null;
  owner_type: string | null;
  owner_id: string | null;
  api_key_id: string | null;
  disabled_at: string | null;
  failure_count: number;
  seq: number;
  created_at: string;
  updated_at: string;
};

export type EndpointDto = {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  enabled: boolean;
  disabled_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryRow = {
  id: string;
  endpoint_id: string;
  event_type: string;
  event_id: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  response_status: number | null;
  last_error: string | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  dead_lettered_at: string | null;
  created_at: string;
};

export type DeliveryDto = {
  id: string;
  event_type: string;
  event_id: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  response_status: number | null;
  last_error: string | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  dead_lettered_at: string | null;
  created_at: string;
};

export function toEndpointDto(r: EndpointRow): EndpointDto {
  return {
    id: r.id,
    url: r.url,
    events: Array.isArray(r.events) ? [...r.events] : [],
    description: r.description ?? null,
    enabled: r.enabled,
    disabled_at: r.disabled_at ?? null,
    failure_count: r.failure_count ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** Never includes `payload` — receivers already have it and it may hold PII. */
export function toDeliveryDto(r: DeliveryRow): DeliveryDto {
  return {
    id: r.id,
    event_type: r.event_type,
    event_id: r.event_id ?? null,
    status: r.status,
    attempts: r.attempts ?? 0,
    max_attempts: r.max_attempts ?? 0,
    response_status: r.response_status ?? null,
    last_error: r.last_error ?? null,
    next_attempt_at: r.next_attempt_at ?? null,
    delivered_at: r.delivered_at ?? null,
    dead_lettered_at: r.dead_lettered_at ?? null,
    created_at: r.created_at,
  };
}

export function generateSecret(): string {
  return "whsec_" + randomBytes(32).toString("base64url");
}

export function validateEvents(events: string[], owner: Owner): EventType[] {
  const unique = Array.from(new Set(events));
  const bad = unique.filter((e) => !isEventType(e) || !visibleTo(e, owner.type));
  if (bad.length) {
    throw new ApiError(422, "validation_failed", "Unknown or unavailable event.", { events: bad });
  }
  if (unique.length === 0) {
    throw new ApiError(422, "validation_failed", "Subscribe to at least one event.", { events: ["required"] });
  }
  return unique as EventType[];
}

function validateUrl(url: string, opts: UrlCheckOptions): string {
  const r = checkWebhookUrl(url, opts);
  if (!r.ok) throw new ApiError(422, "validation_failed", "Invalid endpoint URL.", { url: [r.reason] });
  return r.url;
}

type ChainedQuery = {
  eq(col: string, val: string): ChainedQuery;
  or(filter: string): ChainedQuery;
  order(col: string, opts: { ascending: boolean }): ChainedQuery;
  limit(n: number): ChainedQuery;
  then<T>(res: (v: { data: unknown[] | null; error: { message: string } | null }) => T): Promise<T>;
};

function ownedQuery(sb: SupabaseClient, owner: Owner) {
  return sb
    .from("webhook_endpoints")
    .select("*")
    .eq("kind", "client")
    .eq("owner_type", owner.type)
    .eq("owner_id", owner.id);
}

export async function createEndpoint(
  sb: SupabaseClient,
  owner: Owner,
  input: { url: string; events: string[]; description?: string; apiKeyId?: string | null },
  opts: UrlCheckOptions,
): Promise<{ endpoint: EndpointDto; secret: string }> {
  const url = validateUrl(input.url, opts);
  const events = validateEvents(input.events, owner);
  const { data: existing, error: countError } = await ownedQuery(sb, owner);
  if (countError) throw new Error(`createEndpoint: ${countError.message}`);
  if ((existing ?? []).length >= MAX_ENDPOINTS) {
    throw new ApiError(409, "conflict", `You can have at most ${MAX_ENDPOINTS} webhook endpoints. Delete one first.`);
  }
  const secret = generateSecret();
  const { data, error } = await sb
    .from("webhook_endpoints")
    .insert({
      kind: "client",
      owner_type: owner.type,
      owner_id: owner.id,
      url,
      events,
      enabled: true,
      secret,
      description: input.description ?? null,
      api_key_id: input.apiKeyId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createEndpoint: ${error?.message ?? "no row"}`);
  return { endpoint: toEndpointDto(data as EndpointRow), secret };
}

export async function listEndpoints(sb: SupabaseClient, owner: Owner): Promise<EndpointDto[]> {
  const { data, error } = await ownedQuery(sb, owner).order("created_at", { ascending: true });
  if (error) throw new Error(`listEndpoints: ${error.message}`);
  return ((data ?? []) as EndpointRow[]).map(toEndpointDto);
}

export async function getOwnedEndpoint(sb: SupabaseClient, owner: Owner, id: string): Promise<EndpointRow> {
  const { data, error } = await ownedQuery(sb, owner).eq("id", id).maybeSingle();
  if (error) throw new Error(`getOwnedEndpoint: ${error.message}`);
  if (!data) throw notFound();
  return data as EndpointRow;
}

export async function updateEndpoint(
  sb: SupabaseClient,
  owner: Owner,
  id: string,
  patch: { url?: string; events?: string[]; description?: string | null; enabled?: boolean },
  opts: UrlCheckOptions,
): Promise<EndpointDto> {
  await getOwnedEndpoint(sb, owner, id);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.url !== undefined) update.url = validateUrl(patch.url, opts);
  if (patch.events !== undefined) update.events = validateEvents(patch.events, owner);
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.enabled === true) {
    update.enabled = true;
    update.disabled_at = null;
    update.failure_count = 0;
  } else if (patch.enabled === false) {
    update.enabled = false;
  }
  const { data, error } = await sb
    .from("webhook_endpoints")
    .update(update)
    .eq("id", id)
    .eq("owner_type", owner.type)
    .eq("owner_id", owner.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`updateEndpoint: ${error?.message ?? "no row"}`);
  return toEndpointDto(data as EndpointRow);
}

export async function deleteEndpoint(sb: SupabaseClient, owner: Owner, id: string): Promise<void> {
  await getOwnedEndpoint(sb, owner, id);
  const { error } = await sb
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("owner_type", owner.type)
    .eq("owner_id", owner.id);
  if (error) throw new Error(`deleteEndpoint: ${error.message}`);
}

export async function rotateSecret(sb: SupabaseClient, owner: Owner, id: string): Promise<{ secret: string }> {
  await getOwnedEndpoint(sb, owner, id);
  const secret = generateSecret();
  const { error } = await sb
    .from("webhook_endpoints")
    .update({ secret, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_type", owner.type)
    .eq("owner_id", owner.id);
  if (error) throw new Error(`rotateSecret: ${error.message}`);
  return { secret };
}

export async function listDeliveriesPage(
  sb: SupabaseClient,
  owner: Owner,
  endpointId: string,
  o: { limit: number; cursor: Cursor | null; status?: string },
): Promise<{ data: DeliveryDto[]; next_cursor: string | null }> {
  await getOwnedEndpoint(sb, owner, endpointId);
  let q = sb.from("webhook_deliveries").select("*").eq("endpoint_id", endpointId) as unknown as ChainedQuery;
  if (o.status) q = q.eq("status", o.status);
  q = applyCursor(q, o.cursor);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(o.limit + 1);
  if (error) throw new Error(`listDeliveriesPage: ${error.message}`);
  const page = pageResult((data ?? []) as DeliveryRow[], o.limit);
  return { data: page.data.map(toDeliveryDto), next_cursor: page.next_cursor };
}

export async function replayDelivery(
  sb: SupabaseClient,
  owner: Owner,
  endpointId: string,
  deliveryId: string,
): Promise<DeliveryDto> {
  await getOwnedEndpoint(sb, owner, endpointId);
  const { data: existing, error: readError } = await sb
    .from("webhook_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("endpoint_id", endpointId)
    .maybeSingle();
  if (readError) throw new Error(`replayDelivery: ${readError.message}`);
  if (!existing) throw notFound();
  const row = existing as DeliveryRow;
  if (row.status !== "dead" && row.status !== "failed") {
    throw new ApiError(409, "conflict", "Only failed or dead-lettered deliveries can be replayed.");
  }
  const { data, error } = await sb
    .from("webhook_deliveries")
    .update({
      status: "pending",
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      dead_lettered_at: null,
      last_error: null,
      claimed_at: null,
      claimed_by: null,
    })
    .eq("id", deliveryId)
    .eq("endpoint_id", endpointId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`replayDelivery: ${error?.message ?? "no row"}`);
  return toDeliveryDto(data as DeliveryRow);
}
