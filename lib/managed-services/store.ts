/**
 * Managed-services storage (server-only).
 * Prefers Supabase; falls back to a local JSON file in development,
 * mirroring lib/private-ai/opportunities.ts. Production refuses file writes.
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_PLANS } from "./content";
import type {
  ClientRoadmap,
  ClientSubscription,
  HoursUsage,
  MaintenanceCategory,
  MaintenanceLog,
  ManagedServicePlan,
  PlanPatch,
  RecurringRevenueSummary,
  ReportKind,
  RoadmapItem,
  RoadmapStatus,
  ServiceReport,
  ServiceReportData,
  ServiceRequest,
  ServiceRequestInclusion,
  ServiceRequestStatus,
  ServiceRequestType,
  StandardPlanKey,
  SubscriptionEvent,
  SubscriptionInvoice,
  SubscriptionStatus,
  UpgradeRecommendation,
} from "./types";
import {
  MAINTENANCE_CATEGORIES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TYPES,
  SUBSCRIPTION_STATUSES,
} from "./types";

// ---------------------------------------------------------------------------
// File fallback (dev only)
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "managed-services.json");

type FileDb = {
  plans: ManagedServicePlan[];
  subscriptions: ClientSubscription[];
  events: SubscriptionEvent[];
  invoices: SubscriptionInvoice[];
  requests: ServiceRequest[];
  maintenance: MaintenanceLog[];
  reports: ServiceReport[];
  roadmaps: ClientRoadmap[];
};

const EMPTY_DB: FileDb = {
  plans: [],
  subscriptions: [],
  events: [],
  invoices: [],
  requests: [],
  maintenance: [],
  reports: [],
  roadmaps: [],
};

async function readDb(): Promise<FileDb> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileDb>;
    return { ...EMPTY_DB, ...parsed };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(db: FileDb): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_FILE_STORE) {
    console.warn(
      "[managed-services] refusing file write in production. Configure Supabase."
    );
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
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

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

function rowToPlan(row: Record<string, unknown>): ManagedServicePlan {
  return {
    id: str(row.id),
    key: str(row.key),
    name: str(row.name),
    tagline: str(row.tagline),
    bestFit: str(row.best_fit ?? row.bestFit),
    description: str(row.description),
    monthlyPriceCents: numOrNull(row.monthly_price_cents ?? row.monthlyPriceCents),
    annualPriceCents: numOrNull(row.annual_price_cents ?? row.annualPriceCents),
    annualDiscountPct: num(row.annual_discount_pct ?? row.annualDiscountPct),
    setupFeeCents: num(row.setup_fee_cents ?? row.setupFeeCents),
    customPricing: Boolean(row.custom_pricing ?? row.customPricing),
    includedHours: numOrNull(row.included_hours ?? row.includedHours),
    additionalHourlyRateCents: numOrNull(
      row.additional_hourly_rate_cents ?? row.additionalHourlyRateCents
    ),
    supportLevel: str(row.support_level ?? row.supportLevel),
    responseTime: str(row.response_time ?? row.responseTime),
    minimumCommitmentMonths: num(
      row.minimum_commitment_months ?? row.minimumCommitmentMonths
    ),
    cancellationTerms: str(row.cancellation_terms ?? row.cancellationTerms),
    features: arr<string>(row.features),
    detailedScope: arr<string>(row.detailed_scope ?? row.detailedScope),
    addons: arr(row.addons),
    comparison: obj(row.comparison) as ManagedServicePlan["comparison"],
    recommended: Boolean(row.recommended),
    businessCritical: Boolean(row.business_critical ?? row.businessCritical),
    tierRank: num(row.tier_rank ?? row.tierRank),
    basePlanKey: strOrNull(row.base_plan_key ?? row.basePlanKey),
    clientId: strOrNull(row.client_id ?? row.clientId),
    active: row.active === undefined ? true : Boolean(row.active),
    sortOrder: num(row.sort_order ?? row.sortOrder),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function planToRow(plan: ManagedServicePlan): Record<string, unknown> {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    tagline: plan.tagline,
    best_fit: plan.bestFit,
    description: plan.description,
    monthly_price_cents: plan.monthlyPriceCents,
    annual_price_cents: plan.annualPriceCents,
    annual_discount_pct: plan.annualDiscountPct,
    setup_fee_cents: plan.setupFeeCents,
    custom_pricing: plan.customPricing,
    included_hours: plan.includedHours,
    additional_hourly_rate_cents: plan.additionalHourlyRateCents,
    support_level: plan.supportLevel,
    response_time: plan.responseTime,
    minimum_commitment_months: plan.minimumCommitmentMonths,
    cancellation_terms: plan.cancellationTerms,
    features: plan.features,
    detailed_scope: plan.detailedScope,
    addons: plan.addons,
    comparison: plan.comparison,
    recommended: plan.recommended,
    business_critical: plan.businessCritical,
    tier_rank: plan.tierRank,
    base_plan_key: plan.basePlanKey,
    client_id: plan.clientId,
    active: plan.active,
    sort_order: plan.sortOrder,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

/**
 * List plans. By default returns active, non-client-specific plans in
 * sort order (the public four). Pass options for admin views.
 */
export async function listPlans(options?: {
  includeInactive?: boolean;
  includeClientPlans?: boolean;
}): Promise<ManagedServicePlan[]> {
  const includeInactive = options?.includeInactive ?? false;
  const includeClientPlans = options?.includeClientPlans ?? false;

  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("managed_service_plans").select("*");
      if (!includeInactive) query = query.eq("active", true);
      if (!includeClientPlans) query = query.is("client_id", null);
      const { data, error } = await query
        .order("sort_order", { ascending: true })
        .limit(200);
      if (error) throw error;
      if (data?.length) {
        return data.map((r) => rowToPlan(r as Record<string, unknown>));
      }
    } catch (err) {
      console.warn("[managed-services] listPlans failed — using defaults.", err);
    }
  }

  const db = await readDb();
  const filePlans = db.plans.filter(
    (p) =>
      (includeInactive || p.active) && (includeClientPlans || p.clientId == null)
  );
  // Defaults provide the four standard plans; file rows override by key.
  const merged = new Map<string, ManagedServicePlan>();
  for (const p of DEFAULT_PLANS) {
    if (includeInactive || p.active) merged.set(p.key, p);
  }
  for (const p of filePlans) merged.set(p.key, p);
  return [...merged.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPlanById(id: string): Promise<ManagedServicePlan | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("managed_service_plans")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) return rowToPlan(data as Record<string, unknown>);
      return null;
    } catch (err) {
      console.warn("[managed-services] getPlanById failed.", err);
    }
  }
  const all = await listPlans({ includeInactive: true, includeClientPlans: true });
  return all.find((p) => p.id === id) ?? null;
}

export async function getPlanByKey(key: string): Promise<ManagedServicePlan | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("managed_service_plans")
        .select("*")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (data) return rowToPlan(data as Record<string, unknown>);
      return null;
    } catch (err) {
      console.warn("[managed-services] getPlanByKey failed.", err);
    }
  }
  const all = await listPlans({ includeInactive: true, includeClientPlans: true });
  return all.find((p) => p.key === key) ?? null;
}

