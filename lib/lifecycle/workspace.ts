/**
 * Client Lifecycle Platform — project workspace.
 *
 * Requests (client change/work requests), unified message threads
 * (project / request / ticket), and client approvals.
 *
 * Server-only. Service-role Supabase access via requireSupabase();
 * tables owned here: requests, messages, approvals.
 */

import { nowIso, requireSupabase } from "@/lib/lifecycle/core";
import {
  CHANGE_ORDER_CATEGORIES,
  type Approval,
  type ApprovalStatus,
  type ClientRequest,
  type Message,
  type RequestCategory,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/lifecycle/types";

const MAX_MESSAGE_LENGTH = 10000;
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 50;

/** Escape LIKE/ILIKE wildcards in user-supplied search terms. */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function createRequest(input: {
  clientId: string;
  projectId?: string | null;
  milestoneId?: string | null;
  requesterType: "client" | "admin";
  requesterClientUserId?: string | null;
  requesterName: string;
  category: RequestCategory;
  priority?: RequestPriority;
  title: string;
  description: string;
}): Promise<ClientRequest> {
  const sb = requireSupabase();
  const title = input.title.trim();
  if (!title) throw new Error("createRequest: title is required.");

  const { data, error } = await sb
    .from("requests")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      milestone_id: input.milestoneId ?? null,
      requester_type: input.requesterType,
      requester_client_user_id: input.requesterClientUserId ?? null,
      requester_name: input.requesterName,
      category: input.category,
      priority: input.priority ?? "normal",
      title,
      description: input.description ?? "",
      status: "open",
      change_order_required: CHANGE_ORDER_CATEGORIES.includes(input.category),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createRequest: ${error?.message || "insert returned no row"}`);
  }
  return data as ClientRequest;
}

export async function getRequest(id: string): Promise<ClientRequest | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRequest: ${error.message}`);
  return (data as ClientRequest) || null;
}

export async function listRequestsForClient(
  clientId: string,
  opts: { status?: RequestStatus; limit?: number } = {},
): Promise<ClientRequest[]> {
  const sb = requireSupabase();
  let query = sb
    .from("requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? DEFAULT_LIST_LIMIT);
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw new Error(`listRequestsForClient: ${error.message}`);
  return (data || []) as ClientRequest[];
}

export async function listRequests(
  filters: {
    status?: RequestStatus;
    category?: RequestCategory;
    assignedAdminId?: string;
    limit?: number;
  } = {},
): Promise<ClientRequest[]> {
  const sb = requireSupabase();
  let query = sb
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? DEFAULT_LIST_LIMIT);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.assignedAdminId) query = query.eq("assigned_admin_id", filters.assignedAdminId);
  const { data, error } = await query;
  if (error) throw new Error(`listRequests: ${error.message}`);
  return (data || []) as ClientRequest[];
}

export async function updateRequest(
  id: string,
  patch: {
    status?: RequestStatus;
    priority?: RequestPriority;
    assignedAdminId?: string | null;
    dueAt?: string | null;
    changeOrderRequired?: boolean;
    milestoneId?: string | null;
  },
): Promise<ClientRequest> {
  const sb = requireSupabase();
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.assignedAdminId !== undefined) update.assigned_admin_id = patch.assignedAdminId;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.changeOrderRequired !== undefined) {
    update.change_order_required = patch.changeOrderRequired;
  }
  if (patch.milestoneId !== undefined) update.milestone_id = patch.milestoneId;

  const { data, error } = await sb
    .from("requests")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`updateRequest: ${error.message}`);
  if (!data) throw new Error("updateRequest: request not found.");
  return data as ClientRequest;
}

export async function resolveRequest(
  id: string,
  input: { resolution: string },
): Promise<ClientRequest> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("requests")
    .update({
      status: "resolved",
      resolution: input.resolution,
      resolved_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`resolveRequest: ${error.message}`);
  if (!data) throw new Error("resolveRequest: request not found.");
  return data as ClientRequest;
}

// ---------------------------------------------------------------------------
// Messages (unified threads: project wall, request thread, ticket thread)
// ---------------------------------------------------------------------------

