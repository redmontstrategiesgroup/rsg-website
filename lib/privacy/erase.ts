import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Data-subject export and erasure (GDPR/CCPA DSAR support).
 *
 * The app writes a person's PII across several tables — not just `leads`. A
 * DSAR that only touched leads left bookings, newsletter subscription, and any
 * portal client account behind. These helpers cover every table the app writes
 * for a data subject, keyed by their email.
 *
 * Every table op is individually guarded: some tables (the client-lifecycle
 * set) may not be migrated on a given deployment, and a missing table must
 * NOT abort erasure of the tables that DO exist. Each op reports its outcome so
 * the caller (and the audit log) records exactly what was and was not erased.
 */

export type TableOutcome = {
  table: string;
  deleted: number;
  status: "ok" | "skipped" | "error";
  detail?: string;
};

/** Delete rows where `column = value`; returns a guarded outcome (never throws). */
async function deleteWhere(
  sb: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<TableOutcome> {
  try {
    const { data, error } = await sb
      .from(table)
      .delete()
      .eq(column, value)
      .select("id");
    if (error) {
      // Missing/unmigrated table or permission issue — skip, don't abort.
      return { table, deleted: 0, status: "skipped", detail: error.message };
    }
    return { table, deleted: data?.length ?? 0, status: "ok" };
  } catch (err) {
    return {
      table,
      deleted: 0,
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Guarded select; returns [] on any failure so a missing table is invisible. */
async function selectWhere(
  sb: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  value: string
): Promise<unknown[]> {
  try {
    const { data, error } = await sb.from(table).select(columns).eq(column, value);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** True if a portal client account exists for this email. */
export async function clientAccountExists(
  sb: SupabaseClient,
  email: string
): Promise<boolean> {
  const rows = await selectWhere(sb, "clients", "id", "email", email);
  return rows.length > 0;
}

/**
 * Everything the system holds for a data subject, by email. Scoped to that one
 * person; nothing is joined across other subjects.
 */
export async function exportDataSubject(
  sb: SupabaseClient,
  email: string
): Promise<{
  email: string;
  leads: unknown[];
  bookings: unknown[];
  subscriber: unknown[];
  clientAccount: unknown[];
  clientUsers: unknown[];
  exportedAt: string;
}> {
  const leads = await selectWhere(sb, "leads", "*", "email", email);
  const leadIds = (leads as { id?: string }[]).map((r) => r.id).filter(Boolean) as string[];

  let bookings: unknown[] = [];
  if (leadIds.length) {
    try {
      const { data } = await sb
        .from("bookings")
        .select("id, starts_at, status, lead_id")
        .in("lead_id", leadIds);
      bookings = data ?? [];
    } catch {
      bookings = [];
    }
  }

  // Client account is returned WITHOUT the password hash.
  const clientAccount = await selectWhere(
    sb,
    "clients",
    "id, email, name, company, plan, member_since, strategist",
    "email",
    email
  );
  const clientUsers = await selectWhere(
    sb,
    "client_users",
    "id, email, name, role, client_id",
    "email",
    email
  );
  const subscriber = await selectWhere(sb, "subscribers", "*", "email", email);

  return {
    email,
    leads,
    bookings,
    subscriber,
    clientAccount,
    clientUsers,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Erase a data subject's PII by email.
 *
 * Always erases the marketing/intake footprint: leads (+ their bookings) and
 * newsletter subscription. The portal client ACCOUNT is only erased when
 * `includeClientAccount` is explicitly true — deleting a live client account
 * (and its cascade of sessions, subscriptions, roadmaps, service records) is
 * destructive and must be a conscious choice, not a side effect of clearing a
 * stray lead. Deleting the `clients` row cascades to its FK-CASCADE children;
 * `client_users` is erased explicitly (it may live in an unmigrated schema).
 */
export async function eraseDataSubject(
  sb: SupabaseClient,
  email: string,
  opts: { includeClientAccount?: boolean } = {}
): Promise<{ outcomes: TableOutcome[]; clientAccountPresent: boolean }> {
  const outcomes: TableOutcome[] = [];

  // 1. Leads → delete their bookings first (FK), then the leads.
  const leadRows = await selectWhere(sb, "leads", "id", "email", email);
  const leadIds = (leadRows as { id?: string }[]).map((r) => r.id).filter(Boolean) as string[];
  if (leadIds.length) {
    try {
      const { data, error } = await sb
        .from("bookings")
        .delete()
        .in("lead_id", leadIds)
        .select("id");
      outcomes.push(
        error
          ? { table: "bookings", deleted: 0, status: "skipped", detail: error.message }
          : { table: "bookings", deleted: data?.length ?? 0, status: "ok" }
      );
    } catch (err) {
      outcomes.push({
        table: "bookings",
        deleted: 0,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  outcomes.push(await deleteWhere(sb, "leads", "email", email));

  // 2. Newsletter subscription.
  outcomes.push(await deleteWhere(sb, "subscribers", "email", email));

  // 3. Portal account — explicit opt-in only.
  const clientAccountPresent = await clientAccountExists(sb, email);
  if (opts.includeClientAccount) {
    // client_users first (lifecycle schema, guarded), then the clients row
    // (cascades to sessions/subscriptions/roadmaps/service_* via FK).
    outcomes.push(await deleteWhere(sb, "client_users", "email", email));
    outcomes.push(await deleteWhere(sb, "clients", "email", email));
  }

  return { outcomes, clientAccountPresent };
}