/** Create or update a plan (admin). Patches are whitelisted by the caller. */
export async function upsertPlan(
  patch: PlanPatch & { id?: string }
): Promise<ManagedServicePlan | null> {
  const existing = patch.id ? await getPlanById(patch.id) : null;
  const base =
    existing ??
    (patch.key ? await getPlanByKey(patch.key) : null) ??
    null;

  const now = nowIso();
  const plan: ManagedServicePlan = {
    id: base?.id ?? randomUUID(),
    key: patch.key ?? base?.key ?? `custom-${randomUUID().slice(0, 8)}`,
    name: patch.name ?? base?.name ?? "Untitled plan",
    tagline: patch.tagline ?? base?.tagline ?? "",
    bestFit: patch.bestFit ?? base?.bestFit ?? "",
    description: patch.description ?? base?.description ?? "",
    monthlyPriceCents:
      patch.monthlyPriceCents !== undefined
        ? patch.monthlyPriceCents
        : base?.monthlyPriceCents ?? null,
    annualPriceCents:
      patch.annualPriceCents !== undefined
        ? patch.annualPriceCents
        : base?.annualPriceCents ?? null,
    annualDiscountPct: patch.annualDiscountPct ?? base?.annualDiscountPct ?? 0,
    setupFeeCents: patch.setupFeeCents ?? base?.setupFeeCents ?? 0,
    customPricing: patch.customPricing ?? base?.customPricing ?? false,
    includedHours:
      patch.includedHours !== undefined
        ? patch.includedHours
        : base?.includedHours ?? null,
    additionalHourlyRateCents:
      patch.additionalHourlyRateCents !== undefined
        ? patch.additionalHourlyRateCents
        : base?.additionalHourlyRateCents ?? null,
    supportLevel: patch.supportLevel ?? base?.supportLevel ?? "",
    responseTime: patch.responseTime ?? base?.responseTime ?? "",
    minimumCommitmentMonths:
      patch.minimumCommitmentMonths ?? base?.minimumCommitmentMonths ?? 0,
    cancellationTerms: patch.cancellationTerms ?? base?.cancellationTerms ?? "",
    features: patch.features ?? base?.features ?? [],
    detailedScope: patch.detailedScope ?? base?.detailedScope ?? [],
    addons: patch.addons ?? base?.addons ?? [],
    comparison: patch.comparison ?? base?.comparison ?? {},
    recommended: patch.recommended ?? base?.recommended ?? false,
    businessCritical: patch.businessCritical ?? base?.businessCritical ?? false,
    tierRank: patch.tierRank ?? base?.tierRank ?? 0,
    basePlanKey:
      patch.basePlanKey !== undefined
        ? patch.basePlanKey
        : base?.basePlanKey ?? null,
    clientId:
      patch.clientId !== undefined ? patch.clientId : base?.clientId ?? null,
    active: patch.active ?? base?.active ?? true,
    sortOrder: patch.sortOrder ?? base?.sortOrder ?? 0,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("managed_service_plans")
        .upsert(planToRow(plan), { onConflict: "id" });
      if (error) throw error;
      return plan;
    } catch (err) {
      console.warn("[managed-services] upsertPlan failed — using file store.", err);
    }
  }

  const db = await readDb();
  const idx = db.plans.findIndex((p) => p.id === plan.id || p.key === plan.key);
  if (idx === -1) db.plans.push(plan);
  else db.plans[idx] = plan;
  await writeDb(db);
  return plan;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

function rowToSubscription(row: Record<string, unknown>): ClientSubscription {
  const status = str(row.status, "pending") as SubscriptionStatus;
  return {
    id: str(row.id),
    clientId: str(row.client_id ?? row.clientId),
    planId: str(row.plan_id ?? row.planId),
    status: SUBSCRIPTION_STATUSES.includes(status) ? status : "pending",
    billingFrequency:
      str(row.billing_frequency ?? row.billingFrequency) === "annual"
        ? "annual"
        : "monthly",
    monthlyPriceCents: num(row.monthly_price_cents ?? row.monthlyPriceCents),
    annualPriceCents: numOrNull(row.annual_price_cents ?? row.annualPriceCents),
    setupFeeCents: num(row.setup_fee_cents ?? row.setupFeeCents),
    currency: str(row.currency, "usd"),
    includedHours: numOrNull(row.included_hours ?? row.includedHours),
    additionalHourlyRateCents: numOrNull(
      row.additional_hourly_rate_cents ?? row.additionalHourlyRateCents
    ),
    minimumCommitmentMonths: num(
      row.minimum_commitment_months ?? row.minimumCommitmentMonths
    ),
    commitmentEndsAt: strOrNull(row.commitment_ends_at ?? row.commitmentEndsAt),
    startedAt: strOrNull(row.started_at ?? row.startedAt),
    currentPeriodStart: strOrNull(
      row.current_period_start ?? row.currentPeriodStart
    ),
    currentPeriodEnd: strOrNull(row.current_period_end ?? row.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end ?? row.cancelAtPeriodEnd),
    cancellationRequestedAt: strOrNull(
      row.cancellation_requested_at ?? row.cancellationRequestedAt
    ),
    cancellationReason: strOrNull(
      row.cancellation_reason ?? row.cancellationReason
    ),
    pausedAt: strOrNull(row.paused_at ?? row.pausedAt),
    endedAt: strOrNull(row.ended_at ?? row.endedAt),
    stripeCustomerId: strOrNull(row.stripe_customer_id ?? row.stripeCustomerId),
    stripeSubscriptionId: strOrNull(
      row.stripe_subscription_id ?? row.stripeSubscriptionId
    ),
    paymentMethodSummary: str(
      row.payment_method_summary ?? row.paymentMethodSummary
    ),
    lastPaymentStatus: str(row.last_payment_status ?? row.lastPaymentStatus),
    lastPaymentAt: strOrNull(row.last_payment_at ?? row.lastPaymentAt),
    failedPaymentCount: num(row.failed_payment_count ?? row.failedPaymentCount),
    accountManager: str(row.account_manager ?? row.accountManager),
    technicalOwner: str(row.technical_owner ?? row.technicalOwner),
    slaNotes: str(row.sla_notes ?? row.slaNotes),
    adminNotes: str(row.admin_notes ?? row.adminNotes),
    source: str(row.source, "admin"),
    proposalId: strOrNull(row.proposal_id ?? row.proposalId),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function subscriptionToRow(sub: ClientSubscription): Record<string, unknown> {
  return {
    id: sub.id,
    client_id: sub.clientId,
    plan_id: sub.planId,
    status: sub.status,
    billing_frequency: sub.billingFrequency,
    monthly_price_cents: sub.monthlyPriceCents,
    annual_price_cents: sub.annualPriceCents,
    setup_fee_cents: sub.setupFeeCents,
    currency: sub.currency,
    included_hours: sub.includedHours,
    additional_hourly_rate_cents: sub.additionalHourlyRateCents,
    minimum_commitment_months: sub.minimumCommitmentMonths,
    commitment_ends_at: sub.commitmentEndsAt,
    started_at: sub.startedAt,
    current_period_start: sub.currentPeriodStart,
    current_period_end: sub.currentPeriodEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    cancellation_requested_at: sub.cancellationRequestedAt,
    cancellation_reason: sub.cancellationReason,
    paused_at: sub.pausedAt,
    ended_at: sub.endedAt,
    stripe_customer_id: sub.stripeCustomerId,
    stripe_subscription_id: sub.stripeSubscriptionId,
    payment_method_summary: sub.paymentMethodSummary,
    last_payment_status: sub.lastPaymentStatus,
    last_payment_at: sub.lastPaymentAt,
    failed_payment_count: sub.failedPaymentCount,
    account_manager: sub.accountManager,
    technical_owner: sub.technicalOwner,
    sla_notes: sub.slaNotes,
    admin_notes: sub.adminNotes,
    source: sub.source,
    proposal_id: sub.proposalId,
    created_at: sub.createdAt,
    updated_at: sub.updatedAt,
  };
}

/** Attach plan display fields to subscriptions. */
async function decorateSubscriptions(
  subs: ClientSubscription[]
): Promise<ClientSubscription[]> {
  if (!subs.length) return subs;
  const plans = await listPlans({ includeInactive: true, includeClientPlans: true });
  const byId = new Map(plans.map((p) => [p.id, p]));
  return subs.map((s) => {
    const plan = byId.get(s.planId);
    return plan
      ? {
          ...s,
          planKey: plan.key,
          planName: plan.name,
          planBusinessCritical: plan.businessCritical,
        }
      : s;
  });
}

export async function listSubscriptions(options?: {
  clientId?: string;
  statuses?: SubscriptionStatus[];
}): Promise<ClientSubscription[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("client_subscriptions").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.statuses?.length)
        query = query.in("status", options.statuses);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return decorateSubscriptions(
        (data ?? []).map((r) => rowToSubscription(r as Record<string, unknown>))
      );
    } catch (err) {
      console.warn("[managed-services] listSubscriptions failed.", err);
    }
  }

  const db = await readDb();
  let subs = db.subscriptions;
  if (options?.clientId) subs = subs.filter((s) => s.clientId === options.clientId);
  if (options?.statuses?.length)
    subs = subs.filter((s) => options.statuses!.includes(s.status));
  return decorateSubscriptions(
    [...subs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function getSubscription(
  id: string
): Promise<ClientSubscription | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [decorated] = await decorateSubscriptions([
        rowToSubscription(data as Record<string, unknown>),
      ]);
      return decorated ?? null;
    } catch (err) {
      console.warn("[managed-services] getSubscription failed.", err);
    }
  }
  const db = await readDb();
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) return null;
  const [decorated] = await decorateSubscriptions([sub]);
  return decorated ?? null;
}

