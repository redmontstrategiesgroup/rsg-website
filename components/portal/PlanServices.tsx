"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wrench,
  LifeBuoy,
  CalendarCheck,
  ArrowUpRight,
  PlusCircle,
  FileText,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Map as MapIcon,
  CreditCard,
} from "lucide-react";
import type { ClientPublic } from "@/lib/types";
import type { PortalManagedData } from "@/lib/managed-services/portal-data";
import type {
  ClientRoadmap,
  ManagedServicePlan,
  RoadmapItem,
  RoadmapItemKind,
  ServiceRequest,
  ServiceRequestStatus,
  SubscriptionStatus,
} from "@/lib/managed-services/types";
import {
  SERVICE_REQUEST_TYPE_LABELS,
  type ServiceRequestType,
} from "@/lib/managed-services/types";
import {
  annualPriceCents,
  formatCents,
  formatMonthlyPrice,
} from "@/lib/managed-services/content";
import { postJson } from "@/lib/api";

/* ----------------------------- display maps ---------------------------- */

const SUB_STATUS_PILL: Record<
  SubscriptionStatus,
  { classes: string; label: string }
> = {
  active: { classes: "bg-emerald-400/10 text-emerald-300", label: "Active" },
  past_due: { classes: "bg-amber-400/10 text-amber-300", label: "Past due" },
  paused: { classes: "bg-white/[0.06] text-white/50", label: "Paused" },
  pending_cancellation: {
    classes: "bg-crimson/15 text-crimson-light",
    label: "Pending cancellation",
  },
  cancelled: { classes: "bg-crimson/15 text-crimson-light", label: "Cancelled" },
  pending: { classes: "bg-white/[0.06] text-white/50", label: "Pending" },
  awaiting_payment: {
    classes: "bg-white/[0.06] text-white/50",
    label: "Awaiting payment",
  },
};

const REQUEST_STATUS_PILL: Record<
  ServiceRequestStatus,
  { classes: string; label: string }
> = {
  new: { classes: "bg-sky-400/10 text-sky-300", label: "New" },
  in_review: { classes: "bg-amber-400/10 text-amber-300", label: "In review" },
  approved: { classes: "bg-emerald-400/10 text-emerald-300", label: "Approved" },
  scheduled: { classes: "bg-sky-400/10 text-sky-300", label: "Scheduled" },
  in_progress: {
    classes: "bg-amber-400/10 text-amber-300",
    label: "In progress",
  },
  waiting_on_client: {
    classes: "bg-crimson/15 text-crimson-light",
    label: "Waiting on you",
  },
  completed: { classes: "bg-emerald-400/10 text-emerald-300", label: "Completed" },
  declined: { classes: "bg-white/[0.06] text-white/50", label: "Declined" },
};

const INCLUSION_BADGE: Record<string, { classes: string; label: string }> = {
  included: { classes: "bg-emerald-400/10 text-emerald-300", label: "Included" },
  needs_approval: {
    classes: "bg-amber-400/10 text-amber-300",
    label: "Needs approval",
  },
  extra_charge: {
    classes: "bg-crimson/15 text-crimson-light",
    label: "May carry an additional charge",
  },
  pending_assessment: {
    classes: "bg-white/[0.06] text-white/50",
    label: "Pending assessment",
  },
};

const ROADMAP_KIND_LABELS: Record<RoadmapItemKind, string> = {
  current_system: "Current systems",
  problem: "Problems",
  completed: "Completed",
  planned: "Planned",
  automation: "Automations",
  ai_opportunity: "AI opportunities",
  security: "Security",
  integration: "Integrations",
};

const ROADMAP_KIND_ORDER: RoadmapItemKind[] = [
  "current_system",
  "problem",
  "completed",
  "planned",
  "automation",
  "ai_opportunity",
  "security",
  "integration",
];

/** The types a client can pick in the request modal. */
const MODAL_REQUEST_TYPES: ServiceRequestType[] = [
  "technical_issue",
  "website_change",
  "crm_change",
  "automation_request",
  "ai_knowledge_update",
  "new_integration",
  "reporting_request",
  "security_concern",
  "infrastructure_issue",
  "strategy_request",
  "additional_work",
];

