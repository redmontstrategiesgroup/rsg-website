import { z } from "zod";

const priority = z.enum(["critical", "high", "medium", "low"]);
const score10 = z.number().int().min(1).max(10).optional();
const score100 = z.number().int().min(0).max(100).optional();

export const BriefPayloadSchema = z.object({
  title: z.string().trim().min(1).max(240),
  briefType: z.string().trim().min(1).max(80).default("daily_executive"),
  scheduleName: z.string().trim().max(160).optional(),
  sourceIdentifier: z.string().trim().max(240).optional(),
  briefDate: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }).optional(),
  executiveSummary: z.string().max(20_000).default(""),
  contentMarkdown: z.string().max(500_000).default(""),
  priority: priority.default("medium"),
  sections: z.array(z.object({
    type: z.string().trim().max(80).default("other"),
    heading: z.string().trim().min(1).max(240),
    content: z.string().max(100_000),
    position: z.number().int().min(0).max(1_000).default(0),
  })).max(100).default([]),
  actions: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(20_000).optional(),
    whyItMatters: z.string().max(10_000).optional(),
    priority: priority.default("medium"),
    impactScore: score10,
    effortScore: score10,
    category: z.string().trim().max(100).optional(),
    dueDate: z.iso.date().optional(),
    sourceSection: z.string().trim().max(240).optional(),
  })).max(250).default([]),
  opportunities: z.array(z.object({
    name: z.string().trim().min(1).max(240),
    description: z.string().max(20_000).optional(),
    businessRationale: z.string().max(10_000).optional(),
    opportunityType: z.string().trim().max(100).default("operational_improvement"),
    horizon: z.enum(["immediate", "near_term", "long_term", "experimental"]).default("near_term"),
    targetCustomer: z.string().trim().max(240).optional(),
    targetIndustry: z.string().trim().max(160).optional(),
    potentialValue: z.string().trim().max(240).optional(),
    revenuePotentialScore: score10,
    strategicFitScore: score10,
    urgencyScore: score10,
    difficultyScore: score10,
    speedToRevenueScore: score10,
    confidenceScore: score100,
    recommendedNextStep: z.string().max(10_000).optional(),
  })).max(250).default([]),
  risks: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(20_000).optional(),
    severity: priority.default("medium"),
    probability: score100,
    potentialImpact: z.string().max(10_000).optional(),
    mitigation: z.string().max(10_000).optional(),
    status: z.enum(["active", "monitoring", "mitigated", "accepted", "closed"]).default("monitoring"),
    timeHorizon: z.string().trim().max(160).optional(),
  })).max(250).default([]),
  intelligence: z.array(z.object({
    headline: z.string().trim().min(1).max(300),
    summary: z.string().max(20_000).optional(),
    whyItMatters: z.string().max(10_000).optional(),
    businessImpact: z.string().max(10_000).optional(),
    category: z.string().trim().max(100).default("other"),
    urgency: priority.default("medium"),
    confidence: score100,
    geographicRelevance: z.string().trim().max(240).optional(),
    eventDate: z.iso.date().optional(),
    publicationDate: z.iso.date().optional(),
  })).max(500).default([]),
  sources: z.array(z.object({
    title: z.string().trim().min(1).max(300),
    publisher: z.string().trim().max(200).optional(),
    author: z.string().trim().max(200).optional(),
    url: z.url().max(2_000).optional(),
    sourceType: z.enum(["company_website", "government", "research_report", "news_publication", "industry_publication", "social_media", "podcast", "video", "financial_filing", "local_publication", "other"]).default("other"),
    credibilityLevel: z.enum(["high", "medium", "low", "unclassified"]).default("unclassified"),
    publicationDate: z.iso.date().optional(),
  })).max(500).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

export type BriefPayload = z.infer<typeof BriefPayloadSchema>;

export function payloadError(error: z.ZodError) {
  return error.issues.slice(0, 8).map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
