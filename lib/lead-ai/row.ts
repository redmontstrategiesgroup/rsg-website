import { RED_FLAGS, type LeadInsight, type RedFlag } from "./types.ts";

/** lead_ai_insights as PostgREST returns it. */
export type InsightRow = {
  id: string;
  lead_id: string;
  created_at: string;
  model: string;
  prompt_version: string;
  status: string;
  error: string | null;
  ai_fit_score: number | null;
  adjustment: number | null;
  rationale: string | null;
  signals: unknown;
  red_flags: unknown;
  draft_subject: string | null;
  draft_body: string | null;
  sent_at: string | null;
  sent_by: string | null;
  sent_subject: string | null;
  sent_body: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function insightFromRow(row: InsightRow): LeadInsight {
  const sig =
    row.signals && typeof row.signals === "object" && !Array.isArray(row.signals)
      ? (row.signals as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    leadId: row.lead_id,
    createdAt: row.created_at,
    model: row.model,
    promptVersion: row.prompt_version,
    status: row.status === "ok" ? "ok" : "failed",
    error: row.error,
    aiFitScore: row.ai_fit_score,
    adjustment: row.adjustment,
    rationale: row.rationale,
    signals: sig ? { positive: strings(sig.positive), negative: strings(sig.negative) } : null,
    redFlags: strings(row.red_flags).filter((f): f is RedFlag =>
      (RED_FLAGS as readonly string[]).includes(f),
    ),
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
    sentAt: row.sent_at,
    sentBy: row.sent_by,
    sentSubject: row.sent_subject,
    sentBody: row.sent_body,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
  };
}

/** Input must be newest first. `lastSent` survives a later regenerate. */
export function summarizeInsights(newestFirst: LeadInsight[]): {
  latest: LeadInsight | null;
  lastSent: LeadInsight | null;
} {
  return {
    latest: newestFirst[0] ?? null,
    lastSent: newestFirst.find((i) => i.sentAt) ?? null,
  };
}
