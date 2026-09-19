/**
 * Cursor-paged Supabase queries and mutations backing the admin API
 * (leads, clients, proposals, entities, audit events). Mirrors
 * `lib/lifecycle/paged.ts`'s structure but is not client-scoped.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCursor, pageResult, type Cursor } from "../apiv1/pagination.ts";
import { orIlike } from "../apiv1/search.ts";
import type { AuditRow, ClientRow, EntityRow, LeadRow } from "../apiv1/serializers-admin.ts";
import type { Proposal } from "./types.ts";

export type PageOpts = { limit: number; cursor: Cursor | null };
export type Page<T> = { data: T[]; next_cursor: string | null };

type Row = { id: string; created_at: string };

const CLIENT_COLUMNS = "id,email,name,company,plan,member_since,strategist,status,lead_id,created_at,updated_at";

/** Minimal chainable shape the loop below needs; the real PostgREST builder satisfies it. */
type ChainedQuery = {
  eq(col: string, val: string): ChainedQuery;
  is(col: string, val: null): ChainedQuery;
  or(filter: string): ChainedQuery;
  gte(col: string, val: string): ChainedQuery;
  order(col: string, opts: { ascending: boolean }): ChainedQuery;
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

async function run<T extends Row>(
  fn: string,
  sb: SupabaseClient,
  table: string,
  select: string,
  o: PageOpts,
  build: (q: ChainedQuery) => ChainedQuery,
): Promise<Page<T>> {
  let q = sb.from(table).select(select) as unknown as ChainedQuery;
  q = build(q);
  q = applyCursor(q, o.cursor);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(o.limit + 1);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return pageResult((data ?? []) as T[], o.limit);
}

export function listLeadsPage(
  sb: SupabaseClient,
  o: PageOpts & { q?: string | null; status?: string; since?: string },
): Promise<Page<LeadRow>> {
  return run<LeadRow>("listLeadsPage", sb, "leads", "*", o, (q) => {
    let r = q.is("deleted_at", null);
    if (o.q) r = r.or(orIlike(["name", "email", "business_name"], o.q));
    if (o.status) r = r.eq("status", o.status);
    if (o.since) r = r.gte("created_at", o.since);
    return r;
  });
}

export async function getLeadRow(sb: SupabaseClient, id: string): Promise<LeadRow | null> {
  const { data, error } = await (sb.from("leads").select("*") as unknown as {
    eq(col: string, val: string): { is(col: string, val: null): { maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }> } };
  })
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`getLeadRow: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

export async function softDeleteLead(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await (sb.from("leads").update({ deleted_at: new Date().toISOString() }) as unknown as {
    eq(col: string, val: string): { is(col: string, val: null): { select(cols: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } };
  })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`softDeleteLead: ${error.message}`);
  return (data ?? []).length > 0;
}

export function listClientsPage(
  sb: SupabaseClient,
  o: PageOpts & { q?: string | null; status?: string },
): Promise<Page<ClientRow>> {
  return run<ClientRow>("listClientsPage", sb, "clients", CLIENT_COLUMNS, o, (q) => {
    let r = q;
    if (o.q) r = r.or(orIlike(["name", "email", "company"], o.q));
    if (o.status) r = r.eq("status", o.status);
    return r;
  });
}

export async function getClientRow(sb: SupabaseClient, id: string): Promise<ClientRow | null> {
  const { data, error } = await (sb.from("clients").select(CLIENT_COLUMNS) as unknown as {
    eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }> };
  })
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getClientRow: ${error.message}`);
  return (data as ClientRow | null) ?? null;
}

export async function setClientStatus(
  sb: SupabaseClient,
  id: string,
  status: "active" | "paused" | "former",
): Promise<boolean> {
  const { data, error } = await (sb.from("clients").update({ status }) as unknown as {
    eq(col: string, val: string): { select(cols: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
  })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`setClientStatus: ${error.message}`);
  return (data ?? []).length > 0;
}

export function listProposalsPage(
  sb: SupabaseClient,
  o: PageOpts & { status?: string },
): Promise<Page<Proposal>> {
  return run<Proposal>("listProposalsPage", sb, "lifecycle_proposals", "*", o, (q) =>
    o.status ? q.eq("status", o.status) : q,
  );
}

export function listEntitiesPage(
  sb: SupabaseClient,
  table: string,
  o: PageOpts & { status?: string; stage?: string },
): Promise<Page<EntityRow>> {
  return run<EntityRow>("listEntitiesPage", sb, table, "*", o, (q) => {
    let r = q;
    if (o.status) r = r.eq("status", o.status);
    if (o.stage) r = r.eq("stage", o.stage);
    return r;
  });
}

export function listAuditPage(
  sb: SupabaseClient,
  o: PageOpts & { action?: string; since?: string },
): Promise<Page<AuditRow>> {
  return run<AuditRow>("listAuditPage", sb, "audit_events", "*", o, (q) => {
    let r = q;
    if (o.action) r = r.eq("action", o.action);
    if (o.since) r = r.gte("created_at", o.since);
    return r;
  });
}
