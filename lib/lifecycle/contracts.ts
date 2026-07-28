/**
 * Electronic contracts + signatures — data access.
 *
 * Owns the contracts, contract_signatures, and contract_events tables.
 * Contracts are created from the plain-English templates in
 * contract-templates.ts, signed by the client signer first, then
 * countersigned by an admin (when required). Every state change writes a
 * contract_events row so the full signing history is auditable.
 */

import { createHash } from "node:crypto";
import { newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import {
  CONTRACT_KIND_LABELS,
  type Contract,
  type ContractEvent,
  type ContractKind,
  type ContractSection,
  type ContractSignature,
  type ContractStatus,
} from "@/lib/lifecycle/types";
import {
  CONTRACT_TEMPLATES,
  fillContractSections,
} from "@/lib/lifecycle/contract-templates";

/** Statuses that can still expire (nothing has been fully executed yet). */
const EXPIRABLE_STATUSES: ContractStatus[] = [
  "draft",
  "sent",
  "viewed",
  "partially_signed",
];

/** Terminal statuses in which no further signatures are accepted. */
const UNSIGNABLE_STATUSES: ContractStatus[] = [
  "countersigned",
  "active",
  "declined",
  "voided",
  "expired",
];

// ---------------------------------------------------------------------------
// Content hashing
// ---------------------------------------------------------------------------

/**
 * SHA-256 hex of the canonical JSON form of the contract content. Stored on
 * the contract and stamped onto each signature at signing time, so it is
 * verifiable that every signer saw the exact same text.
 */
export function hashContractContent(content: ContractSection[]): string {
  const canonical = JSON.stringify(
    content.map((section) => ({
      key: section.key,
      title: section.title,
      body: section.body,
    })),
  );
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function recordContractEvent(
  contractId: string,
  event: string,
  opts: {
    actorType?: "client" | "admin" | "system";
    actorId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
  } = {},
): Promise<ContractEvent> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contract_events")
    .insert({
      contract_id: contractId,
      event,
      actor_type: opts.actorType ?? "system",
      actor_id: opts.actorId ?? null,
      metadata: opts.metadata ?? {},
      ip: opts.ip ?? null,
      user_agent: opts.userAgent ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to record contract event "${event}" for ${contractId}: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as ContractEvent;
}

// ---------------------------------------------------------------------------
// Internal fetch helpers
// ---------------------------------------------------------------------------

async function fetchContractById(id: string): Promise<Contract | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load contract ${id}: ${error.message}`);
  return (data as Contract) ?? null;
}

async function requireContract(id: string): Promise<Contract> {
  const contract = await fetchContractById(id);
  if (!contract) throw new Error(`Contract ${id} not found.`);
  return contract;
}

async function fetchSignatures(contractId: string): Promise<ContractSignature[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contract_signatures")
    .select("*")
    .eq("contract_id", contractId)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(
      `Failed to load signatures for contract ${contractId}: ${error.message}`,
    );
  }
  return (data ?? []) as ContractSignature[];
}

async function fetchEvents(contractId: string): Promise<ContractEvent[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contract_events")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `Failed to load events for contract ${contractId}: ${error.message}`,
    );
  }
  return (data ?? []) as ContractEvent[];
}

async function updateContract(
  id: string,
  patch: Record<string, unknown>,
): Promise<Contract> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contracts")
    .update({ ...patch, updated_at: nowIso() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to update contract ${id}: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as Contract;
}

function isExpired(contract: Contract): boolean {
  return Boolean(
    contract.expires_at &&
      new Date(contract.expires_at).getTime() < Date.now() &&
      EXPIRABLE_STATUSES.includes(contract.status),
  );
}

async function expireContract(contract: Contract): Promise<Contract> {
  const updated = await updateContract(contract.id, { status: "expired" });
  await recordContractEvent(contract.id, "expired", {
    actorType: "system",
    metadata: { previous_status: contract.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createContract(input: {
  kind: ContractKind;
  title?: string;
  opportunityId?: string;
  proposalId?: string;
  clientId?: string;
  leadId?: string;
  vars: Record<string, string>;
  signerName: string;
  signerEmail: string;
  signerTitle?: string;
  requiresCountersign?: boolean;
  expiresInDays?: number;
  createdBy?: string;
}): Promise<{ contract: Contract; signatures: ContractSignature[] }> {
  const sb = requireSupabase();
  const requiresCountersign = input.requiresCountersign ?? true;
  const expiresInDays = input.expiresInDays ?? 14;
  const content = fillContractSections(input.kind, input.vars);
  const now = nowIso();

  // The effective_date column is a SQL date; only store the var when it is
  // already in ISO date form (display strings stay in the content only).
  const effectiveDate =
    input.vars.effective_date && /^\d{4}-\d{2}-\d{2}$/.test(input.vars.effective_date)
      ? input.vars.effective_date
      : null;

  const { data, error } = await sb
    .from("contracts")
    .insert({
      opportunity_id: input.opportunityId ?? null,
      proposal_id: input.proposalId ?? null,
      client_id: input.clientId ?? null,
      lead_id: input.leadId ?? null,
      token: newToken(),
      kind: input.kind,
      title:
        input.title?.trim() ||
        `${CONTRACT_KIND_LABELS[input.kind]} — ${input.vars.client_business || input.signerName}`,
      status: "draft",
      content,
      content_hash: hashContractContent(content),
      requires_countersign: requiresCountersign,
      effective_date: effectiveDate,
      expires_at: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
      created_by: input.createdBy ?? null,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create contract: ${error?.message ?? "no row returned"}`);
  }
  const contract = data as Contract;

  const { data: sigData, error: sigError } = await sb
    .from("contract_signatures")
    .insert([
      {
        contract_id: contract.id,
        signer_type: "client",
        role: "signer",
        signer_name: input.signerName.trim(),
        signer_email: input.signerEmail.trim().toLowerCase(),
        signer_title: input.signerTitle?.trim() || null,
        sort_order: 0,
        required: true,
      },
      {
        contract_id: contract.id,
        signer_type: "admin",
        role: "countersigner",
        signer_name: "",
        signer_email: "",
        sort_order: 1,
        required: requiresCountersign,
      },
    ])
    .select("*");
  if (sigError || !sigData) {
    throw new Error(
      `Failed to create signature slots for contract ${contract.id}: ${sigError?.message ?? "no rows returned"}`,
    );
  }

  await recordContractEvent(contract.id, "created", {
    actorType: "admin",
    actorId: input.createdBy ?? null,
    metadata: { kind: input.kind, requires_countersign: requiresCountersign },
  });

  const signatures = (sigData as ContractSignature[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  return { contract, signatures };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getContract(id: string): Promise<{
  contract: Contract;
  signatures: ContractSignature[];
  events: ContractEvent[];
} | null> {
  const contract = await fetchContractById(id);
  if (!contract) return null;
  const [signatures, events] = await Promise.all([
    fetchSignatures(contract.id),
    fetchEvents(contract.id),
  ]);
  return { contract, signatures, events };
}

/**
 * Public signing-page lookup. Auto-expires the contract (like proposals) when
 * its expiry has passed and it has not been fully executed.
 */
export async function getContractByToken(token: string): Promise<{
  contract: Contract;
  signatures: ContractSignature[];
  events: ContractEvent[];
} | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("contracts")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    // Public page lookup: a query failure (e.g. migration not applied yet)
    // renders the friendly not-found state rather than the error boundary.
    console.warn(`getContractByToken failed: ${error.message}`);
    return null;
  }
  if (!data) return null;

  let contract = data as Contract;
  if (isExpired(contract)) {
    contract = await expireContract(contract);
  }
  const [signatures, events] = await Promise.all([
    fetchSignatures(contract.id),
    fetchEvents(contract.id),
  ]);
  return { contract, signatures, events };
}

export async function listContracts(
  filters: {
    status?: ContractStatus;
    clientId?: string;
    opportunityId?: string;
    limit?: number;
  } = {},
): Promise<Contract[]> {
  const sb = requireSupabase();
  let query = sb
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.opportunityId) query = query.eq("opportunity_id", filters.opportunityId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list contracts: ${error.message}`);
  return (data ?? []) as Contract[];
}

// ---------------------------------------------------------------------------
// Send / view
// ---------------------------------------------------------------------------

export async function markContractSent(id: string): Promise<Contract> {
  const contract = await requireContract(id);
  const updated = await updateContract(id, {
    status: contract.status === "draft" ? "sent" : contract.status,
    sent_at: contract.sent_at ?? nowIso(),
  });
  await recordContractEvent(id, "sent", { actorType: "admin" });
  return updated;
}

export async function markContractViewed(id: string): Promise<Contract> {
  const contract = await requireContract(id);
  // Only the first view transitions the status; later views just log events.
  const updated =
    contract.status === "sent"
      ? await updateContract(id, { status: "viewed" })
      : contract;
  await recordContractEvent(id, "viewed", { actorType: "client" });
  return updated;
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

function computeStatusAfterSigning(
  contract: Contract,
  signatures: ContractSignature[],
): { status: ContractStatus; fullyExecuted: boolean } {
  const requiredSigners = signatures.filter((s) => s.required && s.role === "signer");
  const countersigner = signatures.find((s) => s.role === "countersigner");
  const someSigned = signatures.some((s) => s.signed_at);
  const allClientSigned =
    requiredSigners.length > 0 && requiredSigners.every((s) => s.signed_at);

  let status: ContractStatus = contract.status;
  if (allClientSigned && countersigner?.signed_at) status = "countersigned";
  else if (allClientSigned) status = "signed";
  else if (someSigned) status = "partially_signed";

  const fullyExecuted =
    status === "countersigned" ||
    (status === "signed" && !contract.requires_countersign);
  return { status, fullyExecuted };
}

async function applySignature(
  contractId: string,
  ctx: {
    signatureId: string;
    signedName: string;
    initials: string | null;
    acknowledgments: { key: string; label: string }[];
    ip: string;
    userAgent: string;
    actorId?: string | null;
    signerNameOverride?: string;
    signerEmailOverride?: string;
  },
): Promise<{ contract: Contract; signatures: ContractSignature[] }> {
  const sb = requireSupabase();
  let contract = await requireContract(contractId);

  if (UNSIGNABLE_STATUSES.includes(contract.status)) {
    throw new Error(
      `Contract ${contractId} cannot be signed in status "${contract.status}".`,
    );
  }
  if (isExpired(contract)) {
    await expireContract(contract);
    throw new Error(`Contract ${contractId} has expired and can no longer be signed.`);
  }

  const signatures = await fetchSignatures(contractId);
  const signature = signatures.find((s) => s.id === ctx.signatureId);
  if (!signature) {
    throw new Error(
      `Signature ${ctx.signatureId} not found on contract ${contractId}.`,
    );
  }
  if (signature.signed_at) {
    throw new Error(`Signature ${ctx.signatureId} has already been signed.`);
  }

  const signedName = ctx.signedName.trim();
  if (!signedName) throw new Error("A typed signature name is required.");

  // Client signers must accept every acknowledgment defined by the template.
  if (signature.role === "signer") {
    const requiredAcks = CONTRACT_TEMPLATES[contract.kind].acknowledgments;
    const acceptedKeys = new Set(ctx.acknowledgments.map((a) => a.key));
    const missing = requiredAcks.filter((ack) => !acceptedKeys.has(ack.key));
    if (missing.length > 0) {
      throw new Error(
        `All required acknowledgments must be accepted before signing. Missing: ${missing
          .map((ack) => ack.key)
          .join(", ")}.`,
      );
    }
  }

  // Signing order: every required signature earlier in the order must be in.
  const blockers = signatures.filter(
    (s) => s.required && s.sort_order < signature.sort_order && !s.signed_at,
  );
  if (blockers.length > 0) {
    throw new Error(
      `Contract ${contractId} must be signed in order; waiting on: ${blockers
        .map((s) => s.signer_name || s.role)
        .join(", ")}.`,
    );
  }

  const now = nowIso();
  const patch: Record<string, unknown> = {
    signed_name: signedName,
    initials: ctx.initials?.trim() || null,
    acknowledgments: ctx.acknowledgments.map((ack) => ({
      key: ack.key,
      label: ack.label,
      accepted_at: now,
    })),
    content_hash: hashContractContent(contract.content),
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    signed_at: now,
  };
  if (ctx.signerNameOverride) patch.signer_name = ctx.signerNameOverride.trim();
  if (ctx.signerEmailOverride) {
    patch.signer_email = ctx.signerEmailOverride.trim().toLowerCase();
  }

  const { error: signError } = await sb
    .from("contract_signatures")
    .update(patch)
    .eq("id", signature.id)
    .is("signed_at", null);
  if (signError) {
    throw new Error(
      `Failed to record signature ${signature.id} on contract ${contractId}: ${signError.message}`,
    );
  }

  await recordContractEvent(contractId, "signature_signed", {
    actorType: signature.signer_type,
    actorId: ctx.actorId ?? null,
    metadata: {
      signature_id: signature.id,
      role: signature.role,
      signer_email: ctx.signerEmailOverride ?? signature.signer_email,
      signed_name: signedName,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const freshSignatures = await fetchSignatures(contractId);
  const { status, fullyExecuted } = computeStatusAfterSigning(
    contract,
    freshSignatures,
  );

  const previousStatus = contract.status;
  contract = await updateContract(contractId, {
    status,
    completed_at: fullyExecuted ? contract.completed_at ?? now : contract.completed_at,
  });

  if (status !== previousStatus) {
    await recordContractEvent(contractId, status, {
      actorType: "system",
      metadata: { previous_status: previousStatus },
    });
  }
  if (fullyExecuted && previousStatus !== "countersigned") {
    await recordContractEvent(contractId, "completed", {
      actorType: "system",
      metadata: { status },
    });
  }

  return { contract, signatures: freshSignatures };
}

export async function signContract(
  contractId: string,
  input: {
    signatureId: string;
    signedName: string;
    initials?: string;
    acknowledgments: { key: string; label: string }[];
    ip: string;
    userAgent: string;
  },
): Promise<{ contract: Contract; signatures: ContractSignature[] }> {
  return applySignature(contractId, {
    signatureId: input.signatureId,
    signedName: input.signedName,
    initials: input.initials ?? null,
    acknowledgments: input.acknowledgments,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

export async function countersignContract(
  contractId: string,
  input: {
    adminId: string;
    adminName: string;
    adminEmail: string;
    signedName: string;
    ip: string;
    userAgent: string;
  },
): Promise<{ contract: Contract; signatures: ContractSignature[] }> {
  const signatures = await fetchSignatures(contractId);
  const slot = signatures.find((s) => s.role === "countersigner" && !s.signed_at);
  if (!slot) {
    throw new Error(
      `Contract ${contractId} has no open countersigner slot to sign.`,
    );
  }
  return applySignature(contractId, {
    signatureId: slot.id,
    signedName: input.signedName,
    initials: null,
    acknowledgments: [],
    ip: input.ip,
    userAgent: input.userAgent,
    actorId: input.adminId,
    signerNameOverride: input.adminName,
    signerEmailOverride: input.adminEmail,
  });
}

// ---------------------------------------------------------------------------
// Void / decline
// ---------------------------------------------------------------------------

export async function voidContract(id: string, reason: string): Promise<Contract> {
  const contract = await requireContract(id);
  if (contract.status === "voided") return contract;
  const updated = await updateContract(id, { status: "voided" });
  await recordContractEvent(id, "voided", {
    actorType: "admin",
    metadata: { reason, previous_status: contract.status },
  });
  return updated;
}

export async function declineContract(id: string, reason: string): Promise<Contract> {
  const contract = await requireContract(id);
  if (contract.status === "declined") return contract;
  const updated = await updateContract(id, { status: "declined" });
  await recordContractEvent(id, "declined", {
    actorType: "client",
    metadata: { reason, previous_status: contract.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Execution state
// ---------------------------------------------------------------------------

/** True when every required signature is in place and the contract binds. */
export function isFullyExecuted(contract: Contract): boolean {
  return (
    contract.status === "countersigned" ||
    contract.status === "active" ||
    (contract.status === "signed" && !contract.requires_countersign)
  );
}

// ---------------------------------------------------------------------------
// Signature reminders
// ---------------------------------------------------------------------------

/**
 * Contracts awaiting signature that are due a reminder: sent/viewed/partially
 * signed, not expired, fewer than `maxReminders` reminders so far, and no
 * activity (send or reminder) within the last `olderThanMinutes`.
 */
export async function findContractsNeedingSignatureReminder(opts: {
  olderThanMinutes: number;
  maxReminders: number;
}): Promise<Contract[]> {
  const sb = requireSupabase();
  const nowMs = Date.now();
  const cutoffMs = nowMs - opts.olderThanMinutes * 60_000;

  const { data, error } = await sb
    .from("contracts")
    .select("*")
    .in("status", ["sent", "viewed", "partially_signed"])
    .or(`expires_at.is.null,expires_at.gt.${new Date(nowMs).toISOString()}`)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to find contracts needing reminders: ${error.message}`);
  }
  const candidates = (data ?? []) as Contract[];
  if (candidates.length === 0) return [];

  const { data: eventData, error: eventError } = await sb
    .from("contract_events")
    .select("contract_id, created_at")
    .eq("event", "reminder_sent")
    .in(
      "contract_id",
      candidates.map((c) => c.id),
    );
  if (eventError) {
    throw new Error(`Failed to load reminder history: ${eventError.message}`);
  }

  const reminders = new Map<string, { count: number; latestMs: number }>();
  for (const row of (eventData ?? []) as { contract_id: string; created_at: string }[]) {
    const entry = reminders.get(row.contract_id) ?? { count: 0, latestMs: 0 };
    entry.count += 1;
    entry.latestMs = Math.max(entry.latestMs, new Date(row.created_at).getTime());
    reminders.set(row.contract_id, entry);
  }

  return candidates.filter((contract) => {
    const anchorMs = new Date(contract.sent_at ?? contract.created_at).getTime();
    if (anchorMs > cutoffMs) return false;
    const history = reminders.get(contract.id);
    if (!history) return true;
    if (history.count >= opts.maxReminders) return false;
    return history.latestMs <= cutoffMs;
  });
}

export async function markContractReminded(id: string): Promise<ContractEvent> {
  await requireContract(id);
  const event = await recordContractEvent(id, "reminder_sent", {
    actorType: "system",
  });
  const sb = requireSupabase();
  const { error } = await sb
    .from("contracts")
    .update({ updated_at: nowIso() })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to touch contract ${id} after reminder: ${error.message}`);
  }
  return event;
}
