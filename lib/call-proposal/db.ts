import { getSupabase } from "../supabase.ts";
import { briefFromRow, patchToRow, type BriefRow } from "./row.ts";
import {
  RunInProgressError,
  type BriefPatch,
  type CallBriefRecord,
  type CallInput,
  type CallSummary,
  type ProposalSection,
} from "./types.ts";

/** Supabase access for Call → Proposal. Throws on DB errors; callers decide policy. */

function db() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

const UNIQUE_VIOLATION = "23505";

function readyCallsQuery(leadId: string, columns: string) {
  return db()
    .from("pocket_recordings")
    .select(columns)
    .eq("lead_id", leadId)
    .eq("status", "ready")
    .is("dismissed_at", null)
    .order("recorded_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(20);
}

type RecordingRow = {
  id: string;
  title: string | null;
  recorded_at: string | null;
  transcript?: string | null;
  transcript_segments?: unknown;
};

export async function loadCalls(leadId: string): Promise<CallInput[]> {
  const { data, error } = await readyCallsQuery(
    leadId,
    "id, title, recorded_at, transcript, transcript_segments",
  );
  if (error) throw new Error(`call-proposal.loadCalls: ${error.message}`);
  return ((data ?? []) as unknown as RecordingRow[]).map((r) => ({
    recordingId: r.id,
    title: r.title ?? "",
    recordedAt: r.recorded_at,
    transcript: r.transcript ?? "",
    segments: Array.isArray(r.transcript_segments)
      ? (r.transcript_segments as { speaker?: unknown; text?: unknown }[])
          .filter((s) => s && typeof s.text === "string")
          .map((s) => ({ speaker: typeof s.speaker === "string" ? s.speaker : "", text: s.text as string }))
      : [],
  }));
}

export async function listCallSummaries(leadId: string): Promise<CallSummary[]> {
  const { data, error } = await readyCallsQuery(leadId, "id, title, recorded_at");
  if (error) throw new Error(`call-proposal.listCallSummaries: ${error.message}`);
  return ((data ?? []) as unknown as RecordingRow[]).map((r) => ({
    id: r.id,
    title: r.title ?? "",
    recordedAt: r.recorded_at,
  }));
}

export async function insertBrief(row: {
  leadId: string;
  createdBy: string;
  promptVersion: string;
}): Promise<string> {
  const { data, error } = await db()
    .from("call_briefs")
    .insert({
      lead_id: row.leadId,
      created_by: row.createdBy,
      prompt_version: row.promptVersion,
      status: "extracting",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new RunInProgressError();
    throw new Error(`call-proposal.insertBrief: ${error.message}`);
  }
  return (data as { id: string }).id;
}

export async function updateBrief(id: string, patch: BriefPatch): Promise<void> {
  const { error } = await db().from("call_briefs").update(patchToRow(patch)).eq("id", id);
  if (error) throw new Error(`call-proposal.updateBrief: ${error.message}`);
}

export async function getBrief(id: string): Promise<CallBriefRecord | null> {
  const { data, error } = await db().from("call_briefs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`call-proposal.getBrief: ${error.message}`);
  return data ? briefFromRow(data as BriefRow) : null;
}

export async function listBriefs(leadId: string, limit = 20): Promise<CallBriefRecord[]> {
  const { data, error } = await db()
    .from("call_briefs")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`call-proposal.listBriefs: ${error.message}`);
  return ((data ?? []) as BriefRow[]).map(briefFromRow);
}

/**
 * Runs stuck past the window are dead (function killed). A stuck `drafting`
 * run already has its extraction, so it becomes a retryable draft failure.
 */
export async function failStaleRuns(leadId: string, olderThanMs: number): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  for (const [status, stage] of [
    ["extracting", "extract"],
    ["drafting", "draft"],
  ] as const) {
    const { error } = await db()
      .from("call_briefs")
      .update(patchToRow({ status: "failed", failedStage: stage, error: "Run timed out. Try again." }))
      .eq("lead_id", leadId)
      .eq("status", status)
      .lt("updated_at", cutoff);
    if (error) throw new Error(`call-proposal.failStaleRuns: ${error.message}`);
  }
}

export async function claimRetry(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("call_briefs")
    .update(patchToRow({ status: "drafting", failedStage: null, error: "" }))
    .eq("id", id)
    .eq("status", "failed")
    .eq("failed_stage", "draft")
    .select("id");
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new RunInProgressError();
    throw new Error(`call-proposal.claimRetry: ${error.message}`);
  }
  return (data ?? []).length > 0;
}

export async function linkProposalToBrief(proposalId: string, briefId: string): Promise<void> {
  const { error } = await db()
    .from("lifecycle_proposals")
    .update({ call_brief_id: briefId })
    .eq("id", proposalId);
  if (error) throw new Error(`call-proposal.linkProposalToBrief: ${error.message}`);
}

/** Sections of a proposal that is still a draft; null if missing or past draft. */
export async function loadDraftProposalSections(proposalId: string): Promise<ProposalSection[] | null> {
  const { data, error } = await db()
    .from("lifecycle_proposals")
    .select("status, sections")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw new Error(`call-proposal.loadDraftProposalSections: ${error.message}`);
  const row = data as { status?: string; sections?: unknown } | null;
  if (!row || row.status !== "draft" || !Array.isArray(row.sections)) return null;
  return row.sections as ProposalSection[];
}
