import type { Lead } from "../types.ts";
import { clamp, MAX_ADJUSTMENT } from "./blend.ts";
import { composeDraft } from "./compose.ts";
import { buildLeadMessage, buildSystemPrompt, PROMPT_VERSION } from "./prompt.ts";
import { parseLeadAiOutput } from "./schema.ts";
import { NO_DRAFT_FLAGS, type NewInsight } from "./types.ts";

/**
 * Claude lead analysis: one model call → one lead_ai_insights row.
 * Every I/O dependency is injected (production wiring lives in index.ts), and
 * the function never rejects: intake schedules it in the background and a
 * failure must only ever produce a `failed` row.
 */

export type GenerateResult = {
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type LeadAiUpdate = {
  leadId: string;
  aiScore: number;
  insightId: string;
  /** Blended score to write to leads.lead_score (Phase 3). */
  leadScore?: number;
};

export type AnalyzeDeps = {
  loadLead: (id: string) => Promise<Lead | null>;
  generate: (req: { system: string; message: string }) => Promise<GenerateResult>;
  insertInsight: (row: NewInsight) => Promise<string>;
  updateLeadAi: (update: LeadAiUpdate) => Promise<void>;
  model: string;
  bookingUrl: string;
  signature: string;
};

export type AnalyzeResult =
  | { ok: true; insightId: string }
  | {
      ok: false;
      reason: "not_found" | "skipped" | "failed";
      insightId?: string;
      error?: string;
    };

const SKIP_STATUSES = new Set(["spam", "archived"]);

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500) || "Unknown error";
}

type FailureBase = Pick<NewInsight, "leadId" | "model" | "promptVersion">;

async function recordFailure(
  deps: AnalyzeDeps,
  base: FailureBase,
  error: string,
  gen: GenerateResult | null,
): Promise<AnalyzeResult> {
  try {
    const insightId = await deps.insertInsight({
      ...base,
      status: "failed",
      error,
      aiFitScore: null,
      adjustment: null,
      rationale: null,
      signals: null,
      redFlags: [],
      draftSubject: null,
      draftBody: null,
      inputTokens: gen?.inputTokens ?? null,
      outputTokens: gen?.outputTokens ?? null,
    });
    return { ok: false, reason: "failed", insightId, error };
  } catch (err) {
    console.error("[lead-ai] could not record failed analysis", {
      leadId: base.leadId,
      error: errorText(err),
    });
    return { ok: false, reason: "failed", error };
  }
}

export async function analyzeLead(
  leadId: string,
  deps: AnalyzeDeps,
): Promise<AnalyzeResult> {
  let lead: Lead | null;
  try {
    lead = await deps.loadLead(leadId);
  } catch (err) {
    return { ok: false, reason: "failed", error: errorText(err) };
  }
  if (!lead) return { ok: false, reason: "not_found" };
  if (SKIP_STATUSES.has(lead.status ?? "new")) return { ok: false, reason: "skipped" };

  const ruleScore = lead.ruleScore ?? lead.score ?? 0;
  const base: FailureBase = { leadId, model: deps.model, promptVersion: PROMPT_VERSION };

  let gen: GenerateResult;
  try {
    gen = await deps.generate({
      system: buildSystemPrompt(),
      message: buildLeadMessage(lead, ruleScore),
    });
  } catch (err) {
    return recordFailure(deps, base, errorText(err), null);
  }

  const parsed = parseLeadAiOutput(gen.output);
  if (!parsed.ok) {
    return recordFailure(deps, { ...base, model: gen.model }, parsed.error, gen);
  }

  const v = parsed.value;
  const noDraft = v.red_flags.some((f) => NO_DRAFT_FLAGS.includes(f));
  const draft = !noDraft && v.draft ? v.draft : null;

  try {
    const insightId = await deps.insertInsight({
      ...base,
      model: gen.model,
      status: "ok",
      error: null,
      aiFitScore: v.ai_fit_score,
      adjustment: clamp(v.adjustment, -MAX_ADJUSTMENT, MAX_ADJUSTMENT),
      rationale: v.rationale,
      signals: v.signals,
      redFlags: v.red_flags,
      draftSubject: draft ? draft.subject : null,
      draftBody: draft
        ? composeDraft(draft.body, { bookingUrl: deps.bookingUrl, signature: deps.signature })
        : null,
      inputTokens: gen.inputTokens,
      outputTokens: gen.outputTokens,
    });
    await deps.updateLeadAi({ leadId, aiScore: v.ai_fit_score, insightId });
    return { ok: true, insightId };
  } catch (err) {
    console.error("[lead-ai] could not persist analysis", { leadId, error: errorText(err) });
    return { ok: false, reason: "failed", error: errorText(err) };
  }
}
