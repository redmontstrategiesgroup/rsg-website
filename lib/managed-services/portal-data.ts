/**
 * Portal-facing managed-services data assembly (server-only).
 *
 * Gathers everything the "Plan & Services" portal tab needs in one call so
 * the page loader can pass a single serializable payload to the client
 * component. Never import from client components — this pulls in node:fs
 * via the store.
 */

import {
  getActiveSubscriptionForClient,
  getClientStripeCustomerId,
  getHoursUsage,
  getPlanById,
  getUpgradeRecommendations,
  listInvoices,
  listMaintenanceLogs,
  listPlans,
  listRoadmaps,
  listServiceReports,
  listServiceRequests,
  requestInclusionFor,
  responseSlaHours,
} from "./store";
import { listProposals } from "./proposals";
import { isStripeConfigured } from "./billing";
import { SERVICE_REQUEST_TYPES } from "./types";
import type {
  ClientRoadmap,
  ClientSubscription,
  HoursUsage,
  MaintenanceLog,
  ManagedServicePlan,
  ServiceReport,
  ServiceRequest,
  SubscriptionInvoice,
  UpgradeRecommendation,
} from "./types";

export type PortalManagedData = {
  subscription: ClientSubscription | null;
  plan: ManagedServicePlan | null;
  availablePlans: ManagedServicePlan[];
  usage: HoursUsage | null;
  requests: ServiceRequest[];
  maintenance: MaintenanceLog[];
  reports: ServiceReport[];
  roadmaps: ClientRoadmap[];
  invoices: SubscriptionInvoice[];
  upgradeRecommendations: UpgradeRecommendation[];
  pendingProposals: { id: string; token: string; title: string; kind: string }[];
  inclusionByType: Record<string, string>;
  slaHours: number;
  stripeConfigured: boolean;
  billingPortalAvailable: boolean;
};

export async function getPortalManagedData(
  clientId: string
): Promise<PortalManagedData> {
  const subscription = await getActiveSubscriptionForClient(clientId);
  const plan = subscription ? await getPlanById(subscription.planId) : null;

  const [
    availablePlans,
    usage,
    requests,
    maintenance,
    reports,
    roadmaps,
    invoices,
    upgradeRecommendations,
    proposals,
  ] = await Promise.all([
    listPlans(),
    subscription ? getHoursUsage(subscription) : Promise.resolve(null),
    listServiceRequests({ clientId, limit: 50 }),
    listMaintenanceLogs({ clientId, visibleToClientOnly: true, limit: 30 }),
    listServiceReports({ clientId, publishedOnly: true }),
    listRoadmaps({ clientId }),
    listInvoices({ clientId }),
    getUpgradeRecommendations(clientId, subscription),
    listProposals({ clientId, statuses: ["sent", "viewed"] }),
  ]);

  const inclusionByType = Object.fromEntries(
    SERVICE_REQUEST_TYPES.map((t) => [
      t,
      requestInclusionFor(t, subscription?.planKey),
    ])
  );

  const stripeConfigured = isStripeConfigured();
  const billingPortalAvailable =
    stripeConfigured &&
    Boolean(
      subscription?.stripeCustomerId ?? (await getClientStripeCustomerId(clientId))
    );

  return {
    // adminNotes are internal commentary — never serialize them to clients.
    subscription: subscription ? { ...subscription, adminNotes: "" } : null,
    plan,
    availablePlans,
    usage,
    requests: requests.map((r) => ({ ...r, adminNotes: "" })),
    maintenance,
    reports,
    roadmaps,
    invoices,
    upgradeRecommendations,
    pendingProposals: proposals.map((p) => ({
      id: p.id,
      token: p.token,
      title: p.title,
      kind: p.kind,
    })),
    inclusionByType,
    slaHours: responseSlaHours(subscription?.planKey),
    stripeConfigured,
    billingPortalAvailable,
  };
}
