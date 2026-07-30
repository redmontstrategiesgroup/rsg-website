/**
 * Zod validation for admin-edited vertical content. Bounds every string and
 * list so a compromised admin session can't stuff megabytes into the page,
 * and pins enum-ish fields to the values the renderer understands.
 */

import { z } from "zod";
import { VERTICAL_SLUGS } from "./types";

const short = z.string().trim().max(200);
const shortReq = z.string().trim().min(1).max(200);
const medium = z.string().trim().max(600);
const mediumReq = z.string().trim().min(1).max(600);
const long = z.string().trim().max(2000);

const ctaSchema = z.object({
  label: shortReq,
  href: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((v) => v.startsWith("/") || v.startsWith("#"), {
      message: "CTA links must be internal paths or anchors.",
    }),
});

const problemSchema = z.object({
  id: shortReq,
  title: shortReq,
  detail: mediumReq,
  cost: short.optional(),
});

const stageSchema = z.object({
  id: shortReq,
  label: shortReq,
  happens: mediumReq,
  failures: z.array(medium).max(8),
  system: shortReq,
  automations: z.array(medium).max(8),
  kpis: z.array(short).max(8),
  integrations: z.array(short).max(10),
});

const systemSchema = z.object({
  id: shortReq,
  name: shortReq,
  outcome: mediumReq,
  capabilities: z.array(medium).max(10),
  timeline: shortReq,
  pricing: shortReq,
  integrations: z.array(short).max(12),
  flagship: z.boolean().optional(),
});

const integrationSchema = z.object({
  name: shortReq,
  category: shortReq,
  connects: mediumReq,
});

const complianceItemSchema = z.object({
  title: shortReq,
  detail: long.min(1),
});

const caseStudySchema = z.object({
  label: shortReq,
  businessType: shortReq,
  size: shortReq,
  problem: long.min(1),
  currentStack: z.array(short).max(10),
  implementation: z.array(medium).max(10),
  beforeWorkflow: z.array(medium).max(12),
  afterWorkflow: z.array(medium).max(12),
  timeline: shortReq,
  kpis: z.array(short).max(10),
  projections: z.array(z.object({ label: shortReq, value: shortReq })).max(8),
  projectionNote: long.min(1),
  verified: z.boolean().optional(),
});

const assessmentQuestionSchema = z.object({
  id: shortReq,
  label: mediumReq,
  type: z.enum(["select", "text", "number"]),
  options: z.array(short).max(16).optional(),
  placeholder: short.optional(),
  required: z.boolean().optional(),
  helper: medium.optional(),
});

export const verticalSchema = z.object({
  slug: z.enum(VERTICAL_SLUGS as [string, ...string[]]),
  status: z.enum(["draft", "published"]),
  name: shortReq,
  shortName: shortReq,
  audience: z.array(short).min(1).max(12),
  terminology: z.object({
    customer: shortReq,
    customers: shortReq,
    job: shortReq,
    jobs: shortReq,
    team: shortReq,
  }),
  hero: z.object({
    eyebrow: shortReq,
    headline: mediumReq,
    subheadline: long.min(1),
    primaryCta: ctaSchema,
    demoCta: ctaSchema,
    designedFor: long.min(1),
  }),
  problemsIntro: long,
  problems: z.array(problemSchema).max(16),
  workflow: z.object({
    title: shortReq,
    intro: long,
    stages: z.array(stageSchema).max(14),
  }),
  demoSlug: shortReq,
  demo: z.object({
    title: shortReq,
    description: long,
    highlights: z.array(short).max(16),
    simulations: z.array(medium).max(12),
    disclaimer: long.min(1),
  }),
  systemsIntro: long,
  systems: z.array(systemSchema).max(10),
  integrations: z.object({
    intro: long,
    disclaimer: long.min(1),
    items: z.array(integrationSchema).max(20),
  }),
  compliance: z.object({
    title: shortReq,
    intro: long,
    disclaimer: long.min(1),
    items: z.array(complianceItemSchema).max(12),
  }),
  caseStudy: caseStudySchema,
  ctas: z.object({
    primary: ctaSchema,
    secondary: z.array(ctaSchema).max(5),
  }),
  assessment: z.object({
    title: shortReq,
    intro: long,
    questions: z.array(assessmentQuestionSchema).max(16),
    recommendations: z
      .array(z.object({ keywords: z.array(short).min(1).max(8), systemId: shortReq }))
      .max(10),
    fallbackSystemId: shortReq,
  }),
  faqs: z.array(z.object({ q: mediumReq, a: long.min(1) })).max(10),
  seo: z.object({ title: shortReq, description: mediumReq }),
});
