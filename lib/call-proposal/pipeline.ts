import type { Lead } from "../types.ts";
import {
  buildCallsBlock,
  buildDraftMessage,
  buildDraftSystem,
  buildExtractMessage,
  buildExtractSystem,
} from "./prompt.ts";
import { parseDraftOutput, parseExtractOutput } from "./schema.ts";
import { mergeDraftSections, sectionsWithCurrency } from "./sections.ts";
import {
  PROMPT_VERSION,
  RunInProgressError,
  STALE_RUN_MS,
  type BriefPatch,
  type BriefWarning,
  type CallBrief,
  type CallBriefRecord,
  type CallInput,
  type ProposalSection,
  type TemplateChoice,
} from "./types.ts";
import { resolveTemplateKey, verifyBrief } from "./verify.ts";

/**
 * Call → Proposal: two Claude calls behind one click. Every I/O dependency is
 * injected (production wiring in index.ts). Never throws for model or
 * provider failures: the outcome is on the brief row and the RunResult.
 */

export type Stage = "extract" | "draft";

export type GenerateResult = {
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type PipelineDeps = {
  loadLead: (id: string) => Promise<Lead | null>;
  /** Ready, non-dismissed recordings linked to the lead, oldest first. */
  loadCalls: (leadId: string) => Promise<CallInput[]>;
  templates: TemplateChoice[];
  /** The template's tailored sections, resolved for this business (prompt input). */
  templateSections: (templateKey: string, businessName: string) => ProposalSection[];
  generate: (req: { stage: Stage; system: string; message: string }) => Promise<GenerateResult>;
  failStaleRuns: (leadId: string, olderThanMs: number) => Promise<void>;
  /** Throws RunInProgressError when the lead already has an active run. */
  insertBrief: (row: { leadId: string; createdBy: string; promptVersion: string }) => Promise<string>;
  updateBrief: (id: string, patch: BriefPatch) => Promise<void>;
  getBrief: (id: string) => Promise<CallBriefRecord | null>;
  /** failed@draft -> drafting, atomically. False if not in that state; RunInProgressError if another run is active. */
  claimRetry: (id: string) => Promise<boolean>;
  createDraftProposal: (input: {
    leadId: string;
    briefId: string;
    templateKey: string;
    title: string;
    businessName: string;
    challenges: string[];
    outcomes: string[];
    createdBy: string;
  }) => Promise<{ id: string; sections: ProposalSection[] }>;
  saveProposalSections: (proposalId: string, sections: ProposalSection[]) => Promise<void>;
};

export type RunResult =
  | { ok: true; briefId: string; proposalId: string }
  | { ok: false; reason: "not_found" | "no_calls" | "in_progress" | "not_retryable" }
  | { ok: false; reason: "failed"; briefId: string; stage: Stage; error: string };

type Tokens = { model: string; inputTokens: number; outputTokens: number };

export function stageErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { name?: string; code?: string; message?: string; userMessage?: string };
  if (e.name === "AiError" && e.code === "refused") {
    return "Claude declined this request. Try again, or write the proposal by hand.";
  }
  if (e.name === "AiError" && e.code === "not_configured") {
    return "ANTHROPIC_API_KEY isn't configured: add it to the environment first.";
  }
  return (e.userMessage || e.message || "Unknown error.").slice(0, 500);
}

export function runResultStatus(r: RunResult): { status: number; error: string | null } {
  if (r.ok) return { status: 200, error: null };
  switch (r.reason) {
    case "not_found":
      return { status: 404, error: "Not found." };
    case "no_calls":
      return { status: 400, error: "Link a transcribed call to this lead first." };
    case "in_progress":
      return { status: 409, error: "A draft is already running for this lead." };
    case "not_retryable":
      return { status: 409, error: "This draft can't be retried. Start a new draft instead." };
    case "failed":
      return { status: 502, error: r.error };
  }
}

async function fail(deps: PipelineDeps, briefId: string, stage: Stage, err: unknown): Promise<RunResult> {
  const error = stageErrorMessage(err);
  try {
    await deps.updateBrief(briefId, { status: "failed", failedStage: stage, error });
  } catch (writeErr) {
    console.error("[call-proposal] could not record failure", briefId, writeErr);
  }
  return { ok: false, reason: "failed", briefId, stage, error };
}

function hasText(c: CallInput): boolean {
  return Boolean(c.transcript.trim()) || c.segments.some((s) => s.text.trim());
}

