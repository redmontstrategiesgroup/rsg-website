import { getSupabase } from "../supabase.ts";
import type { LeadAiUpdate } from "./analyze.ts";
import { insightFromRow, type InsightRow } from "./row.ts";
import type { LeadInsight, NewInsight } from "./types.ts";

/** Supabase access for lead AI. Throws on DB errors; callers decide policy. */

function db() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

export async function insertInsight(i: NewInsight): Promise<string> {
  const { data, error } = await db()
    .from("lead_ai_insights")
    .insert({
      lead_id: i.leadId,
      model: i.model,
      prompt_version: i.promptVersion,
      status: i.status,
      error: i.error,
      ai_fit_score: i.aiFitScore,
      adjustment: i.adjustment,
      rationale: i.rationale,
      signals: i.signals,
      red_flags: i.redFlags,
      draft_subject: i.draftSubject,
      draft_body: i.draftBody,
      input_tokens: i.inputTokens,
      output_tokens: i.outputTokens,
    })
    .select("id")
    .single();
  if (error) fail(error);
  return (data as { id: string }).id;
}

export async function updateLeadAi(u: LeadAiUpdate): Promise<void> {
  const patch: Record<string, unknown> = {
    ai_score: u.aiScore,
    ai_insight_id: u.insightId,
    updated_at: new Date().toISOString(),
  };
  if (typeof u.leadScore === "number") patch.lead_score = u.leadScore;
  const { error } = await db().from("leads").update(patch).eq("id", u.leadId);
  if (error) fail(error);
}

export async function getInsight(id: string): Promise<LeadInsight | null> {
  const { data, error } = await db()
    .from("lead_ai_insights")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  return data ? insightFromRow(data as InsightRow) : null;
}

export async function getInsightSummary(leadId: string): Promise<{
  latest: LeadInsight | null;
  lastSent: LeadInsight | null;
}> {
  const sb = db();
  const [latestRes, sentRes] = await Promise.all([
    sb
      .from("lead_ai_insights")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
    sb
      .from("lead_ai_insights")
      .select("*")
      .eq("lead_id", leadId)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);
  if (latestRes.error) fail(latestRes.error);
  if (sentRes.error) fail(sentRes.error);
  const first = (rows: unknown): LeadInsight | null => {
    const row = Array.isArray(rows) ? (rows[0] as InsightRow | undefined) : undefined;
    return row ? insightFromRow(row) : null;
  };
  return { latest: first(latestRes.data), lastSent: first(sentRes.data) };
}

/** Atomic send claim: true only for the first caller while sent_at is null. */
export async function claimSend(insightId: string, adminId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("lead_ai_insights")
    .update({ sent_at: new Date().toISOString(), sent_by: adminId })
    .eq("id", insightId)
    .is("sent_at", null)
    .select("id");
  if (error) fail(error);
  return Array.isArray(data) && data.length > 0;
}

export async function releaseSend(insightId: string): Promise<void> {
  const { error } = await db()
    .from("lead_ai_insights")
    .update({ sent_at: null, sent_by: null })
    .eq("id", insightId)
    .is("sent_body", null);
  if (error) fail(error);
}

export async function completeSend(
  insightId: string,
  subject: string,
  body: string,
): Promise<void> {
  const { error } = await db()
    .from("lead_ai_insights")
    .update({ sent_subject: subject, sent_body: body })
    .eq("id", insightId);
  if (error) fail(error);
}
