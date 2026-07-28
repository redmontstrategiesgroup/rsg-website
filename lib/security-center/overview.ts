/**
 * Security overview: every number here is measured from the live system
 * (admins table, audit events, security tables, environment) or clearly
 * marked unavailable. Nothing is fabricated.
 */

import { countAuditEvents } from "@/lib/audit";
import { isDemoDataEnabled } from "@/lib/demo";
import { listAdmins } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getSecuritySettings,
  listApprovals,
  listIncidents,
  listRetentionRules,
  listSecurityTests,
  listVendors,
} from "./store";
import type {
  EnvironmentCheck,
  SecurityIndicator,
  SecurityOverview,
  SecurityStatusLevel,
} from "./types";

const PRIVILEGED_ROLES = new Set(["owner", "administrator"]);

/** Roughly 12 months, for vendor-review staleness. */
const VENDOR_REVIEW_MAX_AGE_MS = 365 * 24 * 3600_000;

type BackupStatus = {
  value: string;
  detail: string;
  status: SecurityStatusLevel;
  lastBackupAt: string | null;
  source: "supabase_api" | "supabase_managed" | "file_store";
};

/**
 * Real backup status when a Supabase management token is configured
 * (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF); otherwise an honest
 * "managed but not verified from here" state. Never a fake green light.
 */
async function getBackupStatus(): Promise<BackupStatus> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;

  if (!isSupabaseConfigured()) {
    return {
      value: "No durable backups",
      detail:
        "Running on the local development file store. Configure Supabase for durable, backed-up storage.",
      status:
        process.env.NODE_ENV === "production" ? "critical" : "review_recommended",
      lastBackupAt: null,
      source: "file_store",
    };
  }

  if (token && ref) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/backups`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: "no-store",
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const body = (await res.json()) as {
          pitr_enabled?: boolean;
          backups?: { status?: string; inserted_at?: string }[];
        };
        const completed = (body.backups ?? [])
          .filter((b) => (b.status ?? "").toUpperCase() === "COMPLETED")
          .map((b) => b.inserted_at)
          .filter((d): d is string => Boolean(d))
          .sort()
          .reverse();
        const last = completed[0] ?? null;
        const pitr = body.pitr_enabled ? " Point-in-time recovery is enabled." : "";
        if (last) {
          const ageHours = (Date.now() - new Date(last).getTime()) / 3600_000;
          return {
            value: `Last backup ${new Date(last).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
            detail: `Verified via the Supabase management API.${pitr}`,
            status: ageHours <= 48 ? "secure" : "action_required",
            lastBackupAt: last,
            source: "supabase_api",
          };
        }
        return {
          value: "No completed backups reported",
          detail: `The Supabase management API returned no completed backups.${pitr}`,
          status: body.pitr_enabled ? "secure" : "action_required",
          lastBackupAt: null,
          source: "supabase_api",
        };
      }
      console.warn("[security-center] backup status API returned", res.status);
    } catch (err) {
      console.warn("[security-center] backup status check failed", err);
    }
  }

  return {
    value: "Managed by Supabase — not verified from this console",
    detail:
      "Automated database backups are handled by Supabase for this project. Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF to display verified backup status here.",
    status: "review_recommended",
    lastBackupAt: null,
    source: "supabase_managed",
  };
}

function bool(v: string | undefined): boolean {
  return Boolean(v && v.trim());
}