export async function runCallProposal(
  leadId: string,
  createdBy: string,
  deps: PipelineDeps,
): Promise<RunResult> {
  const lead = await deps.loadLead(leadId);
  if (!lead) return { ok: false, reason: "not_found" };
  const calls = (await deps.loadCalls(leadId)).filter(hasText);
  if (!calls.length) return { ok: false, reason: "no_calls" };

  await deps.failStaleRuns(leadId, STALE_RUN_MS);
  let briefId: string;
  try {
    briefId = await deps.insertBrief({ leadId, createdBy, promptVersion: PROMPT_VERSION });
  } catch (err) {
    if (err instanceof RunInProgressError) return { ok: false, reason: "in_progress" };
    throw err;
  }

  const block = buildCallsBlock(calls);
  let brief: CallBrief;
  let tokens: Tokens;
  let warnings: BriefWarning[];
  try {
    const res = await deps.generate({
      stage: "extract",
      system: buildExtractSystem(deps.templates),
      message: buildExtractMessage(block, lead),
    });
    tokens = { model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    const parsed = parseExtractOutput(res.output);
    if (!parsed.ok) {
      await deps.updateBrief(briefId, tokens);
      throw new Error(parsed.error);
    }
    const verified = verifyBrief(parsed.value, block.texts);
    brief = verified.brief;
    warnings = verified.unverified
      ? [
          {
            code: "unverified_quotes",
            detail: `${verified.unverified} quote(s) weren't found word-for-word in the transcripts.`,
          },
        ]
      : [];
    await deps.updateBrief(briefId, {
      status: "drafting",
      extraction: brief,
      recordingIds: block.included.map((c) => c.recordingId),
      truncated: block.truncated,
      warnings,
      ...tokens,
    });
  } catch (err) {
    return fail(deps, briefId, "extract", err);
  }

  return draftStage(deps, { briefId, leadId, lead, brief, tokens, warnings, createdBy });
}

async function draftStage(
  deps: PipelineDeps,
  ctx: {
    briefId: string;
    leadId: string;
    lead: Lead;
    brief: CallBrief;
    tokens: Tokens;
    warnings: BriefWarning[];
    createdBy: string;
  },
): Promise<RunResult> {
  const { briefId, brief } = ctx;
  try {
    const templateKey = resolveTemplateKey(
      brief.suggested_template_key,
      deps.templates.map((t) => t.key),
    );
    const template = deps.templates.find((t) => t.key === templateKey) ?? {
      key: templateKey,
      label: templateKey,
    };
    const businessName = ctx.lead.company?.trim() || ctx.lead.name;
    const res = await deps.generate({
      stage: "draft",
      system: buildDraftSystem(),
      message: buildDraftMessage({
        brief,
        businessName,
        template,
        sections: deps.templateSections(templateKey, businessName),
      }),
    });
    const tokens: Tokens = {
      model: res.model,
      inputTokens: ctx.tokens.inputTokens + res.inputTokens,
      outputTokens: ctx.tokens.outputTokens + res.outputTokens,
    };
    const parsed = parseDraftOutput(res.output);
    if (!parsed.ok) {
      await deps.updateBrief(briefId, tokens);
      throw new Error(parsed.error);
    }

    const proposal = await deps.createDraftProposal({
      leadId: ctx.leadId,
      briefId,
      templateKey,
      title: parsed.value.title,
      businessName,
      challenges: brief.pain_points.map((p) => p.text).slice(0, 10),
      outcomes: brief.goals.map((g) => g.text).slice(0, 10),
      createdBy: ctx.createdBy,
    });
    // Linked before anything else can fail, so a later failure never orphans it.
    await deps.updateBrief(briefId, {
      proposalId: proposal.id,
      templateKey,
      termLength: parsed.value.term_length,
      ...tokens,
    });

    const sections = mergeDraftSections(proposal.sections, parsed.value.sections);
    await deps.saveProposalSections(proposal.id, sections);

    const currency = sectionsWithCurrency(sections);
    const warnings: BriefWarning[] = [
      ...ctx.warnings.filter((w) => w.code !== "currency_in_draft"),
      ...(currency.length
        ? [{ code: "currency_in_draft" as const, detail: `Check for amounts in: ${currency.join(", ")}.` }]
        : []),
    ];
    await deps.updateBrief(briefId, { status: "ready", failedStage: null, error: "", warnings });
    return { ok: true, briefId, proposalId: proposal.id };
  } catch (err) {
    return fail(deps, briefId, "draft", err);
  }
}

export async function retryDraft(briefId: string, deps: PipelineDeps): Promise<RunResult> {
  const rec = await deps.getBrief(briefId);
  if (!rec) return { ok: false, reason: "not_found" };
  if (rec.status !== "failed" || rec.failedStage !== "draft" || !rec.extraction) {
    return { ok: false, reason: "not_retryable" };
  }
  const lead = await deps.loadLead(rec.leadId);
  if (!lead) return { ok: false, reason: "not_found" };

  await deps.failStaleRuns(rec.leadId, STALE_RUN_MS);
  let claimed: boolean;
  try {
    claimed = await deps.claimRetry(briefId);
  } catch (err) {
    if (err instanceof RunInProgressError) return { ok: false, reason: "in_progress" };
    throw err;
  }
  if (!claimed) return { ok: false, reason: "not_retryable" };

  return draftStage(deps, {
    briefId,
    leadId: rec.leadId,
    lead,
    brief: rec.extraction,
    tokens: { model: rec.model, inputTokens: rec.inputTokens, outputTokens: rec.outputTokens },
    warnings: rec.warnings,
    createdBy: rec.createdBy,
  });
}
