/**
 * Proposal storage & lifecycle (server-only).
 *
 * A proposal can carry a one-time implementation scope, a recurring
 * managed-service scope, or both. Clients accept from a tokenized public
 * page; accepting the recurring scope creates a client_subscriptions row
 * (and, when Stripe is configured, the caller sends them to checkout).
 */

import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";
import type {
  BillingFrequency,
  PlanAddon,
  Proposal,
  ProposalAcceptedScope,
  ProposalImplementation,
  ProposalKind,
  ProposalStatus,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "proposals.json");

async function readFileStore(): Promise<Proposal[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Proposal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileStore(rows: Proposal[]): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_FILE_STORE) {
    console.warn("[proposals] refusing file write in production. Configure Supabase.");
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function strOrNull(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function generateProposalToken(): string {
  return randomBytes(24).toString("base64url");
}

function rowToProposal(row: Record<string, unknown>): Proposal {
  const status = str(row.status, "draft") as ProposalStatus;
  const kind = str(row.kind, "implementation") as ProposalKind;
  return {
    id: str(row.id),
    token: str(row.token),
    clientId: strOrNull(row.client_id ?? row.clientId),
    leadId: strOrNull(row.lead_id ?? row.leadId),
    title: str(row.title),
    status: ["draft", "sent", "viewed", "accepted", "declined", "expired"].includes(
      status
    )
      ? status
      : "draft",
    kind: [
      "implementation",
      "monthly_service",
      "implementation_plus_monthly",
      "project_completion",
    ].includes(kind)
      ? kind
      : "implementation",
    summary: str(row.summary),
    preparedFor: str(row.prepared_for ?? row.preparedFor),
    implementation:
      ((row.implementation ?? {}) as ProposalImplementation) ?? {},
    planId: strOrNull(row.plan_id ?? row.planId),
    alternativePlanIds: Array.isArray(row.alternative_plan_ids)
      ? (row.alternative_plan_ids as string[])
      : Array.isArray(row.alternativePlanIds)
        ? (row.alternativePlanIds as string[])
        : [],
    billingFrequency:
      str(row.billing_frequency ?? row.billingFrequency) === "annual"
        ? "annual"
        : "monthly",
    monthlyPriceCents: numOrNull(row.monthly_price_cents ?? row.monthlyPriceCents),
    annualPriceCents: numOrNull(row.annual_price_cents ?? row.annualPriceCents),
    setupFeeCents: numOrNull(row.setup_fee_cents ?? row.setupFeeCents) ?? 0,
    includedSupport: str(row.included_support ?? row.includedSupport),
    serviceLevel: str(row.service_level ?? row.serviceLevel),
    minimumCommitmentMonths:
      numOrNull(row.minimum_commitment_months ?? row.minimumCommitmentMonths) ?? 0,
    addons: Array.isArray(row.addons) ? (row.addons as PlanAddon[]) : [],
    contractTerms: str(row.contract_terms ?? row.contractTerms),
    validUntil: strOrNull(row.valid_until ?? row.validUntil),
    sentAt: strOrNull(row.sent_at ?? row.sentAt),
    viewedAt: strOrNull(row.viewed_at ?? row.viewedAt),
    acceptedAt: strOrNull(row.accepted_at ?? row.acceptedAt),
    declinedAt: strOrNull(row.declined_at ?? row.declinedAt),
    acceptedScope:
      (row.accepted_scope as ProposalAcceptedScope | null) ??
      (row.acceptedScope as ProposalAcceptedScope | null) ??
      null,
    acceptanceName: str(row.acceptance_name ?? row.acceptanceName),
    acceptanceEmail: str(row.acceptance_email ?? row.acceptanceEmail),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    createdBy: str(row.created_by ?? row.createdBy),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function proposalToRow(p: Proposal): Record<string, unknown> {
  return {
    id: p.id,
    token: p.token,
    client_id: p.clientId,
    lead_id: p.leadId,
    title: p.title,
    status: p.status,
    kind: p.kind,
    summary: p.summary,
    prepared_for: p.preparedFor,
    implementation: p.implementation,
    plan_id: p.planId,
    alternative_plan_ids: p.alternativePlanIds,
    billing_frequency: p.billingFrequency,
    monthly_price_cents: p.monthlyPriceCents,
    annual_price_cents: p.annualPriceCents,
    setup_fee_cents: p.setupFeeCents,
    included_support: p.includedSupport,
    service_level: p.serviceLevel,
    minimum_commitment_months: p.minimumCommitmentMonths,
    addons: p.addons,
    contract_terms: p.contractTerms,
    valid_until: p.validUntil,
    sent_at: p.sentAt,
    viewed_at: p.viewedAt,
    accepted_at: p.acceptedAt,
    declined_at: p.declinedAt,
    accepted_scope: p.acceptedScope,
    acceptance_name: p.acceptanceName,
    acceptance_email: p.acceptanceEmail,
    subscription_id: p.subscriptionId,
    created_by: p.createdBy,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export type ProposalInput = {
  id?: string;
  clientId?: string | null;
  leadId?: string | null;
  title: string;
  kind: ProposalKind;
  summary?: string;
  preparedFor?: string;
  implementation?: ProposalImplementation;
  planId?: string | null;
  alternativePlanIds?: string[];
  billingFrequency?: BillingFrequency;
  monthlyPriceCents?: number | null;
  annualPriceCents?: number | null;
  setupFeeCents?: number;
  includedSupport?: string;
  serviceLevel?: string;
  minimumCommitmentMonths?: number;
  addons?: PlanAddon[];
  contractTerms?: string;
  validUntil?: string | null;
  status?: ProposalStatus;
  createdBy?: string;
};

export async function upsertProposal(input: ProposalInput): Promise<Proposal | null> {
  const existing = input.id ? await getProposalById(input.id) : null;
  const now = nowIso();
  const status = input.status ?? existing?.status ?? "draft";
  const proposal: Proposal = {
    id: existing?.id ?? input.id ?? randomUUID(),
    token: existing?.token ?? generateProposalToken(),
    clientId:
      input.clientId !== undefined ? input.clientId : existing?.clientId ?? null,
    leadId: input.leadId !== undefined ? input.leadId : existing?.leadId ?? null,
    title: input.title,
    status,
    kind: input.kind,
    summary: input.summary ?? existing?.summary ?? "",
    preparedFor: input.preparedFor ?? existing?.preparedFor ?? "",
    implementation: input.implementation ?? existing?.implementation ?? {},
    planId: input.planId !== undefined ? input.planId : existing?.planId ?? null,
    alternativePlanIds:
      input.alternativePlanIds ?? existing?.alternativePlanIds ?? [],
    billingFrequency:
      input.billingFrequency ?? existing?.billingFrequency ?? "monthly",
    monthlyPriceCents:
      input.monthlyPriceCents !== undefined
        ? input.monthlyPriceCents
        : existing?.monthlyPriceCents ?? null,
    annualPriceCents:
      input.annualPriceCents !== undefined
        ? input.annualPriceCents
        : existing?.annualPriceCents ?? null,
    setupFeeCents: input.setupFeeCents ?? existing?.setupFeeCents ?? 0,
    includedSupport: input.includedSupport ?? existing?.includedSupport ?? "",
    serviceLevel: input.serviceLevel ?? existing?.serviceLevel ?? "",
    minimumCommitmentMonths:
      input.minimumCommitmentMonths ?? existing?.minimumCommitmentMonths ?? 0,
    addons: input.addons ?? existing?.addons ?? [],
    contractTerms: input.contractTerms ?? existing?.contractTerms ?? "",
    validUntil:
      input.validUntil !== undefined
        ? input.validUntil
        : existing?.validUntil ?? null,
    sentAt:
      existing?.sentAt ?? (status === "sent" ? now : null),
    viewedAt: existing?.viewedAt ?? null,
    acceptedAt: existing?.acceptedAt ?? null,
    declinedAt: existing?.declinedAt ?? null,
    acceptedScope: existing?.acceptedScope ?? null,
    acceptanceName: existing?.acceptanceName ?? "",
    acceptanceEmail: existing?.acceptanceEmail ?? "",
    subscriptionId: existing?.subscriptionId ?? null,
    createdBy: input.createdBy ?? existing?.createdBy ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (status === "sent" && !proposal.sentAt) proposal.sentAt = now;

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("proposals")
        .upsert(proposalToRow(proposal), { onConflict: "id" });
      if (error) throw error;
      return proposal;
    } catch (err) {
      console.warn("[proposals] upsert failed — using file store.", err);
    }
  }

  const rows = await readFileStore();
  const idx = rows.findIndex((r) => r.id === proposal.id);
  if (idx === -1) rows.unshift(proposal);
  else rows[idx] = proposal;
  await writeFileStore(rows);
  return proposal;
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProposal(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[proposals] getById failed.", err);
    }
  }
  const rows = await readFileStore();
  return rows.find((r) => r.id === id) ?? null;
}

export async function getProposalByToken(token: string): Promise<Proposal | null> {
  if (!token || token.length < 16) return null;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToProposal(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[proposals] getByToken failed.", err);
    }
  }
  const rows = await readFileStore();
  return rows.find((r) => r.token === token) ?? null;
}

export async function listProposals(options?: {
  clientId?: string;
  statuses?: ProposalStatus[];
  limit?: number;
}): Promise<Proposal[]> {
  const limit = options?.limit ?? 200;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("proposals").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.statuses?.length)
        query = query.in("status", options.statuses);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToProposal(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[proposals] list failed.", err);
    }
  }
  const rows = await readFileStore();
  let out = rows;
  if (options?.clientId) out = out.filter((r) => r.clientId === options.clientId);
  if (options?.statuses?.length)
    out = out.filter((r) => options.statuses!.includes(r.status));
  return out.slice(0, limit);
}

async function patchProposal(
  id: string,
  patch: Partial<Proposal>
): Promise<Proposal | null> {
  const existing = await getProposalById(id);
  if (!existing) return null;
  const next: Proposal = { ...existing, ...patch, updatedAt: nowIso() };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const row = proposalToRow(next);
      delete row.id;
      delete row.token;
      delete row.created_at;
      const { error } = await supabase.from("proposals").update(row).eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[proposals] patch failed.", err);
    }
  }

  const rows = await readFileStore();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) rows.unshift(next);
  else rows[idx] = next;
  await writeFileStore(rows);
  return next;
}

