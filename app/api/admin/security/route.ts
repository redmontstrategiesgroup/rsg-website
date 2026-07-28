import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
  type AdminContext,
} from "@/lib/admin-auth";
import { can, type SchedulingPermission } from "@/lib/scheduling/permissions";
import { clientIp } from "@/lib/security";
import { writeAuditEvent, listAuditEvents } from "@/lib/audit";
import { listAdmins } from "@/lib/store";
import { ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/types";
import { buildSecurityOverview } from "@/lib/security-center/overview";
import {
  createApproval,
  createIncident,
  getSecuritySettings,
  listApprovals,
  listIncidents,
  listRetentionRules,
  listSecurityTests,
  listVendors,
  updateApproval,
  updateIncident,
  updateSecuritySettings,
  upsertRetentionRule,
  upsertSecurityTest,
  upsertVendor,
} from "@/lib/security-center/store";
import {
  PLATFORM_VENDOR_DEFAULTS,
  SECURITY_TEST_CATALOG,
} from "@/lib/security-center/catalog";
import type {
  AiApprovalStatus,
  IncidentTimelineKind,
} from "@/lib/security-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------- Helpers ------------------------------- */

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function badRequest(msg = "Invalid request.") {
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** Strip secrets before an admin record ever leaves the server. */
function toPublicAdmin(a: {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  mfaEnabled: boolean;
}) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    roleLabel: ADMIN_ROLE_LABELS[a.role] ?? a.role,
    mfaEnabled: a.mfaEnabled,
  };
}

const str = (v: unknown, max = 4000): string =>
  typeof v === "string" ? v.slice(0, max) : "";
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

async function audit(
  ctx: AdminContext,
  request: Request,
  action: string,
  extra?: Record<string, unknown>
) {
  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action,
    entityType: "security",
    metadata: extra,
    ip: clientIp(request),
  });
}

/* --------------------------------- GET --------------------------------- */

export async function GET(request: Request) {
  const ctx = await requireAdmin("view_security");
  if (!isAdminContext(ctx)) return ctx;

  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "all";

  if (section === "audit") {
    if (!can("view_audit", ctx.role)) return forbidden();
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const events = await listAuditEvents({
      limit,
      offset,
      action: url.searchParams.get("action") || undefined,
      actionPrefix: url.searchParams.get("actionPrefix") || undefined,
      actorEmail: url.searchParams.get("actorEmail") || undefined,
      actorType:
        (url.searchParams.get("actorType") as
          | "admin"
          | "system"
          | "cron"
          | "anonymous"
          | null) || undefined,
      entityType: url.searchParams.get("entityType") || undefined,
      since: url.searchParams.get("since") || undefined,
      until: url.searchParams.get("until") || undefined,
    });
    return NextResponse.json({ events, limit, offset });
  }

  // Full snapshot for the console. All reads require view_security (already
  // gated). The audit sub-feed is fetched separately with view_audit.
  const [
    overview,
    incidents,
    vendors,
    retentionRules,
    approvals,
    tests,
    settings,
    admins,
  ] = await Promise.all([
    buildSecurityOverview(),
    listIncidents(),
    listVendors(),
    listRetentionRules(),
    listApprovals(),
    listSecurityTests(),
    getSecuritySettings(),
    listAdmins(),
  ]);

  return NextResponse.json({
    role: ctx.role,
    capabilities: {
      manageIncidents: can("manage_incidents", ctx.role),
      manageVendors: can("manage_vendors", ctx.role),
      manageRetention: can("manage_retention", ctx.role),
      approveAi: can("approve_ai_actions", ctx.role),
      manageTests: can("manage_security_tests", ctx.role),
      manageSettings: can("manage_security_settings", ctx.role),
      viewAudit: can("view_audit", ctx.role),
      manageMfa: can("manage_mfa", ctx.role),
    },
    overview,
    incidents,
    vendors,
    retentionRules,
    approvals,
    tests,
    settings,
    admins: admins.map(toPublicAdmin),
    testCatalog: SECURITY_TEST_CATALOG,
  });
}

/* --------------------------------- POST -------------------------------- */

/** Each action maps to the permission it needs — fail closed on unmapped. */
const ACTION_PERMISSION: Record<string, SchedulingPermission> = {
  create_incident: "manage_incidents",
  update_incident: "manage_incidents",
  upsert_vendor: "manage_vendors",
  seed_platform_vendors: "manage_vendors",
  upsert_retention: "manage_retention",
  decide_approval: "approve_ai_actions",
  execute_approval: "approve_ai_actions",
  create_demo_approval: "approve_ai_actions",
  upsert_test: "manage_security_tests",
  seed_test_checklist: "manage_security_tests",
  update_settings: "manage_security_settings",
  toggle_ai_pause: "manage_security_settings",
};

