import { newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type { Assessment, AssessmentStatus } from "@/lib/lifecycle/types";
import {
  buildAssessmentSummary,
  computeAssessmentScore,
  recommendServiceCategory,
} from "@/lib/lifecycle/assessment-content";

/**
 * Business Systems Assessment — data access.
 * Content, scoring, and summary generation live in assessment-content.ts.
 */

const DEFAULT_EXPIRES_DAYS = 30;

export async function createAssessment(input: {
  leadId?: string | null;
  clientId?: string | null;
  email: string;
  expiresInDays?: number;
}): Promise<Assessment> {
  const sb = requireSupabase();
  const days = input.expiresInDays ?? DEFAULT_EXPIRES_DAYS;
  const { data, error } = await sb
    .from("assessments")
    .insert({
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      email: input.email.trim().toLowerCase(),
      token: newToken(),
      status: "draft",
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create assessment: ${error?.message ?? "no row returned"}`);
  }
  return data as Assessment;
}

export async function getAssessment(id: string): Promise<Assessment | null> {
  const sb = requireSupabase();
  const { data } = await sb.from("assessments").select("*").eq("id", id).maybeSingle();
  return (data as Assessment | null) ?? null;
}

/**
 * Token lookup for the public /assessment/[token] flow. Lazily expires
 * abandoned drafts so an old link cannot be resumed.
 */
export async function getAssessmentByToken(token: string): Promise<Assessment | null> {
  if (!token || token.length < 16) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("assessments")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const assessment = data as Assessment;

  const expired =
    assessment.expires_at &&
    new Date(assessment.expires_at).getTime() < Date.now() &&
    (assessment.status === "draft" || assessment.status === "in_progress");
  if (expired) {
    const { data: updated } = await sb
      .from("assessments")
      .update({ status: "expired" satisfies AssessmentStatus, updated_at: nowIso() })
      .eq("id", assessment.id)
      .select("*")
      .single();
    return (updated as Assessment | null) ?? { ...assessment, status: "expired" };
  }
  return assessment;
}

export async function listAssessments(filters: {
  status?: AssessmentStatus;
  leadId?: string;
  limit?: number;
} = {}): Promise<Assessment[]> {
  const sb = requireSupabase();
  let query = sb
    .from("assessments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list assessments: ${error.message}`);
  return (data ?? []) as Assessment[];
}

/** question_key → answer map for scoring/summary/rendering. */
export async function getAssessmentAnswers(
  assessmentId: string,
): Promise<Record<string, unknown>> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("assessment_responses")
    .select("question_key, answer")
    .eq("assessment_id", assessmentId);
  if (error) throw new Error(`Failed to load assessment answers: ${error.message}`);
  const answers: Record<string, unknown> = {};
  for (const row of (data ?? []) as { question_key: string; answer: unknown }[]) {
    answers[row.question_key] = row.answer;
  }
  return answers;
}

/**
 * Upsert a batch of answers (auto-save). Bumps the assessment into
 * in_progress on first save and tracks the section the visitor is on.
 */
export async function saveAssessmentAnswers(
  assessmentId: string,
  entries: {
    sectionKey: string;
    questionKey: string;
    answer: unknown;
    answeredBy?: string;
  }[],
  opts: { currentSection?: string } = {},
): Promise<void> {
  if (entries.length === 0 && !opts.currentSection) return;
  const sb = requireSupabase();
  const now = nowIso();

  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      assessment_id: assessmentId,
      section_key: e.sectionKey,
      question_key: e.questionKey,
      answer: e.answer ?? null,
      answered_by: e.answeredBy ?? null,
      updated_at: now,
    }));
    const { error } = await sb
      .from("assessment_responses")
      .upsert(rows, { onConflict: "assessment_id,question_key" });
    if (error) throw new Error(`Failed to save assessment answers: ${error.message}`);
  }

  const patch: Record<string, unknown> = { updated_at: now };
  if (opts.currentSection) patch.current_section = opts.currentSection;

  // Only drafts transition; submitted/reviewed assessments stay put.
  const { data: current } = await sb
    .from("assessments")
    .select("status, started_at")
    .eq("id", assessmentId)
    .maybeSingle();
  if (current?.status === "draft") {
    patch.status = "in_progress" satisfies AssessmentStatus;
    if (!current.started_at) patch.started_at = now;
  }
  const { error: updateError } = await sb
    .from("assessments")
    .update(patch)
    .eq("id", assessmentId);
  if (updateError) {
    throw new Error(`Failed to update assessment progress: ${updateError.message}`);
  }
}

/**
 * Finalize: compute score + recommendation + summary from the saved answers
 * and mark the assessment submitted. Idempotent — resubmitting recomputes.
 */
export async function submitAssessment(assessmentId: string): Promise<Assessment> {
  const sb = requireSupabase();
  const answers = await getAssessmentAnswers(assessmentId);
  const { score, sectionScores } = computeAssessmentScore(answers);
  const category = recommendServiceCategory(answers);
  const summary = buildAssessmentSummary(answers, score, sectionScores);

  const { data, error } = await sb
    .from("assessments")
    .update({
      status: "submitted" satisfies AssessmentStatus,
      score,
      recommended_service_category: category,
      summary,
      submitted_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", assessmentId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to submit assessment: ${error?.message ?? "no row returned"}`);
  }
  return data as Assessment;
}

export async function markAssessmentReviewed(
  id: string,
  reviewedBy: string,
): Promise<Assessment> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("assessments")
    .update({
      status: "reviewed" satisfies AssessmentStatus,
      reviewed_at: nowIso(),
      reviewed_by: reviewedBy,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to mark assessment reviewed: ${error?.message ?? "no row"}`);
  }
  return data as Assessment;
}

const MAX_INVITED = 5;

/** Track a teammate invited to contribute (email delivery is the caller's job). */
export async function addInvitedEmail(
  assessmentId: string,
  email: string,
): Promise<Assessment> {
  const sb = requireSupabase();
  const normalized = email.trim().toLowerCase();
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  const invited = Array.isArray(assessment.invited_emails)
    ? assessment.invited_emails
    : [];
  if (invited.includes(normalized)) return assessment;
  if (invited.length >= MAX_INVITED) {
    throw new Error("Invite limit reached for this assessment.");
  }

  const { data, error } = await sb
    .from("assessments")
    .update({ invited_emails: [...invited, normalized], updated_at: nowIso() })
    .eq("id", assessmentId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to record invite: ${error?.message ?? "no row returned"}`);
  }
  return data as Assessment;
}
