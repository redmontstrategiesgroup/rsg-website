import { z } from "zod";
import { RED_FLAGS, type LeadAiOutput } from "./types.ts";

/**
 * The model's forced-tool output. Adjustment is deliberately wide here and
 * clamped in code: a model that says +25 is still a usable assessment.
 */
export const LeadAiOutputSchema = z.object({
  ai_fit_score: z.number().int().min(0).max(100),
  adjustment: z.number().int().min(-100).max(100),
  rationale: z.string().trim().min(1).max(800),
  signals: z.object({
    positive: z.array(z.string().max(200)).max(6),
    negative: z.array(z.string().max(200)).max(6),
  }),
  red_flags: z.array(z.enum(RED_FLAGS)).max(5),
  draft: z
    .object({
      subject: z.string().trim().min(1).max(160),
      body: z.string().trim().min(1).max(3000),
    })
    .nullable(),
});

export type ParseResult =
  | { ok: true; value: LeadAiOutput }
  | { ok: false; error: string };

export function parseLeadAiOutput(raw: unknown): ParseResult {
  const r = LeadAiOutputSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const detail = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Invalid model output: ${detail}` };
}

const jsonSchema = z.toJSONSchema(LeadAiOutputSchema) as Record<string, unknown>;
delete jsonSchema.$schema;

/** Tool definition for generateStructured (forced tool call = JSON output). */
export const LEAD_AI_TOOL = {
  name: "record_lead_assessment",
  description:
    "Record the fit assessment for this lead and the drafted first reply email.",
  input_schema: jsonSchema as { type: "object"; [key: string]: unknown },
};
