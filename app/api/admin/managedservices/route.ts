import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { getClients, updateLead } from "@/lib/store";
import {
  addMaintenanceLog,
  createSubscription,
  getPlanByKey,
  getRecurringRevenueSummary,
  getRoadmap,
  getServiceReport,
  getSubscription,
  listMaintenanceLogs,
  listPlans,
  listRoadmaps,
  listServiceReports,
  listServiceRequests,
  listSubscriptionEvents,
  listSubscriptions,
  recordSubscriptionEvent,
  updateServiceRequest,
  updateSubscription,
  upsertPlan,
  upsertRoadmap,
  upsertServiceReport,
} from "@/lib/managed-services/store";
import {
  cancelStripeSubscriptionNow,
  isStripeConfigured,
  setStripeCancelAtPeriodEnd,
} from "@/lib/managed-services/billing";
import {
  MAINTENANCE_CATEGORIES,
  ROADMAP_ITEM_KINDS,
  SERVICE_REQUEST_STATUSES,
  STANDARD_PLAN_KEYS,
  SUBSCRIPTION_STATUSES,
  type MaintenanceCategory,
  type RoadmapItemKind,
  type ServiceRequestStatus,
  type StandardPlanKey,
  type SubscriptionStatus,
} from "@/lib/managed-services/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function minimalClients() {
  const clients = await getClients();
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
  }));
}

const OPEN_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "new",
  "in_review",
  "approved",
  "scheduled",
  "in_progress",
  "waiting_on_client",
];

// ---------------------------------------------------------------------------
// GET — section reads (view_analytics)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const ctx = await requireAdmin("view_analytics");
  if (!isAdminContext(ctx)) return ctx;

  const section = new URL(request.url).searchParams.get("section") ?? "overview";

  switch (section) {
    case "overview": {
      const [revenue, openRequestsList, events] = await Promise.all([
        getRecurringRevenueSummary(),
        listServiceRequests({ statuses: OPEN_REQUEST_STATUSES }),
        listSubscriptionEvents({ limit: 30 }),
      ]);
      return NextResponse.json({
        revenue,
        openRequests: openRequestsList.length,
        events,
      });
    }
    case "plans": {
      const [plans, clients] = await Promise.all([
        listPlans({ includeInactive: true, includeClientPlans: true }),
        minimalClients(),
      ]);
      return NextResponse.json({ plans, clients });
    }
    case "subscriptions": {
      const [subscriptions, clients, plans] = await Promise.all([
        listSubscriptions(),
        minimalClients(),
        listPlans({ includeInactive: true, includeClientPlans: true }),
      ]);
      return NextResponse.json({ subscriptions, clients, plans });
    }
    case "requests": {
      const [requests, clients] = await Promise.all([
        listServiceRequests(),
        minimalClients(),
      ]);
      return NextResponse.json({ requests, clients });
    }
    case "maintenance": {
      const [logs, clients] = await Promise.all([
        listMaintenanceLogs({ limit: 200 }),
        minimalClients(),
      ]);
      return NextResponse.json({ logs, clients });
    }
    case "reports": {
      const [reports, clients] = await Promise.all([
        listServiceReports(),
        minimalClients(),
      ]);
      return NextResponse.json({ reports, clients });
    }
    case "roadmaps": {
      const [roadmaps, clients] = await Promise.all([
        listRoadmaps(),
        minimalClients(),
      ]);
      return NextResponse.json({ roadmaps, clients });
    }
    case "events": {
      const events = await listSubscriptionEvents({ limit: 200 });
      return NextResponse.json({ events });
    }
    default:
      return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// POST — mutations (manage_billing)
// ---------------------------------------------------------------------------

const subscriptionStatusEnum = z.enum(
  SUBSCRIPTION_STATUSES as [SubscriptionStatus, ...SubscriptionStatus[]]
);
const requestStatusEnum = z.enum(
  SERVICE_REQUEST_STATUSES as [ServiceRequestStatus, ...ServiceRequestStatus[]]
);
const maintenanceCategoryEnum = z.enum(
  MAINTENANCE_CATEGORIES as [MaintenanceCategory, ...MaintenanceCategory[]]
);
const roadmapItemKindEnum = z.enum(
  ROADMAP_ITEM_KINDS as [RoadmapItemKind, ...RoadmapItemKind[]]
);
const standardPlanKeyEnum = z.enum(
  STANDARD_PLAN_KEYS as [StandardPlanKey, ...StandardPlanKey[]]
);
const billingFrequencyEnum = z.enum(["monthly", "annual"]);

const planAddonSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(500).default(""),
  monthlyPriceCents: z.number().int().min(0).nullable().default(null),
});

