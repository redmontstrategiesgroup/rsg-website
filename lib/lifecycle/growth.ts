/**
 * Client Lifecycle Platform — renewals and expansion roadmap.
 *
 * Renewals track anything with a date that must not sneak up on anyone
 * (contracts, subscriptions, support plans, review meetings) with tiered
 * reminder windows. Expansion items form the client's growth roadmap;
 * suggestions are rule-based from real platform data and are never persisted
 * automatically — the admin decides what goes on the roadmap.
 */

import { nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type {
  ExpansionItem,
  ExpansionStatus,
  Metric,
  Renewal,
  RenewalKind,
  RenewalStatus,
} from "@/lib/lifecycle/types";

const DAY_MS = 86_400_000;

/** Renewal statuses that still need reminders / attention. */
const ACTIVE_RENEWAL_STATUSES: RenewalStatus[] = [
  "upcoming",
  "notice_sent",
  "in_discussion",
];

/** Parse a Postgres date (YYYY-MM-DD) as a UTC timestamp. */
function dateUtcMs(dateOnly: string): number {
  const [y, m, d] = dateOnly.slice(0, 10).split("-").map((n) => Number.parseInt(n, 10));
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function isoDateOnly(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Renewals
// ---------------------------------------------------------------------------

export async function createRenewal(input: {
  clientId: string;
  contractId?: string | null;
  kind: RenewalKind;
  name: string;
  renewsOn: string; // YYYY-MM-DD
  term?: string;
  valueCents?: number | null;
  reminderDays?: number[];
}): Promise<Renewal> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewsOn)) {
    throw new Error(`Invalid renewal date "${input.renewsOn}" — expected YYYY-MM-DD.`);
  }
  const sb = requireSupabase();
  const row: Record<string, unknown> = {
    client_id: input.clientId,
    contract_id: input.contractId ?? null,
    kind: input.kind,
    name: input.name,
    renews_on: input.renewsOn,
    term: input.term ?? "",
    value_cents: input.valueCents ?? null,
    updated_at: nowIso(),
  };
  if (input.reminderDays !== undefined) row.reminder_days = input.reminderDays;

  const { data, error } = await sb
    .from("renewals")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to create renewal "${input.name}" for client ${input.clientId}: ${error.message}`);
  }
  return data as Renewal;
}

export async function updateRenewal(
  id: string,
  patch: {
    kind?: RenewalKind;
    name?: string;
    renewsOn?: string;
    term?: string;
    valueCents?: number | null;
    status?: RenewalStatus;
    reminderDays?: number[];
    notes?: string;
    contractId?: string | null;
  },
): Promise<Renewal> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.renewsOn !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.renewsOn)) {
      throw new Error(`Invalid renewal date "${patch.renewsOn}" — expected YYYY-MM-DD.`);
    }
    row.renews_on = patch.renewsOn;
  }
  if (patch.term !== undefined) row.term = patch.term;
  if (patch.valueCents !== undefined) row.value_cents = patch.valueCents;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reminderDays !== undefined) row.reminder_days = patch.reminderDays;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.contractId !== undefined) row.contract_id = patch.contractId;

  const { data, error } = await sb
    .from("renewals")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update renewal ${id}: ${error.message}`);
  return data as Renewal;
}