export async function POST(request: Request) {
  const ctx = await requireAdmin("view_security");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest();
  }

  const action = typeof body.action === "string" ? body.action : "";
  const needed = ACTION_PERMISSION[action];
  if (!needed) return badRequest("Unknown action.");
  if (!can(needed, ctx.role)) return forbidden();

  const actor = ctx.admin.email;

  try {
    switch (action) {
      /* ------------------------- Incidents ------------------------- */
      case "create_incident": {
        const title = str(body.title, 300).trim();
        if (!title) return badRequest("Title is required.");
        const incident = await createIncident({
          title,
          description: str(body.description, 8000),
          severity: normalizeEnum(body.severity, ["low", "medium", "high", "critical"], "medium"),
          owner: str(body.owner, 200),
          systemsAffected: strArr(body.systemsAffected),
          createdBy: actor,
        });
        if (!incident) return badRequest("Could not create incident.");
        await audit(ctx, request, "security.incident_create", {
          incidentId: incident.id,
          severity: incident.severity,
        });
        return NextResponse.json({ incident }, { status: 201 });
      }

      case "update_incident": {
        const id = str(body.id, 64);
        if (!id) return badRequest("Incident id required.");
        const timelineEntry =
          body.timelineEntry && typeof body.timelineEntry === "object"
            ? {
                kind: normalizeEnum(
                  (body.timelineEntry as Record<string, unknown>).kind,
                  [
                    "detected",
                    "containment",
                    "credential_rotation",
                    "isolation",
                    "log_preservation",
                    "notification",
                    "restoration",
                    "note",
                    "resolution",
                    "follow_up",
                  ],
                  "note"
                ) as IncidentTimelineKind,
                text: str((body.timelineEntry as Record<string, unknown>).text, 4000),
                actor,
              }
            : undefined;
        const incident = await updateIncident(id, {
          title: body.title !== undefined ? str(body.title, 300) : undefined,
          description:
            body.description !== undefined ? str(body.description, 8000) : undefined,
          severity:
            body.severity !== undefined
              ? normalizeEnum(body.severity, ["low", "medium", "high", "critical"], "medium")
              : undefined,
          status:
            body.status !== undefined
              ? normalizeEnum(
                  body.status,
                  ["open", "contained", "monitoring", "resolved", "closed"],
                  "open"
                )
              : undefined,
          owner: body.owner !== undefined ? str(body.owner, 200) : undefined,
          systemsAffected:
            body.systemsAffected !== undefined ? strArr(body.systemsAffected) : undefined,
          followUpAt:
            body.followUpAt !== undefined
              ? body.followUpAt === null
                ? null
                : str(body.followUpAt, 40)
              : undefined,
          timelineEntry:
            timelineEntry && timelineEntry.text ? timelineEntry : undefined,
        });
        if (!incident) return badRequest("Incident not found.");
        await audit(ctx, request, "security.incident_update", {
          incidentId: id,
          status: incident.status,
        });
        return NextResponse.json({ incident });
      }

      /* -------------------------- Vendors -------------------------- */
      case "upsert_vendor": {
        const name = str(body.name, 200).trim();
        if (!name) return badRequest("Vendor name required.");
        const vendor = await upsertVendor({
          id: body.id ? str(body.id, 64) : undefined,
          name,
          service: str(body.service, 300),
          purpose: str(body.purpose, 2000),
          dataCategories: strArr(body.dataCategories),
          environment: str(body.environment, 60) || "production",
          hostingRegion: body.hostingRegion !== undefined ? str(body.hostingRegion, 200) : undefined,
          contractOwner: body.contractOwner !== undefined ? str(body.contractOwner, 200) : undefined,
          securityDocsUrl:
            body.securityDocsUrl !== undefined ? str(body.securityDocsUrl, 500) : undefined,
          agreementStatus: normalizeEnum(
            body.agreementStatus,
            [
              "not_documented",
              "requested",
              "in_review",
              "terms_accepted",
              "dpa_signed",
              "expired",
              "terminated",
            ],
            "not_documented"
          ),
          renewalDate: body.renewalDate !== undefined ? str(body.renewalDate, 40) : undefined,
          subprocessors: body.subprocessors !== undefined ? str(body.subprocessors, 2000) : undefined,
          accessLevel: body.accessLevel !== undefined ? str(body.accessLevel, 500) : undefined,
          lastReviewDate: body.lastReviewDate !== undefined ? str(body.lastReviewDate, 40) : undefined,
          riskLevel: normalizeEnum(body.riskLevel, ["low", "medium", "high"], "medium"),
          removalProcedure:
            body.removalProcedure !== undefined ? str(body.removalProcedure, 2000) : undefined,
          notes: body.notes !== undefined ? str(body.notes, 2000) : undefined,
          status: normalizeEnum(
            body.status,
            ["active", "under_review", "offboarding", "removed"],
            "active"
          ),
        });
        if (!vendor) return badRequest("Could not save vendor.");
        await audit(ctx, request, "security.vendor_upsert", { vendorId: vendor.id, name });
        return NextResponse.json({ vendor });
      }

      case "seed_platform_vendors": {
        const existing = await listVendors();
        const have = new Set(existing.map((v) => v.name.toLowerCase()));
        const created = [];
        for (const def of PLATFORM_VENDOR_DEFAULTS) {
          if (have.has(def.name.toLowerCase())) continue;
          const vendor = await upsertVendor({ ...def, status: "active" });
          if (vendor) created.push(vendor);
        }
        await audit(ctx, request, "security.vendor_seed", { created: created.length });
        return NextResponse.json({ created: created.length });
      }

      /* ------------------------- Retention ------------------------- */
      case "upsert_retention": {
        const dataCategory = str(body.dataCategory, 120).trim();
        if (!dataCategory) return badRequest("Data category required.");
        const rule = await upsertRetentionRule({
          id: body.id ? str(body.id, 64) : undefined,
          dataCategory,
          label: str(body.label, 200),
          retentionPeriod: str(body.retentionPeriod, 300),
          retentionDays:
            body.retentionDays !== undefined && body.retentionDays !== null
              ? Number(body.retentionDays)
              : undefined,
          actionAtExpiry: normalizeEnum(
            body.actionAtExpiry,
            ["manual_review", "anonymize", "archive", "delete"],
            "manual_review"
          ),
          legalHold: Boolean(body.legalHold),
          notes: body.notes !== undefined ? str(body.notes, 2000) : undefined,
          status: normalizeEnum(body.status, ["draft", "active", "suspended"], "active"),
          updatedBy: actor,
        });
        if (!rule) return badRequest("Could not save retention rule.");
        await audit(ctx, request, "security.retention_upsert", {
          ruleId: rule.id,
          category: dataCategory,
        });
        return NextResponse.json({ rule });
      }

      /* ------------------------- Approvals ------------------------- */
      case "create_demo_approval": {
        // Seeds a clearly-labeled sample request so the approval workflow can
        // be exercised end to end without a live AI action queued.
        const approval = await createApproval({
          actionType: str(body.actionType, 120) || "send_customer_email",
          title: str(body.title, 300) || "Draft follow-up email to a lead (sample)",
          content:
            str(body.content, 20_000) ||
            "Hi there — thanks for reaching out to Redmont Strategies Group. Based on what you shared, a Business Systems Audit is the right next step. Would Thursday work for a short strategy call?\n\n[Sample content queued for approval — not sent until approved.]",
          reason:
            str(body.reason, 2000) ||
            "AI drafted a follow-up after a qualified lead submitted the contact form.",
          dataSources: strArr(body.dataSources).length
            ? strArr(body.dataSources)
            : ["Lead contact record", "Published RSG knowledge base"],
          recordsAffected: strArr(body.recordsAffected).length
            ? strArr(body.recordsAffected)
            : ["lead:sample"],
          riskLevel: normalizeEnum(body.riskLevel, ["low", "medium", "high", "critical"], "high"),
          requestedBy: "site-assistant (sample)",
        });
        if (!approval) return badRequest("Could not create request.");
        await audit(ctx, request, "security.approval_seed", { approvalId: approval.id });
        return NextResponse.json({ approval }, { status: 201 });
      }

      case "decide_approval": {
        const id = str(body.id, 64);
        const decision = normalizeEnum(
          body.decision,
          ["approved", "rejected", "escalated"],
          "rejected"
        ) as AiApprovalStatus;
        if (!id) return badRequest("Approval id required.");
        const approval = await updateApproval(id, {
          status: decision,
          decidedBy: actor,
          decisionNote: str(body.note, 2000),
          content: body.content !== undefined ? str(body.content, 20_000) : undefined,
        });
        if (!approval) return badRequest("Approval not found.");
        await audit(ctx, request, "security.approval_decide", {
          approvalId: id,
          decision,
          riskLevel: approval.riskLevel,
        });
        return NextResponse.json({ approval });
      }

      case "execute_approval": {
        const id = str(body.id, 64);
        if (!id) return badRequest("Approval id required.");
        const current = await listApprovals().then((all) => all.find((a) => a.id === id));
        if (!current) return badRequest("Approval not found.");
        // Irreversible-action guard: only an approved request can execute,
        // and the client must confirm.
        if (current.status !== "approved") {
          return badRequest("Only an approved request can be executed.");
        }
        if (body.confirm !== true) {
          return badRequest("Execution must be explicitly confirmed.");
        }
        // This platform records the execution decision; it does not itself
        // dispatch the underlying action. Downstream systems read this state.
        const approval = await updateApproval(id, {
          status: "executed",
          executedAt: new Date().toISOString(),
          executionResult: str(body.result, 2000) || "Marked executed by an approver.",
        });
        await audit(ctx, request, "security.approval_execute", {
          approvalId: id,
          actionType: current.actionType,
        });
        return NextResponse.json({ approval });
      }

      /* ---------------------------- Tests -------------------------- */
      case "upsert_test": {
        const name = str(body.name, 300).trim();
        const category = str(body.category, 120).trim();
        if (!name || !category) return badRequest("Test name and category required.");
        const result = normalizeEnum(
          body.result,
          ["not_run", "pass", "fail", "partial"],
          "not_run"
        );
        const test = await upsertSecurityTest({
          id: body.id ? str(body.id, 64) : undefined,
          name,
          category,
          target: str(body.target, 300),
          expected: str(body.expected, 4000),
          actual: str(body.actual, 4000),
          result,
          severity:
            body.severity !== undefined
              ? body.severity === null || body.severity === ""
                ? null
                : normalizeEnum(
                    body.severity,
                    ["info", "low", "medium", "high", "critical"],
                    "info"
                  )
              : undefined,
          evidence: body.evidence !== undefined ? str(body.evidence, 4000) : undefined,
          remediation: body.remediation !== undefined ? str(body.remediation, 4000) : undefined,
          retestStatus: normalizeEnum(
            body.retestStatus,
            ["none", "required", "scheduled", "passed", "failed"],
            "none"
          ),
          lastRunAt:
            result === "not_run" ? undefined : new Date().toISOString(),
          createdBy: actor,
        });
        if (!test) return badRequest("Could not save test.");
        await audit(ctx, request, "security.test_upsert", {
          testId: test.id,
          category,
          result,
        });
        return NextResponse.json({ test });
      }

      case "seed_test_checklist": {
        const existing = await listSecurityTests();
        const have = new Set(existing.map((t) => `${t.category}|${t.name}`.toLowerCase()));
        let created = 0;
        for (const def of SECURITY_TEST_CATALOG) {
          const key = `${def.category}|${def.name}`.toLowerCase();
          if (have.has(key)) continue;
          const test = await upsertSecurityTest({
            name: def.name,
            category: def.category,
            expected: def.expected,
            result: "not_run",
            retestStatus: "none",
            createdBy: actor,
          });
          if (test) created += 1;
        }
        await audit(ctx, request, "security.test_seed", { created });
        return NextResponse.json({ created });
      }

      /* --------------------------- Settings ------------------------ */
      case "update_settings": {
        const patch: Record<string, unknown> = {};
        if (Array.isArray(body.mfaRequiredRoles)) {
          patch.mfaRequiredRoles = strArr(body.mfaRequiredRoles);
        }
        if (typeof body.approvalExpiryHours === "number") {
          patch.approvalExpiryHours = body.approvalExpiryHours;
        }
        if (Array.isArray(body.packages)) {
          patch.packages = body.packages;
        }
        const settings = await updateSecuritySettings(patch, actor);
        if (!settings) return badRequest("Could not update settings.");
        await audit(ctx, request, "security.settings_update", {
          mfaRequiredRoles: settings.mfaRequiredRoles,
        });
        return NextResponse.json({ settings });
      }

      case "toggle_ai_pause": {
        const paused = Boolean(body.paused);
        const settings = await updateSecuritySettings(
          { aiPaused: paused, aiPausedReason: str(body.reason, 500) },
          actor
        );
        if (!settings) return badRequest("Could not update AI status.");
        await audit(ctx, request, paused ? "security.ai_pause" : "security.ai_resume", {
          reason: settings.aiPausedReason,
        });
        return NextResponse.json({ settings });
      }

      default:
        return badRequest("Unknown action.");
    }
  } catch (err) {
    console.error("[admin/security POST]", err);
    return NextResponse.json({ error: "The action could not be completed." }, { status: 500 });
  }
}

/** Coerce an untrusted value to one of `allowed`, else `fallback`. The
 *  `const` type parameter keeps the inline arrays inferred as literal unions. */
function normalizeEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