const upsertPlanSchema = z.object({
  action: z.literal("upsert_plan"),
  plan: z.object({
    id: z.uuid().optional(),
    key: z
      .string()
      .regex(/^[a-z0-9_-]{2,60}$/)
      .optional(),
    name: z.string().min(1).max(120),
    tagline: z.string().max(500).optional(),
    bestFit: z.string().max(500).optional(),
    description: z.string().max(500).optional(),
    monthlyPriceCents: z.number().int().min(0).nullable().optional(),
    annualPriceCents: z.number().int().min(0).nullable().optional(),
    annualDiscountPct: z.number().min(0).max(100).optional(),
    setupFeeCents: z.number().int().min(0).optional(),
    customPricing: z.boolean().optional(),
    includedHours: z.number().min(0).nullable().optional(),
    additionalHourlyRateCents: z.number().int().min(0).nullable().optional(),
    supportLevel: z.string().max(200).optional(),
    responseTime: z.string().max(200).optional(),
    minimumCommitmentMonths: z.number().int().min(0).max(36).optional(),
    cancellationTerms: z.string().max(500).optional(),
    features: z.array(z.string().max(300)).max(40).optional(),
    detailedScope: z.array(z.string().max(300)).max(40).optional(),
    addons: z.array(planAddonSchema).max(20).optional(),
    comparison: z
      .record(z.string().max(80), z.union([z.string().max(120), z.boolean()]))
      .optional(),
    recommended: z.boolean().optional(),
    businessCritical: z.boolean().optional(),
    active: z.boolean().optional(),
    tierRank: z.number().int().min(0).max(100).optional(),
    sortOrder: z.number().int().min(-1000).max(10000).optional(),
    basePlanKey: z.string().max(80).nullable().optional(),
    clientId: z.uuid().nullable().optional(),
  }),
});