export async function addMessage(input: {
  clientId: string;
  projectId?: string | null;
  requestId?: string | null;
  ticketId?: string | null;
  authorType: "client" | "admin" | "system";
  authorClientUserId?: string | null;
  authorAdminId?: string | null;
  authorName: string;
  body: string;
  /** Internal notes are admin-only; ignored for client/system authors. */
  internal?: boolean;
  mentions?: string[];
}): Promise<Message> {
  const sb = requireSupabase();
  const body = input.body.trim();
  if (!body) throw new Error("addMessage: message body is required.");
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`addMessage: message body exceeds ${MAX_MESSAGE_LENGTH} characters.`);
  }
  // Client (and system) authors can never create internal notes.
  const internal = input.authorType === "admin" && Boolean(input.internal);

  // Workflow transitions (e.g. request status changes on reply) are
  // intentionally left to callers — this function only inserts the message.
  const { data, error } = await sb
    .from("messages")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      request_id: input.requestId ?? null,
      ticket_id: input.ticketId ?? null,
      author_type: input.authorType,
      author_client_user_id: input.authorClientUserId ?? null,
      author_admin_id: input.authorAdminId ?? null,
      author_name: input.authorName,
      body,
      internal,
      mentions: input.mentions ?? [],
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`addMessage: ${error?.message || "insert returned no row"}`);
  }
  return data as Message;
}

export type MessageScope =
  | { requestId: string }
  | { ticketId: string }
  | { projectId: string };

export async function listMessages(
  scope: MessageScope,
  opts: { includeInternal: boolean; limit?: number },
): Promise<Message[]> {
  const sb = requireSupabase();
  let query = sb.from("messages").select("*");
  if ("requestId" in scope) {
    query = query.eq("request_id", scope.requestId);
  } else if ("ticketId" in scope) {
    query = query.eq("ticket_id", scope.ticketId);
  } else {
    // Project wall: direct project messages only, not request/ticket threads.
    query = query
      .eq("project_id", scope.projectId)
      .is("request_id", null)
      .is("ticket_id", null);
  }
  // Client safety: internal notes must never leave admin surfaces.
  if (!opts.includeInternal) query = query.eq("internal", false);
  query = query.order("created_at", { ascending: true });
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`listMessages: ${error.message}`);
  return (data || []) as Message[];
}

export async function searchMessages(
  clientId: string,
  q: string,
  opts: { includeInternal: boolean; limit?: number },
): Promise<Message[]> {
  const term = q.trim();
  if (!term) return [];
  const sb = requireSupabase();
  let query = sb
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .ilike("body", `%${escapeLikeTerm(term)}%`)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? DEFAULT_SEARCH_LIMIT);
  if (!opts.includeInternal) query = query.eq("internal", false);

  const { data, error } = await query;
  if (error) throw new Error(`searchMessages: ${error.message}`);
  return (data || []) as Message[];
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function createApproval(input: {
  clientId: string;
  projectId?: string | null;
  milestoneId?: string | null;
  fileId?: string | null;
  title: string;
  description?: string;
  requestedBy?: string | null;
  dueAt?: string | null;
}): Promise<Approval> {
  const sb = requireSupabase();
  const title = input.title.trim();
  if (!title) throw new Error("createApproval: title is required.");

  const { data, error } = await sb
    .from("approvals")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      milestone_id: input.milestoneId ?? null,
      file_id: input.fileId ?? null,
      title,
      description: input.description ?? "",
      status: "pending",
      requested_by: input.requestedBy ?? null,
      due_at: input.dueAt ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createApproval: ${error?.message || "insert returned no row"}`);
  }
  return data as Approval;
}

export async function listApprovalsForClient(
  clientId: string,
  opts: { status?: ApprovalStatus } = {},
): Promise<Approval[]> {
  const sb = requireSupabase();
  let query = sb
    .from("approvals")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw new Error(`listApprovalsForClient: ${error.message}`);
  return (data || []) as Approval[];
}

export async function decideApproval(
  id: string,
  input: {
    decision: "approved" | "changes_requested";
    decidedByClientUserId?: string | null;
    decidedByName: string;
    note?: string;
  },
): Promise<Approval> {
  const sb = requireSupabase();
  // The status guard makes the decision one-shot: only pending approvals move.
  const { data, error } = await sb
    .from("approvals")
    .update({
      status: input.decision,
      decided_at: nowIso(),
      decided_by_client_user_id: input.decidedByClientUserId ?? null,
      decided_by_name: input.decidedByName,
      decision_note: input.note ?? null,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`decideApproval: ${error.message}`);
  if (!data) throw new Error("decideApproval: approval not found or already decided.");
  return data as Approval;
}

export async function cancelApproval(id: string): Promise<Approval> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("approvals")
    .update({ status: "cancelled", updated_at: nowIso() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`cancelApproval: ${error.message}`);
  if (!data) throw new Error("cancelApproval: approval not found or already decided.");
  return data as Approval;
}
