import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { getClients } from "@/lib/store";
import { listPlans } from "@/lib/managed-services/store";
import {
  getProposalById,
  listProposals,
  upsertProposal,
} from "@/lib/managed-services/proposals";
import type { Proposal } from "@/lib/managed-services/types";

export const runtime = "nodejs";

function shareUrlFor(proposal: Proposal): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base.replace(/\/$/, "")}/proposal/${proposal.token}`;
}

// ---------------------------------------------------------------------------
// GET — proposals, plans, clients (manage_clients)
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const [proposals, plans, clients] = await Promise.all([
    listProposals(),
    listPlans({ includeInactive: true, includeClientPlans: true }),
    getClients(),
  ]);

  return NextResponse.json({
    proposals,
    plans,
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
    })),
  });
}

// ---------------------------------------------------------------------------
// POST — mutations (manage_billing)
// ---------------------------------------------------------------------------

const implementationItemSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).default(""),
});

const addonSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(500).default(""),
  monthlyPriceCents: z.number().int().min(0).nullable().default(null),
});

const implementationSchema = z.object({
  summary: z.string().max(2000).optional(),
  items: z.array(implementationItemSchema).max(30).optional(),
  costCents: z.number().int().min(0).optional(),
  depositCents: z.number().int().min(0).optional(),
  timeline: z.string().max(300).optional(),
  delivered: z.array(implementationItemSchema).max(30).optional(),
  ownershipNotes: z.string().max(2000).optional(),
});

const proposalKindEnum = z.enum([
  "implementation",
  "monthly_service",
  "implementation_plus_monthly",
  "project_completion",
]);

const upsertProposalSchema = z.object({
  action: z.literal("upsert_proposal"),
  id: z.uuid().optional(),
  clientId: z.uuid().nullable().optional(),
  leadId: z.string().max(80).nullable().optional(),
  title: z.string().min(1).max(200),
  kind: proposalKindEnum,
  summary: z.string().max(4000).optional(),
  preparedFor: z.string().max(200).optional(),
  implementation: implementationSchema.optional(),
  planId: z.uuid().nullable().optional(),
  alternativePlanIds: z.array(z.uuid()).max(3).optional(),
  billingFrequency: z.enum(["monthly", "annual"]).optional(),
  monthlyPriceCents: z.number().int().min(0).nullable().optional(),
  annualPriceCents: z.number().int().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).optional(),
  includedSupport: z.string().max(500).optional(),
  serviceLevel: z.string().max(500).optional(),
  minimumCommitmentMonths: z.number().int().min(0).max(36).optional(),
  addons: z.array(addonSchema).max(20).optional(),
  contractTerms: z.string().max(6000).optional(),
  validUntil: z.iso.datetime().nullable().optional(),
  status: z.enum(["draft", "sent"]).optional(),
});

const markSentSchema = z.object({
  action: z.literal("mark_sent"),
  id: z.uuid(),
});

const createCompletionProposalSchema = z.object({
  action: z.literal("create_completion_proposal"),
  clientId: z.uuid(),
  projectName: z.string().min(1).max(200),
  delivered: z.array(implementationItemSchema).max(30),
  ownershipNotes: z.string().max(2000).optional(),
  planId: z.uuid(),
  billingFrequency: z.enum(["monthly", "annual"]).optional(),
  monthlyPriceCents: z.number().int().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).optional(),
  alternativePlanIds: z.array(z.uuid()).max(3).optional(),
});

const BodySchema = z.discriminatedUnion("action", [
  upsertProposalSchema,
  markSentSchema,
  createCompletionProposalSchema,
]);

export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_billing");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const audit = (entityId: string | null | undefined) =>
    writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: `proposal.${body.action}`,
      entityType: "proposal",
      entityId: entityId ?? null,
      ip: clientIp(request),
    });

  switch (body.action) {
    case "upsert_proposal": {
      const proposal = await upsertProposal({
        id: body.id,
        clientId: body.clientId,
        leadId: body.leadId,
        title: body.title,
        kind: body.kind,
        summary: body.summary,
        preparedFor: body.preparedFor,
        implementation: body.implementation,
        planId: body.planId,
        alternativePlanIds: body.alternativePlanIds,
        billingFrequency: body.billingFrequency,
        monthlyPriceCents: body.monthlyPriceCents,
        annualPriceCents: body.annualPriceCents,
        setupFeeCents: body.setupFeeCents,
        includedSupport: body.includedSupport,
        serviceLevel: body.serviceLevel,
        minimumCommitmentMonths: body.minimumCommitmentMonths,
        addons: body.addons,
        contractTerms: body.contractTerms,
        validUntil: body.validUntil,
        status: body.status,
        createdBy: ctx.admin.email,
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Could not save the proposal." },
          { status: 500 }
        );
      }
      await audit(proposal.id);
      return NextResponse.json({
        ok: true,
        proposal,
        shareUrl: shareUrlFor(proposal),
      });
    }

    case "mark_sent": {
      const existing = await getProposalById(body.id);
      if (!existing) {
        return NextResponse.json(
          { error: "Proposal not found." },
          { status: 404 }
        );
      }
      const proposal = await upsertProposal({
        id: existing.id,
        title: existing.title,
        kind: existing.kind,
        status: "sent",
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Could not update the proposal." },
          { status: 500 }
        );
      }
      await audit(proposal.id);
      return NextResponse.json({
        ok: true,
        proposal,
        shareUrl: shareUrlFor(proposal),
      });
    }

    case "create_completion_proposal": {
      const proposal = await upsertProposal({
        clientId: body.clientId,
        kind: "project_completion",
        status: "sent",
        title: `${body.projectName} — Delivery & Ongoing Management`,
        summary: `Delivery summary and recommended ongoing management for ${body.projectName}.`,
        implementation: {
          delivered: body.delivered,
          ownershipNotes: body.ownershipNotes,
        },
        planId: body.planId,
        alternativePlanIds: body.alternativePlanIds,
        billingFrequency: body.billingFrequency,
        monthlyPriceCents: body.monthlyPriceCents,
        setupFeeCents: body.setupFeeCents,
        createdBy: ctx.admin.email,
      });
      if (!proposal) {
        return NextResponse.json(
          { error: "Could not create the proposal." },
          { status: 500 }
        );
      }
      await audit(proposal.id);
      return NextResponse.json({
        ok: true,
        proposal,
        shareUrl: shareUrlFor(proposal),
      });
    }
  }
}
