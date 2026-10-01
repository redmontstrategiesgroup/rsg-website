import type { BriefPatch, BriefStatus, CallBrief, CallBriefRecord, FailedStage } from "./types.ts";

export type BriefRow = {
  id: string;
  lead_id: string;
  recording_ids: string[] | null;
  status: BriefStatus;
  failed_stage: FailedStage | null;
  error: string | null;
  extraction: unknown;
  truncated: boolean | null;
  template_key: string | null;
  term_length: string | null;
  proposal_id: string | null;
  warnings: unknown;
  model: string | null;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  prompt_version: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function briefFromRow(r: BriefRow): CallBriefRecord {
  return {
    id: r.id,
    leadId: r.lead_id,
    recordingIds: Array.isArray(r.recording_ids) ? r.recording_ids : [],
    status: r.status,
    failedStage: r.failed_stage,
    error: r.error ?? "",
    extraction: r.extraction && typeof r.extraction === "object" ? (r.extraction as CallBrief) : null,
    truncated: Boolean(r.truncated),
    templateKey: r.template_key,
    termLength: r.term_length ?? "",
    proposalId: r.proposal_id,
    warnings: Array.isArray(r.warnings) ? (r.warnings as CallBriefRecord["warnings"]) : [],
    model: r.model ?? "",
    inputTokens: Number(r.input_tokens) || 0,
    outputTokens: Number(r.output_tokens) || 0,
    promptVersion: r.prompt_version,
    createdBy: r.created_by ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS: Record<keyof BriefPatch, string> = {
  status: "status",
  failedStage: "failed_stage",
  error: "error",
  extraction: "extraction",
  recordingIds: "recording_ids",
  truncated: "truncated",
  templateKey: "template_key",
  termLength: "term_length",
  proposalId: "proposal_id",
  warnings: "warnings",
  model: "model",
  inputTokens: "input_tokens",
  outputTokens: "output_tokens",
};

export function patchToRow(p: BriefPatch, now = new Date().toISOString()): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: now };
  for (const [key, value] of Object.entries(p)) {
    if (value !== undefined) row[COLUMNS[key as keyof BriefPatch]] = value;
  }
  return row;
}
