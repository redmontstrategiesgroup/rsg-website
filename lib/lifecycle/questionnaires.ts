import { newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type { Questionnaire, QuestionnaireStatus } from "@/lib/lifecycle/types";
import { buildPrepBrief } from "@/lib/lifecycle/questionnaire-content";

/**
 * Post-booking preparation questionnaires — data access.
 * Templates and prep-brief generation live in questionnaire-content.ts.
 */

export async function createQuestionnaire(input: {
  bookingId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  templateKey: string;
  dueAt?: string | null;
}): Promise<Questionnaire> {
  const sb = requireSupabase();

  // One active questionnaire per booking — re-sending a link must not fork
  // the client's saved answers.
  if (input.bookingId) {
    const { data: existing } = await sb
      .from("questionnaires")
      .select("*")
      .eq("booking_id", input.bookingId)
      .in("status", ["pending", "in_progress"])
      .limit(1)
      .maybeSingle();
    if (existing) return existing as Questionnaire;
  }

  const { data, error } = await sb
    .from("questionnaires")
    .insert({
      booking_id: input.bookingId ?? null,
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      token: newToken(),
      template_key: input.templateKey,
      status: "pending" satisfies QuestionnaireStatus,
      due_at: input.dueAt ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create questionnaire: ${error?.message ?? "no row returned"}`);
  }
  return data as Questionnaire;
}

export async function getQuestionnaire(id: string): Promise<Questionnaire | null> {
  const sb = requireSupabase();
  const { data } = await sb.from("questionnaires").select("*").eq("id", id).maybeSingle();
  return (data as Questionnaire | null) ?? null;
}

export async function getQuestionnaireByToken(token: string): Promise<Questionnaire | null> {
  if (!token || token.length < 16) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("questionnaires")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as Questionnaire | null) ?? null;
}

export async function listQuestionnaires(filters: {
  status?: QuestionnaireStatus;
  limit?: number;
} = {}): Promise<Questionnaire[]> {
  const sb = requireSupabase();
  let query = sb
    .from("questionnaires")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list questionnaires: ${error.message}`);
  return (data ?? []) as Questionnaire[];
}

export async function getQuestionnaireAnswers(
  questionnaireId: string,
): Promise<Record<string, unknown>> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("questionnaire_responses")
    .select("question_key, answer")
    .eq("questionnaire_id", questionnaireId);
  if (error) throw new Error(`Failed to load questionnaire answers: ${error.message}`);
  const answers: Record<string, unknown> = {};
  for (const row of (data ?? []) as { question_key: string; answer: unknown }[]) {
    answers[row.question_key] = row.answer;
  }
  return answers;
}

export async function saveQuestionnaireAnswers(
  questionnaireId: string,
  entries: { questionKey: string; answer: unknown }[],
): Promise<void> {
  if (entries.length === 0) return;
  const sb = requireSupabase();
  const now = nowIso();
  const rows = entries.map((e) => ({
    questionnaire_id: questionnaireId,
    question_key: e.questionKey,
    answer: e.answer ?? null,
    updated_at: now,
  }));
  const { error } = await sb
    .from("questionnaire_responses")
    .upsert(rows, { onConflict: "questionnaire_id,question_key" });
  if (error) throw new Error(`Failed to save questionnaire answers: ${error.message}`);

  const { error: updateError } = await sb
    .from("questionnaires")
    .update({ status: "in_progress" satisfies QuestionnaireStatus, updated_at: now })
    .eq("id", questionnaireId)
    .in("status", ["pending", "in_progress"]);
  if (updateError) {
    throw new Error(`Failed to update questionnaire progress: ${updateError.message}`);
  }
}

/** Finalize: build the internal prep brief from answers and mark submitted. */
export async function submitQuestionnaire(questionnaireId: string): Promise<Questionnaire> {
  const sb = requireSupabase();
  const questionnaire = await getQuestionnaire(questionnaireId);
  if (!questionnaire) throw new Error(`Questionnaire ${questionnaireId} not found`);

  const answers = await getQuestionnaireAnswers(questionnaireId);
  const brief = buildPrepBrief(answers, questionnaire.template_key);

  const { data, error } = await sb
    .from("questionnaires")
    .update({
      status: "submitted" satisfies QuestionnaireStatus,
      submitted_at: nowIso(),
      brief,
      updated_at: nowIso(),
    })
    .eq("id", questionnaireId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to submit questionnaire: ${error?.message ?? "no row returned"}`);
  }
  return data as Questionnaire;
}

export async function waiveQuestionnaire(id: string): Promise<Questionnaire> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("questionnaires")
    .update({ status: "waived" satisfies QuestionnaireStatus, updated_at: nowIso() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to waive questionnaire: ${error?.message ?? "no row returned"}`);
  }
  return data as Questionnaire;
}

const MAX_INVITED = 5;

export async function addInvitedEmail(
  questionnaireId: string,
  email: string,
): Promise<Questionnaire> {
  const sb = requireSupabase();
  const normalized = email.trim().toLowerCase();
  const questionnaire = await getQuestionnaire(questionnaireId);
  if (!questionnaire) throw new Error(`Questionnaire ${questionnaireId} not found`);

  const invited = Array.isArray(questionnaire.invited_emails)
    ? questionnaire.invited_emails
    : [];
  if (invited.includes(normalized)) return questionnaire;
  if (invited.length >= MAX_INVITED) {
    throw new Error("Invite limit reached for this questionnaire.");
  }

  const { data, error } = await sb
    .from("questionnaires")
    .update({ invited_emails: [...invited, normalized], updated_at: nowIso() })
    .eq("id", questionnaireId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to record invite: ${error?.message ?? "no row returned"}`);
  }
  return data as Questionnaire;
}

/**
 * Reminder sweep source: pending/in_progress questionnaires whose last nudge
 * (or creation) is older than the window, still before their due date.
 */
export async function findQuestionnairesNeedingReminder(opts: {
  olderThanMinutes: number;
  maxReminders: number;
}): Promise<Questionnaire[]> {
  const sb = requireSupabase();
  const cutoff = new Date(Date.now() - opts.olderThanMinutes * 60_000).toISOString();
  const { data, error } = await sb
    .from("questionnaires")
    .select("*")
    .in("status", ["pending", "in_progress"])
    .lt("reminder_count", opts.maxReminders)
    .lt("created_at", cutoff)
    .limit(50);
  if (error) throw new Error(`Failed to find questionnaires for reminder: ${error.message}`);

  const now = Date.now();
  return ((data ?? []) as Questionnaire[]).filter((q) => {
    if (q.last_reminded_at && new Date(q.last_reminded_at).toISOString() >= cutoff) {
      return false;
    }
    // Never nudge after the consultation has already happened.
    if (q.due_at && new Date(q.due_at).getTime() < now) return false;
    return true;
  });
}

export async function markQuestionnaireReminded(id: string): Promise<void> {
  const sb = requireSupabase();
  const questionnaire = await getQuestionnaire(id);
  if (!questionnaire) return;
  const { error } = await sb
    .from("questionnaires")
    .update({
      reminder_count: questionnaire.reminder_count + 1,
      last_reminded_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to mark questionnaire reminded: ${error.message}`);
}
