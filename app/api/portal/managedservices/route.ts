import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSession } from "@/lib/auth";
import { getClientById, isSessionLive } from "@/lib/store";
import { rateLimit, rateLimitResponse } from "@/lib/security";
import { getPortalManagedData } from "@/lib/managed-services/portal-data";
import {
  createServiceRequest,
  getActiveSubscriptionForClient,
  getClientStripeCustomerId,
  getPlanById,
  getRoadmap,
  approveRoadmap,
  recordSubscriptionEvent,
  setClientStripeCustomerId,
  updateSubscription,
} from "@/lib/managed-services/store";
import {
  changeStripeSubscriptionPrice,
  createBillingPortalSession,
  createSubscriptionCheckout,
  ensureStripeCustomer,
  isStripeConfigured,
  setStripeCancelAtPeriodEnd,
} from "@/lib/managed-services/billing";
import { annualPriceCents } from "@/lib/managed-services/content";
import { SERVICE_REQUEST_TYPES } from "@/lib/managed-services/types";
import type { ServiceRequestType } from "@/lib/managed-services/types";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_request"),
    type: z.enum(
      SERVICE_REQUEST_TYPES as [ServiceRequestType, ...ServiceRequestType[]]
    ),
    title: z.string().min(1).max(200),
    details: z.string().max(4000).optional(),
  }),
  z.object({
    action: z.literal("request_plan_change"),
    planId: z.string().uuid(),
    billingFrequency: z.enum(["monthly", "annual"]),
    acknowledge: z.boolean().optional(),
    note: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("request_cancellation"),
    reason: z.string().max(2000).optional(),
    acknowledge: z.boolean(),
  }),
  z.object({
    action: z.literal("approve_roadmap"),
    roadmapId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("billing_portal"),
  }),
]);

async function authedClientId(): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role === "admin") return null;
  if (session.sid && !(await isSessionLive(session.sid))) return null;
  return session.sub;
}