export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<ClientSubscription | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [decorated] = await decorateSubscriptions([
        rowToSubscription(data as Record<string, unknown>),
      ]);
      return decorated ?? null;
    } catch (err) {
      console.warn("[managed-services] getSubscriptionByStripeId failed.", err);
    }
  }
  const db = await readDb();
  const sub = db.subscriptions.find(
    (s) => s.stripeSubscriptionId === stripeSubscriptionId
  );
  if (!sub) return null;
  const [decorated] = await decorateSubscriptions([sub]);
  return decorated ?? null;
}

/** The client's current (non-cancelled) subscription, newest first. */
export async function getActiveSubscriptionForClient(
  clientId: string
): Promise<ClientSubscription | null> {
  const subs = await listSubscriptions({ clientId });
  return (
    subs.find((s) =>
      ["active", "past_due", "pending_cancellation", "paused"].includes(s.status)
    ) ??
    subs.find((s) => ["pending", "awaiting_payment"].includes(s.status)) ??
    null
  );
}

export type SubscriptionCreateInput = {
  clientId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingFrequency?: "monthly" | "annual";
  monthlyPriceCents?: number;
  annualPriceCents?: number | null;
  setupFeeCents?: number;
  includedHours?: number | null;
  additionalHourlyRateCents?: number | null;
  minimumCommitmentMonths?: number;
  accountManager?: string;
  technicalOwner?: string;
  slaNotes?: string;
  adminNotes?: string;
  source?: string;
  proposalId?: string | null;
  stripeCustomerId?: string | null;
};

/** Create a subscription. Economics default from the plan row. */
export async function createSubscription(
  input: SubscriptionCreateInput
): Promise<ClientSubscription | null> {
  const plan = await getPlanById(input.planId);
  if (!plan) return null;

  const now = nowIso();
  const sub: ClientSubscription = {
    id: randomUUID(),
    clientId: input.clientId,
    planId: plan.id,
    planKey: plan.key,
    planName: plan.name,
    planBusinessCritical: plan.businessCritical,
    status: input.status ?? "pending",
    billingFrequency: input.billingFrequency ?? "monthly",
    monthlyPriceCents: input.monthlyPriceCents ?? plan.monthlyPriceCents ?? 0,
    annualPriceCents:
      input.annualPriceCents !== undefined
        ? input.annualPriceCents
        : plan.annualPriceCents,
    setupFeeCents: input.setupFeeCents ?? plan.setupFeeCents,
    currency: "usd",
    includedHours:
      input.includedHours !== undefined ? input.includedHours : plan.includedHours,
    additionalHourlyRateCents:
      input.additionalHourlyRateCents !== undefined
        ? input.additionalHourlyRateCents
        : plan.additionalHourlyRateCents,
    minimumCommitmentMonths:
      input.minimumCommitmentMonths ?? plan.minimumCommitmentMonths,
    commitmentEndsAt: null,
    startedAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancellationRequestedAt: null,
    cancellationReason: null,
    pausedAt: null,
    endedAt: null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: null,
    paymentMethodSummary: "",
    lastPaymentStatus: "",
    lastPaymentAt: null,
    failedPaymentCount: 0,
    accountManager: input.accountManager ?? "",
    technicalOwner: input.technicalOwner ?? "",
    slaNotes: input.slaNotes ?? "",
    adminNotes: input.adminNotes ?? "",
    source: input.source ?? "admin",
    proposalId: input.proposalId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("client_subscriptions")
        .insert(subscriptionToRow(sub));
      if (error) throw error;
      return sub;
    } catch (err) {
      console.warn(
        "[managed-services] createSubscription failed — using file store.",
        err
      );
    }
  }

  const db = await readDb();
  db.subscriptions.unshift(sub);
  await writeDb(db);
  return sub;
}

export type SubscriptionPatch = Partial<
  Omit<ClientSubscription, "id" | "clientId" | "createdAt" | "updatedAt">
>;

export async function updateSubscription(
  id: string,
  patch: SubscriptionPatch
): Promise<ClientSubscription | null> {
  const existing = await getSubscription(id);
  if (!existing) return null;
  const next: ClientSubscription = { ...existing, ...patch, updatedAt: nowIso() };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const row = subscriptionToRow(next);
      delete row.id;
      delete row.client_id;
      delete row.created_at;
      const { error } = await supabase
        .from("client_subscriptions")
        .update(row)
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[managed-services] updateSubscription failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.subscriptions.findIndex((s) => s.id === id);
  if (idx === -1) db.subscriptions.unshift(next);
  else db.subscriptions[idx] = next;
  await writeDb(db);
  return next;
}

// ---------------------------------------------------------------------------
// Subscription events (audit + Stripe replay protection)
// ---------------------------------------------------------------------------

function rowToEvent(row: Record<string, unknown>): SubscriptionEvent {
  return {
    id: str(row.id),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    clientId: strOrNull(row.client_id ?? row.clientId),
    type: str(row.type),
    description: str(row.description),
    actor: str(row.actor, "system"),
    data: obj(row.data),
    stripeEventId: strOrNull(row.stripe_event_id ?? row.stripeEventId),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
  };
}