const OPEN_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "new",
  "in_review",
  "approved",
  "scheduled",
  "in_progress",
  "waiting_on_client",
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function inclusionNote(inclusion: string | undefined, slaHours: number): string {
  switch (inclusion) {
    case "included":
      return `Included in your plan — response expected within ${slaHours} business hours.`;
    case "needs_approval":
      return "Requires approval before work begins.";
    case "extra_charge":
      return "May carry an additional charge — we'll confirm before any work starts.";
    default:
      return "We'll assess this request and confirm scope before any work starts.";
  }
}

const inputClasses =
  "w-full rounded-lg border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none";

const labelClasses =
  "font-mono text-[0.58rem] uppercase tracking-label text-white/40";

/* ------------------------------- component ----------------------------- */

type ModalState =
  | { kind: "request"; presetType: ServiceRequestType }
  | { kind: "plan"; presetPlanKey?: string }
  | null;

export function PlanServices({
  client,
  data,
}: {
  client: ClientPublic;
  data: PortalManagedData | null;
}) {
  const [requests, setRequests] = useState<ServiceRequest[]>(
    data?.requests ?? []
  );
  const [roadmaps, setRoadmaps] = useState<ClientRoadmap[]>(
    data?.roadmaps ?? []
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [billingBanner, setBillingBanner] = useState<
    "success" | "cancelled" | null
  >(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing === "success" || billing === "cancelled") {
      setBillingBanner(billing);
    }
  }, []);

  const sub = data?.subscription ?? null;
  const plan = data?.plan ?? null;
  const usage = data?.usage ?? null;

  const openRequests = useMemo(
    () => requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status)),
    [requests]
  );
  const latestReportId = data?.reports[0]?.id ?? null;
  const latestRoadmap = roadmaps[0] ?? null;

  async function openBillingPortal() {
    setBillingPortalLoading(true);
    setBillingPortalError("");
    try {
      const res = await postJson("/api/portal/managedservices", {
        action: "billing_portal",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (res.ok && json.url) {
        window.location.assign(json.url);
        return;
      }
      setBillingPortalError(
        json.error ?? "Could not open the billing portal. Please try again."
      );
    } catch {
      setBillingPortalError(
        "Could not open the billing portal. Please try again."
      );
    }
    setBillingPortalLoading(false);
  }

  const handleRequestCreated = useCallback((created: ServiceRequest) => {
    setRequests((prev) => [created, ...prev]);
  }, []);

  const handleRoadmapApproved = useCallback((updated: ClientRoadmap) => {
    setRoadmaps((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  }, []);

  return (
    <div className="space-y-8">
      {/* Billing return banners */}
      {billingBanner === "success" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
          Payment received — your plan is being activated.
        </div>
      )}
      {billingBanner === "cancelled" && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          <AlertTriangle size={16} className="shrink-0 text-amber-300" />
          Checkout was cancelled — no changes made.
        </div>
      )}

      {/* Pending proposals */}
      {data && data.pendingProposals.length > 0 && (
        <div className="space-y-3">
          {data.pendingProposals.map((p) => (
            <Link
              key={p.id}
              href={`/proposal/${p.token}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-crimson/30 bg-crimson/[0.07] p-4 transition-colors hover:border-crimson/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crimson/30 bg-crimson/15 text-crimson-light">
                  <FileText size={15} />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">
                    A proposal is waiting for your review
                  </p>
                  <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/45">
                    {p.title}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={16}
                className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2.5">
        <ActionButton
          icon={Wrench}
          label="Request a system change"
          onClick={() => setModal({ kind: "request", presetType: "website_change" })}
        />
        <ActionButton
          icon={LifeBuoy}
          label="Submit a support ticket"
          onClick={() =>
            setModal({ kind: "request", presetType: "technical_issue" })
          }
        />
        <Link
          href="/book"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition-colors hover:border-white/30 hover:text-white"
        >
          <CalendarCheck size={15} className="text-crimson-light" />
          Schedule a review
        </Link>
        {sub && (
          <ActionButton
            icon={ArrowUpRight}
            label="Upgrade plan"
            onClick={() => setModal({ kind: "plan" })}
          />
        )}
        <ActionButton
          icon={PlusCircle}
          label="Request additional work"
          onClick={() =>
            setModal({ kind: "request", presetType: "additional_work" })
          }
        />
        {latestReportId && (
          <Link
            href={`/portal/reports/${latestReportId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition-colors hover:border-white/30 hover:text-white"
          >
            <FileText size={15} className="text-crimson-light" />
            View monthly report
          </Link>
        )}
      </div>

      {/* Current plan */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="card p-6"
        >
          {sub && plan ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={labelClasses}>Current plan</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                    {plan.name}
                  </h2>
                  <p className="mt-1.5 max-w-md text-sm text-white/55">
                    {plan.tagline}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 font-mono text-[0.54rem] uppercase tracking-label ${SUB_STATUS_PILL[sub.status].classes}`}
                >
                  {SUB_STATUS_PILL[sub.status].label}
                </span>
              </div>

              <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
                <PlanFact
                  label="Billing"
                  value={
                    sub.billingFrequency === "annual"
                      ? "Annual"
                      : "Monthly"
                  }
                />
                <PlanFact
                  label="Renews"
                  value={formatDate(sub.currentPeriodEnd)}
                />
                <PlanFact
                  label="Price"
                  value={
                    sub.billingFrequency === "annual"
                      ? sub.annualPriceCents != null
                        ? `${formatCents(sub.annualPriceCents)}/yr`
                        : formatMonthlyPrice(plan)
                      : sub.monthlyPriceCents > 0
                        ? `${formatCents(sub.monthlyPriceCents)}/mo`
                        : formatMonthlyPrice(plan)
                  }
                />
                <PlanFact
                  label="Support"
                  value={`${plan.supportLevel} · ${plan.responseTime}`}
                />
                {sub.accountManager && (
                  <PlanFact label="Account manager" value={sub.accountManager} />
                )}
                {sub.technicalOwner && (
                  <PlanFact label="Technical owner" value={sub.technicalOwner} />
                )}
                {sub.paymentMethodSummary && (
                  <PlanFact
                    label="Payment method"
                    value={sub.paymentMethodSummary}
                  />
                )}
              </dl>

              {plan.features.length > 0 && (
                <div className="mt-5 border-t border-white/[0.06] pt-5">
                  <p className={labelClasses}>What&apos;s included</p>
                  <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {plan.features.slice(0, 8).map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-white/60"
                      >
                        <ShieldCheck
                          size={13}
                          className="mt-0.5 shrink-0 text-crimson-light"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.features.length > 8 && (
                    <p className="mt-2 text-[0.72rem] text-white/35">
                      + {plan.features.length - 8} more inclusions in your
                      agreement
                    </p>
                  )}
                </div>
              )}

              {data?.billingPortalAvailable && (
                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <button
                    onClick={openBillingPortal}
                    disabled={billingPortalLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
                  >
                    <CreditCard size={15} className="text-crimson-light" />
                    {billingPortalLoading ? "Opening…" : "Manage billing"}
                  </button>
                  {billingPortalError && (
                    <p className="mt-2 text-sm text-crimson-light">
                      {billingPortalError}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="py-4 text-center sm:py-6">
              <p className="font-display text-lg font-semibold text-white/85">
                No management plan yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
                Your systems aren&apos;t under active management. A managed plan
                keeps them secure, updated, monitored, and improving every
                month — with everything logged right here in your portal.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/book" className="btn-primary text-sm">
                  Talk through ongoing management
                </Link>
              </div>
            </div>
          )}
        </motion.div>

        <div className="space-y-4">
          {/* Hours meter */}
          {usage && usage.includedHours != null && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="card p-6"
            >
              <div className="flex items-center justify-between">
                <p className={labelClasses}>Service hours</p>
                <Clock size={14} className="text-crimson-light" />
              </div>
              <p className="mt-3 font-display text-xl font-semibold text-white">
                {usage.usedHours} of {usage.includedHours} hours used this
                period
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      100,
                      usage.includedHours > 0
                        ? (usage.usedHours / usage.includedHours) * 100
                        : 0
                    )}%`,
                  }}
                  transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${
                    usage.overLimit
                      ? "bg-red-400"
                      : usage.approachingLimit
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
              </div>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-white/40">
                {usage.overLimit
                  ? "You've used all included hours this period — we'll confirm before any additional-rate work."
                  : usage.approachingLimit
                    ? "You're approaching your included hours for this period."
                    : "Routine monitoring, backups, and updates never consume your hours."}
              </p>
            </motion.div>
          )}

          {/* Upgrade recommendations */}
          {sub &&
            data &&
            data.upgradeRecommendations.map((rec, i) => {
              const target = data.availablePlans.find(
                (p) => p.key === rec.targetPlanKey
              );
              return (
                <motion.div
                  key={rec.targetPlanKey}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.1 + i * 0.06,
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="card p-6"
                >
                  <p className={labelClasses}>A note from your team</p>
                  <h3 className="mt-2 font-display text-[0.98rem] font-semibold text-white">
                    {rec.headline}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {rec.reason}
                  </p>
                  {target && (
                    <button
                      onClick={() =>
                        setModal({ kind: "plan", presetPlanKey: target.key })
                      }
                      className="mt-4 inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-label text-crimson-light transition-colors hover:text-white"
                    >
                      Explore {target.name}
                      <ChevronRight size={12} />
                    </button>
                  )}
                </motion.div>
              );
            })}
        </div>
      </div>

      {/* Systems under management */}
      {client.systems.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">
              Systems under management
            </h2>
            <span className={labelClasses}>{client.systems.length} systems</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {client.systems.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Zap size={13} className="shrink-0 text-crimson-light" />
                  <p className="truncate text-sm font-medium text-white">
                    {s.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 font-mono text-[0.56rem] uppercase tracking-label">
                  <span className="text-white/45">{s.uptime}% uptime</span>
                  <span
                    className={
                      s.status === "live"
                        ? "text-emerald-300"
                        : s.status === "optimizing"
                          ? "text-amber-300"
                          : s.status === "building"
                            ? "text-sky-300"
                            : "text-white/50"
                    }
                  >
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open requests */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">
            Open requests
          </h2>
          <span className={labelClasses}>{openRequests.length} open</span>
        </div>
        {openRequests.length === 0 ? (
          <p className="mt-5 text-sm text-white/40">
            No open requests. Use the buttons above to request changes, report
            issues, or ask for new work.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {openRequests.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{r.title}</p>
                    <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-label text-white/40">
                      {SERVICE_REQUEST_TYPE_LABELS[r.type]} · submitted{" "}
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${INCLUSION_BADGE[r.inclusion]?.classes ?? INCLUSION_BADGE.pending_assessment.classes}`}
                    >
                      {INCLUSION_BADGE[r.inclusion]?.label ?? "Pending assessment"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${REQUEST_STATUS_PILL[r.status].classes}`}
                    >
                      {REQUEST_STATUS_PILL[r.status].label}
                    </span>
                  </div>
                </div>
                {r.responseDueAt && (
                  <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-white/45">
                    <Clock size={11} className="text-crimson-light" />
                    Response expected by {formatDate(r.responseDueAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent maintenance */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-white">
            Recent maintenance
          </h2>
          {!data || data.maintenance.length === 0 ? (
            <p className="mt-5 text-sm text-white/40">
              Maintenance work performed on your systems will be logged here.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.maintenance.slice(0, 8).map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{m.title}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-label text-white/40">
                        {m.category}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                      {formatDate(m.performedAt)}
                      {m.hoursSpent > 0 && ` · ${m.hoursSpent}h`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Reports */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-white">
            Reports
          </h2>
          {!data || data.reports.length === 0 ? (
            <p className="mt-5 text-sm text-white/40">
              Your monthly and health reports will be published here.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.reports.map((rep) => (
                <li
                  key={rep.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
                      <FileText size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {rep.title}
                      </p>
                      <p className="font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                        {rep.kind} · {formatDate(rep.publishedAt ?? rep.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/portal/reports/${rep.id}`}
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.56rem] uppercase tracking-label text-white/40 transition-colors hover:text-white"
                  >
                    View report
                    <ChevronRight size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Roadmap */}
      {latestRoadmap && (
        <RoadmapCard
          roadmap={latestRoadmap}
          onApproved={handleRoadmapApproved}
        />
      )}

      {/* Billing history */}
      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Billing history
        </h2>
        {data && data.invoices.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  <th className="px-4 py-3 font-normal">Invoice</th>
                  <th className="px-4 py-3 font-normal">Amount</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Issued</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const link = inv.hostedInvoiceUrl || inv.invoicePdfUrl;
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-white/[0.06] last:border-0"
                    >
                      <td className="px-4 py-3.5 text-white/80">
                        {inv.invoiceNumber || inv.description || "Invoice"}
                      </td>
                      <td className="px-4 py-3.5 text-white/80">
                        {formatCents(inv.amountDueCents)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
                            inv.status === "paid"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : inv.status === "open"
                                ? "bg-amber-400/10 text-amber-300"
                                : "bg-white/[0.06] text-white/50"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-white/60">
                        {formatDate(inv.issuedAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[0.56rem] uppercase tracking-label text-white/40 transition-colors hover:text-white"
                          >
                            <ExternalLink size={12} />
                            Invoice
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : client.invoices.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                  <th className="px-4 py-3 font-normal">Invoice</th>
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Amount</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {client.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-white/[0.06] last:border-0"
                  >
                    <td className="px-4 py-3.5 font-mono text-white/80">
                      {inv.id}
                    </td>
                    <td className="px-4 py-3.5 text-white/60">{inv.date}</td>
                    <td className="px-4 py-3.5 text-white/80">
                      ${inv.amount.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
                          inv.status === "Paid"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : inv.status === "Due"
                              ? "bg-crimson/15 text-crimson-light"
                              : "bg-white/[0.06] text-white/50"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 text-sm text-white/40">
            No invoices yet. Your billing history will appear here once your
            plan is active.
          </p>
        )}
      </div>

      {/* Modals */}
      {modal?.kind === "request" && data && (
        <RequestModal
          data={data}
          presetType={modal.presetType}
          onClose={() => setModal(null)}
          onCreated={handleRequestCreated}
        />
      )}
      {modal?.kind === "plan" && data && sub && plan && (
        <PlanChangeModal
          data={data}
          currentPlan={plan}
          presetPlanKey={modal.presetPlanKey}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------- small components -------------------------- */

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Wrench;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition-colors hover:border-white/30 hover:text-white"
    >
      <Icon size={15} className="text-crimson-light" />
      {label}
    </button>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={labelClasses}>{label}</dt>
      <dd className="mt-1 text-sm text-white/80">{value}</dd>
    </div>
  );
}

/* ------------------------------- roadmap ------------------------------- */

function RoadmapCard({
  roadmap,
  onApproved,
}: {
  roadmap: ClientRoadmap;
  onApproved: (updated: ClientRoadmap) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [approvedNow, setApprovedNow] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<RoadmapItemKind, RoadmapItem[]>();
    for (const item of roadmap.items) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return ROADMAP_KIND_ORDER.filter((k) => map.has(k)).map((k) => ({
      kind: k,
      items: map.get(k)!,
    }));
  }, [roadmap.items]);

  async function approve() {
    setApproving(true);
    setError("");
    try {
      const res = await postJson("/api/portal/managedservices", {
        action: "approve_roadmap",
        roadmapId: roadmap.id,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        roadmap?: ClientRoadmap;
        error?: string;
      };
      if (res.ok && json.roadmap) {
        onApproved(json.roadmap);
        setApprovedNow(true);
      } else {
        setError(json.error ?? "Could not approve the roadmap. Please try again.");
      }
    } catch {
      setError("Could not approve the roadmap. Please try again.");
    }
    setApproving(false);
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-crimson-light">
            <MapIcon size={15} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {roadmap.title || "Technology roadmap"}
            </h2>
            {roadmap.periodLabel && (
              <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/40">
                {roadmap.periodLabel}
              </p>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-mono text-[0.54rem] uppercase tracking-label ${
            roadmap.status === "approved" || roadmap.status === "completed"
              ? "bg-emerald-400/10 text-emerald-300"
              : roadmap.status === "in_progress"
                ? "bg-amber-400/10 text-amber-300"
                : roadmap.status === "proposed"
                  ? "bg-crimson/15 text-crimson-light"
                  : "bg-white/[0.06] text-white/50"
          }`}
        >
          {roadmap.status.replaceAll("_", " ")}
        </span>
      </div>

      {roadmap.summary && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
          {roadmap.summary}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {grouped.map(({ kind, items }) => (
          <div key={kind}>
            <p className={labelClasses}>{ROADMAP_KIND_LABELS[kind]}</p>
            <div className="mt-2.5 space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[0.52rem] uppercase tracking-label ${
                        item.status === "done" || item.status === "approved"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : item.status === "in_progress"
                            ? "bg-amber-400/10 text-amber-300"
                            : item.status === "deferred"
                              ? "bg-white/[0.06] text-white/50"
                              : "bg-sky-400/10 text-sky-300"
                      }`}
                    >
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {item.detail && (
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                      {item.detail}
                    </p>
                  )}
                  {(item.impact || item.timeline) && (
                    <p className="mt-2 font-mono text-[0.56rem] uppercase tracking-label text-white/40">
                      {[item.impact, item.timeline].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {roadmap.status === "proposed" && (
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <button
            onClick={approve}
            disabled={approving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve this roadmap phase"}
          </button>
          {error && <p className="mt-2 text-sm text-crimson-light">{error}</p>}
        </div>
      )}
      {approvedNow && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 size={15} />
          Roadmap approved — we&apos;ll schedule the work and keep you posted
          here.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- modal scaffold ---------------------------- */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        tabIndex={-1}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-base p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-white">
            {title}
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.03] text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  );
}

/* ---------------------------- request modal ----------------------------- */

function RequestModal({
  data,
  presetType,
  onClose,
  onCreated,
}: {
  data: PortalManagedData;
  presetType: ServiceRequestType;
  onClose: () => void;
  onCreated: (r: ServiceRequest) => void;
}) {
  const [type, setType] = useState<ServiceRequestType>(presetType);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please add a short title for your request.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await postJson("/api/portal/managedservices", {
        action: "create_request",
        type,
        title: title.trim(),
        details: details.trim() || undefined,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        request?: ServiceRequest;
        error?: string;
      };
      if (res.ok && json.request) {
        onCreated(json.request);
        setDone(true);
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <ModalShell title="Request received" onClose={onClose}>
        <div className="py-2 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-300" />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Your request is in. {inclusionNote(data.inclusionByType[type], data.slaHours)}
          </p>
          <button onClick={onClose} className="btn-ghost mt-6 text-sm">
            Back to your portal
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Submit a request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ms-request-type" className={labelClasses}>
            Request type
          </label>
          <select
            id="ms-request-type"
            value={type}
            onChange={(e) => setType(e.target.value as ServiceRequestType)}
            className={`${inputClasses} mt-2 appearance-none`}
          >
            {MODAL_REQUEST_TYPES.map((t) => (
              <option key={t} value={t} className="bg-base text-white">
                {SERVICE_REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ms-request-title" className={labelClasses}>
            Title
          </label>
          <input
            id="ms-request-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            placeholder="What do you need?"
            className={`${inputClasses} mt-2`}
          />
        </div>
        <div>
          <label htmlFor="ms-request-details" className={labelClasses}>
            Details
          </label>
          <textarea
            id="ms-request-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="Anything that helps us scope it — links, examples, urgency."
            className={`${inputClasses} mt-2 resize-y`}
          />
        </div>

        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[0.78rem] leading-relaxed text-white/55">
          {inclusionNote(data.inclusionByType[type], data.slaHours)}
        </p>

        {error && <p className="text-sm text-crimson-light">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* --------------------------- plan-change modal -------------------------- */

function PlanChangeModal({
  data,
  currentPlan,
  presetPlanKey,
  onClose,
}: {
  data: PortalManagedData;
  currentPlan: ManagedServicePlan;
  presetPlanKey?: string;
  onClose: () => void;
}) {
  const preset =
    data.availablePlans.find((p) => p.key === presetPlanKey) ?? null;
  const [selectedId, setSelectedId] = useState<string>(
    preset?.id ?? currentPlan.id
  );
  const [frequency, setFrequency] = useState<"monthly" | "annual">(
    data.subscription?.billingFrequency ?? "monthly"
  );
  const [note, setNote] = useState("");
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [ackEnd, setAckEnd] = useState(false);
  const [ackCritical, setAckCritical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCopy, setSuccessCopy] = useState("");

  const target = data.availablePlans.find((p) => p.id === selectedId) ?? null;
  const isDowngrade = target ? target.tierRank < currentPlan.tierRank : false;
  const criticalDowngrade = currentPlan.businessCritical && isDowngrade;
  const criticalCancellation = currentPlan.businessCritical && showCancellation;

  async function submitPlanChange() {
    if (!target || target.id === currentPlan.id) {
      setError("Choose a different plan to continue.");
      return;
    }
    if (criticalDowngrade && !ackCritical) {
      setError("Please acknowledge the managed transition to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await postJson("/api/portal/managedservices", {
        action: "request_plan_change",
        planId: target.id,
        billingFrequency: frequency,
        note: note.trim() || undefined,
        ...(criticalDowngrade ? { acknowledge: true } : {}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        requiresReview?: boolean;
        checkoutUrl?: string;
        error?: string;
      };
      if (res.ok && json.checkoutUrl) {
        window.location.assign(json.checkoutUrl);
        return;
      }
      if (res.ok && json.requiresReview) {
        setSuccessCopy(
          "Request received — your account manager will follow up."
        );
      } else if (res.ok && json.ok) {
        setSuccessCopy("Plan updated.");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  async function submitCancellation() {
    if (!ackEnd || (criticalCancellation && !ackCritical)) {
      setError("Please confirm the acknowledgements to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await postJson("/api/portal/managedservices", {
        action: "request_cancellation",
        reason: cancelReason.trim() || undefined,
        acknowledge: true,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        requiresReview?: boolean;
        error?: string;
      };
      if (res.ok && json.requiresReview) {
        setSuccessCopy(
          "Request received — your account manager will follow up about a managed transition."
        );
      } else if (res.ok && json.ok) {
        setSuccessCopy(
          "Cancellation scheduled — your plan stays fully active until the end of the current billing period."
        );
        setTimeout(() => window.location.reload(), 1600);
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  if (successCopy) {
    return (
      <ModalShell title="All set" onClose={onClose}>
        <div className="py-2 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-300" />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            {successCopy}
          </p>
          <button onClick={onClose} className="btn-ghost mt-6 text-sm">
            Back to your portal
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={showCancellation ? "Request cancellation" : "Change your plan"}
      onClose={onClose}
    >
      {!showCancellation ? (
        <div className="space-y-4">
          <fieldset>
            <legend className={labelClasses}>Choose a plan</legend>
            <div className="mt-2.5 space-y-2.5">
              {data.availablePlans.map((p) => {
                const selected = p.id === selectedId;
                const isCurrent = p.id === currentPlan.id;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      selected
                        ? "border-crimson/60 bg-crimson/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ms-plan"
                      value={p.id}
                      checked={selected}
                      onChange={() => setSelectedId(p.id)}
                      className="mt-1 accent-[#e11d48]"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {p.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-label text-white/50">
                            Current
                          </span>
                        )}
                        <span className="font-mono text-[0.6rem] uppercase tracking-label text-crimson-light">
                          {formatMonthlyPrice(p)}
                        </span>
                      </span>
                      <span className="mt-1 block text-[0.8rem] leading-relaxed text-white/50">
                        {p.tagline}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="ms-plan-frequency" className={labelClasses}>
              Billing frequency
            </label>
            <select
              id="ms-plan-frequency"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value === "annual" ? "annual" : "monthly")
              }
              className={`${inputClasses} mt-2 appearance-none`}
            >
              <option value="monthly" className="bg-base text-white">
                Monthly
              </option>
              <option value="annual" className="bg-base text-white">
                Annual
                {target && annualPriceCents(target) != null
                  ? ` — ${formatCents(annualPriceCents(target)!)}/yr`
                  : ""}
              </option>
            </select>
          </div>

          <div>
            <label htmlFor="ms-plan-note" className={labelClasses}>
              Note (optional)
            </label>
            <textarea
              id="ms-plan-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Anything we should know about this change?"
              className={`${inputClasses} mt-2 resize-y`}
            />
          </div>

          {criticalDowngrade && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-4 text-[0.8rem] leading-relaxed text-white/70">
              <input
                type="checkbox"
                checked={ackCritical}
                onChange={(e) => setAckCritical(e.target.checked)}
                className="mt-0.5 accent-[#e11d48]"
              />
              I understand this system is business-critical and RSG will
              contact me about a managed transition before any change takes
              effect.
            </label>
          )}

          {error && <p className="text-sm text-crimson-light">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowCancellation(true);
              }}
              className="font-mono text-[0.58rem] uppercase tracking-label text-white/35 transition-colors hover:text-white/70"
            >
              Request cancellation
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPlanChange}
                disabled={
                  submitting ||
                  !target ||
                  target.id === currentPlan.id ||
                  (criticalDowngrade && !ackCritical)
                }
                className="btn-primary text-sm disabled:opacity-50"
              >
                {submitting
                  ? "Submitting…"
                  : criticalDowngrade || isDowngrade
                    ? "Request change"
                    : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-white/55">
            We&apos;re sorry to see you thinking about it. Cancellation takes
            effect at the close of your current billing period
            {currentPlan.businessCritical
              ? ", and business-critical systems always get a managed transition plan first"
              : ""}
            .
          </p>
          <div>
            <label htmlFor="ms-cancel-reason" className={labelClasses}>
              What&apos;s prompting this? (optional)
            </label>
            <textarea
              id="ms-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={2000}
              rows={3}
              className={`${inputClasses} mt-2 resize-y`}
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[0.8rem] leading-relaxed text-white/70">
            <input
              type="checkbox"
              checked={ackEnd}
              onChange={(e) => setAckEnd(e.target.checked)}
              className="mt-0.5 accent-[#e11d48]"
            />
            I understand what&apos;s included in my plan ends at the close of
            the billing period.
          </label>

          {criticalCancellation && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-4 text-[0.8rem] leading-relaxed text-white/70">
              <input
                type="checkbox"
                checked={ackCritical}
                onChange={(e) => setAckCritical(e.target.checked)}
                className="mt-0.5 accent-[#e11d48]"
              />
              I understand this system is business-critical and RSG will
              contact me about a managed transition before any change takes
              effect.
            </label>
          )}

          {error && <p className="text-sm text-crimson-light">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowCancellation(false);
              }}
              className="font-mono text-[0.58rem] uppercase tracking-label text-white/35 transition-colors hover:text-white/70"
            >
              Back to plan options
            </button>
            <button
              type="button"
              onClick={submitCancellation}
              disabled={
                submitting || !ackEnd || (criticalCancellation && !ackCritical)
              }
              className="btn-primary text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit cancellation request"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
