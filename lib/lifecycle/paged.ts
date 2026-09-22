/**
 * Cursor-paged list functions for the public API. Kept separate from the
 * existing list* helpers (which stay unpaged for the portal pages).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCursor, pageResult, type Cursor } from "../apiv1/pagination.ts";
import type { Invoice, Payment, Project, StoredFile, Ticket } from "./types.ts";
import type { BriefRow } from "../apiv1/serializers.ts";

export type PageOpts = { limit: number; cursor: Cursor | null };
export type Page<T> = { data: T[]; next_cursor: string | null };

type Row = { id: string; created_at: string };

/** Minimal chainable shape the loop below needs; the real PostgREST builder satisfies it. */
type ChainedQuery = {
  eq(col: string, val: string): ChainedQuery;
  or(filter: string): ChainedQuery;
  order(col: string, opts: { ascending: boolean }): ChainedQuery;
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

async function run<T extends Row>(
  fn: string,
  sb: SupabaseClient,
  table: string,
  clientId: string,
  opts: PageOpts,
  filters: Record<string, string | undefined>,
): Promise<Page<T>> {
  let q = sb.from(table).select("*").eq("client_id", clientId) as unknown as ChainedQuery;
  for (const [col, val] of Object.entries(filters)) if (val) q = q.eq(col, val);
  q = applyCursor(q, opts.cursor);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit + 1);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return pageResult((data ?? []) as T[], opts.limit);
}

export const listProjectsPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Project>("listProjectsPage", sb, "projects", clientId, o, { status: o.status });
export const listTicketsPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Ticket>("listTicketsPage", sb, "tickets", clientId, o, { status: o.status });
export const listFilesPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { projectId?: string }) =>
  run<StoredFile>("listFilesPage", sb, "files", clientId, o, { project_id: o.projectId });
export const listInvoicesPage = (sb: SupabaseClient, clientId: string, o: PageOpts & { status?: string }) =>
  run<Invoice>("listInvoicesPage", sb, "invoices", clientId, o, { status: o.status });
export const listPaymentsPage = (sb: SupabaseClient, clientId: string, o: PageOpts) =>
  run<Payment>("listPaymentsPage", sb, "payments", clientId, o, {});
export const listBriefsPage = (sb: SupabaseClient, clientId: string, o: PageOpts) =>
  run<BriefRow>("listBriefsPage", sb, "briefs", clientId, o, {});
