/**
 * Client Lifecycle Platform — support ticketing.
 *
 * Server-only data access for tickets and sla_policies. Ticket threads are
 * message rows owned by the workspace module (workspace.addMessage) — this
 * module never touches the messages table.
 *
 * SLA rule: a response target is stamped onto a ticket only when the policy
 * for its priority is enabled. Unconfigured targets are never promised.
 */

import { requireSupabase, nowIso } from "@/lib/lifecycle/core";
import type {
  SlaPolicy,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/lifecycle/types";

/** Most severe first — used to order policy lists and admin queues. */
const PRIORITY_SEVERITY: TicketPriority[] = [
  "critical",
  "urgent",
  "high",
  "normal",
  "low",
];

// ---------------------------------------------------------------------------
// SLA policies
// ---------------------------------------------------------------------------

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("sla_policies").select("*");
  if (error) throw new Error(`Failed to load SLA policies: ${error.message}`);
  const policies = (data ?? []) as SlaPolicy[];
  return policies.sort(
    (a, b) =>
      PRIORITY_SEVERITY.indexOf(a.priority) - PRIORITY_SEVERITY.indexOf(b.priority),
  );
}

export async function updateSlaPolicy(
  priority: TicketPriority,
  patch: {
    targetResponseMinutes?: number;
    targetResolutionMinutes?: number;
    enabled?: boolean;
  },
): Promise<SlaPolicy> {
  const sb = requireSupabase();
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.targetResponseMinutes !== undefined) {
    update.target_response_minutes = patch.targetResponseMinutes;
  }
  if (patch.targetResolutionMinutes !== undefined) {
    update.target_resolution_minutes = patch.targetResolutionMinutes;
  }
  if (patch.enabled !== undefined) update.enabled = patch.enabled;

  const { data, error } = await sb
    .from("sla_policies")
    .update(update)
    .eq("priority", priority)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to update SLA policy for ${priority}: ${error.message}`);
  }
  return data as SlaPolicy;
}

/** Response target for a priority — only when that policy is enabled. */
async function targetResponseMinutesFor(
  priority: TicketPriority,
): Promise<number | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("sla_policies")
    .select("target_response_minutes, enabled")
    .eq("priority", priority)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load SLA policy for ${priority}: ${error.message}`);
  }
  const policy = data as Pick<SlaPolicy, "target_response_minutes" | "enabled"> | null;
  return policy?.enabled ? policy.target_response_minutes : null;
}

// ---------------------------------------------------------------------------
// Ticket creation & lookup
// ---------------------------------------------------------------------------

export type CreateTicketInput = {
  clientId: string;
  projectId?: string | null;
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  openedByClientUserId?: string | null;
  openedByName: string;
};

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const sb = requireSupabase();
  const priority = input.priority ?? "normal";
  const targetResponseMinutes = await targetResponseMinutesFor(priority);
  const now = nowIso();

  const { data, error } = await sb
    .from("tickets")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      category: input.category,
      priority,
      subject: input.subject,
      description: input.description,
      status: "submitted",
      opened_by_client_user_id: input.openedByClientUserId ?? null,
      opened_by_name: input.openedByName,
      target_response_minutes: targetResponseMinutes,
      last_activity_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create ticket: ${error.message}`);
  return data as Ticket;
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load ticket ${id}: ${error.message}`);
  return (data as Ticket) ?? null;
}

export async function getTicketByNumber(n: number): Promise<Ticket | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("number", n)
    .maybeSingle();
  if (error) throw new Error(`Failed to load ticket #${n}: ${error.message}`);
  return (data as Ticket) ?? null;
}

export async function listTicketsForClient(
  clientId: string,
  opts: { status?: TicketStatus; limit?: number } = {},
): Promise<Ticket[]> {
  const sb = requireSupabase();
  let query = sb
    .from("tickets")
    .select("*")
    .eq("client_id", clientId)
    .order("last_activity_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list tickets for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as Ticket[];
}

export async function listTickets(
  filters: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedAdminId?: string;
    category?: TicketCategory;
    limit?: number;
  } = {},
): Promise<Ticket[]> {
  const sb = requireSupabase();
  let query = sb
    .from("tickets")
    .select("*")
    .order("last_activity_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignedAdminId) query = query.eq("assigned_admin_id", filters.assignedAdminId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list tickets: ${error.message}`);
  return (data ?? []) as Ticket[];
}

// ---------------------------------------------------------------------------
// Ticket lifecycle
// ---------------------------------------------------------------------------

export type UpdateTicketPatch = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAdminId?: string | null;
  projectId?: string | null;
};

/**
 * Applies an admin-side change. Every change bumps last_activity_at and
 * updated_at; a priority change re-derives the SLA response target; moving to
 * resolved/closed stamps the corresponding timestamp.
 */
