/**
 * Client Lifecycle Platform — monthly reporting.
 *
 * Metrics land in `metrics` (one row per client + key + period month) and are
 * assembled into `reports` scorecards. Reports never invent numbers: the
 * scorecard only contains metric rows that actually exist, and every narrative
 * field starts empty for the admin to write.
 */

import {
  newToken,
  nowIso,
  periodLabel,
  requireSupabase,
} from "@/lib/lifecycle/core";
import type {
  Metric,
  MetricSource,
  MonthlyReport,
  ReportStatus,
  ScorecardEntry,
} from "@/lib/lifecycle/types";
import { formatCents } from "@/lib/lifecycle/types";

// ---------------------------------------------------------------------------
// Metric catalog
// ---------------------------------------------------------------------------

export type MetricCatalogEntry = {
  key: string;
  label: string;
  unit: string;
  /** Which way "better" points. Response time is better when it goes down. */
  direction: "up" | "down";
};

export const METRIC_CATALOG: MetricCatalogEntry[] = [
  { key: "leads_generated", label: "Leads generated", unit: "count", direction: "up" },
  { key: "lead_response_minutes", label: "Average lead response time", unit: "minutes", direction: "down" },
  { key: "appointment_conversion_rate", label: "Appointment conversion rate", unit: "%", direction: "up" },
  { key: "pipeline_value", label: "Pipeline value", unit: "cents", direction: "up" },
  { key: "quote_acceptance_rate", label: "Quote acceptance rate", unit: "%", direction: "up" },
  { key: "revenue_attributed", label: "Revenue attributed", unit: "cents", direction: "up" },
  { key: "missed_calls_recovered", label: "Missed calls recovered", unit: "count", direction: "up" },
  { key: "followups_sent", label: "Follow-ups sent", unit: "count", direction: "up" },
  { key: "customers_reactivated", label: "Customers reactivated", unit: "count", direction: "up" },
  { key: "reviews_generated", label: "Reviews generated", unit: "count", direction: "up" },
  { key: "website_visits", label: "Website visits", unit: "count", direction: "up" },
  { key: "conversion_rate", label: "Website conversion rate", unit: "%", direction: "up" },
  { key: "bookings", label: "Bookings", unit: "count", direction: "up" },
  { key: "automation_runs", label: "Automation runs", unit: "count", direction: "up" },
  { key: "hours_saved", label: "Hours saved", unit: "hours", direction: "up" },
  { key: "tickets_resolved", label: "Support tickets resolved", unit: "count", direction: "up" },
  { key: "uptime_pct", label: "System uptime", unit: "%", direction: "up" },
  { key: "active_users", label: "Active users", unit: "count", direction: "up" },
  { key: "roi_pct", label: "Return on investment", unit: "%", direction: "up" },
];

function catalogEntry(key: string): MetricCatalogEntry | undefined {
  return METRIC_CATALOG.find((entry) => entry.key === key);
}

// ---------------------------------------------------------------------------
// Period helpers (internal)
// ---------------------------------------------------------------------------

const PERIOD_RE = /^\d{4}-\d{2}-01$/;

function assertPeriod(period: string): void {
  if (!PERIOD_RE.test(period)) {
    throw new Error(`Invalid period month "${period}" — expected YYYY-MM-01.`);
  }
}

