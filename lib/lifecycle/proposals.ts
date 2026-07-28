import { newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type {
  PaymentScheduleEntry,
  Proposal,
  ProposalComment,
  ProposalEventName,
  ProposalOption,
  ProposalSection,
  ProposalStatus,
} from "@/lib/lifecycle/types";
import {
  PROPOSAL_TEMPLATES,
  buildProposalSections,
} from "@/lib/lifecycle/proposal-templates";

/**
 * Proposals — data access, tracking, and approval workflow.
 * Templates/copy live in proposal-templates.ts.
 */

const EDITABLE_STATUSES: ProposalStatus[] = [
  "draft",
  "sent",
  "viewed",
  "revision_requested",
];

export async function createProposal(input: {
  opportunityId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  templateKey: string;
  title?: string;
  businessName: string;
  challenges?: string[];
  outcomes?: string[];
  totalCents: number;
  depositCents: number;
  expiresInDays?: number;
  createdBy?: string;
}): Promise<{ proposal: Proposal; options: ProposalOption[] }> {
  const sb = requireSupabase();
  const template = PROPOSAL_TEMPLATES[input.templateKey];
  if (!template) throw new Error(`Unknown proposal template: ${input.templateKey}`);

  const sections = buildProposalSections(input.templateKey, {
    businessName: input.businessName,
    challenges: input.challenges ?? [],
    outcomes: input.outcomes ?? [],
    totalCents: input.totalCents,
    depositCents: input.depositCents,
  });
  const expiresInDays = input.expiresInDays ?? 14;

  const { data, error } = await sb
    .from("lifecycle_proposals")
    .insert({
      opportunity_id: input.opportunityId ?? null,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      token: newToken(),
      title: input.title?.trim() || `${template.title} — ${input.businessName}`,
      status: "draft" satisfies ProposalStatus,
      total_cents: input.totalCents,
      deposit_cents: input.depositCents,
      payment_schedule: template.buildSchedule(input.totalCents, input.depositCents),
      sections,
      created_from_template_key: input.templateKey,
      expires_at: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
      created_by: input.createdBy ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create proposal: ${error?.message ?? "no row returned"}`);
  }
  const proposal = data as Proposal;

  let options: ProposalOption[] = [];
  if (template.defaultOptions.length > 0) {
    const { data: optData, error: optError } = await sb
      .from("proposal_options")
      .insert(
        template.defaultOptions.map((o, i) => ({
          proposal_id: proposal.id,
          title: o.title,
          description: o.description,
          price_cents: o.price_cents,
          billing: o.billing,
          selected: false,
          sort_order: o.sort_order ?? i,
        })),
      )
      .select("*");
    if (optError) {
      throw new Error(`Failed to create proposal options: ${optError.message}`);
    }
    options = ((optData ?? []) as ProposalOption[]).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
  }
  return { proposal, options };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

async function loadRelated(proposalId: string): Promise<{
  options: ProposalOption[];
  comments: ProposalComment[];
}> {
  const sb = requireSupabase();
  const [optRes, comRes] = await Promise.all([
    sb
      .from("proposal_options")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order", { ascending: true }),
    sb
      .from("proposal_comments")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true }),
  ]);
  return {
    options: (optRes.data ?? []) as ProposalOption[],
    comments: (comRes.data ?? []) as ProposalComment[],
  };
}

export async function getProposal(id: string): Promise<{
  proposal: Proposal;
  options: ProposalOption[];
  comments: ProposalComment[];
} | null> {
  const sb = requireSupabase();
  const { data } = await sb.from("lifecycle_proposals").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const related = await loadRelated((data as Proposal).id);
  return { proposal: data as Proposal, ...related };
}

/** Public token lookup — lazily expires overdue sent/viewed proposals. */
export async function getProposalByToken(token: string): Promise<{
  proposal: Proposal;
  options: ProposalOption[];
  comments: ProposalComment[];
} | null> {
  if (!token || token.length < 16) return null;
  const sb = requireSupabase();
  const { data } = await sb.from("lifecycle_proposals").select("*").eq("token", token).maybeSingle();
  if (!data) return null;
  let proposal = data as Proposal;

  const shouldExpire =
    (proposal.status === "sent" || proposal.status === "viewed") &&
    proposal.expires_at &&
    new Date(proposal.expires_at).getTime() < Date.now();
  if (shouldExpire) {
    const { data: updated } = await sb
      .from("lifecycle_proposals")
      .update({ status: "expired" satisfies ProposalStatus, updated_at: nowIso() })
      .eq("id", proposal.id)
      .select("*")
      .single();
    if (updated) proposal = updated as Proposal;
    await recordProposalEvent(proposal.id, "expired", { actor: "system" });
  }

  const related = await loadRelated(proposal.id);
  return { proposal, ...related };
}

export async function listProposals(filters: {
  status?: ProposalStatus;
  opportunityId?: string;
  clientId?: string;
  limit?: number;
} = {}): Promise<Proposal[]> {
  const sb = requireSupabase();
  let query = sb
    .from("lifecycle_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.opportunityId) query = query.eq("opportunity_id", filters.opportunityId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list proposals: ${error.message}`);
  return (data ?? []) as Proposal[];
}

// ---------------------------------------------------------------------------
// Edit (admin)
// ---------------------------------------------------------------------------

export async function updateProposalContent(
  id: string,
  patch: {
    title?: string;
    sections?: ProposalSection[];
    totalCents?: number;
    depositCents?: number;
    paymentSchedule?: PaymentScheduleEntry[];
    expiresAt?: string | null;
  },
): Promise<Proposal> {
  const sb = requireSupabase();
  const { data: current } = await sb
    .from("lifecycle_proposals")
    .select("status, version, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error(`Proposal ${id} not found`);
  if (!EDITABLE_STATUSES.includes(current.status as ProposalStatus)) {
    throw new Error(`Proposal is ${current.status} and can no longer be edited.`);
  }

  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.sections !== undefined) {
    row.sections = patch.sections;
    // Content changed after the client saw it → new version for the record.
    if (current.sent_at) row.version = (current.version as number) + 1;
  }
  if (patch.totalCents !== undefined) row.total_cents = patch.totalCents;
  if (patch.depositCents !== undefined) row.deposit_cents = patch.depositCents;
  if (patch.paymentSchedule !== undefined) row.payment_schedule = patch.paymentSchedule;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;

  const { data, error } = await sb
    .from("lifecycle_proposals")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update proposal: ${error?.message ?? "no row returned"}`);
  }
  return data as Proposal;
}

export async function replaceOptions(
  proposalId: string,
  options: {
    title: string;
    description?: string;
    priceCents: number;
    billing: ProposalOption["billing"];
    selected?: boolean;
  }[],
): Promise<ProposalOption[]> {
  const sb = requireSupabase();
  const { error: delError } = await sb
    .from("proposal_options")
    .delete()
    .eq("proposal_id", proposalId);
  if (delError) throw new Error(`Failed to clear options: ${delError.message}`);
  if (options.length === 0) return [];

  const { data, error } = await sb
    .from("proposal_options")
    .insert(
      options.map((o, i) => ({
        proposal_id: proposalId,
        title: o.title,
        description: o.description ?? "",
        price_cents: o.priceCents,
        billing: o.billing,
        selected: o.selected ?? false,
        sort_order: i,
      })),
    )
    .select("*");
  if (error) throw new Error(`Failed to replace options: ${error.message}`);
  return ((data ?? []) as ProposalOption[]).sort((a, b) => a.sort_order - b.sort_order);
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export function proposalTotals(
  proposal: Proposal,
  options: ProposalOption[],
): {
  baseCents: number;
  selectedOneTimeCents: number;
  totalCents: number;
  recurringMonthlyCents: number;
  depositCents: number;
} {
  const selected = options.filter((o) => o.selected);
  const selectedOneTimeCents = selected
    .filter((o) => o.billing === "one_time")
    .reduce((sum, o) => sum + o.price_cents, 0);
  const recurringMonthlyCents = selected.reduce((sum, o) => {
    if (o.billing === "monthly") return sum + o.price_cents;
    if (o.billing === "quarterly") return sum + Math.round(o.price_cents / 3);
    if (o.billing === "annual") return sum + Math.round(o.price_cents / 12);
    return sum;
  }, 0);
  return {
    baseCents: proposal.total_cents,
    selectedOneTimeCents,
    totalCents: proposal.total_cents + selectedOneTimeCents,
    recurringMonthlyCents,
    depositCents: proposal.deposit_cents,
  };
}

export async function setOptionSelected(
  proposalId: string,
  optionId: string,
  selected: boolean,
): Promise<{ options: ProposalOption[]; totalCents: number; recurringMonthlyCents: number }> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("proposal_options")
    .update({ selected })
    .eq("id", optionId)
    .eq("proposal_id", proposalId);
  if (error) throw new Error(`Failed to update option: ${error.message}`);

  const loaded = await getProposal(proposalId);
  if (!loaded) throw new Error(`Proposal ${proposalId} not found`);
  const totals = proposalTotals(loaded.proposal, loaded.options);

  await recordProposalEvent(proposalId, selected ? "option_selected" : "option_deselected", {
    metadata: { option_id: optionId },
  });
  return {
    options: loaded.options,
    totalCents: totals.totalCents,
    recurringMonthlyCents: totals.recurringMonthlyCents,
  };
}

// ---------------------------------------------------------------------------
// Status transitions & tracking
// ---------------------------------------------------------------------------

async function setStatus(id: string, status: ProposalStatus, extra: Record<string, unknown> = {}) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("lifecycle_proposals")
    .update({ status, ...extra, updated_at: nowIso() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to set proposal ${status}: ${error?.message ?? "no row"}`);
  }
  return data as Proposal;
}