export async function recordSubscriptionEvent(input: {
  subscriptionId?: string | null;
  clientId?: string | null;
  type: string;
  description?: string;
  actor?: string;
  data?: Record<string, unknown>;
  stripeEventId?: string | null;
}): Promise<SubscriptionEvent | null> {
  const event: SubscriptionEvent = {
    id: randomUUID(),
    subscriptionId: input.subscriptionId ?? null,
    clientId: input.clientId ?? null,
    type: input.type,
    description: input.description ?? "",
    actor: input.actor ?? "system",
    data: input.data ?? {},
    stripeEventId: input.stripeEventId ?? null,
    createdAt: nowIso(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("subscription_events").insert({
        id: event.id,
        subscription_id: event.subscriptionId,
        client_id: event.clientId,
        type: event.type,
        description: event.description,
        actor: event.actor,
        data: event.data,
        stripe_event_id: event.stripeEventId,
        created_at: event.createdAt,
      });
      if (error) throw error;
      return event;
    } catch (err) {
      // Unique violation on stripe_event_id means the event was already
      // processed — callers treat null as "skip".
      if (event.stripeEventId) {
        const e = err as { code?: string; message?: string };
        if (
          e?.code === "23505" ||
          /duplicate key/i.test(e?.message ?? "")
        ) {
          console.warn("[managed-services] event insert rejected (replay).", err);
          return null;
        }
        // Any other storage failure must NOT look like a replay — rethrow so
        // the webhook returns 500 and Stripe retries (nothing was claimed).
        throw err;
      }
      console.warn("[managed-services] recordSubscriptionEvent failed.", err);
    }
  }

  const db = await readDb();
  if (
    event.stripeEventId &&
    db.events.some((e) => e.stripeEventId === event.stripeEventId)
  ) {
    return null;
  }
  db.events.unshift(event);
  await writeDb({ ...db, events: db.events.slice(0, 5000) });
  return event;
}

/**
 * Claim a Stripe event id exactly once. Returns true when this call
 * claimed it (process the event), false when it was already processed.
 */
export async function claimStripeEvent(
  stripeEventId: string,
  type: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  const event = await recordSubscriptionEvent({
    type: `stripe.${type}`,
    description: `Stripe webhook: ${type}`,
    actor: "stripe",
    data,
    stripeEventId,
  });
  return event !== null;
}

export async function listSubscriptionEvents(options?: {
  subscriptionId?: string;
  clientId?: string;
  limit?: number;
}): Promise<SubscriptionEvent[]> {
  const limit = options?.limit ?? 100;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("subscription_events").select("*");
      if (options?.subscriptionId)
        query = query.eq("subscription_id", options.subscriptionId);
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToEvent(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[managed-services] listSubscriptionEvents failed.", err);
    }
  }
  const db = await readDb();
  let events = db.events;
  if (options?.subscriptionId)
    events = events.filter((e) => e.subscriptionId === options.subscriptionId);
  if (options?.clientId)
    events = events.filter((e) => e.clientId === options.clientId);
  return events.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