export async function listRenewalsForClient(clientId: string): Promise<Renewal[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("renewals")
    .select("*")
    .eq("client_id", clientId)
    .order("renews_on", { ascending: true });
  if (error) {
    throw new Error(`Failed to list renewals for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as Renewal[];
}

export async function listRenewals(
  opts: { status?: RenewalStatus; withinDays?: number; limit?: number } = {},
): Promise<Renewal[]> {
  const sb = requireSupabase();
  let query = sb
    .from("renewals")
    .select("*")
    .order("renews_on", { ascending: true });
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.withinDays !== undefined) {
    query = query.lte("renews_on", isoDateOnly(Date.now() + opts.withinDays * DAY_MS));
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list renewals: ${error.message}`);
  return (data ?? []) as Renewal[];
}

/**
 * Active renewals whose reminder window has been crossed and not yet acted on.
 * A renewal is due when days-until-renews_on has entered any window in its
 * reminder_days and last_reminded_at is null or predates that window's
 * crossing point. The caller sends the notice and then calls
 * markRenewalReminded(id).
 */
export async function findDueRenewalReminders(
  now: Date = new Date(),
): Promise<{ renewal: Renewal; daysOut: number }[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("renewals")
    .select("*")
    .in("status", ACTIVE_RENEWAL_STATUSES)
    .order("renews_on", { ascending: true });
  if (error) throw new Error(`Failed to load renewals for reminders: ${error.message}`);

  const due: { renewal: Renewal; daysOut: number }[] = [];
  for (const renewal of (data ?? []) as Renewal[]) {
    const renewsAtMs = dateUtcMs(renewal.renews_on);
    const daysOut = Math.ceil((renewsAtMs - now.getTime()) / DAY_MS);
    if (daysOut < 0) continue; // already past the renewal date — nothing to remind

    const windows = (Array.isArray(renewal.reminder_days) ? renewal.reminder_days : [])
      .filter((n) => Number.isFinite(n) && n >= 0);
    const lastRemindedMs = renewal.last_reminded_at
      ? new Date(renewal.last_reminded_at).getTime()
      : null;

    const isDue = windows.some((windowDays) => {
      if (daysOut > windowDays) return false; // window not reached yet
      const crossingMs = renewsAtMs - windowDays * DAY_MS;
      return lastRemindedMs === null || lastRemindedMs < crossingMs;
    });

    if (isDue) due.push({ renewal, daysOut });
  }
  return due;
}

/** Record that a reminder went out; first reminder moves status to notice_sent. */
export async function markRenewalReminded(id: string): Promise<Renewal> {
  const sb = requireSupabase();
  const { data: existing, error: loadError } = await sb
    .from("renewals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(`Failed to load renewal ${id}: ${loadError.message}`);
  if (!existing) throw new Error(`Renewal ${id} not found.`);

  const renewal = existing as Renewal;
  const row: Record<string, unknown> = {
    last_reminded_at: nowIso(),
    updated_at: nowIso(),
  };
  if (renewal.status === "upcoming") row.status = "notice_sent" satisfies RenewalStatus;

  const { data, error } = await sb
    .from("renewals")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to mark renewal ${id} reminded: ${error.message}`);
  return data as Renewal;
}

// ---------------------------------------------------------------------------
// Expansion roadmap
// ---------------------------------------------------------------------------

export async function createExpansionItem(input: {
  clientId: string;
  title: string;
  problem?: string;
  solution?: string;
  expectedOutcome?: string;
  priority?: ExpansionItem["priority"];
  timing?: string;
  dependencies?: string;
  investmentRange?: string;
  status?: ExpansionStatus;
  source?: ExpansionItem["source"];
  sortOrder?: number;
}): Promise<ExpansionItem> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("expansion_items")
    .insert({
      client_id: input.clientId,
      title: input.title,
      problem: input.problem ?? "",
      solution: input.solution ?? "",
      expected_outcome: input.expectedOutcome ?? "",
      priority: input.priority ?? "medium",
      timing: input.timing ?? "",
      dependencies: input.dependencies ?? "",
      investment_range: input.investmentRange ?? "",
      status: input.status ?? "identified",
      source: input.source ?? "manual",
      sort_order: input.sortOrder ?? 0,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to create expansion item "${input.title}" for client ${input.clientId}: ${error.message}`);
  }
  return data as ExpansionItem;
}

