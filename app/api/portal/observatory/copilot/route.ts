import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppApi, isAppContext } from "@/lib/apps/context";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { appGenerateStructured } from "@/lib/apps/ai";
import { aiErrorResponse, type StructuredSchema } from "@/lib/ai/proxy";

export const runtime = "nodejs";

const APP = "observatory";

/**
 * Observatory copilot — server-side port of the standalone app's js/copilot.js.
 * The simulation engine runs in the browser and builds the catalog / evidence
 * pack; this route holds the API key, the grounding system prompts, and the
 * output schemas server-side, and calls Anthropic through lib/apps/ai (which
 * enforces the per-tenant cap + records usage). The two operations mirror the
 * original: NL scenario parse, and an evidence-grounded decision brief.
 */

// --- NL scenario parse (ported PARSE_SCHEMA + system) ---------------------

const PARSE_SYSTEM = `You translate a plain-language decision question into a structured simulation scenario for the Harborview synthetic world. Use ONLY entity ids from the provided catalog. Map the request to the available delta types; anything unmappable goes in "unmapped" (do NOT approximate silently). List EVERY default you choose in "inferred_assumptions". Branches: create multiple when the user compares options; otherwise one intervention branch (a no-change baseline is added automatically). startDay defaults to 8 (one week of warm-up).`;

const PARSE_TOOL: StructuredSchema = {
  name: "scenario",
  description: "The structured simulation scenario parsed from the request.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      objective: { type: "string" },
      horizonDays: { type: "integer" },
      headlineMetric: {
        type: "string",
        enum: [
          "unemployment_rate", "labor_income", "consumer_spend", "external_leakage",
          "retail_revenue", "avg_commute", "congestion_index", "grocery_access",
          "clinic_wait", "clinic_lost", "productivity_loss", "closures_cum",
        ],
      },
      branches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            deltas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "close_road", "outage", "layoff", "open_business", "price_change",
                      "facility_config", "add_housing", "demand_shock", "param",
                    ],
                  },
                  edgeId: { type: ["string", "null"] },
                  subId: { type: ["string", "null"] },
                  orgId: { type: ["string", "null"] },
                  nb: { type: ["string", "null"] },
                  sector: { type: ["string", "null"] },
                  name: { type: ["string", "null"] },
                  pct: { type: ["number", "null"] },
                  count: { type: ["integer", "null"] },
                  units: { type: ["integer", "null"] },
                  category: { type: ["string", "null"] },
                  key: { type: ["string", "null"] },
                  value: { type: ["number", "null"] },
                  priceLevel: { type: ["number", "null"] },
                  quality: { type: ["number", "null"] },
                  capacityDaily: { type: ["integer", "null"] },
                  staff: { type: ["integer", "null"] },
                  wage: { type: ["number", "null"] },
                  config: {
                    type: ["object", "null"],
                    properties: {
                      servers: { type: ["integer", "null"] },
                      layoutEff: { type: ["number", "null"] },
                      triage: { type: ["boolean", "null"] },
                    },
                    additionalProperties: false,
                  },
                  startDay: { type: ["integer", "null"] },
                  days: { type: ["integer", "null"] },
                },
                required: ["type"],
                additionalProperties: false,
              },
            },
          },
          required: ["name", "deltas"],
          additionalProperties: false,
        },
      },
      unmapped: {
        type: "array",
        items: { type: "string" },
        description: "Aspects of the request the modeled levers cannot represent",
      },
      inferred_assumptions: {
        type: "array",
        items: { type: "string" },
        description: "Every default or guess made — each requires user review",
      },
    },
    required: ["name", "objective", "horizonDays", "headlineMetric", "branches", "unmapped", "inferred_assumptions"],
    additionalProperties: false,
  },
};

type ParseResult = {
  name: string;
  objective: string;
  horizonDays: number;
  headlineMetric: string;
  branches: { name: string; deltas: { type: string; [key: string]: unknown }[] }[];
  unmapped: string[];
  inferred_assumptions: string[];
};

// --- Evidence-grounded brief (ported BRIEF_SCHEMA + system) ---------------

const BRIEF_SYSTEM = `You are the analysis copilot inside NEXUS Observatory, a simulation platform. You will receive an EVIDENCE PACK produced by a deterministic simulation engine.

Rules — non-negotiable:
- Every claim must trace to the evidence pack. Cite concrete numbers from it. Do not invent data, agents, events, or effects the pack does not contain.
- The world is synthetic and uncalibrated; use hedged language ("the model estimates…", "under current assumptions…"). Never say an outcome "will" happen.
- If the pack lacks something needed to answer, state that it was not modeled.
- Quantities carry P10–P90 ranges across seeded runs — report ranges, not just point values.
- Audience: business/operations/planning decision-makers. Plain language, no hype.`;

const BRIEF_TOOL: StructuredSchema = {
  name: "brief",
  description: "The evidence-grounded decision brief.",
  input_schema: {
    type: "object",
    properties: {
      executive_summary: { type: "string" },
      key_findings: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      recommended_pilot: { type: "string" },
      monitoring: { type: "array", items: { type: "string" } },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["executive_summary", "key_findings", "risks", "recommended_pilot", "monitoring", "caveats"],
    additionalProperties: false,
  },
};

type BriefResult = {
  executive_summary: string;
  key_findings: string[];
  risks: string[];
  recommended_pilot: string;
  monitoring: string[];
  caveats: string[];
};

// --- Route ----------------------------------------------------------------

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("parse"),
    text: z.string().min(1).max(4000),
    catalog: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("brief"),
    evidence: z.record(z.string(), z.unknown()),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireAppApi();
  if (!isAppContext(auth)) return auth;
  if (!(await rateLimit(`${APP}-ai:${auth.clientId}:${clientIp(request)}`, 30, 5 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "parse") {
      const catalogJson = JSON.stringify(body.catalog).slice(0, 20_000);
      const parsed = await appGenerateStructured<ParseResult>({
        clientId: auth.clientId,
        app: APP,
        system: PARSE_SYSTEM,
        input: `CATALOG:\n${catalogJson}\n\nREQUEST:\n${body.text}`,
        schema: PARSE_TOOL,
        maxTokens: 2000,
      });
      return NextResponse.json({ parsed });
    }

    const evidenceJson = JSON.stringify(body.evidence).slice(0, 40_000);
    const brief = await appGenerateStructured<BriefResult>({
      clientId: auth.clientId,
      app: APP,
      system: BRIEF_SYSTEM,
      input: `EVIDENCE PACK:\n${evidenceJson}`,
      schema: BRIEF_TOOL,
      maxTokens: 3000,
    });
    return NextResponse.json({ brief });
  } catch (err) {
    // AiError → 503/429/422/502; anything else → 500.
    return aiErrorResponse(err);
  }
}