/** Record the first public view (sent → viewed). */
export async function markProposalViewed(proposal: Proposal): Promise<void> {
  if (proposal.viewedAt) return;
  if (proposal.status !== "sent" && proposal.status !== "draft") {
    if (!proposal.viewedAt) {
      await patchProposal(proposal.id, { viewedAt: nowIso() });
    }
    return;
  }
  await patchProposal(proposal.id, {
    status: proposal.status === "sent" ? "viewed" : proposal.status,
    viewedAt: nowIso(),
  });
}

export function proposalIsExpired(proposal: Proposal): boolean {
  return Boolean(
    proposal.validUntil && new Date(proposal.validUntil).getTime() < Date.now()
  );
}

export function proposalIsAcceptable(proposal: Proposal): boolean {
  if (proposal.status === "accepted" || proposal.status === "declined") {
    return false;
  }
  return !proposalIsExpired(proposal);
}

/**
 * Atomically claim acceptance of an open proposal. Returns null when the
 * proposal was already accepted/declined (e.g. a concurrent duplicate
 * submission) so the caller can bail out before creating subscriptions or
 * checkout sessions. The Supabase update is conditional on an open status;
 * the file fallback (dev only) re-checks best-effort.
 */
export async function recordProposalAcceptance(input: {
  proposal: Proposal;
  scope: ProposalAcceptedScope;
  name: string;
  email: string;
  subscriptionId?: string | null;
}): Promise<Proposal | null> {
  const now = nowIso();
  const next: Proposal = {
    ...input.proposal,
    status: "accepted",
    acceptedAt: now,
    acceptedScope: input.scope,
    acceptanceName: input.name,
    acceptanceEmail: input.email,
    subscriptionId: input.subscriptionId ?? input.proposal.subscriptionId,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .update({
          status: "accepted",
          accepted_at: now,
          accepted_scope: input.scope,
          acceptance_name: input.name,
          acceptance_email: input.email,
          subscription_id: next.subscriptionId,
          updated_at: now,
        })
        .eq("id", input.proposal.id)
        .in("status", ["sent", "viewed"])
        .select("id");
      if (error) throw error;
      return data?.length ? next : null;
    } catch (err) {
      console.warn("[proposals] acceptance update failed — using file store.", err);
    }
  }

  const rows = await readFileStore();
  const idx = rows.findIndex((r) => r.id === input.proposal.id);
  const currentStatus = idx >= 0 ? rows[idx]!.status : input.proposal.status;
  if (currentStatus === "accepted" || currentStatus === "declined") return null;
  if (idx === -1) rows.unshift(next);
  else rows[idx] = next;
  await writeFileStore(rows);
  return next;
}

export async function recordProposalDecline(
  proposal: Proposal
): Promise<Proposal | null> {
  return patchProposal(proposal.id, {
    status: "declined",
    declinedAt: nowIso(),
  });
}

/** Link the created subscription back to the proposal. */
export async function linkProposalSubscription(
  proposalId: string,
  subscriptionId: string
): Promise<void> {
  await patchProposal(proposalId, { subscriptionId });
}
