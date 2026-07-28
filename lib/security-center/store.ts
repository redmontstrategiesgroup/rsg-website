import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_SECURITY_SETTINGS,
  type AiApproval,
  type AiApprovalStatus,
  type IncidentTimelineEntry,
  type RetentionRule,
  type SecurityIncident,
  type SecuritySettings,
  type SecurityTest,
  type VendorRecord,
} from "./types";

/**
 * Security Center persistence: Supabase when configured, a local JSON file
 * for dev otherwise. Mirrors lib/store.ts semantics — production never
 * treats the file store as durable and fails closed to Supabase.
 */

const IS_PROD = process.env.NODE_ENV === "production";

const DATA_DIR =
  process.env.DATA_DIR ??
  (IS_PROD
    ? path.join(os.tmpdir(), "rsg-data")
    : path.join(process.cwd(), "data"));
const FILE = path.join(DATA_DIR, "security-center.json");

type FileShape = {
  incidents: SecurityIncident[];
  vendors: VendorRecord[];
  retentionRules: RetentionRule[];
  approvals: AiApproval[];
  tests: SecurityTest[];
  settings: SecuritySettings | null;
};

const EMPTY: FileShape = {
  incidents: [],
  vendors: [],
  retentionRules: [],
  approvals: [],
  tests: [],
  settings: null,
};

async function readFileStore(): Promise<FileShape> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<FileShape>) };
  } catch {
    return { ...EMPTY };
  }
}

