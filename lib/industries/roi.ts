/**
 * ROI estimate math for the industry vertical calculators.
 *
 * Pure functions — safe on server and client. Every model is deliberately
 * conservative and every figure the visitor sees is labeled an estimate;
 * the calculator UI renders the vertical's disclaimer alongside results.
 *
 * Inputs come from the visitor's sliders; assumption rates come from the
 * vertical's admin-editable `roi.assumptions`. Rates are decimals
 * (0.25 = 25%); the visitor-facing percent inputs are whole numbers
 * (25 = 25%) and get divided down here.
 */

import type { RoiAssumption, RoiResultLine, VerticalSlug } from "./types";

export type RoiValues = Record<string, number>;

function rate(assumptions: RoiAssumption[], id: string, fallback: number): number {
  const found = assumptions.find((a) => a.id === id);
  const value = found?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pct(inputs: RoiValues, id: string): number {
  return (inputs[id] ?? 0) / 100;
}

function num(inputs: RoiValues, id: string): number {
  return inputs[id] ?? 0;
}

const round = (v: number) => Math.max(0, Math.round(v));

/**
 * Home services: missed calls, estimate follow-up, and maintenance plans.
 *
 * - Revenue lost to missed calls = leads × missed-call % × booking % × job value.
 * - Recoverable jobs assume only `missedCallRecovery` of missed callers can be
 *   caught with instant text-back, then book at the business's own rate.
 * - Estimate follow-up closes uncontacted estimates at the business's own
 *   close rate, dampened by `followUpDampener` (followed-up-late estimates
 *   close below fresh ones).
 * - Maintenance plans assume `maintenanceEnrollRate` of completed jobs enroll
 *   at `maintenancePlanValue` per year.
 * - Review lift is a count, not revenue: jobs × (target request rate − the
 *   business's current rate).
 */
function homeServicesRoi(inputs: RoiValues, assumptions: RoiAssumption[]): RoiResultLine[] {
  const leads = num(inputs, "monthlyLeads");
  const missed = pct(inputs, "missedCallPct");
  const booking = pct(inputs, "bookingRate");
  const jobValue = num(inputs, "avgJobValue");
  const estimateClose = pct(inputs, "estimateCloseRate");
  const uncontacted = num(inputs, "uncontactedEstimates");
  const monthlyJobs = num(inputs, "monthlyJobs");
  const reviewRate = pct(inputs, "reviewRequestRate");

  const recovery = rate(assumptions, "missedCallRecovery", 0.5);
  const followUpDampener = rate(assumptions, "followUpDampener", 0.6);
  const enrollRate = rate(assumptions, "maintenanceEnrollRate", 0.08);
  const planValue = rate(assumptions, "maintenancePlanValue", 348);
  const reviewTargetRate = rate(assumptions, "reviewTargetRate", 0.5);

  const lostMonthly = leads * missed * booking * jobValue;
  const recoveredJobs = leads * missed * recovery * booking;
  const followUpRevenue = uncontacted * estimateClose * followUpDampener * jobValue;
  const maintenanceAnnual = monthlyJobs * 12 * enrollRate * planValue;
  const additionalReviews = monthlyJobs * Math.max(0, reviewTargetRate - reviewRate);
  const annual = recoveredJobs * jobValue * 12 + followUpRevenue * 12 + maintenanceAnnual;

  return [
    {
      id: "lost-missed-calls",
      label: "Revenue lost to missed calls",
      value: round(lostMonthly),
      format: "currency",
      period: "monthly",
      detail: "Callers who never reached you, at your own booking rate and job value.",
    },
    {
      id: "recovered-jobs",
      label: "Additional booked jobs",
      value: Math.round(recoveredJobs * 10) / 10,
      format: "number",
      period: "monthly",
      detail: `Assumes ${Math.round(recovery * 100)}% of missed callers respond to an instant text-back.`,
    },
    {
      id: "estimate-follow-up",
      label: "Revenue recovered by estimate follow-up",
      value: round(followUpRevenue),
      format: "currency",
      period: "monthly",
      detail: `Uncontacted estimates closing at ${Math.round(followUpDampener * 100)}% of your normal close rate once follow-up is automatic.`,
    },
    {
      id: "maintenance",
      label: "Potential maintenance-plan revenue",
      value: round(maintenanceAnnual),
      format: "currency",
      period: "annual",
      detail: `Assumes ${Math.round(enrollRate * 100)}% of completed jobs enroll at ~$${Math.round(planValue)}/yr.`,
    },
    {
      id: "reviews",
      label: "Additional public reviews",
      value: Math.round(additionalReviews * 10) / 10,
      format: "number",
      period: "monthly",
      detail: `Automated requests at a ${Math.round(reviewTargetRate * 100)}% ask rate vs. your current ${Math.round(reviewRate * 100)}%.`,
    },
    {
      id: "annual-opportunity",
      label: "Estimated annual opportunity",
      value: round(annual),
      format: "currency",
      period: "annual",
    },
  ];
}

/**
 * Dental: booking-rate lift, no-show reduction, treatment plans, reactivation.
 */
function dentalRoi(inputs: RoiValues, assumptions: RoiAssumption[]): RoiResultLine[] {
  const inquiries = num(inputs, "monthlyInquiries");
  const booking = pct(inputs, "bookingRate");
  const patientValue = num(inputs, "newPatientValue");
  const noShows = num(inputs, "monthlyNoShows");
  const unscheduledPlans = num(inputs, "unscheduledPlans");
  const planValue = num(inputs, "avgPlanValue");
  const inactive = num(inputs, "inactivePatients");
  const reactivation = pct(inputs, "reactivationRate");

  const bookingLift = rate(assumptions, "bookingLift", 0.12);
  const noShowReduction = rate(assumptions, "noShowReduction", 0.3);
  const planAcceptRate = rate(assumptions, "planAcceptRate", 0.2);
  const reactivationLift = rate(assumptions, "reactivationLift", 0.06);
  const reactivatedValue = rate(assumptions, "reactivatedValue", 320);

  // Lift is applied to inquiries that currently do NOT book.
  const additionalAppointments = inquiries * (1 - booking) * bookingLift;
  const noShowRecovered = noShows * noShowReduction * patientValue;
  const planRevenue = unscheduledPlans * planAcceptRate * planValue;
  // Only count reactivations above what the practice already achieves.
  const incrementalReactivation = Math.max(0, reactivationLift - reactivation);
  const reactivationRevenue = inactive * incrementalReactivation * reactivatedValue;
  const annual =
    additionalAppointments * patientValue * 12 + noShowRecovered * 12 + planRevenue + reactivationRevenue;

  return [
    {
      id: "additional-appointments",
      label: "Additional appointments",
      value: Math.round(additionalAppointments * 10) / 10,
      format: "number",
      period: "monthly",
      detail: `Assumes ${Math.round(bookingLift * 100)}% of inquiries that currently slip away get booked with instant answers and online scheduling.`,
    },
    {
      id: "no-show-recovered",
      label: "Revenue recovered from reduced no-shows",
      value: round(noShowRecovered),
      format: "currency",
      period: "monthly",
      detail: `Assumes confirmations and waitlist backfill cut no-shows by ${Math.round(noShowReduction * 100)}%.`,
    },
    {
      id: "treatment-plans",
      label: "Potential treatment-plan revenue",
      value: round(planRevenue),
      format: "currency",
      period: "one-time",
      detail: `Assumes ${Math.round(planAcceptRate * 100)}% of the current unscheduled list schedules with structured follow-up.`,
    },
    {
      id: "reactivation",
      label: "Potential patient-reactivation revenue",
      value: round(reactivationRevenue),
      format: "currency",
      period: "annual",
      detail: `Assumes recall campaigns bring back ${Math.round(reactivationLift * 100)}% of inactive patients, counting only the lift above your current rate.`,
    },
    {
      id: "annual-opportunity",
      label: "Estimated annual opportunity",
      value: round(annual),
      format: "currency",
      period: "annual",
    },
  ];
}

/**
 * Retail: abandoned carts, repeat purchases, loyalty, and inventory loss.
 */
function retailRoi(inputs: RoiValues, assumptions: RoiAssumption[]): RoiResultLine[] {
  const online = num(inputs, "monthlyOnlineRevenue");
  const inStore = num(inputs, "monthlyStoreRevenue");
  const abandonRate = pct(inputs, "abandonedCartRate");
  const aov = num(inputs, "avgOrderValue");
  const customers = num(inputs, "activeCustomers");
  const repeatRate = pct(inputs, "repeatPurchaseRate");
  const locations = Math.max(1, num(inputs, "locations"));
  const inventoryLoss = pct(inputs, "inventoryLossRate");

  const cartRecovery = rate(assumptions, "cartRecoveryRate", 0.1);
  const repeatLift = rate(assumptions, "repeatLift", 0.05);
  const loyaltyLift = rate(assumptions, "loyaltyLift", 0.04);
  const lossReduction = rate(assumptions, "inventoryLossReduction", 0.25);
  const reportingHours = rate(assumptions, "reportingHoursPerLocation", 5);

  // If `online` is completed revenue and `abandonRate` of checkouts abandon,
  // abandoned value ≈ online × r/(1−r). Capped to avoid runaway at high rates.
  const safeAbandon = Math.min(abandonRate, 0.9);
  const abandonedValue = online * (safeAbandon / Math.max(1 - safeAbandon, 0.1));
  const recoveredCarts = abandonedValue * cartRecovery;
  // Lift applies to the customers who do NOT already repeat.
  const repeatRevenue = customers * Math.max(0, 1 - repeatRate) * repeatLift * aov;
  const loyaltyRevenue = customers * loyaltyLift * aov;
  const inventorySavings = (online + inStore) * 12 * inventoryLoss * lossReduction;
  const reportingSaved = locations * reportingHours;
  const annual = recoveredCarts * 12 + repeatRevenue + loyaltyRevenue + inventorySavings;

  return [
    {
      id: "recovered-carts",
      label: "Recoverable abandoned-cart revenue",
      value: round(recoveredCarts),
      format: "currency",
      period: "monthly",
      detail: `Assumes ${Math.round(cartRecovery * 100)}% of abandoned carts recover with timed reminders.`,
    },
    {
      id: "repeat-purchases",
      label: "Increased repeat-purchase revenue",
      value: round(repeatRevenue),
      format: "currency",
      period: "annual",
      detail: `Assumes ${Math.round(repeatLift * 100)}% of your one-time customers make one additional purchase per year.`,
    },
    {
      id: "loyalty",
      label: "Potential loyalty-program impact",
      value: round(loyaltyRevenue),
      format: "currency",
      period: "annual",
      detail: `Assumes ${Math.round(loyaltyLift * 100)}% of active customers add one order after joining the program.`,
    },
    {
      id: "inventory",
      label: "Potential inventory-loss reduction",
      value: round(inventorySavings),
      format: "currency",
      period: "annual",
      detail: `Assumes visibility and reorder alerts cut stockout/shrink losses by ${Math.round(lossReduction * 100)}%.`,
    },
    {
      id: "reporting-hours",
      label: "Manual reporting hours eliminated",
      value: Math.round(reportingSaved),
      format: "number",
      period: "monthly",
      detail: `~${Math.round(reportingHours)} hrs/location/month of spreadsheet consolidation replaced by unified reporting across ${Math.round(locations)} location${locations === 1 ? "" : "s"}.`,
    },
    {
      id: "annual-opportunity",
      label: "Estimated annual opportunity",
      value: round(annual),
      format: "currency",
      period: "annual",
    },
  ];
}

const COMPUTE: Record<VerticalSlug, (inputs: RoiValues, assumptions: RoiAssumption[]) => RoiResultLine[]> = {
  "home-services": homeServicesRoi,
  "dental-practices": dentalRoi,
  retail: retailRoi,
};

export function computeRoi(
  slug: VerticalSlug,
  inputs: RoiValues,
  assumptions: RoiAssumption[]
): RoiResultLine[] {
  const fn = COMPUTE[slug];
  return fn ? fn(inputs, assumptions) : [];
}

export function formatRoiValue(line: RoiResultLine): string {
  if (line.format === "currency") {
    return `$${Math.round(line.value).toLocaleString("en-US")}`;
  }
  return line.value.toLocaleString("en-US");
}