export async function markProposalSent(id: string): Promise<Proposal> {
  const proposal = await setStatus(id, "sent", { sent_at: nowIso() });
  await recordProposalEvent(id, "sent", { actor: "admin" });
  return proposal;
}

export async function withdrawProposal(id: string): Promise<Proposal> {
  const proposal = await setStatus(id, "withdrawn");
  await recordProposalEvent(id, "withdrawn", { actor: "admin" });
  return proposal;
}

/**
 * Engagement tracking. "opened" flips sent → viewed and stamps first/last
 * viewed; "view_heartbeat" accumulates total viewing time; section views and
 * option toggles land in proposal_events for the admin timeline.
 */
export async function recordProposalEvent(
  proposalId: string,
  event: ProposalEventName,
  opts: {
    sectionKey?: string;
    actor?: "client" | "admin" | "system";
    metadata?: Record<string, unknown>;
    ip?: string;
    viewSeconds?: number;
  } = {},
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("proposal_events").insert({
    proposal_id: proposalId,
    event,
    section_key: opts.sectionKey ?? null,
    actor: opts.actor ?? "client",
    metadata: opts.metadata ?? {},
    ip: opts.ip ?? null,
  });
  if (error) throw new Error(`Failed to record proposal event: ${error.message}`);

  if (event === "opened") {
    const { data: current } = await sb
      .from("lifecycle_proposals")
      .select("status, first_viewed_at")
      .eq("id", proposalId)
      .maybeSingle();
    if (current) {
      const patch: Record<string, unknown> = {
        last_viewed_at: nowIso(),
        updated_at: nowIso(),
      };
      if (!current.first_viewed_at) patch.first_viewed_at = nowIso();
      if (current.status === "sent") patch.status = "viewed" satisfies ProposalStatus;
      await sb.from("lifecycle_proposals").update(patch).eq("id", proposalId);
    }
  } else if (event === "view_heartbeat" && opts.viewSeconds && opts.viewSeconds > 0) {
    const { data: current } = await sb
      .from("lifecycle_proposals")
      .select("total_view_seconds")
      .eq("id", proposalId)
      .maybeSingle();
    if (current) {
      await sb
        .from("lifecycle_proposals")
        .update({
          total_view_seconds:
            (current.total_view_seconds as number) + Math.min(opts.viewSeconds, 300),
          last_viewed_at: nowIso(),
        })
        .eq("id", proposalId);
    }
  }
}