async function writeFileStore(data: FileShape): Promise<boolean> {
  if (IS_PROD) {
    console.error(
      "[security-center] refusing file write in production. Configure Supabase."
    );
    return false;
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    console.warn("[security-center] could not write file store (read-only fs).");
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/* ------------------------------ Incidents ------------------------------ */

type IncidentRow = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  owner: string | null;
  systems_affected: unknown;
  timeline: unknown;
  detected_at: string;
  resolved_at: string | null;
  follow_up_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToIncident(row: IncidentRow): SecurityIncident {
  const timeline = Array.isArray(row.timeline)
    ? (row.timeline as IncidentTimelineEntry[]).filter(
        (t) => t && typeof t.text === "string"
      )
    : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    severity: row.severity as SecurityIncident["severity"],
    status: row.status as SecurityIncident["status"],
    owner: row.owner ?? "",
    systemsAffected: strArr(row.systems_affected),
    timeline,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    followUpAt: row.follow_up_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listIncidents(): Promise<SecurityIncident[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("security_incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data as IncidentRow[]) ?? []).map(rowToIncident);
    } catch (err) {
      console.warn("[security-center] incidents read failed — using file store.", err);
    }
  }
  const file = await readFileStore();
  return [...file.incidents].sort((a, b) =>
    b.detectedAt.localeCompare(a.detectedAt)
  );
}

export type IncidentInput = {
  title: string;
  description?: string;
  severity?: SecurityIncident["severity"];
  owner?: string;
  systemsAffected?: string[];
  detectedAt?: string;
  createdBy?: string;
};

export async function createIncident(
  input: IncidentInput
): Promise<SecurityIncident | null> {
  const record: SecurityIncident = {
    id: randomUUID(),
    title: input.title.slice(0, 300),
    description: (input.description ?? "").slice(0, 8000),
    severity: input.severity ?? "medium",
    status: "open",
    owner: (input.owner ?? "").slice(0, 200),
    systemsAffected: (input.systemsAffected ?? []).map((s) => s.slice(0, 200)),
    timeline: [
      {
        at: nowIso(),
        actor: input.createdBy ?? "system",
        kind: "detected",
        text: "Incident opened.",
      },
    ],
    detectedAt: input.detectedAt ?? nowIso(),
    resolvedAt: null,
    followUpAt: null,
    createdBy: input.createdBy ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("security_incidents")
        .insert({
          id: record.id,
          title: record.title,
          description: record.description,
          severity: record.severity,
          status: record.status,
          owner: record.owner,
          systems_affected: record.systemsAffected,
          timeline: record.timeline,
          detected_at: record.detectedAt,
          created_by: record.createdBy,
        })
        .select("*")
        .limit(1);
      if (error) throw error;
      const row = (data as IncidentRow[])?.[0];
      if (row) return rowToIncident(row);
    } catch (err) {
      console.warn("[security-center] incident create failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  file.incidents.unshift(record);
  const ok = await writeFileStore(file);
  return ok ? record : null;
}

export type IncidentPatch = {
  title?: string;
  description?: string;
  severity?: SecurityIncident["severity"];
  status?: SecurityIncident["status"];
  owner?: string;
  systemsAffected?: string[];
  followUpAt?: string | null;
  /** Append a timeline entry (containment action, notification, note, …). */
  timelineEntry?: { kind: IncidentTimelineEntry["kind"]; text: string; actor: string };
};

export async function updateIncident(
  id: string,
  patch: IncidentPatch
): Promise<SecurityIncident | null> {
  const incidents = await listIncidents();
  const current = incidents.find((i) => i.id === id);
  if (!current) return null;

  const next: SecurityIncident = {
    ...current,
    title: patch.title !== undefined ? patch.title.slice(0, 300) : current.title,
    description:
      patch.description !== undefined
        ? patch.description.slice(0, 8000)
        : current.description,
    severity: patch.severity ?? current.severity,
    status: patch.status ?? current.status,
    owner: patch.owner !== undefined ? patch.owner.slice(0, 200) : current.owner,
    systemsAffected:
      patch.systemsAffected !== undefined
        ? patch.systemsAffected.map((s) => s.slice(0, 200))
        : current.systemsAffected,
    followUpAt:
      patch.followUpAt !== undefined ? patch.followUpAt : current.followUpAt,
    updatedAt: nowIso(),
  };

  if (patch.timelineEntry) {
    next.timeline = [
      ...current.timeline,
      {
        at: nowIso(),
        actor: patch.timelineEntry.actor.slice(0, 200),
        kind: patch.timelineEntry.kind,
        text: patch.timelineEntry.text.slice(0, 4000),
      },
    ];
  }

  // Resolution bookkeeping.
  if (patch.status === "resolved" || patch.status === "closed") {
    next.resolvedAt = current.resolvedAt ?? nowIso();
  } else if (patch.status && current.resolvedAt) {
    next.resolvedAt = null; // reopened
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("security_incidents")
        .update({
          title: next.title,
          description: next.description,
          severity: next.severity,
          status: next.status,
          owner: next.owner,
          systems_affected: next.systemsAffected,
          timeline: next.timeline,
          resolved_at: next.resolvedAt,
          follow_up_at: next.followUpAt,
          updated_at: next.updatedAt,
        })
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[security-center] incident update failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  const idx = file.incidents.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  file.incidents[idx] = next;
  const ok = await writeFileStore(file);
  return ok ? next : null;
}

/* ------------------------------- Vendors ------------------------------- */

type VendorRow = {
  id: string;
  name: string;
  service: string;
  purpose: string;
  data_categories: unknown;
  environment: string;
  hosting_region: string | null;
  contract_owner: string | null;
  security_docs_url: string | null;
  agreement_status: string;
  renewal_date: string | null;
  subprocessors: string | null;
  access_level: string | null;
  last_review_date: string | null;
  risk_level: string;
  removal_procedure: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToVendor(row: VendorRow): VendorRecord {
  return {
    id: row.id,
    name: row.name,
    service: row.service ?? "",
    purpose: row.purpose ?? "",
    dataCategories: strArr(row.data_categories),
    environment: row.environment ?? "production",
    hostingRegion: row.hosting_region,
    contractOwner: row.contract_owner,
    securityDocsUrl: row.security_docs_url,
    agreementStatus: row.agreement_status as VendorRecord["agreementStatus"],
    renewalDate: row.renewal_date,
    subprocessors: row.subprocessors,
    accessLevel: row.access_level,
    lastReviewDate: row.last_review_date,
    riskLevel: row.risk_level as VendorRecord["riskLevel"],
    removalProcedure: row.removal_procedure,
    notes: row.notes,
    status: row.status as VendorRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listVendors(): Promise<VendorRecord[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("security_vendors")
        .select("*")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data as VendorRow[]) ?? []).map(rowToVendor);
    } catch (err) {
      console.warn("[security-center] vendors read failed — using file store.", err);
    }
  }
  const file = await readFileStore();
  return [...file.vendors].sort((a, b) => a.name.localeCompare(b.name));
}

export type VendorInput = Partial<Omit<VendorRecord, "id" | "createdAt" | "updatedAt">> & {
  name: string;
};

export async function upsertVendor(
  input: VendorInput & { id?: string }
): Promise<VendorRecord | null> {
  const existing = input.id ? (await listVendors()).find((v) => v.id === input.id) : undefined;
  const record: VendorRecord = {
    id: existing?.id ?? randomUUID(),
    name: input.name.slice(0, 200),
    service: str(input.service, existing?.service ?? "").slice(0, 300),
    purpose: str(input.purpose, existing?.purpose ?? "").slice(0, 2000),
    dataCategories: (input.dataCategories ?? existing?.dataCategories ?? []).map((s) =>
      s.slice(0, 120)
    ),
    environment: str(input.environment, existing?.environment ?? "production").slice(0, 60),
    hostingRegion: input.hostingRegion ?? existing?.hostingRegion ?? null,
    contractOwner: input.contractOwner ?? existing?.contractOwner ?? null,
    securityDocsUrl: input.securityDocsUrl ?? existing?.securityDocsUrl ?? null,
    agreementStatus: input.agreementStatus ?? existing?.agreementStatus ?? "not_documented",
    renewalDate: input.renewalDate ?? existing?.renewalDate ?? null,
    subprocessors: input.subprocessors ?? existing?.subprocessors ?? null,
    accessLevel: input.accessLevel ?? existing?.accessLevel ?? null,
    lastReviewDate: input.lastReviewDate ?? existing?.lastReviewDate ?? null,
    riskLevel: input.riskLevel ?? existing?.riskLevel ?? "medium",
    removalProcedure: input.removalProcedure ?? existing?.removalProcedure ?? null,
    notes: input.notes ?? existing?.notes ?? null,
    status: input.status ?? existing?.status ?? "active",
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("security_vendors").upsert({
        id: record.id,
        name: record.name,
        service: record.service,
        purpose: record.purpose,
        data_categories: record.dataCategories,
        environment: record.environment,
        hosting_region: record.hostingRegion,
        contract_owner: record.contractOwner,
        security_docs_url: record.securityDocsUrl,
        agreement_status: record.agreementStatus,
        renewal_date: record.renewalDate || null,
        subprocessors: record.subprocessors,
        access_level: record.accessLevel,
        last_review_date: record.lastReviewDate || null,
        risk_level: record.riskLevel,
        removal_procedure: record.removalProcedure,
        notes: record.notes,
        status: record.status,
        updated_at: record.updatedAt,
      });
      if (error) throw error;
      return record;
    } catch (err) {
      console.warn("[security-center] vendor upsert failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  const idx = file.vendors.findIndex((v) => v.id === record.id);
  if (idx === -1) file.vendors.push(record);
  else file.vendors[idx] = record;
  const ok = await writeFileStore(file);
  return ok ? record : null;
}

/* --------------------------- Retention rules --------------------------- */

type RetentionRow = {
  id: string;
  data_category: string;
  label: string;
  retention_period: string;
  retention_days: number | null;
  action_at_expiry: string;
  legal_hold: boolean;
  notes: string | null;
  status: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRetention(row: RetentionRow): RetentionRule {
  return {
    id: row.id,
    dataCategory: row.data_category,
    label: row.label ?? "",
    retentionPeriod: row.retention_period ?? "",
    retentionDays: row.retention_days,
    actionAtExpiry: row.action_at_expiry as RetentionRule["actionAtExpiry"],
    legalHold: Boolean(row.legal_hold),
    notes: row.notes,
    status: row.status as RetentionRule["status"],
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRetentionRules(): Promise<RetentionRule[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("retention_rules")
        .select("*")
        .order("data_category", { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data as RetentionRow[]) ?? []).map(rowToRetention);
    } catch (err) {
      console.warn("[security-center] retention read failed — using file store.", err);
    }
  }
  const file = await readFileStore();
  return [...file.retentionRules].sort((a, b) =>
    a.dataCategory.localeCompare(b.dataCategory)
  );
}

export type RetentionInput = Partial<
  Omit<RetentionRule, "id" | "createdAt" | "updatedAt">
> & { dataCategory: string };

export async function upsertRetentionRule(
  input: RetentionInput & { id?: string }
): Promise<RetentionRule | null> {
  const existing = input.id
    ? (await listRetentionRules()).find((r) => r.id === input.id)
    : undefined;
  const record: RetentionRule = {
    id: existing?.id ?? randomUUID(),
    dataCategory: input.dataCategory.slice(0, 120),
    label: str(input.label, existing?.label ?? "").slice(0, 200),
    retentionPeriod: str(input.retentionPeriod, existing?.retentionPeriod ?? "").slice(0, 300),
    retentionDays:
      input.retentionDays !== undefined ? input.retentionDays : existing?.retentionDays ?? null,
    actionAtExpiry: input.actionAtExpiry ?? existing?.actionAtExpiry ?? "manual_review",
    legalHold: input.legalHold ?? existing?.legalHold ?? false,
    notes: input.notes ?? existing?.notes ?? null,
    status: input.status ?? existing?.status ?? "active",
    updatedBy: input.updatedBy ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("retention_rules").upsert({
        id: record.id,
        data_category: record.dataCategory,
        label: record.label,
        retention_period: record.retentionPeriod,
        retention_days: record.retentionDays,
        action_at_expiry: record.actionAtExpiry,
        legal_hold: record.legalHold,
        notes: record.notes,
        status: record.status,
        updated_by: record.updatedBy,
        updated_at: record.updatedAt,
      });
      if (error) throw error;
      return record;
    } catch (err) {
      console.warn("[security-center] retention upsert failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  const idx = file.retentionRules.findIndex((r) => r.id === record.id);
  if (idx === -1) file.retentionRules.push(record);
  else file.retentionRules[idx] = record;
  const ok = await writeFileStore(file);
  return ok ? record : null;
}

/* ---------------------------- AI approvals ----------------------------- */

type ApprovalRow = {
  id: string;
  action_type: string;
  title: string;
  content: string;
  reason: string;
  data_sources: unknown;
  records_affected: unknown;
  risk_level: string;
  status: string;
  requested_by: string;
  requested_at: string;
  expires_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  executed_at: string | null;
  execution_result: string | null;
  created_at: string;
  updated_at: string;
};

function rowToApproval(row: ApprovalRow): AiApproval {
  return {
    id: row.id,
    actionType: row.action_type,
    title: row.title,
    content: row.content ?? "",
    reason: row.reason ?? "",
    dataSources: strArr(row.data_sources),
    recordsAffected: strArr(row.records_affected),
    riskLevel: row.risk_level as AiApproval["riskLevel"],
    status: row.status as AiApprovalStatus,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    executedAt: row.executed_at,
    executionResult: row.execution_result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lazily expire overdue approval requests, then return the list. */
export async function listApprovals(): Promise<AiApproval[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      // Expire overdue awaiting_approval items first (lazy sweep).
      await sb
        .from("ai_approvals")
        .update({ status: "expired", updated_at: nowIso() })
        .eq("status", "awaiting_approval")
        .lt("expires_at", nowIso());
      const { data, error } = await sb
        .from("ai_approvals")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data as ApprovalRow[]) ?? []).map(rowToApproval);
    } catch (err) {
      console.warn("[security-center] approvals read failed — using file store.", err);
    }
  }
  const file = await readFileStore();
  let changed = false;
  for (const a of file.approvals) {
    if (
      a.status === "awaiting_approval" &&
      a.expiresAt &&
      new Date(a.expiresAt).getTime() < Date.now()
    ) {
      a.status = "expired";
      a.updatedAt = nowIso();
      changed = true;
    }
  }
  if (changed) await writeFileStore(file);
  return [...file.approvals].sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt)
  );
}

export type ApprovalInput = {
  actionType: string;
  title: string;
  content: string;
  reason: string;
  dataSources?: string[];
  recordsAffected?: string[];
  riskLevel?: AiApproval["riskLevel"];
  requestedBy?: string;
  expiresAt?: string | null;
};

export async function createApproval(
  input: ApprovalInput
): Promise<AiApproval | null> {
  const settings = await getSecuritySettings();
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt
      : new Date(
          Date.now() + settings.approvalExpiryHours * 3600_000
        ).toISOString();

  const record: AiApproval = {
    id: randomUUID(),
    actionType: input.actionType.slice(0, 120),
    title: input.title.slice(0, 300),
    content: input.content.slice(0, 20_000),
    reason: input.reason.slice(0, 2000),
    dataSources: (input.dataSources ?? []).map((s) => s.slice(0, 300)),
    recordsAffected: (input.recordsAffected ?? []).map((s) => s.slice(0, 300)),
    riskLevel: input.riskLevel ?? "high",
    status: "awaiting_approval",
    requestedBy: (input.requestedBy ?? "system").slice(0, 200),
    requestedAt: nowIso(),
    expiresAt,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    executedAt: null,
    executionResult: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("ai_approvals").insert({
        id: record.id,
        action_type: record.actionType,
        title: record.title,
        content: record.content,
        reason: record.reason,
        data_sources: record.dataSources,
        records_affected: record.recordsAffected,
        risk_level: record.riskLevel,
        status: record.status,
        requested_by: record.requestedBy,
        requested_at: record.requestedAt,
        expires_at: record.expiresAt,
      });
      if (error) throw error;
      return record;
    } catch (err) {
      console.warn("[security-center] approval create failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  file.approvals.unshift(record);
  const ok = await writeFileStore(file);
  return ok ? record : null;
}

export async function getApproval(id: string): Promise<AiApproval | null> {
  const approvals = await listApprovals();
  return approvals.find((a) => a.id === id) ?? null;
}

export type ApprovalPatch = {
  status?: AiApprovalStatus;
  decidedBy?: string;
  decisionNote?: string;
  content?: string;
  executedAt?: string | null;
  executionResult?: string | null;
};

export async function updateApproval(
  id: string,
  patch: ApprovalPatch
): Promise<AiApproval | null> {
  const current = await getApproval(id);
  if (!current) return null;

  const decisionMade =
    patch.status &&
    ["approved", "rejected", "escalated"].includes(patch.status) &&
    patch.status !== current.status;

  const next: AiApproval = {
    ...current,
    status: patch.status ?? current.status,
    content:
      patch.content !== undefined ? patch.content.slice(0, 20_000) : current.content,
    decidedBy: decisionMade ? (patch.decidedBy ?? null) : current.decidedBy,
    decidedAt: decisionMade ? nowIso() : current.decidedAt,
    decisionNote:
      patch.decisionNote !== undefined
        ? patch.decisionNote.slice(0, 2000)
        : current.decisionNote,
    executedAt: patch.executedAt !== undefined ? patch.executedAt : current.executedAt,
    executionResult:
      patch.executionResult !== undefined
        ? patch.executionResult?.slice(0, 2000) ?? null
        : current.executionResult,
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("ai_approvals")
        .update({
          status: next.status,
          content: next.content,
          decided_by: next.decidedBy,
          decided_at: next.decidedAt,
          decision_note: next.decisionNote,
          executed_at: next.executedAt,
          execution_result: next.executionResult,
          updated_at: next.updatedAt,
        })
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[security-center] approval update failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  const idx = file.approvals.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  file.approvals[idx] = next;
  const ok = await writeFileStore(file);
  return ok ? next : null;
}

/* ---------------------------- Security tests --------------------------- */

type TestRow = {
  id: string;
  name: string;
  category: string;
  target: string;
  expected: string;
  actual: string;
  result: string;
  severity: string | null;
  evidence: string | null;
  remediation: string | null;
  retest_status: string;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function rowToTest(row: TestRow): SecurityTest {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    target: row.target ?? "",
    expected: row.expected ?? "",
    actual: row.actual ?? "",
    result: row.result as SecurityTest["result"],
    severity: (row.severity as SecurityTest["severity"]) ?? null,
    evidence: row.evidence,
    remediation: row.remediation,
    retestStatus: row.retest_status as SecurityTest["retestStatus"],
    lastRunAt: row.last_run_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSecurityTests(): Promise<SecurityTest[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("security_tests")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data as TestRow[]) ?? []).map(rowToTest);
    } catch (err) {
      console.warn("[security-center] tests read failed — using file store.", err);
    }
  }
  const file = await readFileStore();
  return [...file.tests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type SecurityTestInput = Partial<
  Omit<SecurityTest, "id" | "createdAt" | "updatedAt">
> & { name: string; category: string };

export async function upsertSecurityTest(
  input: SecurityTestInput & { id?: string }
): Promise<SecurityTest | null> {
  const existing = input.id
    ? (await listSecurityTests()).find((t) => t.id === input.id)
    : undefined;
  const record: SecurityTest = {
    id: existing?.id ?? randomUUID(),
    name: input.name.slice(0, 300),
    category: input.category.slice(0, 120),
    target: str(input.target, existing?.target ?? "").slice(0, 300),
    expected: str(input.expected, existing?.expected ?? "").slice(0, 4000),
    actual: str(input.actual, existing?.actual ?? "").slice(0, 4000),
    result: input.result ?? existing?.result ?? "not_run",
    severity: input.severity !== undefined ? input.severity : existing?.severity ?? null,
    evidence: input.evidence !== undefined ? input.evidence : existing?.evidence ?? null,
    remediation:
      input.remediation !== undefined ? input.remediation : existing?.remediation ?? null,
    retestStatus: input.retestStatus ?? existing?.retestStatus ?? "none",
    lastRunAt: input.lastRunAt !== undefined ? input.lastRunAt : existing?.lastRunAt ?? null,
    createdBy: existing?.createdBy ?? input.createdBy ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("security_tests").upsert({
        id: record.id,
        name: record.name,
        category: record.category,
        target: record.target,
        expected: record.expected,
        actual: record.actual,
        result: record.result,
        severity: record.severity,
        evidence: record.evidence,
        remediation: record.remediation,
        retest_status: record.retestStatus,
        last_run_at: record.lastRunAt,
        created_by: record.createdBy,
        updated_at: record.updatedAt,
      });
      if (error) throw error;
      return record;
    } catch (err) {
      console.warn("[security-center] test upsert failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  const idx = file.tests.findIndex((t) => t.id === record.id);
  if (idx === -1) file.tests.push(record);
  else file.tests[idx] = record;
  const ok = await writeFileStore(file);
  return ok ? record : null;
}

/* --------------------------- Security settings ------------------------- */

let settingsCache: { value: SecuritySettings; at: number } | null = null;
const SETTINGS_TTL_MS = 30_000;

function normalizeSettings(raw: unknown): SecuritySettings {
  const r = (raw ?? {}) as Partial<SecuritySettings>;
  const packages = Array.isArray(r.packages)
    ? DEFAULT_SECURITY_SETTINGS.packages.map((d) => {
        const found = r.packages!.find((p) => p && p.id === d.id);
        return {
          id: d.id,
          startingPrice:
            typeof found?.startingPrice === "string"
              ? found.startingPrice.slice(0, 120)
              : "",
        };
      })
    : DEFAULT_SECURITY_SETTINGS.packages;
  return {
    mfaRequiredRoles: Array.isArray(r.mfaRequiredRoles)
      ? (r.mfaRequiredRoles.filter(
          (x): x is SecuritySettings["mfaRequiredRoles"][number] =>
            typeof x === "string"
        ) as SecuritySettings["mfaRequiredRoles"])
      : [],
    aiPaused: Boolean(r.aiPaused),
    aiPausedReason:
      typeof r.aiPausedReason === "string" ? r.aiPausedReason.slice(0, 500) : "",
    approvalExpiryHours:
      typeof r.approvalExpiryHours === "number" &&
      Number.isFinite(r.approvalExpiryHours) &&
      r.approvalExpiryHours >= 1 &&
      r.approvalExpiryHours <= 24 * 30
        ? Math.round(r.approvalExpiryHours)
        : DEFAULT_SECURITY_SETTINGS.approvalExpiryHours,
    packages,
  };
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }
  let value = { ...DEFAULT_SECURITY_SETTINGS };
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("security_settings")
        .select("settings")
        .eq("id", "default")
        .limit(1);
      if (error) throw error;
      if (data?.[0]) value = normalizeSettings((data[0] as { settings: unknown }).settings);
    } catch (err) {
      console.warn("[security-center] settings read failed — using defaults.", err);
    }
  } else {
    const file = await readFileStore();
    if (file.settings) value = normalizeSettings(file.settings);
  }
  settingsCache = { value, at: Date.now() };
  return value;
}

export async function updateSecuritySettings(
  patch: Partial<SecuritySettings>,
  updatedBy: string
): Promise<SecuritySettings | null> {
  const current = await getSecuritySettings();
  const next = normalizeSettings({ ...current, ...patch });

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("security_settings").upsert({
        id: "default",
        settings: next,
        updated_by: updatedBy.slice(0, 200),
        updated_at: nowIso(),
      });
      if (error) throw error;
      settingsCache = { value: next, at: Date.now() };
      return next;
    } catch (err) {
      console.warn("[security-center] settings update failed — using file store.", err);
    }
  }

  const file = await readFileStore();
  file.settings = next;
  const ok = await writeFileStore(file);
  if (!ok) return null;
  settingsCache = { value: next, at: Date.now() };
  return next;
}

/** Test-only: drop the in-process settings cache. */
export function __clearSecuritySettingsCache(): void {
  settingsCache = null;
}
