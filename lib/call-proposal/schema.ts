import { z } from "zod";

/** Model output contracts (forced tool calls). Lengths are capped; code re-checks meaning. */

const Ev = z.object({
  quote: z.string().trim().min(1).max(300),
  call: z.number().int().min(1).max(50),
});
const Level = z.enum(["low", "medium", "high"]);

export const ExtractOutputSchema = z.object({
  pain_points: z.array(z.object({ text: z.string().trim().min(1).max(300), evidence: Ev })).max(10),
  current_tools: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        use: z.string().trim().max(200),
        issue: z.string().trim().max(300).nullable(),
        evidence: Ev,
      }),
    )
    .max(15),
  goals: z.array(z.object({ text: z.string().trim().min(1).max(300), evidence: Ev })).max(8),
  budget: z
    .object({
      stated: z.string().trim().min(1).max(200),
      low_cents: z.number().int().min(0).nullable(),
      high_cents: z.number().int().min(0).nullable(),
      confidence: Level,
      evidence: Ev,
    })
    .nullable(),
  timeline: z
    .object({
      stated: z.string().trim().min(1).max(200),
      target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      urgency: Level,
      evidence: Ev,
    })
    .nullable(),
  decision_makers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().max(120),
        evidence: Ev,
      }),
    )
    .max(6),
  open_questions: z.array(z.string().trim().min(1).max(300)).max(10),
  suggested_template_key: z.string().trim().max(60),
  summary: z.string().trim().min(1).max(600),
});
export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

export const DraftOutputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  term_length: z.string().trim().min(1).max(80),
  sections: z
    .array(
      z.object({
        key: z.string().trim().max(60),
        body: z.string().trim().max(4000),
        items: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(200),
              detail: z.string().trim().max(800).optional(),
              meta: z.string().trim().max(120).optional(),
            }),
          )
          .max(12)
          .optional(),
      }),
    )
    .max(12),
});
export type DraftOutput = z.infer<typeof DraftOutputSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const detail = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, error: `Invalid model output: ${detail}` };
}

export const parseExtractOutput = (raw: unknown) => parseWith(ExtractOutputSchema, raw);
export const parseDraftOutput = (raw: unknown) => parseWith(DraftOutputSchema, raw);

function toolSchema(schema: z.ZodType): { type: "object"; [key: string]: unknown } {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json as { type: "object"; [key: string]: unknown };
}

export const EXTRACT_TOOL = {
  name: "record_call_brief",
  description: "Record what the prospect said about their situation, with evidence quotes.",
  input_schema: toolSchema(ExtractOutputSchema),
};

export const DRAFT_TOOL = {
  name: "record_proposal_draft",
  description: "Record the drafted proposal sections, title and engagement length.",
  input_schema: toolSchema(DraftOutputSchema),
};