export async function updateTicket(
  id: string,
  patch: UpdateTicketPatch,
): Promise<Ticket> {
  const sb = requireSupabase();
  const now = nowIso();
  const update: Record<string, unknown> = {
    last_activity_at: now,
    updated_at: now,
  };

  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === "resolved") update.resolved_at = now;
    if (patch.status === "closed") update.closed_at = now;
  }
  if (patch.priority !== undefined) {
    update.priority = patch.priority;
    update.target_response_minutes = await targetResponseMinutesFor(patch.priority);
  }
  if (patch.assignedAdminId !== undefined) update.assigned_admin_id = patch.assignedAdminId;
  if (patch.projectId !== undefined) update.project_id = patch.projectId;

  const { data, error } = await sb
    .from("tickets")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update ticket ${id}: ${error.message}`);
  return data as Ticket;
}

/**
 * Stamps first_response_at exactly once (called after the first admin reply).
 * Returns true when this call set it, false when it was already recorded.
 */
export async function recordFirstResponseIfNeeded(ticketId: string): Promise<boolean> {
  const sb = requireSupabase();
  const now = nowIso();
  const { data, error } = await sb
    .from("tickets")
    .update({ first_response_at: now, last_activity_at: now, updated_at: now })
    .eq("id", ticketId)
    .is("first_response_at", null)
    .select("id");
  if (error) {
    throw new Error(`Failed to record first response for ticket ${ticketId}: ${error.message}`);
  }
  return ((data ?? []) as { id: string }[]).length > 0;
}

export async function resolveTicket(
  id: string,
  opts: { resolutionNotes: string },
): Promise<Ticket> {
  const sb = requireSupabase();
  const now = nowIso();
  const { data, error } = await sb
    .from("tickets")
    .update({
      status: "resolved",
      resolution_notes: opts.resolutionNotes,
      resolved_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to resolve ticket ${id}: ${error.message}`);
  return data as Ticket;
}

/** Client confirms a resolved ticket is actually fixed: resolved → closed. */
export async function confirmTicketClosure(id: string): Promise<Ticket> {
  const sb = requireSupabase();
  const now = nowIso();
  const { data, error } = await sb
    .from("tickets")
    .update({
      status: "closed",
      closed_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "resolved")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to close ticket ${id}: ${error.message}`);
  if (!data) {
    throw new Error(`Cannot confirm closure of ticket ${id}: it is not in a resolved state.`);
  }
  return data as Ticket;
}

/** Reopens a resolved or closed ticket back to in_progress. */
export async function reopenTicket(id: string): Promise<Ticket> {
  const sb = requireSupabase();
  const now = nowIso();
  const { data, error } = await sb
    .from("tickets")
    .update({
      status: "in_progress",
      resolved_at: null,
      closed_at: null,
      last_activity_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["resolved", "closed"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to reopen ticket ${id}: ${error.message}`);
  if (!data) {
    throw new Error(`Cannot reopen ticket ${id}: it is not resolved or closed.`);
  }
  return data as Ticket;
}

// ---------------------------------------------------------------------------
// Automation support & stats
// ---------------------------------------------------------------------------

/**
 * Tickets with no activity inside the window — feeds the inactivity nudge
 * automation. Defaults to tickets waiting on the client.
 */
export async function findInactiveTickets(opts: {
  inactiveMinutes: number;
  statuses?: TicketStatus[];
}): Promise<Ticket[]> {
  const sb = requireSupabase();
  const statuses = opts.statuses?.length ? opts.statuses : ["waiting_on_client"];
  const cutoff = new Date(Date.now() - opts.inactiveMinutes * 60_000).toISOString();

  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .in("status", statuses)
    .lt("last_activity_at", cutoff)
    .order("last_activity_at", { ascending: true });
  if (error) throw new Error(`Failed to find inactive tickets: ${error.message}`);
  return (data ?? []) as Ticket[];
}

/** Support workload snapshot, optionally scoped to one client. */
export async function ticketStats(clientId?: string): Promise<{
  open: number;
  waitingOnClient: number;
  resolved30d: number;
}> {
  const sb = requireSupabase();
  const scoped = (query: ReturnType<typeof buildCountQuery>) =>
    clientId ? query.eq("client_id", clientId) : query;
  const buildCountQuery = () =>
    sb.from("tickets").select("id", { count: "exact", head: true });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

  const [openRes, waitingRes, resolvedRes] = await Promise.all([
    scoped(buildCountQuery()).not("status", "in", "(resolved,closed)"),
    scoped(buildCountQuery()).eq("status", "waiting_on_client"),
    scoped(buildCountQuery()).gte("resolved_at", thirtyDaysAgo),
  ]);

  if (openRes.error) {
    throw new Error(`Failed to count open tickets: ${openRes.error.message}`);
  }
  if (waitingRes.error) {
    throw new Error(`Failed to count waiting tickets: ${waitingRes.error.message}`);
  }
  if (resolvedRes.error) {
    throw new Error(`Failed to count resolved tickets: ${resolvedRes.error.message}`);
  }

  return {
    open: openRes.count ?? 0,
    waitingOnClient: waitingRes.count ?? 0,
    resolved30d: resolvedRes.count ?? 0,
  };
}