const createCustomPlanSchema = z.object({
  action: z.literal("create_custom_plan"),
  basePlanKey: standardPlanKeyEnum,
  clientId: z.uuid(),
  name: z.string().min(1).max(120),
  monthlyPriceCents: z.number().int().min(0).nullable(),
  includedHours: z.number().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

const assignSubscriptionSchema = z.object({
  action: z.literal("assign_subscription"),
  clientId: z.uuid(),
  planId: z.uuid(),
  billingFrequency: billingFrequencyEnum,
  status: subscriptionStatusEnum.optional(),
  monthlyPriceCents: z.number().int().min(0).optional(),
  annualPriceCents: z.number().int().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).optional(),
  includedHours: z.number().min(0).nullable().optional(),
  minimumCommitmentMonths: z.number().int().min(0).max(36).optional(),
  accountManager: z.string().max(200).optional(),
  technicalOwner: z.string().max(200).optional(),
  slaNotes: z.string().max(4000).optional(),
  adminNotes: z.string().max(4000).optional(),
  startNow: z.boolean().default(true),
});

const updateSubscriptionSchema = z.object({
  action: z.literal("update_subscription"),
  id: z.uuid(),
  patch: z
    .object({
      status: subscriptionStatusEnum.optional(),
      billingFrequency: billingFrequencyEnum.optional(),
      monthlyPriceCents: z.number().int().min(0).optional(),
      annualPriceCents: z.number().int().min(0).nullable().optional(),
      setupFeeCents: z.number().int().min(0).optional(),
      includedHours: z.number().min(0).nullable().optional(),
      additionalHourlyRateCents: z.number().int().min(0).nullable().optional(),
      accountManager: z.string().max(200).optional(),
      technicalOwner: z.string().max(200).optional(),
      slaNotes: z.string().max(4000).optional(),
      adminNotes: z.string().max(4000).optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
      currentPeriodStart: z.iso.datetime().nullable().optional(),
      currentPeriodEnd: z.iso.datetime().nullable().optional(),
      commitmentEndsAt: z.iso.datetime().nullable().optional(),
    })
    .strict(),
});

const cancelSubscriptionSchema = z.object({
  action: z.literal("cancel_subscription"),
  id: z.uuid(),
  immediate: z.boolean().default(false),
  reason: z.string().max(2000).optional(),
});

const updateRequestSchema = z.object({
  action: z.literal("update_request"),
  id: z.uuid(),
  patch: z
    .object({
      status: requestStatusEnum.optional(),
      priority: z.enum(["standard", "priority", "urgent"]).optional(),
      inclusion: z
        .enum(["included", "needs_approval", "extra_charge", "pending_assessment"])
        .optional(),
      estimatedHours: z.number().min(0).max(500).nullable().optional(),
      actualHours: z.number().min(0).max(500).nullable().optional(),
      extraChargeCents: z.number().int().min(0).nullable().optional(),
      adminNotes: z.string().max(4000).optional(),
    })
    .strict(),
});

const logMaintenanceSchema = z.object({
  action: z.literal("log_maintenance"),
  clientId: z.uuid(),
  subscriptionId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  category: maintenanceCategoryEnum,
  description: z.string().max(4000).optional(),
  hoursSpent: z.number().min(0).max(500).default(0),
  performedBy: z.string().max(200).optional(),
  performedAt: z.iso.datetime().optional(),
  visibleToClient: z.boolean().default(true),
});

const reportDataSchema = z.object({
  systemsMonitored: z.array(z.string().max(300)).max(40).optional(),
  changesCompleted: z.array(z.string().max(300)).max(40).optional(),
  recommendations: z.array(z.string().max(300)).max(40).optional(),
  upcomingPriorities: z.array(z.string().max(300)).max(40).optional(),
  additionalOpportunities: z.array(z.string().max(300)).max(40).optional(),
  uptimePct: z.number().min(0).max(100).optional(),
  backupsCompleted: z.number().min(0).optional(),
  updatesInstalled: z.number().min(0).optional(),
  issuesResolved: z.number().min(0).optional(),
  securityEvents: z.string().max(2000).optional(),
  performanceNotes: z.string().max(2000).optional(),
  automationActivity: z.string().max(2000).optional(),
  aiActivity: z.string().max(2000).optional(),
  leadMetrics: z
    .array(z.object({ label: z.string().max(200), value: z.string().max(200) }))
    .max(40)
    .optional(),
});

const upsertReportSchema = z.object({
  action: z.literal("upsert_report"),
  id: z.uuid().optional(),
  clientId: z.uuid(),
  subscriptionId: z.uuid().nullable().optional(),
  kind: z.enum(["monthly", "health", "baseline", "quarterly"]),
  title: z.string().min(1).max(200),
  periodStart: z.iso.date().nullable().optional(),
  periodEnd: z.iso.date().nullable().optional(),
  summary: z.string().max(4000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  data: reportDataSchema.optional(),
});

const upsertRoadmapSchema = z.object({
  action: z.literal("upsert_roadmap"),
  id: z.uuid().optional(),
  clientId: z.uuid(),
  subscriptionId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  periodLabel: z.string().max(60).optional(),
  status: z
    .enum(["draft", "proposed", "approved", "in_progress", "completed"])
    .optional(),
  summary: z.string().max(4000).optional(),
  items: z
    .array(
      z.object({
        id: z.uuid().optional(),
        kind: roadmapItemKindEnum,
        title: z.string().min(1).max(200),
        detail: z.string().max(2000).optional(),
        impact: z.string().max(500).optional(),
        timeline: z.string().max(200).optional(),
        status: z
          .enum(["proposed", "approved", "in_progress", "done", "deferred"])
          .default("proposed"),
      })
    )
    .max(60)
    .optional(),
  estimatedImpact: z.string().max(500).optional(),
  proposedTimeline: z.string().max(500).optional(),
  reviewScheduledFor: z.iso.datetime().nullable().optional(),
});

const setLeadRecommendationSchema = z.object({
  action: z.literal("set_lead_recommendation"),
  leadId: z.string().min(1).max(80),
  recommendedPlan: z.union([z.literal(""), standardPlanKeyEnum]),
});

const BodySchema = z.discriminatedUnion("action", [
  upsertPlanSchema,
  createCustomPlanSchema,
  assignSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  updateRequestSchema,
  logMaintenanceSchema,
  upsertReportSchema,
  upsertRoadmapSchema,
  setLeadRecommendationSchema,
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

  const audit = (entityType: string, entityId: string | null | undefined) =>
    writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: `managed_services.${body.action}`,
      entityType,
      entityId: entityId ?? null,
      ip: clientIp(request),
    });

  const adminActor = `admin:${ctx.admin.email}`;

  switch (body.action) {
    case "upsert_plan": {
      const plan = await upsertPlan(body.plan);
      if (!plan) {
        return NextResponse.json(
          { error: "Could not save the plan." },
          { status: 500 }
        );
      }
      await audit("managed_service_plan", plan.id);
      return NextResponse.json({ ok: true, plan });
    }

    case "create_custom_plan": {
      const base = await getPlanByKey(body.basePlanKey);
      if (!base) {
        return NextResponse.json(
          { error: "Base plan not found." },
          { status: 400 }
        );
      }
      const plan = await upsertPlan({
        key: `custom-${body.basePlanKey}-${Date.now().toString(36)}`,
        name: body.name,
        tagline: base.tagline,
        bestFit: base.bestFit,
        description: base.description,
        monthlyPriceCents: body.monthlyPriceCents,
        annualDiscountPct: base.annualDiscountPct,
        setupFeeCents: body.setupFeeCents ?? base.setupFeeCents,
        customPricing: body.monthlyPriceCents == null,
        includedHours: body.includedHours ?? base.includedHours,
        additionalHourlyRateCents: base.additionalHourlyRateCents,
        supportLevel: base.supportLevel,
        responseTime: base.responseTime,
        minimumCommitmentMonths: base.minimumCommitmentMonths,
        cancellationTerms: base.cancellationTerms,
        features: base.features,
        detailedScope: base.detailedScope,
        comparison: base.comparison,
        recommended: false,
        businessCritical: base.businessCritical,
        tierRank: base.tierRank,
        basePlanKey: body.basePlanKey,
        clientId: body.clientId,
        active: true,
        sortOrder: 100,
      });
      if (!plan) {
        return NextResponse.json(
          { error: "Could not create the custom plan." },
          { status: 500 }
        );
      }
      await audit("managed_service_plan", plan.id);
      return NextResponse.json({ ok: true, plan });
    }

    case "assign_subscription": {
      const sub = await createSubscription({
        clientId: body.clientId,
        planId: body.planId,
        billingFrequency: body.billingFrequency,
        monthlyPriceCents: body.monthlyPriceCents,
        annualPriceCents: body.annualPriceCents,
        setupFeeCents: body.setupFeeCents,
        includedHours: body.includedHours,
        minimumCommitmentMonths: body.minimumCommitmentMonths,
        accountManager: body.accountManager,
        technicalOwner: body.technicalOwner,
        slaNotes: body.slaNotes,
        adminNotes: body.adminNotes,
        source: "admin",
        status: "pending",
      });
      if (!sub) {
        return NextResponse.json(
          { error: "Plan not found — subscription was not created." },
          { status: 400 }
        );
      }

      let subscription = sub;
      if (body.startNow) {
        const now = new Date();
        const periodEnd = new Date(now);
        if (body.billingFrequency === "annual") {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        let commitmentEnds: Date | null = null;
        if (sub.minimumCommitmentMonths > 0) {
          commitmentEnds = new Date(now);
          commitmentEnds.setMonth(
            commitmentEnds.getMonth() + sub.minimumCommitmentMonths
          );
        }
        const updated = await updateSubscription(sub.id, {
          status: body.status ?? "active",
          startedAt: now.toISOString(),
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          commitmentEndsAt: commitmentEnds?.toISOString() ?? null,
        });
        if (updated) subscription = updated;
      }

      await recordSubscriptionEvent({
        subscriptionId: sub.id,
        clientId: body.clientId,
        type: "subscription.assigned",
        description: `Plan assigned by ${ctx.admin.email}`,
        actor: adminActor,
      });
      await audit("client_subscription", sub.id);
      return NextResponse.json({ ok: true, subscription });
    }

    case "update_subscription": {
      const subscription = await updateSubscription(body.id, body.patch);
      if (!subscription) {
        return NextResponse.json(
          { error: "Subscription not found." },
          { status: 404 }
        );
      }
      await recordSubscriptionEvent({
        subscriptionId: subscription.id,
        clientId: subscription.clientId,
        type: "subscription.updated",
        description: `Subscription updated by ${ctx.admin.email}`,
        actor: adminActor,
        data: { fields: Object.keys(body.patch) },
      });
      await audit("client_subscription", subscription.id);
      return NextResponse.json({ ok: true, subscription });
    }

    case "cancel_subscription": {
      const sub = await getSubscription(body.id);
      if (!sub) {
        return NextResponse.json(
          { error: "Subscription not found." },
          { status: 404 }
        );
      }

      if (sub.stripeSubscriptionId && isStripeConfigured()) {
        try {
          if (body.immediate) {
            await cancelStripeSubscriptionNow(sub.stripeSubscriptionId);
          } else {
            await setStripeCancelAtPeriodEnd(sub.stripeSubscriptionId, true);
          }
        } catch {
          return NextResponse.json(
            { error: "Stripe update failed — subscription unchanged." },
            { status: 502 }
          );
        }
      }

      const now = new Date().toISOString();
      const subscription = await updateSubscription(
        body.id,
        body.immediate
          ? {
              status: "cancelled",
              endedAt: now,
              cancellationReason: body.reason ?? null,
              cancelAtPeriodEnd: false,
            }
          : {
              status: "pending_cancellation",
              cancelAtPeriodEnd: true,
              cancellationRequestedAt: now,
              cancellationReason: body.reason ?? null,
            }
      );
      await recordSubscriptionEvent({
        subscriptionId: sub.id,
        clientId: sub.clientId,
        type: body.immediate ? "subscription.cancelled" : "cancellation.scheduled",
        description: body.immediate
          ? `Subscription cancelled immediately by ${ctx.admin.email}`
          : `Cancellation scheduled for period end by ${ctx.admin.email}`,
        actor: adminActor,
        data: body.reason ? { reason: body.reason } : {},
      });
      await audit("client_subscription", sub.id);
      return NextResponse.json({ ok: true, subscription });
    }

    case "update_request": {
      const updated = await updateServiceRequest(
        body.id,
        body.patch,
        ctx.admin.email
      );
      if (!updated) {
        return NextResponse.json(
          { error: "Service request not found." },
          { status: 404 }
        );
      }
      await recordSubscriptionEvent({
        subscriptionId: updated.subscriptionId,
        clientId: updated.clientId,
        type: "request.updated",
        description: `Request "${updated.title}" updated by ${ctx.admin.email}`,
        actor: adminActor,
        data: { fields: Object.keys(body.patch) },
      });
      await audit("service_request", updated.id);
      return NextResponse.json({ ok: true, request: updated });
    }

    case "log_maintenance": {
      const log = await addMaintenanceLog({
        clientId: body.clientId,
        subscriptionId: body.subscriptionId ?? null,
        title: body.title,
        category: body.category,
        description: body.description,
        hoursSpent: body.hoursSpent,
        performedBy: body.performedBy ?? ctx.admin.email,
        performedAt: body.performedAt,
        visibleToClient: body.visibleToClient,
      });
      if (!log) {
        return NextResponse.json(
          { error: "Could not save the maintenance log." },
          { status: 500 }
        );
      }
      await recordSubscriptionEvent({
        subscriptionId: log.subscriptionId,
        clientId: log.clientId,
        type: "maintenance.logged",
        description: `Maintenance logged: ${log.title}`,
        actor: adminActor,
        data: { category: log.category, hoursSpent: log.hoursSpent },
      });
      await audit("maintenance_log", log.id);
      return NextResponse.json({ ok: true, log });
    }

    case "upsert_report": {
      const prev = body.id ? await getServiceReport(body.id) : null;
      const report = await upsertServiceReport({
        id: body.id,
        clientId: body.clientId,
        subscriptionId: body.subscriptionId,
        kind: body.kind,
        title: body.title,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        summary: body.summary,
        status: body.status,
        data: body.data,
        createdBy: prev?.createdBy || ctx.admin.email,
      });
      if (!report) {
        return NextResponse.json(
          { error: "Could not save the report." },
          { status: 500 }
        );
      }
      if (report.status === "published" && prev?.status !== "published") {
        await recordSubscriptionEvent({
          subscriptionId: report.subscriptionId,
          clientId: report.clientId,
          type: "report.published",
          description: `Report published: ${report.title}`,
          actor: adminActor,
        });
      }
      await audit("service_report", report.id);
      return NextResponse.json({ ok: true, report });
    }

    case "upsert_roadmap": {
      const prev = body.id ? await getRoadmap(body.id) : null;
      const roadmap = await upsertRoadmap({
        id: body.id,
        clientId: body.clientId,
        subscriptionId: body.subscriptionId,
        title: body.title,
        periodLabel: body.periodLabel,
        status: body.status,
        summary: body.summary,
        items: body.items?.map((item) => ({
          id: item.id ?? randomUUID(),
          kind: item.kind,
          title: item.title,
          detail: item.detail ?? "",
          impact: item.impact ?? "",
          timeline: item.timeline ?? "",
          status: item.status,
        })),
        estimatedImpact: body.estimatedImpact,
        proposedTimeline: body.proposedTimeline,
        reviewScheduledFor: body.reviewScheduledFor,
      });
      if (!roadmap) {
        return NextResponse.json(
          { error: "Could not save the roadmap." },
          { status: 500 }
        );
      }
      if (roadmap.status === "proposed" && prev?.status !== "proposed") {
        await recordSubscriptionEvent({
          subscriptionId: roadmap.subscriptionId,
          clientId: roadmap.clientId,
          type: "roadmap.proposed",
          description: `Roadmap proposed: ${roadmap.title}`,
          actor: adminActor,
        });
      }
      await audit("client_roadmap", roadmap.id);
      return NextResponse.json({ ok: true, roadmap });
    }

    case "set_lead_recommendation": {
      const lead = await updateLead(body.leadId, {
        recommendedPlan: body.recommendedPlan,
      });
      if (!lead) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      await audit("lead", body.leadId);
      return NextResponse.json({ ok: true, lead });
    }
  }
}
