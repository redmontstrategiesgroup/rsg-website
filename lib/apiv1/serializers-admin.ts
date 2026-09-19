// lib/apiv1/serializers-admin.ts
/**
 * DTO serializers for the admin API. Each `toXDto` is an explicit object
 * literal picking exactly the listed keys — never a spread of the source
 * row — so internal/sensitive columns can never leak by accident.
 */
import type { Proposal } from "../lifecycle/types.ts";
import type { PageView } from "../types.ts";

export const ADMIN_DENYLIST = [
  "password_hash",
  "token",
  "approved_ip",
  "sections",
  "qualification_snapshot",
  "service_plan_answers",
  "ip",
  "user_agent",
  "storageMetadata",
];

export type LeadRow = {
  id: string;
  name: string;
  business_name: string;
  website: string | null;
  email: string;
  phone: string | null;
  industry: string | null;
  biggest_problem: string | null;
  improvement_goal: string | null;
  preferred_contact: string | null;
  best_time: string | null;
  timeline: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  lead_score: number | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  owner: string | null;
  archived_at: string | null;
  created_at: string;
  deleted_at: string | null;
  qualification_snapshot?: Record<string, unknown> | null;
  service_plan_answers?: Record<string, unknown> | null;
  recommended_plan?: string | null;
};

export function toLeadDto(r: LeadRow) {
  return {
    id: r.id,
    name: r.name,
    company: r.business_name,
    email: r.email,
    phone: r.phone,
    website: r.website,
    industry: r.industry,
    problem: r.biggest_problem,
    improve: r.improvement_goal,
    preferred_contact: r.preferred_contact,
    best_time: r.best_time,
    timeline: r.timeline,
    source: r.source,
    status: r.status,
    score: r.lead_score,
    owner: r.owner,
    notes: r.notes,
    recommended_plan: r.recommended_plan ?? null,
    page_url: r.page_url,
    referrer: r.referrer,
    utm_source: r.utm_source,
    utm_medium: r.utm_medium,
    utm_campaign: r.utm_campaign,
    utm_content: r.utm_content,
    utm_term: r.utm_term,
    archived_at: r.archived_at,
    created_at: r.created_at,
  };
}

export type ClientRow = {
  id: string;
  email: string;
  name: string;
  company: string;
  plan: string | null;
  member_since: string | null;
  strategist: string | null;
  status: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export function toClientAdminDto(r: ClientRow) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    company: r.company,
    plan: r.plan,
    status: r.status,
    member_since: r.member_since,
    strategist: r.strategist,
    lead_id: r.lead_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function toProposalDto(p: Proposal) {
  return {
    id: p.id,
    opportunity_id: p.opportunity_id,
    lead_id: p.lead_id,
    client_id: p.client_id,
    title: p.title,
    status: p.status,
    version: p.version,
    currency: p.currency,
    total_cents: p.total_cents,
    deposit_cents: p.deposit_cents,
    payment_schedule: p.payment_schedule,
    expires_at: p.expires_at,
    sent_at: p.sent_at,
    first_viewed_at: p.first_viewed_at,
    last_viewed_at: p.last_viewed_at,
    approved_at: p.approved_at,
    approved_by_name: p.approved_by_name,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export type EntityName = "actions" | "opportunities" | "risks" | "ideas";

export const ENTITY_TABLE: Record<EntityName, string> = {
  actions: "action_items",
  opportunities: "opportunities",
  risks: "risks",
  ideas: "ideas",
};

export type EntityRow = Record<string, unknown> & { id: string; created_at: string };

const ENTITY_KEYS: Record<EntityName, readonly string[]> = {
  actions: ["id", "title", "description", "priority", "status", "due_date", "deferred_until", "requires_review", "approved_at", "completed_at", "created_at", "updated_at"],
  opportunities: ["id", "name", "description", "opportunity_type", "stage", "horizon", "recommended_next_step", "requires_review", "approved_at", "created_at", "updated_at"],
  risks: ["id", "title", "description", "severity", "status", "mitigation", "last_reviewed_at", "created_at", "updated_at"],
  ideas: ["id", "title", "description", "idea_type", "status", "next_step", "created_at", "updated_at"],
};

export function toEntityDto(entity: EntityName, r: EntityRow): Record<string, unknown> {
  const keys = ENTITY_KEYS[entity];
  return Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
}

export type AuditRow = {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export function toAuditEventDto(r: AuditRow) {
  return {
    id: r.id,
    actor_type: r.actor_type,
    actor_id: r.actor_id,
    actor_email: r.actor_email,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    metadata: r.metadata,
    created_at: r.created_at,
  };
}

export function toPageViewDto(v: PageView) {
  return {
    at: v.at,
    path: v.path,
    referrer: v.referrer,
    visitor: v.vid,
  };
}