export async function GET() {
  const clientId = await authedClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json(await getPortalManagedData(clientId));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.sid && !(await isSessionLive(session.sid))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const clientId = session.sub;

  if (!(await rateLimit(`portal-ms:${clientId}`, 20, 10 * 60 * 1000))) {
    return rateLimitResponse();
  }

  try {
    const body = schema.parse(await request.json());

    switch (body.action) {
      case "create_request": {
        const sub = await getActiveSubscriptionForClient(clientId);
        const created = await createServiceRequest({
          clientId,
          subscriptionId: sub?.id ?? null,
          planKey: sub?.planKey ?? null,
          type: body.type,
          title: body.title,
          details: body.details,
          actorLabel: "client",
        });
        await recordSubscriptionEvent({
          clientId,
          subscriptionId: sub?.id ?? null,
          type: "request.created",
          description: body.title,
          actor: `client:${clientId}`,
        });
        return NextResponse.json({ ok: true, request: created });
      }

      case "request_plan_change": {
        const sub = await getActiveSubscriptionForClient(clientId);
        if (!sub) {
          return NextResponse.json(
            { error: "No active service plan found for your account." },
            { status: 404 }
          );
        }
        const current = await getPlanById(sub.planId);
        const target = await getPlanById(body.planId);
        if (
          !current ||
          !target ||
          !target.active ||
          // Client-specific plans are only selectable by their own client.
          (target.clientId != null && target.clientId !== clientId)
        ) {
          return NextResponse.json(
            { error: "That plan is not available." },
            { status: 400 }
          );
        }

        const submitReviewRequest = async (eventType: string) => {
          await createServiceRequest({
            clientId,
            subscriptionId: sub.id,
            planKey: sub.planKey ?? null,
            type: "plan_change",
            title: `Plan change request: ${current.name} → ${target.name}`,
            details: body.note ?? "",
            acknowledgedConsequences: true,
            actorLabel: "client",
          });
          await recordSubscriptionEvent({
            clientId,
            subscriptionId: sub.id,
            type: eventType,
            description: `Requested change from ${current.name} to ${target.name} (${body.billingFrequency}).`,
            actor: `client:${clientId}`,
          });
        };

        // Business-critical downgrades never self-serve — reviewed transition.
        if (current.businessCritical && target.tierRank < current.tierRank) {
          if (body.acknowledge !== true) {
            return NextResponse.json(
              {
                error: "Acknowledgement required.",
                code: "acknowledgement_required",
              },
              { status: 400 }
            );
          }
          await submitReviewRequest("plan.change_requested");
          return NextResponse.json({ ok: true, requiresReview: true });
        }

        // Business-critical sideways moves (equal tier, or any move that
        // drops the business-critical designation) are reviewed too — they
        // must never self-serve past the managed-transition guard.
        if (
          current.businessCritical &&
          (target.tierRank === current.tierRank || !target.businessCritical)
        ) {
          await submitReviewRequest("plan.change_requested");
          return NextResponse.json({ ok: true, requiresReview: true });
        }

        // Custom-priced targets always go through review.
        if (target.customPricing || target.monthlyPriceCents == null) {
          await submitReviewRequest("plan.change_requested");
          return NextResponse.json({ ok: true, requiresReview: true });
        }

        if (target.tierRank >= current.tierRank) {
          // Upgrade — amounts resolve server-side from the plan row.
          const amount =
            body.billingFrequency === "annual"
              ? annualPriceCents(target)
              : target.monthlyPriceCents;
          if (amount == null || amount <= 0) {
            await submitReviewRequest("plan.change_requested");
            return NextResponse.json({ ok: true, requiresReview: true });
          }

          if (sub.stripeSubscriptionId && isStripeConfigured()) {
            try {
              await changeStripeSubscriptionPrice({
                stripeSubscriptionId: sub.stripeSubscriptionId,
                plan: { key: target.key, name: target.name },
                billingFrequency: body.billingFrequency,
                recurringAmountCents: amount,
              });
            } catch (err) {
              console.error("[portal-ms] Stripe plan change failed.", err);
              return NextResponse.json(
                { error: "Billing update failed — no changes were made." },
                { status: 502 }
              );
            }
            await updateSubscription(sub.id, {
              planId: target.id,
              billingFrequency: body.billingFrequency,
              monthlyPriceCents: target.monthlyPriceCents,
              annualPriceCents:
                body.billingFrequency === "annual"
                  ? amount
                  : target.annualPriceCents,
              includedHours: target.includedHours,
              additionalHourlyRateCents: target.additionalHourlyRateCents,
            });
            await recordSubscriptionEvent({
              clientId,
              subscriptionId: sub.id,
              type: "plan.upgraded",
              description: `Upgraded from ${current.name} to ${target.name} (${body.billingFrequency}).`,
              actor: `client:${clientId}`,
            });
            return NextResponse.json({ ok: true });
          }

          if (isStripeConfigured()) {
            // No Stripe subscription yet — collect payment via Checkout.
            const client = await getClientById(clientId);
            if (!client) {
              return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
              );
            }
            const customerId = await ensureStripeCustomer({
              clientId,
              email: client.email,
              name: client.name,
              company: client.company,
              existingCustomerId:
                sub.stripeCustomerId ??
                (await getClientStripeCustomerId(clientId)),
            });
            if (!customerId) {
              return NextResponse.json(
                { error: "Billing update failed — no changes were made." },
                { status: 502 }
              );
            }
            await setClientStripeCustomerId(clientId, customerId);
            await updateSubscription(sub.id, {
              planId: target.id,
              billingFrequency: body.billingFrequency,
              monthlyPriceCents: target.monthlyPriceCents,
              annualPriceCents:
                body.billingFrequency === "annual"
                  ? amount
                  : target.annualPriceCents,
              includedHours: target.includedHours,
              additionalHourlyRateCents: target.additionalHourlyRateCents,
              stripeCustomerId: customerId,
              status: "awaiting_payment",
            });
            const checkout = await createSubscriptionCheckout({
              customerId,
              clientId,
              subscriptionId: sub.id,
              plan: { key: target.key, name: target.name },
              billingFrequency: body.billingFrequency,
              recurringAmountCents: amount,
              setupFeeCents: 0,
            });
            await recordSubscriptionEvent({
              clientId,
              subscriptionId: sub.id,
              type: "plan.change_requested",
              description: `Started checkout for ${target.name} (${body.billingFrequency}).`,
              actor: `client:${clientId}`,
            });
            return NextResponse.json({ ok: true, checkoutUrl: checkout?.url });
          }

          // Stripe not configured — manual/invoiced billing, reviewed by RSG.
          await submitReviewRequest("plan.change_requested");
          return NextResponse.json({ ok: true, requiresReview: true });
        }

        // Non-critical downgrade — takes effect after review at renewal.
        await submitReviewRequest("plan.downgrade_requested");
        return NextResponse.json({ ok: true, requiresReview: true });
      }

      case "request_cancellation": {
        const sub = await getActiveSubscriptionForClient(clientId);
        if (!sub) {
          return NextResponse.json(
            { error: "No active service plan found for your account." },
            { status: 404 }
          );
        }
        if (body.acknowledge !== true) {
          return NextResponse.json(
            {
              error: "Acknowledgement required.",
              code: "acknowledgement_required",
            },
            { status: 400 }
          );
        }

        const plan = await getPlanById(sub.planId);
        if (plan?.businessCritical) {
          // Never self-serve cancel business-critical infrastructure.
          await createServiceRequest({
            clientId,
            subscriptionId: sub.id,
            planKey: sub.planKey ?? null,
            type: "cancellation_request",
            title: `Cancellation request: ${plan.name}`,
            details: body.reason ?? "",
            acknowledgedConsequences: true,
            actorLabel: "client",
          });
          await recordSubscriptionEvent({
            clientId,
            subscriptionId: sub.id,
            type: "cancellation.requested",
            description:
              "Client requested cancellation of a business-critical plan — managed transition review required.",
            actor: `client:${clientId}`,
          });
          return NextResponse.json({ ok: true, requiresReview: true });
        }

        if (sub.stripeSubscriptionId && isStripeConfigured()) {
          try {
            await setStripeCancelAtPeriodEnd(sub.stripeSubscriptionId, true);
          } catch (err) {
            console.error("[portal-ms] Stripe cancellation failed.", err);
            return NextResponse.json(
              { error: "Billing update failed — no changes were made." },
              { status: 502 }
            );
          }
        }
        await updateSubscription(sub.id, {
          cancelAtPeriodEnd: true,
          status: "pending_cancellation",
          cancellationRequestedAt: new Date().toISOString(),
          cancellationReason: body.reason ?? null,
        });
        await createServiceRequest({
          clientId,
          subscriptionId: sub.id,
          planKey: sub.planKey ?? null,
          type: "cancellation_request",
          title: `Cancellation scheduled: ${plan?.name ?? sub.planName ?? "current plan"}`,
          details: body.reason ?? "",
          acknowledgedConsequences: true,
          actorLabel: "client",
        });
        await recordSubscriptionEvent({
          clientId,
          subscriptionId: sub.id,
          type: "cancellation.scheduled",
          description:
            "Cancellation scheduled for the end of the current billing period.",
          actor: `client:${clientId}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "approve_roadmap": {
        const roadmap = await getRoadmap(body.roadmapId);
        if (
          !roadmap ||
          roadmap.clientId !== clientId ||
          roadmap.status !== "proposed"
        ) {
          return NextResponse.json(
            { error: "This roadmap can no longer be approved." },
            { status: 400 }
          );
        }
        const updated = await approveRoadmap(
          body.roadmapId,
          `client:${session.email}`
        );
        await recordSubscriptionEvent({
          clientId,
          subscriptionId: roadmap.subscriptionId,
          type: "roadmap.approved",
          description: `Roadmap approved: ${roadmap.title}`,
          actor: `client:${clientId}`,
        });
        return NextResponse.json({ ok: true, roadmap: updated });
      }

      case "billing_portal": {
        const sub = await getActiveSubscriptionForClient(clientId);
        const customerId =
          sub?.stripeCustomerId ?? (await getClientStripeCustomerId(clientId));
        if (!customerId || !isStripeConfigured()) {
          return NextResponse.json(
            { error: "Online billing is not enabled for your account." },
            { status: 400 }
          );
        }
        const url = await createBillingPortalSession(customerId);
        if (!url) {
          return NextResponse.json(
            { error: "Could not open the billing portal. Please try again." },
            { status: 500 }
          );
        }
        return NextResponse.json({ ok: true, url });
      }
    }
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Please check the highlighted fields and try again." },
        { status: 400 }
      );
    }
    console.error("[portal-ms] request failed.", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