/** First day of the month before a YYYY-MM-01 period key. */
function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(Date.UTC(y, (m ?? 1) - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Postgres date columns come back as YYYY-MM-DD; compare on the month. */
function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

function formatMetricValue(value: number, unit: string): string {
  if (unit === "cents") return formatCents(Math.round(value));
  if (unit === "%") return `${value}%`;
  if (unit === "minutes") return `${value} min`;
  if (unit === "hours") return `${value} hrs`;
  if (unit === "count" || unit === "") return String(value);
  return `${value} ${unit}`;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export async function upsertMetric(input: {
  clientId: string;
  projectId?: string | null;
  periodMonth: string; // YYYY-MM-01
  key: string;
  label?: string;
  value: number;
  unit?: string;
  goal?: number | null;
  baseline?: number | null;
  source: MetricSource;
  createdBy?: string | null;
}): Promise<Metric> {
  assertPeriod(input.periodMonth);
  if (!Number.isFinite(input.value)) {
    throw new Error(`Metric "${input.key}" requires a finite numeric value.`);
  }
  const sb = requireSupabase();
  const catalog = catalogEntry(input.key);

  const { data, error } = await sb
    .from("metrics")
    .upsert(
      {
        client_id: input.clientId,
        project_id: input.projectId ?? null,
        period_month: input.periodMonth,
        key: input.key,
        label: input.label ?? catalog?.label ?? input.key,
        value: input.value,
        unit: input.unit ?? catalog?.unit ?? "",
        goal: input.goal ?? null,
        baseline: input.baseline ?? null,
        source: input.source,
        created_by: input.createdBy ?? null,
        updated_at: nowIso(),
      },
      { onConflict: "client_id,key,period_month" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert metric "${input.key}" for client ${input.clientId}: ${error.message}`);
  }
  return data as Metric;
}

export async function listMetrics(
  clientId: string,
  opts: { periodMonth?: string; keys?: string[]; limit?: number } = {},
): Promise<Metric[]> {
  const sb = requireSupabase();
  let query = sb
    .from("metrics")
    .select("*")
    .eq("client_id", clientId)
    .order("period_month", { ascending: false })
    .order("key", { ascending: true });

  if (opts.periodMonth) {
    assertPeriod(opts.periodMonth);
    query = query.eq("period_month", opts.periodMonth);
  }
  if (opts.keys && opts.keys.length > 0) query = query.in("key", opts.keys);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list metrics for client ${clientId}: ${error.message}`);
  }
  return (data ?? []) as Metric[];
}

/**
 * Metrics for the period joined with the previous month's value. Only rows
 * that actually exist for the period appear — nothing is fabricated, and each
 * metric keeps its recorded source (measured / estimated / manual).
 */
export async function buildScorecard(
  clientId: string,
  periodMonth: string,
): Promise<ScorecardEntry[]> {
  assertPeriod(periodMonth);
  const sb = requireSupabase();
  const prior = previousPeriod(periodMonth);

  const { data, error } = await sb
    .from("metrics")
    .select("*")
    .eq("client_id", clientId)
    .in("period_month", [periodMonth, prior]);

  if (error) {
    throw new Error(`Failed to load metrics for client ${clientId} (${periodMonth}): ${error.message}`);
  }

  const rows = (data ?? []) as Metric[];
  const current = rows.filter((r) => sameMonth(r.period_month, periodMonth));
  const previousByKey = new Map<string, number>();
  for (const row of rows) {
    if (sameMonth(row.period_month, prior)) previousByKey.set(row.key, row.value);
  }

  const catalogIndex = (key: string): number => {
    const idx = METRIC_CATALOG.findIndex((entry) => entry.key === key);
    return idx === -1 ? METRIC_CATALOG.length : idx;
  };

  return current
    .sort((a, b) => catalogIndex(a.key) - catalogIndex(b.key) || a.key.localeCompare(b.key))
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      unit: row.unit,
      previous: previousByKey.get(row.key) ?? null,
      goal: row.goal,
      baseline: row.baseline,
      source: row.source,
    }));
}

export function monthDelta(
  current: number,
  previous: number | null,
): { delta: number | null; pct: number | null } {
  if (previous == null) return { delta: null, pct: null };
  const delta = current - previous;
  const pct =
    previous === 0 ? null : Math.round((delta / Math.abs(previous)) * 1000) / 10;
  return { delta, pct };
}

// ---------------------------------------------------------------------------
// Goal progress (computed from clients.success_goals + the scorecard)
// ---------------------------------------------------------------------------