export async function listProposalEvents(proposalId: string, limit = 200) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("proposal_events")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list proposal events: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Comments, revisions, approval
// ---------------------------------------------------------------------------

export async function addProposalComment(
  proposalId: string,
  input: {
    authorType: "client" | "admin";
    authorName: string;
    sectionKey?: string;
    body: string;
  },
): Promise<ProposalComment> {
  const body = input.body.trim();
  if (!body) throw new Error("Comment cannot be empty.");
  if (body.length > 5000) throw new Error("Comment is too long.");

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("proposal_comments")
    .insert({
      proposal_id: proposalId,
      author_type: input.authorType,
      author_name: input.authorName.trim(),
      section_key: input.sectionKey ?? null,
      body,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to add comment: ${error?.message ?? "no row returned"}`);
  }
  await recordProposalEvent(proposalId, "comment_added", {
    actor: input.authorType,
    sectionKey: input.sectionKey,
  });
  return data as ProposalComment;
}

export async function resolveComment(commentId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("proposal_comments")
    .update({ resolved_at: nowIso() })
    .eq("id", commentId);
  if (error) throw new Error(`Failed to resolve comment: ${error.message}`);
}

export async function requestRevision(
  proposalId: string,
  input: { name: string; note: string },
): Promise<Proposal> {
  const proposal = await setStatus(proposalId, "revision_requested");
  await addProposalComment(proposalId, {
    authorType: "client",
    authorName: input.name,
    body: input.note,
  });
  await recordProposalEvent(proposalId, "revision_requested", { actor: "client" });
  return proposal;
}

export async function approveProposal(
  proposalId: string,
  input: { name: string; ip: string },
): Promise<Proposal> {
  const sb = requireSupabase();
  const { data: current } = await sb
    .from("lifecycle_proposals")
    .select("status")
    .eq("id", proposalId)
    .maybeSingle();
  if (!current) throw new Error(`Proposal ${proposalId} not found`);
  if (current.status !== "sent" && current.status !== "viewed") {
    throw new Error(`Proposal is ${current.status} and cannot be approved.`);
  }

  const proposal = await setStatus(proposalId, "approved", {
    approved_at: nowIso(),
    approved_by_name: input.name.trim(),
    approved_ip: input.ip,
  });
  await recordProposalEvent(proposalId, "approved", {
    actor: "client",
    ip: input.ip,
    metadata: { name: input.name.trim() },
  });
  return proposal;
}

/** Cron sweep: expire overdue proposals. Returns how many flipped. */
export async function expireDueProposals(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("lifecycle_proposals")
    .update({ status: "expired" satisfies ProposalStatus, updated_at: nowIso() })
    .in("status", ["sent", "viewed"])
    .lt("expires_at", nowIso())
    .select("id");
  if (error) throw new Error(`Failed to expire proposals: ${error.message}`);
  const expired = (data ?? []) as { id: string }[];
  for (const row of expired) {
    await recordProposalEvent(row.id, "expired", { actor: "system" });
  }
  return expired.length;
}

/** Proposals expiring within `withinDays` (for the "expiring soon" nudge). */
export async function findProposalsExpiringSoon(withinDays = 3): Promise<Proposal[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("lifecycle_proposals")
    .select("*")
    .in("status", ["sent", "viewed"])
    .gt("expires_at", nowIso())
    .lt("expires_at", new Date(Date.now() + withinDays * 86_400_000).toISOString())
    .limit(50);
  if (error) throw new Error(`Failed to find expiring proposals: ${error.message}`);
  return (data ?? []) as Proposal[];
}