export async function updateExpansionItem(
  id: string,
  patch: {
    status?: ExpansionStatus;
    priority?: ExpansionItem["priority"];
    title?: string;
    problem?: string;
    solution?: string;
    expectedOutcome?: string;
    timing?: string;
    dependencies?: string;
    investmentRange?: string;
    sortOrder?: number;
  },
): Promise<ExpansionItem> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.problem !== undefined) row.problem = patch.problem;
  if (patch.solution !== undefined) row.solution = patch.solution;
  if (patch.expectedOutcome !== undefined) row.expected_outcome = patch.expectedOutcome;
  if (patch.timing !== undefined) row.timing = patch.timing;
  if (patch.dependencies !== undefined) row.dependencies = patch.dependencies;
  if (patch.investmentRange !== undefined) row.investment_range = patch.investmentRange;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { data, error } = await sb
    .from("expansion_items")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update expansion item ${id}: ${error.message}`);
  return data as ExpansionItem;
}

export async function listExpansionItems(
  clientId: string,
  opts: { status?: ExpansionStatus } = {},
): Promise<ExpansionItem[]> {
  const sb = requireSupabase();
  let query = sb
    .from("expansion_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list expansion items for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as ExpansionItem[];
}

export async function deleteExpansionItem(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("expansion_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete expansion item ${id}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Rule-based expansion suggestions (never persisted — admin decides)
// ---------------------------------------------------------------------------

export type ExpansionSuggestion = {
  title: string;
  problem: string;
  solution: string;
  expectedOutcome: string;
  priority: ExpansionItem["priority"];
  source: ExpansionItem["source"];
};

const TICKET_SIGNAL_THRESHOLD = 3;
const TICKET_LOOKBACK_DAYS = 90;
const RENEWAL_LOOKAHEAD_DAYS = 60;

/**
 * Rule-based expansion opportunities derived from real platform data only:
 * ticket patterns, recorded metrics, nearing support-plan renewals, and
 * project lifecycle status. Every suggestion cites the counts that produced
 * it. Nothing is persisted; if no signals exist the list is empty.
 */
export async function suggestExpansionOpportunities(
  clientId: string,
): Promise<ExpansionSuggestion[]> {
  const sb = requireSupabase();
  const ticketSince = new Date(Date.now() - TICKET_LOOKBACK_DAYS * DAY_MS).toISOString();

  const [ticketsRes, metricsRes, renewalsRes, projectsRes] = await Promise.all([
    sb
      .from("tickets")
      .select("category")
      .eq("client_id", clientId)
      .gte("created_at", ticketSince),
    sb
      .from("metrics")
      .select("key, value, period_month")
      .eq("client_id", clientId),
    sb
      .from("renewals")
      .select("*")
      .eq("client_id", clientId)
      .eq("kind", "support_plan")
      .in("status", ACTIVE_RENEWAL_STATUSES),
    sb
      .from("projects")
      .select("id, name, status")
      .eq("client_id", clientId)
      .in("status", ["support", "completed"]),
  ]);

  if (ticketsRes.error) {
    throw new Error(`Failed to load tickets for expansion suggestions (client ${clientId}): ${ticketsRes.error.message}`);
  }
  if (metricsRes.error) {
    throw new Error(`Failed to load metrics for expansion suggestions (client ${clientId}): ${metricsRes.error.message}`);
  }
  if (renewalsRes.error) {
    throw new Error(`Failed to load renewals for expansion suggestions (client ${clientId}): ${renewalsRes.error.message}`);
  }
  if (projectsRes.error) {
    throw new Error(`Failed to load projects for expansion suggestions (client ${clientId}): ${projectsRes.error.message}`);
  }

  const tickets = (ticketsRes.data ?? []) as { category: string }[];
  const metrics = (metricsRes.data ?? []) as Pick<Metric, "key" | "value" | "period_month">[];
  const supportRenewals = (renewalsRes.data ?? []) as Renewal[];
  const quietProjects = (projectsRes.data ?? []) as { id: string; name: string; status: string }[];

  const suggestions: ExpansionSuggestion[] = [];

  // 1. Ticket patterns → recurring needs the current engagement doesn't cover.
  const websiteUpdateCount = tickets.filter((t) => t.category === "website_update").length;
  if (websiteUpdateCount >= TICKET_SIGNAL_THRESHOLD) {
    suggestions.push({
      title: "Ongoing website optimization plan",
      problem: `${websiteUpdateCount} website-update tickets were submitted in the last ${TICKET_LOOKBACK_DAYS} days — website changes are being handled one ticket at a time.`,
      solution: "A monthly optimization plan with a set allocation for content, design, and page updates, worked on a predictable cadence instead of per-request tickets.",
      expectedOutcome: "Website changes ship on a regular schedule, with the recurring ticket back-and-forth removed.",
      priority: websiteUpdateCount >= TICKET_SIGNAL_THRESHOLD * 2 ? "high" : "medium",
      source: "support",
    });
  }

  const trainingCount = tickets.filter((t) => t.category === "training").length;
  if (trainingCount >= TICKET_SIGNAL_THRESHOLD) {
    suggestions.push({
      title: "Team enablement package",
      problem: `${trainingCount} training tickets were submitted in the last ${TICKET_LOOKBACK_DAYS} days — the team is learning the systems one support request at a time.`,
      solution: "A structured enablement package: role-based training sessions plus an assigned training-library curriculum for the whole team.",
      expectedOutcome: "The team self-serves day-to-day questions and training requests stop arriving as support tickets.",
      priority: "medium",
      source: "support",
    });
  }

  // 2. Metrics → what measured performance says about the next system.
  const missedCallRows = metrics.filter((m) => m.key === "missed_calls_recovered");
  if (missedCallRows.length > 0) {
    const totalRecovered = missedCallRows.reduce((sum, m) => sum + Number(m.value), 0);
    const monthsTracked = new Set(missedCallRows.map((m) => m.period_month.slice(0, 7))).size;
    suggestions.push({
      title: "Expand AI reception coverage",
      problem: `${totalRecovered} missed calls were recovered across ${monthsTracked} tracked month${monthsTracked === 1 ? "" : "s"} — call volume is regularly exceeding what gets answered live.`,
      solution: "Extend AI reception to full after-hours and overflow coverage, including booking and qualification on recovered calls.",
      expectedOutcome: "A larger share of inbound calls turns into booked work instead of voicemail.",
      priority: "high",
      source: "report",
    });
  }

  const hasReviewMetric = metrics.some((m) => m.key === "reviews_generated");
  if (metrics.length > 0 && !hasReviewMetric) {
    const monthsTracked = new Set(metrics.map((m) => m.period_month.slice(0, 7))).size;
    suggestions.push({
      title: "Review generation system",
      problem: `${metrics.length} metric entries are tracked across ${monthsTracked} month${monthsTracked === 1 ? "" : "s"}, and none measure review generation — there is no system producing reviews today.`,
      solution: "Automated post-job review requests with follow-up sequencing, tracked as a monthly reviews_generated metric.",
      expectedOutcome: "A steady, measurable flow of new reviews feeding local reputation and conversion.",
      priority: "medium",
      source: "report",
    });
  }

  // 3. Support-plan renewals nearing → the natural moment to right-size the tier.
  const nowMs = Date.now();
  for (const renewal of supportRenewals) {
    const daysOut = Math.ceil((dateUtcMs(renewal.renews_on) - nowMs) / DAY_MS);
    if (daysOut < 0 || daysOut > RENEWAL_LOOKAHEAD_DAYS) continue;
    suggestions.push({
      title: `Review support tier before "${renewal.name}" renews`,
      problem: `The support plan "${renewal.name}" renews on ${renewal.renews_on} (${daysOut} day${daysOut === 1 ? "" : "s"} out) — the renewal window is the natural point to right-size coverage.`,
      solution: "Review actual support usage against the current plan and move to a higher tier with faster response targets if usage justifies it.",
      expectedOutcome: "The support plan matches real usage going into the next term, agreed before the renewal date.",
      priority: daysOut <= 30 ? "high" : "medium",
      source: "support",
    });
  }

  // 4. Projects in support/completed → no active build phase is driving improvement.
  if (quietProjects.length > 0) {
    const names = quietProjects.map((p) => p.name).join(", ");
    suggestions.push({
      title: "Quarterly optimization reviews",
      problem: `${quietProjects.length} project${quietProjects.length === 1 ? " is" : "s are"} in support or completed status (${names}) — no active build phase is currently driving improvements.`,
      solution: "A quarterly optimization review: performance walkthrough, small-improvement backlog, and a refreshed roadmap each quarter.",
      expectedOutcome: "Delivered systems keep compounding after launch instead of going static.",
      priority: "medium",
      source: "project",
    });
  }

  return suggestions;
}