function rowToInvoice(row: Record<string, unknown>): SubscriptionInvoice {
  return {
    id: str(row.id),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    clientId: strOrNull(row.client_id ?? row.clientId),
    stripeInvoiceId: strOrNull(row.stripe_invoice_id ?? row.stripeInvoiceId),
    invoiceNumber: str(row.invoice_number ?? row.invoiceNumber),
    description: str(row.description),
    amountDueCents: num(row.amount_due_cents ?? row.amountDueCents),
    amountPaidCents: num(row.amount_paid_cents ?? row.amountPaidCents),
    currency: str(row.currency, "usd"),
    status: str(row.status, "open"),
    hostedInvoiceUrl: str(row.hosted_invoice_url ?? row.hostedInvoiceUrl),
    invoicePdfUrl: str(row.invoice_pdf_url ?? row.invoicePdfUrl),
    periodStart: strOrNull(row.period_start ?? row.periodStart),
    periodEnd: strOrNull(row.period_end ?? row.periodEnd),
    issuedAt: strOrNull(row.issued_at ?? row.issuedAt),
    paidAt: strOrNull(row.paid_at ?? row.paidAt),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

/** Insert-or-update an invoice keyed by its Stripe invoice id. */
export async function upsertInvoice(input: {
  subscriptionId?: string | null;
  clientId?: string | null;
  stripeInvoiceId: string;
  invoiceNumber?: string;
  description?: string;
  amountDueCents?: number;
  amountPaidCents?: number;
  currency?: string;
  status?: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
}): Promise<SubscriptionInvoice | null> {
  const now = nowIso();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("subscription_invoices")
        .select("id, paid_at")
        .eq("stripe_invoice_id", input.stripeInvoiceId)
        .maybeSingle();
      const existingPaidAt =
        (existing as { paid_at?: string | null } | null)?.paid_at ?? null;

      const row: Record<string, unknown> = {
        subscription_id: input.subscriptionId ?? null,
        client_id: input.clientId ?? null,
        stripe_invoice_id: input.stripeInvoiceId,
        invoice_number: input.invoiceNumber ?? "",
        description: input.description ?? "",
        amount_due_cents: input.amountDueCents ?? 0,
        amount_paid_cents: input.amountPaidCents ?? 0,
        currency: input.currency ?? "usd",
        status: input.status ?? "open",
        hosted_invoice_url: input.hostedInvoiceUrl ?? "",
        invoice_pdf_url: input.invoicePdfUrl ?? "",
        period_start: input.periodStart ?? null,
        period_end: input.periodEnd ?? null,
        issued_at: input.issuedAt ?? null,
        // Never regress a recorded payment when events arrive out of order
        // (e.g. invoice.finalized delivered after invoice.paid).
        paid_at: input.paidAt ?? existingPaidAt,
        updated_at: now,
      };

      if (existing?.id) {
        const { data, error } = await supabase
          .from("subscription_invoices")
          .update(row)
          .eq("id", existing.id)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        return data ? rowToInvoice(data as Record<string, unknown>) : null;
      }
      const { data, error } = await supabase
        .from("subscription_invoices")
        .insert({ id: randomUUID(), created_at: now, ...row })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToInvoice(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[managed-services] upsertInvoice failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.invoices.findIndex(
    (i) => i.stripeInvoiceId === input.stripeInvoiceId
  );
  const base: SubscriptionInvoice =
    idx >= 0
      ? db.invoices[idx]!
      : {
          id: randomUUID(),
          subscriptionId: null,
          clientId: null,
          stripeInvoiceId: input.stripeInvoiceId,
          invoiceNumber: "",
          description: "",
          amountDueCents: 0,
          amountPaidCents: 0,
          currency: "usd",
          status: "open",
          hostedInvoiceUrl: "",
          invoicePdfUrl: "",
          periodStart: null,
          periodEnd: null,
          issuedAt: null,
          paidAt: null,
          createdAt: now,
          updatedAt: now,
        };
  const next: SubscriptionInvoice = {
    ...base,
    subscriptionId: input.subscriptionId ?? base.subscriptionId,
    clientId: input.clientId ?? base.clientId,
    invoiceNumber: input.invoiceNumber ?? base.invoiceNumber,
    description: input.description ?? base.description,
    amountDueCents: input.amountDueCents ?? base.amountDueCents,
    amountPaidCents: input.amountPaidCents ?? base.amountPaidCents,
    currency: input.currency ?? base.currency,
    status: input.status ?? base.status,
    hostedInvoiceUrl: input.hostedInvoiceUrl ?? base.hostedInvoiceUrl,
    invoicePdfUrl: input.invoicePdfUrl ?? base.invoicePdfUrl,
    periodStart: input.periodStart ?? base.periodStart,
    periodEnd: input.periodEnd ?? base.periodEnd,
    issuedAt: input.issuedAt ?? base.issuedAt,
    paidAt: input.paidAt ?? base.paidAt,
    updatedAt: now,
  };
  if (idx >= 0) db.invoices[idx] = next;
  else db.invoices.unshift(next);
  await writeDb(db);
  return next;
}

export async function listInvoices(options?: {
  clientId?: string;
  subscriptionId?: string;
  limit?: number;
}): Promise<SubscriptionInvoice[]> {
  const limit = options?.limit ?? 100;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("subscription_invoices").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.subscriptionId)
        query = query.eq("subscription_id", options.subscriptionId);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToInvoice(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[managed-services] listInvoices failed.", err);
    }
  }
  const db = await readDb();
  let invoices = db.invoices;
  if (options?.clientId)
    invoices = invoices.filter((i) => i.clientId === options.clientId);
  if (options?.subscriptionId)
    invoices = invoices.filter((i) => i.subscriptionId === options.subscriptionId);
  return invoices.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Service requests
// ---------------------------------------------------------------------------

function rowToRequest(row: Record<string, unknown>): ServiceRequest {
  const type = str(row.type, "general") as ServiceRequestType;
  const status = str(row.status, "new") as ServiceRequestStatus;
  return {
    id: str(row.id),
    clientId: str(row.client_id ?? row.clientId),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    type: SERVICE_REQUEST_TYPES.includes(type) ? type : "general",
    title: str(row.title),
    details: str(row.details),
    status: SERVICE_REQUEST_STATUSES.includes(status) ? status : "new",
    priority: (["standard", "priority", "urgent"].includes(str(row.priority))
      ? str(row.priority)
      : "standard") as ServiceRequest["priority"],
    inclusion: ([
      "included",
      "needs_approval",
      "extra_charge",
      "pending_assessment",
    ].includes(str(row.inclusion))
      ? str(row.inclusion)
      : "pending_assessment") as ServiceRequestInclusion,
    acknowledgedConsequences: Boolean(
      row.acknowledged_consequences ?? row.acknowledgedConsequences
    ),
    estimatedHours: numOrNull(row.estimated_hours ?? row.estimatedHours),
    actualHours: numOrNull(row.actual_hours ?? row.actualHours),
    extraChargeCents: numOrNull(row.extra_charge_cents ?? row.extraChargeCents),
    responseDueAt: strOrNull(row.response_due_at ?? row.responseDueAt),
    resolvedAt: strOrNull(row.resolved_at ?? row.resolvedAt),
    adminNotes: str(row.admin_notes ?? row.adminNotes),
    activity: arr(row.activity),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function requestToRow(req: ServiceRequest): Record<string, unknown> {
  return {
    id: req.id,
    client_id: req.clientId,
    subscription_id: req.subscriptionId,
    type: req.type,
    title: req.title,
    details: req.details,
    status: req.status,
    priority: req.priority,
    inclusion: req.inclusion,
    acknowledged_consequences: req.acknowledgedConsequences,
    estimated_hours: req.estimatedHours,
    actual_hours: req.actualHours,
    extra_charge_cents: req.extraChargeCents,
    response_due_at: req.responseDueAt,
    resolved_at: req.resolvedAt,
    admin_notes: req.adminNotes,
    activity: req.activity,
    created_at: req.createdAt,
    updated_at: req.updatedAt,
  };
}

/** Response-time SLA in hours, by plan key. */
export function responseSlaHours(planKey?: string | null): number {
  switch (planKey) {
    case "managed_infrastructure":
      return 4;
    case "scale":
      return 8;
    case "optimize":
      return 24;
    case "maintain":
      return 48;
    default:
      return 72;
  }
}

/** Whether a request type is included at a given plan level. */
export function requestInclusionFor(
  type: ServiceRequestType,
  planKey?: string | null
): ServiceRequestInclusion {
  // Administrative flows are always accepted.
  if (
    type === "plan_change" ||
    type === "cancellation_request" ||
    type === "review_request" ||
    type === "general"
  ) {
    return "included";
  }
  if (type === "additional_work") return "extra_charge";

  const tier =
    planKey === "managed_infrastructure"
      ? 4
      : planKey === "scale"
        ? 3
        : planKey === "optimize"
          ? 2
          : planKey === "maintain"
            ? 1
            : 0;

  if (tier === 0) return "extra_charge";
  if (tier === 4) return "included";

  switch (type) {
    case "technical_issue":
    case "security_concern":
      return "included";
    case "infrastructure_issue":
      return tier >= 2 ? "included" : "needs_approval";
    case "website_change":
    case "crm_change":
    case "reporting_request":
      return tier >= 2 ? "included" : "needs_approval";
    case "automation_request":
      return tier >= 3 ? "included" : "extra_charge";
    case "ai_knowledge_update":
      return tier >= 3 ? "included" : "needs_approval";
    case "new_integration":
      return tier >= 3 ? "included" : tier >= 2 ? "needs_approval" : "extra_charge";
    case "strategy_request":
      return tier >= 3 ? "included" : "needs_approval";
    default:
      return "pending_assessment";
  }
}

export async function createServiceRequest(input: {
  clientId: string;
  subscriptionId?: string | null;
  planKey?: string | null;
  type: ServiceRequestType;
  title: string;
  details?: string;
  acknowledgedConsequences?: boolean;
  actorLabel?: string;
}): Promise<ServiceRequest | null> {
  const now = new Date();
  const slaHours = responseSlaHours(input.planKey);
  const request: ServiceRequest = {
    id: randomUUID(),
    clientId: input.clientId,
    subscriptionId: input.subscriptionId ?? null,
    type: input.type,
    title: input.title,
    details: input.details ?? "",
    status: "new",
    priority:
      input.planKey === "managed_infrastructure"
        ? "urgent"
        : input.planKey === "scale" || input.planKey === "optimize"
          ? "priority"
          : "standard",
    inclusion: requestInclusionFor(input.type, input.planKey),
    acknowledgedConsequences: input.acknowledgedConsequences ?? false,
    estimatedHours: null,
    actualHours: null,
    extraChargeCents: null,
    responseDueAt: new Date(now.getTime() + slaHours * 3600_000).toISOString(),
    resolvedAt: null,
    adminNotes: "",
    activity: [
      {
        at: now.toISOString(),
        text: "Request submitted",
        by: input.actorLabel,
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("service_requests")
        .insert(requestToRow(request));
      if (error) throw error;
      return request;
    } catch (err) {
      console.warn("[managed-services] createServiceRequest failed.", err);
    }
  }

  const db = await readDb();
  db.requests.unshift(request);
  await writeDb(db);
  return request;
}

export async function listServiceRequests(options?: {
  clientId?: string;
  statuses?: ServiceRequestStatus[];
  limit?: number;
}): Promise<ServiceRequest[]> {
  const limit = options?.limit ?? 500;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("service_requests").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.statuses?.length)
        query = query.in("status", options.statuses);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToRequest(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[managed-services] listServiceRequests failed.", err);
    }
  }
  const db = await readDb();
  let requests = db.requests;
  if (options?.clientId)
    requests = requests.filter((r) => r.clientId === options.clientId);
  if (options?.statuses?.length)
    requests = requests.filter((r) => options.statuses!.includes(r.status));
  return requests.slice(0, limit);
}

export async function getServiceRequest(
  id: string
): Promise<ServiceRequest | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRequest(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[managed-services] getServiceRequest failed.", err);
    }
  }
  const db = await readDb();
  return db.requests.find((r) => r.id === id) ?? null;
}

export async function updateServiceRequest(
  id: string,
  patch: Partial<
    Pick<
      ServiceRequest,
      | "status"
      | "priority"
      | "inclusion"
      | "estimatedHours"
      | "actualHours"
      | "extraChargeCents"
      | "adminNotes"
      | "resolvedAt"
    >
  >,
  actor?: string
): Promise<ServiceRequest | null> {
  const existing = await getServiceRequest(id);
  if (!existing) return null;

  const now = nowIso();
  const activity = [...existing.activity];
  if (patch.status && patch.status !== existing.status) {
    activity.unshift({
      at: now,
      text: `Status changed to ${patch.status.replaceAll("_", " ")}`,
      by: actor,
    });
  }
  if (patch.inclusion && patch.inclusion !== existing.inclusion) {
    activity.unshift({
      at: now,
      text: `Scope assessment: ${patch.inclusion.replaceAll("_", " ")}`,
      by: actor,
    });
  }

  const next: ServiceRequest = {
    ...existing,
    ...patch,
    resolvedAt:
      patch.resolvedAt !== undefined
        ? patch.resolvedAt
        : patch.status === "completed" || patch.status === "declined"
          ? now
          : existing.resolvedAt,
    activity: activity.slice(0, 100),
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const row = requestToRow(next);
      delete row.id;
      delete row.client_id;
      delete row.created_at;
      const { error } = await supabase
        .from("service_requests")
        .update(row)
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[managed-services] updateServiceRequest failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.requests.findIndex((r) => r.id === id);
  if (idx === -1) db.requests.unshift(next);
  else db.requests[idx] = next;
  await writeDb(db);
  return next;
}

// ---------------------------------------------------------------------------
// Maintenance logs
// ---------------------------------------------------------------------------

function rowToMaintenance(row: Record<string, unknown>): MaintenanceLog {
  const category = str(row.category, "maintenance") as MaintenanceCategory;
  return {
    id: str(row.id),
    clientId: str(row.client_id ?? row.clientId),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    title: str(row.title),
    category: MAINTENANCE_CATEGORIES.includes(category) ? category : "other",
    description: str(row.description),
    hoursSpent: num(row.hours_spent ?? row.hoursSpent),
    performedBy: str(row.performed_by ?? row.performedBy),
    performedAt: str(row.performed_at ?? row.performedAt, nowIso()),
    visibleToClient:
      row.visible_to_client === undefined && row.visibleToClient === undefined
        ? true
        : Boolean(row.visible_to_client ?? row.visibleToClient),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
  };
}

export async function addMaintenanceLog(input: {
  clientId: string;
  subscriptionId?: string | null;
  title: string;
  category?: MaintenanceCategory;
  description?: string;
  hoursSpent?: number;
  performedBy?: string;
  performedAt?: string;
  visibleToClient?: boolean;
}): Promise<MaintenanceLog | null> {
  const log: MaintenanceLog = {
    id: randomUUID(),
    clientId: input.clientId,
    subscriptionId: input.subscriptionId ?? null,
    title: input.title,
    category: input.category ?? "maintenance",
    description: input.description ?? "",
    hoursSpent: input.hoursSpent ?? 0,
    performedBy: input.performedBy ?? "",
    performedAt: input.performedAt ?? nowIso(),
    visibleToClient: input.visibleToClient ?? true,
    createdAt: nowIso(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("maintenance_logs").insert({
        id: log.id,
        client_id: log.clientId,
        subscription_id: log.subscriptionId,
        title: log.title,
        category: log.category,
        description: log.description,
        hours_spent: log.hoursSpent,
        performed_by: log.performedBy,
        performed_at: log.performedAt,
        visible_to_client: log.visibleToClient,
        created_at: log.createdAt,
      });
      if (error) throw error;
      return log;
    } catch (err) {
      console.warn("[managed-services] addMaintenanceLog failed.", err);
    }
  }

  const db = await readDb();
  db.maintenance.unshift(log);
  await writeDb({ ...db, maintenance: db.maintenance.slice(0, 5000) });
  return log;
}

export async function listMaintenanceLogs(options?: {
  clientId?: string;
  since?: string;
  visibleToClientOnly?: boolean;
  limit?: number;
}): Promise<MaintenanceLog[]> {
  const limit = options?.limit ?? 200;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("maintenance_logs").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.since) query = query.gte("performed_at", options.since);
      if (options?.visibleToClientOnly)
        query = query.eq("visible_to_client", true);
      const { data, error } = await query
        .order("performed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) =>
        rowToMaintenance(r as Record<string, unknown>)
      );
    } catch (err) {
      console.warn("[managed-services] listMaintenanceLogs failed.", err);
    }
  }
  const db = await readDb();
  let logs = db.maintenance;
  if (options?.clientId) logs = logs.filter((l) => l.clientId === options.clientId);
  if (options?.since) logs = logs.filter((l) => l.performedAt >= options.since!);
  if (options?.visibleToClientOnly) logs = logs.filter((l) => l.visibleToClient);
  return logs.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Service reports