type SuccessGoal = { goal: string; metric_key?: string; target?: number };
type GoalProgressEntry = MonthlyReport["goal_progress"][number];

function parseSuccessGoals(raw: unknown): SuccessGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is SuccessGoal =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { goal?: unknown }).goal === "string" &&
      (item as { goal: string }).goal.trim().length > 0,
  );
}

function computeGoalProgress(
  goals: SuccessGoal[],
  scorecard: ScorecardEntry[],
): GoalProgressEntry[] {
  return goals.map((goal) => {
    const entry = goal.metric_key
      ? scorecard.find((e) => e.key === goal.metric_key)
      : undefined;

    if (!goal.metric_key) {
      return {
        goal: goal.goal,
        progress: "No linked metric — reviewed qualitatively.",
        on_track: false,
      };
    }

    if (!entry) {
      return {
        goal: goal.goal,
        progress: `No "${goal.metric_key}" measurement recorded for this period yet.`,
        on_track: false,
      };
    }

    const direction = catalogEntry(entry.key)?.direction ?? "up";
    const valueText = formatMetricValue(entry.value, entry.unit);
    const target = goal.target ?? entry.goal;

    if (target != null) {
      const onTrack =
        direction === "down" ? entry.value <= target : entry.value >= target;
      return {
        goal: goal.goal,
        progress: `${valueText} vs target ${formatMetricValue(target, entry.unit)} (${entry.source}).`,
        on_track: onTrack,
      };
    }

    if (entry.previous != null) {
      const improving =
        direction === "down"
          ? entry.value <= entry.previous
          : entry.value >= entry.previous;
      return {
        goal: goal.goal,
        progress: `${valueText} this period, ${formatMetricValue(entry.previous, entry.unit)} last period (${entry.source}); no target set.`,
        on_track: improving,
      };
    }

    return {
      goal: goal.goal,
      progress: `${valueText} recorded (${entry.source}); no target set.`,
      on_track: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Create the draft report for a client + period, or refresh the existing one.
 * The scorecard and goal progress are computed from real metric rows; all
 * narrative fields (executive summary, wins, risks, recommendations, next
 * priorities) start empty for the admin to write.
 */
export async function createDraftReport(input: {
  clientId: string;
  projectId?: string | null;
  periodMonth: string;
  title?: string;
  createdBy?: string | null;
}): Promise<MonthlyReport> {
  assertPeriod(input.periodMonth);
  const sb = requireSupabase();

  const scorecard = await buildScorecard(input.clientId, input.periodMonth);

  const { data: client, error: clientError } = await sb
    .from("clients")
    .select("success_goals")
    .eq("id", input.clientId)
    .maybeSingle();
  if (clientError) {
    throw new Error(`Failed to load client ${input.clientId} for report: ${clientError.message}`);
  }
  if (!client) throw new Error(`Client ${input.clientId} not found.`);

  const goalProgress = computeGoalProgress(
    parseSuccessGoals((client as { success_goals: unknown }).success_goals),
    scorecard,
  );

  const { data: existingData, error: existingError } = await sb
    .from("reports")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("period_month", input.periodMonth)
    .maybeSingle();
  if (existingError) {
    throw new Error(`Failed to check for an existing report (${input.clientId}, ${input.periodMonth}): ${existingError.message}`);
  }

  if (existingData) {
    const existing = existingData as MonthlyReport;
    // Published reports are a delivered record — never rewrite them here.
    if (existing.status === "published") return existing;

    const { data: refreshed, error: refreshError } = await sb
      .from("reports")
      .update({
        scorecard,
        goal_progress: goalProgress,
        updated_at: nowIso(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (refreshError) {
      throw new Error(`Failed to refresh draft report ${existing.id}: ${refreshError.message}`);
    }
    return refreshed as MonthlyReport;
  }

  const { data: created, error: insertError } = await sb
    .from("reports")
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      token: newToken(),
      period_month: input.periodMonth,
      title: input.title ?? `Monthly Performance Report — ${periodLabel(input.periodMonth)}`,
      status: "draft" satisfies ReportStatus,
      executive_summary: "",
      key_wins: [],
      scorecard,
      goal_progress: goalProgress,
      risks: [],
      recommendations: [],
      next_priorities: [],
      expansion_notes: "",
      created_by: input.createdBy ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (insertError) {
    // Concurrent creation of the same (client, period) report: return the winner.
    if (insertError.code === "23505") {
      const { data: winner, error: winnerError } = await sb
        .from("reports")
        .select("*")
        .eq("client_id", input.clientId)
        .eq("period_month", input.periodMonth)
        .single();
      if (winnerError) {
        throw new Error(`Report exists but could not be reloaded (${input.clientId}, ${input.periodMonth}): ${winnerError.message}`);
      }
      return winner as MonthlyReport;
    }
    throw new Error(`Failed to create draft report (${input.clientId}, ${input.periodMonth}): ${insertError.message}`);
  }
  return created as MonthlyReport;
}

export async function updateReport(
  id: string,
  patch: {
    title?: string;
    executiveSummary?: string;
    keyWins?: string[];
    scorecard?: ScorecardEntry[];
    goalProgress?: GoalProgressEntry[];
    risks?: string[];
    recommendations?: string[];
    nextPriorities?: string[];
    expansionNotes?: string;
  },
): Promise<MonthlyReport> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.executiveSummary !== undefined) row.executive_summary = patch.executiveSummary;
  if (patch.keyWins !== undefined) row.key_wins = patch.keyWins;
  if (patch.scorecard !== undefined) row.scorecard = patch.scorecard;
  if (patch.goalProgress !== undefined) row.goal_progress = patch.goalProgress;
  if (patch.risks !== undefined) row.risks = patch.risks;
  if (patch.recommendations !== undefined) row.recommendations = patch.recommendations;
  if (patch.nextPriorities !== undefined) row.next_priorities = patch.nextPriorities;
  if (patch.expansionNotes !== undefined) row.expansion_notes = patch.expansionNotes;

  const { data, error } = await sb
    .from("reports")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update report ${id}: ${error.message}`);
  return data as MonthlyReport;
}

export async function publishReport(id: string): Promise<MonthlyReport> {
  const sb = requireSupabase();
  const report = await getReport(id);
  if (!report) throw new Error(`Report ${id} not found.`);
  if (!report.executive_summary.trim()) {
    throw new Error("A report needs an executive summary before it can be published.");
  }
  if (report.status === "published") return report;

  const { data, error } = await sb
    .from("reports")
    .update({
      status: "published" satisfies ReportStatus,
      published_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to publish report ${id}: ${error.message}`);
  return data as MonthlyReport;
}

export async function getReport(id: string): Promise<MonthlyReport | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load report ${id}: ${error.message}`);
  return (data as MonthlyReport | null) ?? null;
}

/** Token access is client-facing: only published reports resolve. */
export async function getReportByToken(token: string): Promise<MonthlyReport | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("token", token)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    // Public token lookup: a query failure (e.g. migration not applied yet)
    // reads as not-found rather than crashing the caller.
    console.warn(`getReportByToken failed: ${error.message}`);
    return null;
  }
  return (data as MonthlyReport | null) ?? null;
}

export async function listReports(
  clientId?: string,
  opts: { status?: ReportStatus; limit?: number } = {},
): Promise<MonthlyReport[]> {
  const sb = requireSupabase();
  let query = sb
    .from("reports")
    .select("*")
    .order("period_month", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list reports${clientId ? ` for client ${clientId}` : ""}: ${error.message}`);
  }
  return (data ?? []) as MonthlyReport[];
}

export async function latestPublishedReport(
  clientId: string,
): Promise<MonthlyReport | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "published")
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load latest published report for client ${clientId}: ${error.message}`);
  }
  return (data as MonthlyReport | null) ?? null;
}