export async function buildSecurityOverview(): Promise<SecurityOverview> {
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const [
    admins,
    settings,
    approvals,
    incidents,
    tests,
    vendors,
    retentionRules,
    failedLogins7d,
    permissionChanges30d,
    backup,
  ] = await Promise.all([
    listAdmins(),
    getSecuritySettings(),
    listApprovals(),
    listIncidents(),
    listSecurityTests(),
    listVendors(),
    listRetentionRules(),
    countAuditEvents({ actions: ["admin.login_failed"], since: since7d }),
    countAuditEvents({
      actions: [
        "admin.role_change",
        "admin.mfa_enable",
        "admin.mfa_disable",
        "security.settings_update",
        "team.member_upsert",
      ],
      since: since30d,
    }),
    getBackupStatus(),
  ]);

  const adminsWithMfa = admins.filter((a) => a.mfaEnabled).length;
  const privilegedWithoutMfa = admins.filter(
    (a) => PRIVILEGED_ROLES.has(a.role) && !a.mfaEnabled
  ).length;
  const mfaEnforced = settings.mfaRequiredRoles.length > 0;

  const openApprovals = approvals.filter(
    (a) => a.status === "awaiting_approval" || a.status === "escalated"
  );
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "contained" || i.status === "monitoring"
  );
  const criticalOpenIncidents = openIncidents.filter(
    (i) => i.severity === "critical"
  );
  const failedTests = tests.filter(
    (t) => t.result === "fail" && t.retestStatus !== "passed"
  );
  const criticalFailedTests = failedTests.filter(
    (t) => t.severity === "critical" || t.severity === "high"
  );

  const now = Date.now();
  const vendorsNeedingReview = vendors.filter((v) => {
    if (v.status === "removed") return false;
    if (v.status === "under_review") return true;
    if (!v.lastReviewDate) return true;
    return now - new Date(v.lastReviewDate).getTime() > VENDOR_REVIEW_MAX_AGE_MS;
  }).length;

  const activeRetention = retentionRules.filter((r) => r.status === "active");

  const restorationRuns = tests
    .filter(
      (t) =>
        t.category === "backup_restoration" && t.result === "pass" && t.lastRunAt
    )
    .map((t) => t.lastRunAt as string)
    .sort()
    .reverse();
  const lastRestoreTest = restorationRuns[0] ?? null;

  const recentHighRiskAiActions = approvals
    .filter((a) => a.riskLevel === "high" || a.riskLevel === "critical")
    .slice(0, 10);

  const indicators: SecurityIndicator[] = [
    {
      key: "mfa",
      label: "MFA adoption",
      value: `${adminsWithMfa} of ${admins.length} admins`,
      detail: mfaEnforced
        ? `Enforced for: ${settings.mfaRequiredRoles.join(", ")}.`
        : "MFA is available but not enforced for any role.",
      status:
        privilegedWithoutMfa > 0
          ? mfaEnforced
            ? "action_required"
            : "review_recommended"
          : "secure",
    },
    {
      key: "admins",
      label: "Active administrators",
      value: String(admins.length),
      detail: `${admins.filter((a) => PRIVILEGED_ROLES.has(a.role)).length} with owner/administrator privileges.`,
      status: "secure",
    },
    {
      key: "failed_logins",
      label: "Failed admin logins (7d)",
      value: failedLogins7d === null ? "Unavailable" : String(failedLogins7d),
      detail:
        failedLogins7d === null
          ? "Audit store not connected — configure Supabase to track authentication events."
          : "Counted from real authentication audit events.",
      status:
        failedLogins7d === null
          ? "review_recommended"
          : failedLogins7d >= 25
            ? "action_required"
            : "secure",
    },
    {
      key: "approvals",
      label: "Open AI approval requests",
      value: String(openApprovals.length),
      detail: openApprovals.length
        ? "High-risk AI actions waiting for a human decision."
        : "No AI actions are waiting for approval.",
      status: openApprovals.some((a) => a.riskLevel === "critical")
        ? "action_required"
        : openApprovals.length > 0
          ? "review_recommended"
          : "secure",
    },
    {
      key: "permission_changes",
      label: "Permission changes (30d)",
      value:
        permissionChanges30d === null
          ? "Unavailable"
          : String(permissionChanges30d),
      detail:
        permissionChanges30d === null
          ? "Audit store not connected."
          : "Role, MFA, and security-setting changes from the audit log.",
      status: permissionChanges30d === null ? "review_recommended" : "secure",
    },
    {
      key: "backups",
      label: "Backup status",
      value: backup.value,
      detail: backup.detail,
      status: backup.status,
    },
    {
      key: "restore_test",
      label: "Last successful restoration test",
      value: lastRestoreTest
        ? new Date(lastRestoreTest).toLocaleDateString("en-US", {
            timeZone: "America/New_York",
          })
        : "Never recorded",
      detail:
        "Recorded restoration tests from the security test log (category: backup restoration).",
      status: lastRestoreTest ? "secure" : "review_recommended",
    },
    {
      key: "incidents",
      label: "Open incidents",
      value: String(openIncidents.length),
      detail: criticalOpenIncidents.length
        ? `${criticalOpenIncidents.length} critical.`
        : openIncidents.length
          ? "Active incidents are being tracked."
          : "No open incidents.",
      status: criticalOpenIncidents.length
        ? "critical"
        : openIncidents.length
          ? "action_required"
          : "secure",
    },
    {
      key: "findings",
      label: "Unresolved security findings",
      value: String(failedTests.length),
      detail: failedTests.length
        ? "Failed security tests awaiting remediation or retest."
        : "No failed tests on record.",
      status: criticalFailedTests.length
        ? "action_required"
        : failedTests.length
          ? "review_recommended"
          : "secure",
    },
    {
      key: "vendors",
      label: "Vendor review status",
      value: vendors.length
        ? `${vendorsNeedingReview} of ${vendors.length} need review`
        : "No vendors documented",
      detail: vendors.length
        ? "Vendors without a review in the last 12 months, or flagged for review."
        : "Document the third-party services this system depends on.",
      status:
        vendors.length === 0
          ? "review_recommended"
          : vendorsNeedingReview > 0
            ? "review_recommended"
            : "secure",
    },
    {
      key: "retention",
      label: "Retention-policy status",
      value: activeRetention.length
        ? `${activeRetention.length} active rules`
        : "Not documented",
      detail: activeRetention.some((r) => r.legalHold)
        ? "Includes categories under legal hold."
        : "Retention schedules documented in the Data Retention manager.",
      status: activeRetention.length ? "secure" : "review_recommended",
    },
    {
      key: "ai_status",
      label: "AI systems",
      value: settings.aiPaused ? "Paused (emergency disable)" : "Active",
      detail: settings.aiPaused
        ? settings.aiPausedReason || "AI features are disabled via the emergency control."
        : "AI endpoints active with rate limits and approval controls.",
      status: settings.aiPaused ? "action_required" : "secure",
    },
  ];

  const isProd = process.env.NODE_ENV === "production";
  const demoData = isDemoDataEnabled();
  const environment: EnvironmentCheck[] = [
    {
      key: "node_env",
      label: "Environment",
      value: process.env.NODE_ENV ?? "development",
      status: "secure",
      detail: isProd
        ? "Production mode — file-store writes and dev fallbacks are disabled."
        : "Development mode — local file store may substitute for Supabase.",
    },
    {
      key: "database",
      label: "Durable database",
      value: isSupabaseConfigured() ? "Supabase connected" : "Not configured",
      status: isSupabaseConfigured()
        ? "secure"
        : isProd
          ? "critical"
          : "review_recommended",
      detail: isSupabaseConfigured()
        ? "Service-role access held server-side; RLS enabled with anon access revoked."
        : "Using the local development file store.",
    },
    {
      key: "auth_secret",
      label: "Session signing secret",
      value: bool(process.env.AUTH_SECRET) ? "Configured" : "Not set",
      status: bool(process.env.AUTH_SECRET)
        ? "secure"
        : isProd
          ? "critical"
          : "review_recommended",
      detail: bool(process.env.AUTH_SECRET)
        ? "Sessions are signed with a configured secret."
        : "Development uses a per-process random secret; production fails closed without AUTH_SECRET.",
    },
    {
      key: "rate_limits",
      label: "Durable rate limiting",
      value:
        bool(process.env.UPSTASH_REDIS_REST_URL) &&
        bool(process.env.UPSTASH_REDIS_REST_TOKEN)
          ? "Upstash Redis"
          : "In-process fallback",
      status:
        bool(process.env.UPSTASH_REDIS_REST_URL) &&
        bool(process.env.UPSTASH_REDIS_REST_TOKEN)
          ? "secure"
          : isProd
            ? "review_recommended"
            : "secure",
      detail: "Login, booking, and AI endpoints are rate limited.",
    },
    {
      key: "demo_data",
      label: "Demo data",
      value: demoData ? "ENABLED" : "Disabled",
      status: demoData ? (isProd ? "critical" : "review_recommended") : "secure",
      detail: demoData
        ? "Seeded demo records are active. Portal metrics may include clearly seeded sample data."
        : "No demo data is seeded; all records are real.",
    },
    {
      key: "error_monitoring",
      label: "Error monitoring",
      value: bool(process.env.SENTRY_DSN) ? "Sentry connected" : "Not configured",
      status: bool(process.env.SENTRY_DSN) ? "secure" : "review_recommended",
      detail: "Server errors are captured for diagnosis without exposing details to visitors.",
    },
    {
      key: "email",
      label: "Transactional email",
      value: bool(process.env.RESEND_API_KEY) ? "Resend connected" : "Not configured",
      status: bool(process.env.RESEND_API_KEY) ? "secure" : "review_recommended",
      detail: "Notifications and approved AI drafts send through the configured provider.",
    },
    {
      key: "cron",
      label: "Scheduled jobs secret",
      value: bool(process.env.CRON_SECRET) ? "Configured" : "Not set",
      status: bool(process.env.CRON_SECRET)
        ? "secure"
        : isProd
          ? "action_required"
          : "review_recommended",
      detail: "Cron endpoints require a shared secret.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    usingDemoData: demoData,
    indicators,
    environment,
    counts: {
      admins: admins.length,
      adminsWithMfa,
      failedLogins7d: failedLogins7d ?? -1,
      permissionChanges30d: permissionChanges30d ?? -1,
      openApprovals: openApprovals.length,
      openIncidents: openIncidents.length,
      failedTests: failedTests.length,
      vendorsNeedingReview,
      activeRetentionRules: activeRetention.length,
      recentHighRiskAiActions,
    },
  };
}