// ---------------------------------------------------------------------------

function rowToReport(row: Record<string, unknown>): ServiceReport {
  return {
    id: str(row.id),
    clientId: str(row.client_id ?? row.clientId),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    kind: (["monthly", "health", "baseline", "quarterly"].includes(str(row.kind))
      ? str(row.kind)
      : "monthly") as ReportKind,
    title: str(row.title),
    periodStart: strOrNull(row.period_start ?? row.periodStart),
    periodEnd: strOrNull(row.period_end ?? row.periodEnd),
    status: str(row.status) === "published" ? "published" : "draft",
    summary: str(row.summary),
    data: obj(row.data) as ServiceReportData,
    publishedAt: strOrNull(row.published_at ?? row.publishedAt),
    createdBy: str(row.created_by ?? row.createdBy),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function reportToRow(report: ServiceReport): Record<string, unknown> {
  return {
    id: report.id,
    client_id: report.clientId,
    subscription_id: report.subscriptionId,
    kind: report.kind,
    title: report.title,
    period_start: report.periodStart,
    period_end: report.periodEnd,
    status: report.status,
    summary: report.summary,
    data: report.data,
    published_at: report.publishedAt,
    created_by: report.createdBy,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  };
}

export async function upsertServiceReport(input: {
  id?: string;
  clientId: string;
  subscriptionId?: string | null;
  kind?: ReportKind;
  title: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: "draft" | "published";
  summary?: string;
  data?: ServiceReportData;
  createdBy?: string;
}): Promise<ServiceReport | null> {
  const now = nowIso();
  const existing = input.id ? await getServiceReport(input.id) : null;
  const report: ServiceReport = {
    id: existing?.id ?? input.id ?? randomUUID(),
    clientId: input.clientId,
    subscriptionId: input.subscriptionId ?? existing?.subscriptionId ?? null,
    kind: input.kind ?? existing?.kind ?? "monthly",
    title: input.title,
    periodStart:
      input.periodStart !== undefined
        ? input.periodStart
        : existing?.periodStart ?? null,
    periodEnd:
      input.periodEnd !== undefined ? input.periodEnd : existing?.periodEnd ?? null,
    status: input.status ?? existing?.status ?? "draft",
    summary: input.summary ?? existing?.summary ?? "",
    data: input.data ?? existing?.data ?? {},
    publishedAt:
      (input.status ?? existing?.status) === "published"
        ? existing?.publishedAt ?? now
        : null,
    createdBy: input.createdBy ?? existing?.createdBy ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("service_reports")
        .upsert(reportToRow(report), { onConflict: "id" });
      if (error) throw error;
      return report;
    } catch (err) {
      console.warn("[managed-services] upsertServiceReport failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.reports.findIndex((r) => r.id === report.id);
  if (idx === -1) db.reports.unshift(report);
  else db.reports[idx] = report;
  await writeDb(db);
  return report;
}

export async function getServiceReport(id: string): Promise<ServiceReport | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("service_reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToReport(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[managed-services] getServiceReport failed.", err);
    }
  }
  const db = await readDb();
  return db.reports.find((r) => r.id === id) ?? null;
}

export async function listServiceReports(options?: {
  clientId?: string;
  publishedOnly?: boolean;
  limit?: number;
}): Promise<ServiceReport[]> {
  const limit = options?.limit ?? 100;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("service_reports").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      if (options?.publishedOnly) query = query.eq("status", "published");
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToReport(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[managed-services] listServiceReports failed.", err);
    }
  }
  const db = await readDb();
  let reports = db.reports;
  if (options?.clientId)
    reports = reports.filter((r) => r.clientId === options.clientId);
  if (options?.publishedOnly)
    reports = reports.filter((r) => r.status === "published");
  return reports.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Roadmaps
// ---------------------------------------------------------------------------

function rowToRoadmap(row: Record<string, unknown>): ClientRoadmap {
  return {
    id: str(row.id),
    clientId: str(row.client_id ?? row.clientId),
    subscriptionId: strOrNull(row.subscription_id ?? row.subscriptionId),
    title: str(row.title),
    periodLabel: str(row.period_label ?? row.periodLabel),
    status: ([
      "draft",
      "proposed",
      "approved",
      "in_progress",
      "completed",
    ].includes(str(row.status))
      ? str(row.status)
      : "draft") as RoadmapStatus,
    summary: str(row.summary),
    items: arr<RoadmapItem>(row.items),
    estimatedImpact: str(row.estimated_impact ?? row.estimatedImpact),
    proposedTimeline: str(row.proposed_timeline ?? row.proposedTimeline),
    reviewScheduledFor: strOrNull(
      row.review_scheduled_for ?? row.reviewScheduledFor
    ),
    approvedAt: strOrNull(row.approved_at ?? row.approvedAt),
    approvedBy: strOrNull(row.approved_by ?? row.approvedBy),
    createdAt: str(row.created_at ?? row.createdAt, nowIso()),
    updatedAt: str(row.updated_at ?? row.updatedAt, nowIso()),
  };
}

function roadmapToRow(r: ClientRoadmap): Record<string, unknown> {
  return {
    id: r.id,
    client_id: r.clientId,
    subscription_id: r.subscriptionId,
    title: r.title,
    period_label: r.periodLabel,
    status: r.status,
    summary: r.summary,
    items: r.items,
    estimated_impact: r.estimatedImpact,
    proposed_timeline: r.proposedTimeline,
    review_scheduled_for: r.reviewScheduledFor,
    approved_at: r.approvedAt,
    approved_by: r.approvedBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function upsertRoadmap(input: {
  id?: string;
  clientId: string;
  subscriptionId?: string | null;
  title: string;
  periodLabel?: string;
  status?: RoadmapStatus;
  summary?: string;
  items?: RoadmapItem[];
  estimatedImpact?: string;
  proposedTimeline?: string;
  reviewScheduledFor?: string | null;
}): Promise<ClientRoadmap | null> {
  const now = nowIso();
  const existing = input.id ? await getRoadmap(input.id) : null;
  const roadmap: ClientRoadmap = {
    id: existing?.id ?? input.id ?? randomUUID(),
    clientId: input.clientId,
    subscriptionId: input.subscriptionId ?? existing?.subscriptionId ?? null,
    title: input.title,
    periodLabel: input.periodLabel ?? existing?.periodLabel ?? "",
    status: input.status ?? existing?.status ?? "draft",
    summary: input.summary ?? existing?.summary ?? "",
    items: input.items ?? existing?.items ?? [],
    estimatedImpact: input.estimatedImpact ?? existing?.estimatedImpact ?? "",
    proposedTimeline: input.proposedTimeline ?? existing?.proposedTimeline ?? "",
    reviewScheduledFor:
      input.reviewScheduledFor !== undefined
        ? input.reviewScheduledFor
        : existing?.reviewScheduledFor ?? null,
    approvedAt: existing?.approvedAt ?? null,
    approvedBy: existing?.approvedBy ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("client_roadmaps")
        .upsert(roadmapToRow(roadmap), { onConflict: "id" });
      if (error) throw error;
      return roadmap;
    } catch (err) {
      console.warn("[managed-services] upsertRoadmap failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.roadmaps.findIndex((r) => r.id === roadmap.id);
  if (idx === -1) db.roadmaps.unshift(roadmap);
  else db.roadmaps[idx] = roadmap;
  await writeDb(db);
  return roadmap;
}

export async function getRoadmap(id: string): Promise<ClientRoadmap | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("client_roadmaps")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToRoadmap(data as Record<string, unknown>) : null;
    } catch (err) {
      console.warn("[managed-services] getRoadmap failed.", err);
    }
  }
  const db = await readDb();
  return db.roadmaps.find((r) => r.id === id) ?? null;
}

export async function listRoadmaps(options?: {
  clientId?: string;
  limit?: number;
}): Promise<ClientRoadmap[]> {
  const limit = options?.limit ?? 50;
  const supabase = getSupabase();
  if (supabase) {
    try {
      let query = supabase.from("client_roadmaps").select("*");
      if (options?.clientId) query = query.eq("client_id", options.clientId);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => rowToRoadmap(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[managed-services] listRoadmaps failed.", err);
    }
  }
  const db = await readDb();
  let roadmaps = db.roadmaps;
  if (options?.clientId)
    roadmaps = roadmaps.filter((r) => r.clientId === options.clientId);
  return roadmaps.slice(0, limit);
}

/** Client (or admin on their behalf) approves the proposed roadmap phase. */
export async function approveRoadmap(
  id: string,
  approvedBy: string
): Promise<ClientRoadmap | null> {
  const existing = await getRoadmap(id);
  if (!existing) return null;
  const now = nowIso();
  const next: ClientRoadmap = {
    ...existing,
    status: "approved",
    items: existing.items.map((item) =>
      item.status === "proposed" ? { ...item, status: "approved" } : item
    ),
    approvedAt: now,
    approvedBy,
    updatedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("client_roadmaps")
        .update({
          status: next.status,
          items: next.items,
          approved_at: next.approvedAt,
          approved_by: next.approvedBy,
          updated_at: next.updatedAt,
        })
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[managed-services] approveRoadmap failed.", err);
    }
  }

  const db = await readDb();
  const idx = db.roadmaps.findIndex((r) => r.id === id);
  if (idx === -1) db.roadmaps.unshift(next);
  else db.roadmaps[idx] = next;
  await writeDb(db);
  return next;
}

// ---------------------------------------------------------------------------
// Client billing identity (clients.stripe_customer_id)
// ---------------------------------------------------------------------------

export async function getClientStripeCustomerId(
  clientId: string
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("stripe_customer_id")
      .eq("id", clientId)
      .maybeSingle();
    if (error) throw error;
    const id = (data as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id;
    return id || null;
  } catch (err) {
    console.warn("[managed-services] getClientStripeCustomerId failed.", err);
    return null;
  }
}

export async function setClientStripeCustomerId(
  clientId: string,
  stripeCustomerId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("clients")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", clientId);
    if (error) throw error;
  } catch (err) {
    console.warn("[managed-services] setClientStripeCustomerId failed.", err);
  }
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/** Statuses that count toward recurring revenue. */
const REVENUE_STATUSES: SubscriptionStatus[] = [
  "active",
  "past_due",
  "pending_cancellation",
];

/** Normalized monthly value of a subscription, in cents. */
export function normalizedMonthlyCents(sub: {
  billingFrequency: "monthly" | "annual";
  monthlyPriceCents: number;
  annualPriceCents: number | null;
}): number {
  if (sub.billingFrequency === "annual") {
    if (sub.annualPriceCents != null) return Math.round(sub.annualPriceCents / 12);
    return sub.monthlyPriceCents;
  }
  return sub.monthlyPriceCents;
}

export async function getRecurringRevenueSummary(): Promise<RecurringRevenueSummary> {
  const [subs, plans] = await Promise.all([
    listSubscriptions(),
    listPlans({ includeInactive: true, includeClientPlans: true }),
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));

  const revenueSubs = subs.filter((s) => REVENUE_STATUSES.includes(s.status));
  const mrrCents = revenueSubs.reduce(
    (sum, s) => sum + normalizedMonthlyCents(s),
    0
  );

  const byPlanMap = new Map<
    string,
    { planId: string; planKey: string; planName: string; count: number; mrrCents: number }
  >();
  for (const s of revenueSubs) {
    const plan = planById.get(s.planId);
    const entry = byPlanMap.get(s.planId) ?? {
      planId: s.planId,
      planKey: plan?.key ?? "unknown",
      planName: plan?.name ?? "Unknown plan",
      count: 0,
      mrrCents: 0,
    };
    entry.count += 1;
    entry.mrrCents += normalizedMonthlyCents(s);
    byPlanMap.set(s.planId, entry);
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  return {
    activeSubscriptions: revenueSubs.length,
    mrrCents,
    arrCents: mrrCents * 12,
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrrCents - a.mrrCents),
    pastDue: subs.filter((s) => s.status === "past_due").length,
    pendingCancellation: subs.filter((s) => s.status === "pending_cancellation")
      .length,
    cancelledLast90Days: subs.filter(
      (s) => s.status === "cancelled" && (s.endedAt ?? s.updatedAt) >= ninetyDaysAgo
    ).length,
    failedPaymentsLast30Days: subs.filter(
      (s) =>
        s.failedPaymentCount > 0 &&
        s.lastPaymentAt != null &&
        s.lastPaymentAt >= thirtyDaysAgo &&
        s.lastPaymentStatus === "failed"
    ).length,
  };
}

/** Hours consumed in the current service period vs. plan allocation. */
export async function getHoursUsage(
  sub: ClientSubscription
): Promise<HoursUsage> {
  const periodStart =
    sub.currentPeriodStart ??
    // Fall back to the calendar month when the billing period is unknown.
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const periodEnd = sub.currentPeriodEnd ?? nowIso();

  const logs = await listMaintenanceLogs({
    clientId: sub.clientId,
    since: periodStart,
  });
  const usedHours = logs.reduce((sum, l) => sum + l.hoursSpent, 0);
  const included = sub.includedHours;
  return {
    includedHours: included,
    usedHours: Math.round(usedHours * 100) / 100,
    periodStart,
    periodEnd,
    approachingLimit:
      included != null && included > 0 && usedHours >= included * 0.8,
    overLimit: included != null && included > 0 && usedHours > included,
  };
}

/**
 * Consultative upgrade recommendations, computed from real usage.
 * Pure logic split out for testability.
 */
export function computeUpgradeRecommendations(input: {
  planKey: string | null;
  requestsLast90Days: ServiceRequest[];
  usage: HoursUsage | null;
}): UpgradeRecommendation[] {
  const { planKey, requestsLast90Days: requests, usage } = input;
  const recs: UpgradeRecommendation[] = [];
  const tier =
    planKey === "managed_infrastructure"
      ? 4
      : planKey === "scale"
        ? 3
        : planKey === "optimize"
          ? 2
          : planKey === "maintain"
            ? 1
            : 0;

  const changeRequests = requests.filter((r) =>
    ["website_change", "crm_change", "reporting_request"].includes(r.type)
  );
  const automationRequests = requests.filter((r) =>
    ["automation_request", "new_integration"].includes(r.type)
  );
  const aiOrSecurityRequests = requests.filter((r) =>
    ["ai_knowledge_update", "security_concern", "infrastructure_issue"].includes(
      r.type
    )
  );
  const technicalIssues = requests.filter((r) => r.type === "technical_issue");

  if (tier === 1 && changeRequests.length >= 3) {
    recs.push({
      targetPlanKey: "optimize",
      headline: "You're requesting regular changes",
      reason:
        "You've submitted several change requests recently. Optimize includes monthly system changes, funnel improvements, and analytics reporting — usually more economical than per-request work.",
    });
  }

  if (tier === 2 && automationRequests.length >= 1) {
    recs.push({
      targetPlanKey: "scale",
      headline: "Ready for new automation development",
      reason:
        "Your recent requests involve new automations or integrations. Scale includes automation development, AI improvements, and monthly strategy consulting.",
    });
  }

  if (tier > 0 && tier < 4 && aiOrSecurityRequests.length >= 2) {
    recs.push({
      targetPlanKey: "managed_infrastructure",
      headline: "Consider fully managed infrastructure",
      reason:
        "Your requests suggest AI systems or sensitive infrastructure under active use. Managed Infrastructure adds model management, security testing, and priority incident response.",
    });
  }

  if (usage?.approachingLimit && tier > 0 && tier < 3) {
    const target = tier === 1 ? "optimize" : "scale";
    recs.push({
      targetPlanKey: target as StandardPlanKey,
      headline: usage.overLimit
        ? "You've used all included hours this period"
        : "You're approaching your included hours",
      reason:
        "A higher plan includes more monthly service hours at a lower effective rate — worth reviewing against your recent usage.",
    });
  }

  if (technicalIssues.length >= 3) {
    recs.push({
      targetPlanKey: (tier >= 3 ? "managed_infrastructure" : "optimize") as StandardPlanKey,
      headline: "Recurring technical issues — let's do a systems review",
      reason:
        "Several technical issues in a short window usually points to an underlying cause. We'd recommend a systems review to fix the root problem rather than the symptoms.",
    });
  }

  // De-duplicate by target plan, keep first (highest-signal) reason.
  const seen = new Set<string>();
  return recs.filter((r) => {
    if (seen.has(r.targetPlanKey)) return false;
    seen.add(r.targetPlanKey);
    return true;
  });
}

export async function getUpgradeRecommendations(
  clientId: string,
  sub: ClientSubscription | null
): Promise<UpgradeRecommendation[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();
  const requests = (await listServiceRequests({ clientId })).filter(
    (r) => r.createdAt >= ninetyDaysAgo
  );
  const usage = sub ? await getHoursUsage(sub) : null;
  return computeUpgradeRecommendations({
    planKey: sub?.planKey ?? null,
    requestsLast90Days: requests,
    usage,
  });
}
