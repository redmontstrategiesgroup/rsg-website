/**
 * Client Lifecycle Platform — automation engine + in-app notifications.
 *
 * Every lifecycle side effect (emails, in-app notices) flows through
 * fireAutomation(): it honors the admin-configurable automation_settings
 * (enabled / delay / channel), records an automation_runs row, and uses the
 * unique dedupe_key index as the duplicate-notification guard. Delayed runs
 * stay `pending` and are drained by processDueAutomationRuns() (cron/route).
 *
 * fireAutomation NEVER throws — a notification failure must not break the
 * business action that triggered it.
 */

import { nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type {
  AutomationChannel,
  AutomationRun,
  AutomationRunStatus,
  AutomationSetting,
  LifecycleNotification,
} from "@/lib/lifecycle/types";
import {
  sendInternalNotification,
  sendTemplatedEmail,
} from "@/lib/scheduling/notifications";

// ---------------------------------------------------------------------------
// Registry — one entry per id seeded into automation_settings (migration §18),
// mapped to the lc_* notification_templates seeded in migration §19.
// ---------------------------------------------------------------------------

export type AutomationDefinition = {
  key: string;
  label: string;
  description: string;
  /** Human phrase describing when this automation fires. */
  trigger: string;
  /** Visitor/client-facing notification_templates key, when the migration defines one. */
  templateKey?: string;
  /** Internal-audience notification_templates key, when the migration defines one. */
  internalTemplateKey?: string;
  defaultChannel: AutomationChannel;
  defaultDelayMinutes: number;
};

export const AUTOMATION_REGISTRY: Record<string, AutomationDefinition> = {
  qualification_confirmation: {
    key: "qualification_confirmation",
    label: "Qualification confirmation",
    description:
      "Confirms we received a new inquiry and points the prospect to their next step.",
    trigger: "When a new lead completes qualification",
    templateKey: "lc_qualification_confirmation",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  lead_assignment: {
    key: "lead_assignment",
    label: "Lead assignment alert",
    description: "Alerts the team when a lead is routed to a team member.",
    trigger: "When a lead is assigned to a team member",
    internalTemplateKey: "lc_lead_assigned_internal",
    defaultChannel: "in_app",
    defaultDelayMinutes: 0,
  },
  assessment_invite: {
    key: "assessment_invite",
    label: "Assessment invitation",
    description:
      "Sends the Business Systems Assessment link so the prospect can complete it on their own time.",
    trigger: "When an assessment is created for a lead",
    templateKey: "lc_assessment_invite",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  assessment_reminder: {
    key: "assessment_reminder",
    label: "Assessment reminder",
    description: "Nudges prospects whose assessment is started but unfinished.",
    trigger: "When an assessment sits incomplete for two days",
    templateKey: "lc_assessment_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 2880,
  },
  assessment_complete_internal: {
    key: "assessment_complete_internal",
    label: "Assessment completed (team)",
    description:
      "Notifies the team with the score and recommended service category when an assessment is submitted.",
    trigger: "When a prospect submits their assessment",
    internalTemplateKey: "lc_assessment_complete_internal",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  booking_confirmation: {
    key: "booking_confirmation",
    label: "Booking confirmation",
    description:
      "Sends the consultation confirmation email using the scheduling template supplied by the booking flow.",
    trigger: "When a consultation is booked",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  questionnaire_invite: {
    key: "questionnaire_invite",
    label: "Preparation questionnaire invite",
    description:
      "Sends the pre-consultation questionnaire shortly after a booking is confirmed.",
    trigger: "Shortly after a consultation is booked",
    templateKey: "lc_questionnaire_invite",
    defaultChannel: "email",
    defaultDelayMinutes: 10,
  },
  questionnaire_reminder: {
    key: "questionnaire_reminder",
    label: "Questionnaire reminder",
    description:
      "Reminds the prospect to finish the preparation questionnaire before their consultation.",
    trigger: "When the questionnaire is unfinished as the consultation approaches",
    templateKey: "lc_questionnaire_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 2880,
  },
  prep_brief_internal: {
    key: "prep_brief_internal",
    label: "Prep brief ready (team)",
    description:
      "Notifies the team when a consultation preparation brief has been assembled.",
    trigger: "When a preparation brief is generated",
    internalTemplateKey: "lc_prep_brief_internal",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  proposal_delivery: {
    key: "proposal_delivery",
    label: "Proposal delivery",
    description: "Delivers the interactive proposal link to the prospect.",
    trigger: "When a proposal is sent",
    templateKey: "lc_proposal_delivery",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  proposal_follow_up: {
    key: "proposal_follow_up",
    label: "Proposal follow-up",
    description:
      "Checks in on an outstanding proposal that has not been approved yet.",
    trigger: "Three days after a proposal is sent without a decision",
    templateKey: "lc_proposal_follow_up",
    defaultChannel: "email",
    defaultDelayMinutes: 4320,
  },
  proposal_expiring: {
    key: "proposal_expiring",
    label: "Proposal expiring notice",
    description: "Warns the prospect shortly before their proposal expires.",
    trigger: "When a proposal approaches its expiration date",
    templateKey: "lc_proposal_expiring",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  contract_delivery: {
    key: "contract_delivery",
    label: "Agreement delivery",
    description: "Sends the e-signature link for a new agreement.",
    trigger: "When an agreement is sent for signature",
    templateKey: "lc_contract_delivery",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  signature_reminder: {
    key: "signature_reminder",
    label: "Signature reminder",
    description: "Reminds signers about an agreement still awaiting signature.",
    trigger: "When an agreement sits unsigned for two days",
    templateKey: "lc_signature_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 2880,
  },
  contract_signed_internal: {
    key: "contract_signed_internal",
    label: "Agreement fully signed",
    description:
      "Sends the client their fully signed copy and alerts the team that the agreement is complete.",
    trigger: "When all required signatures are in place",
    templateKey: "lc_contract_signed",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  deposit_request: {
    key: "deposit_request",
    label: "Deposit request",
    description: "Requests the project deposit with a secure payment link.",
    trigger: "When the deposit invoice is issued",
    templateKey: "lc_deposit_request",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  payment_receipt: {
    key: "payment_receipt",
    label: "Payment receipt",
    description: "Confirms a successful payment and what happens next.",
    trigger: "When a payment succeeds",
    templateKey: "lc_payment_receipt",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  payment_failed: {
    key: "payment_failed",
    label: "Payment failed notice",
    description:
      "Lets the client know a payment attempt failed and how to retry securely.",
    trigger: "When a payment attempt fails",
    templateKey: "lc_payment_failed",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  payment_reminder: {
    key: "payment_reminder",
    label: "Invoice payment reminder",
    description: "Reminds the client about an open invoice approaching or past due.",
    trigger: "When an invoice remains unpaid",
    templateKey: "lc_payment_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 4320,
  },
  portal_activation: {
    key: "portal_activation",
    label: "Portal welcome",
    description:
      "Welcomes a new client to their portal and points to their first step.",
    trigger: "When a client portal account is activated",
    templateKey: "lc_portal_welcome",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  onboarding_task_reminder: {
    key: "onboarding_task_reminder",
    label: "Onboarding task reminder",
    description: "Reminds the client about onboarding items waiting on their side.",
    trigger: "When onboarding tasks sit open for two days",
    templateKey: "lc_onboarding_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 2880,
  },
  missing_file_reminder: {
    key: "missing_file_reminder",
    label: "Missing file reminder",
    description:
      "Reminds the client about requested files or materials not yet uploaded.",
    trigger: "When a file request sits unfulfilled for three days",
    templateKey: "lc_onboarding_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 4320,
  },
  milestone_update: {
    key: "milestone_update",
    label: "Milestone update",
    description: "Tells the client when a project milestone changes status.",
    trigger: "When a milestone status changes",
    templateKey: "lc_milestone_update",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  approval_request: {
    key: "approval_request",
    label: "Approval request",
    description: "Asks the client to review and approve a deliverable.",
    trigger: "When an approval is requested",
    templateKey: "lc_approval_request",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  project_delay_notice: {
    key: "project_delay_notice",
    label: "Project delay notice",
    description:
      "Proactively tells the client when a milestone is running behind its target date.",
    trigger: "When a milestone is marked delayed",
    templateKey: "lc_project_delay",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  training_assigned: {
    key: "training_assigned",
    label: "Training assigned",
    description: "Notifies the client when new training is added to their library.",
    trigger: "When a training item is assigned",
    templateKey: "lc_training_assigned",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  ticket_created: {
    key: "ticket_created",
    label: "Ticket received",
    description:
      "Confirms a support ticket to the client and alerts the team with its priority.",
    trigger: "When a support ticket is opened",
    templateKey: "lc_ticket_created",
    internalTemplateKey: "lc_ticket_created_internal",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  ticket_updated: {
    key: "ticket_updated",
    label: "Ticket update",
    description: "Notifies the client when there is a new reply or status change.",
    trigger: "When a ticket receives an update",
    templateKey: "lc_ticket_updated",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  ticket_resolved: {
    key: "ticket_resolved",
    label: "Ticket resolved",
    description:
      "Tells the client their ticket is resolved and asks them to confirm closure.",
    trigger: "When a ticket is marked resolved",
    templateKey: "lc_ticket_resolved",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  ticket_inactive_nudge: {
    key: "ticket_inactive_nudge",
    label: "Ticket inactivity nudge",
    description:
      "Nudges the client when a ticket is waiting on them with no recent activity.",
    trigger: "When a ticket waits on the client for three days",
    templateKey: "lc_ticket_updated",
    defaultChannel: "email",
    defaultDelayMinutes: 4320,
  },
  report_published: {
    key: "report_published",
    label: "Report published",
    description: "Announces the monthly performance report in the portal.",
    trigger: "When a monthly report is published",
    templateKey: "lc_report_published",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  renewal_reminder: {
    key: "renewal_reminder",
    label: "Renewal reminder",
    description: "Gives the client advance notice of an upcoming renewal.",
    trigger: "When a renewal reminder window is reached",
    templateKey: "lc_renewal_reminder",
    defaultChannel: "both",
    defaultDelayMinutes: 0,
  },
  strategy_review_reminder: {
    key: "strategy_review_reminder",
    label: "Strategy review reminder",
    description:
      "Invites the client to book a strategy review when one is overdue.",
    trigger: "When it has been too long since the last strategy review",
    templateKey: "lc_strategy_review_reminder",
    defaultChannel: "email",
    defaultDelayMinutes: 0,
  },
  expansion_roadmap_update: {
    key: "expansion_roadmap_update",
    label: "Growth roadmap update",
    description:
      "Surfaces changes to the client's growth and expansion roadmap in the portal.",
    trigger: "When the expansion roadmap changes",
    defaultChannel: "in_app",
    defaultDelayMinutes: 0,
  },
};

// ---------------------------------------------------------------------------
// Settings (registry metadata merged with the automation_settings table)
// ---------------------------------------------------------------------------

export type AutomationSettingWithMeta = AutomationSetting & {
  label: string;
  description: string;
  trigger: string;
};

/**
 * All automations in registry order. Table rows win for enabled/delay/channel;
 * the registry supplies metadata and fills defaults for keys missing a row.
 */
export async function getAutomationSettings(): Promise<AutomationSettingWithMeta[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("automation_settings").select("*");
  if (error) {
    throw new Error(`Failed to load automation settings: ${error.message}`);
  }
  const rows = new Map(
    ((data ?? []) as AutomationSetting[]).map((row) => [row.id, row])
  );
  return Object.values(AUTOMATION_REGISTRY).map((def) => {
    const row = rows.get(def.key);
    return {
      id: def.key,
      enabled: row?.enabled ?? true,
      delay_minutes: row?.delay_minutes ?? def.defaultDelayMinutes,
      channel: row?.channel ?? def.defaultChannel,
      conditions: row?.conditions ?? {},
      updated_by: row?.updated_by ?? null,
      updated_at: row?.updated_at ?? nowIso(),
      label: def.label,
      description: def.description,
      trigger: def.trigger,
    };
  });
}

export async function updateAutomationSetting(
  key: string,
  patch: { enabled?: boolean; delayMinutes?: number; channel?: AutomationChannel },
  updatedBy: string
): Promise<AutomationSetting> {
  const def = AUTOMATION_REGISTRY[key];
  if (!def) {
    throw new Error(`Unknown automation key: ${key}`);
  }
  const sb = requireSupabase();
  const { data: existing, error: readError } = await sb
    .from("automation_settings")
    .select("*")
    .eq("id", key)
    .maybeSingle();
  if (readError) {
    throw new Error(`Failed to load automation setting "${key}": ${readError.message}`);
  }
  const current = existing as AutomationSetting | null;
  const { data, error } = await sb
    .from("automation_settings")
    .upsert(
      {
        id: key,
        enabled: patch.enabled ?? current?.enabled ?? true,
        delay_minutes: patch.delayMinutes ?? current?.delay_minutes ?? def.defaultDelayMinutes,
        channel: patch.channel ?? current?.channel ?? def.defaultChannel,
        conditions: current?.conditions ?? {},
        updated_by: updatedBy,
        updated_at: nowIso(),
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to update automation setting "${key}": ${error.message}`);
  }
  return data as AutomationSetting;
}

// ---------------------------------------------------------------------------
// Firing automations
// ---------------------------------------------------------------------------

export type FireAutomationInput = {
  key: string;
  /** Globally unique per logical event — the duplicate-notification guard. */
  dedupeKey: string;
  entityType: string;
  entityId: string;
  email?: {
    to: string;
    vars: Record<string, string>;
    leadId?: string;
    bookingId?: string;
    /** Use a template other than the registry default (e.g. scheduling templates). */
    templateKeyOverride?: string;
  };
  internalEmail?: { vars: Record<string, string> };
  inApp?: {
    audience: "client" | "admin";
    clientId?: string;
    clientUserId?: string;
    title: string;
    body?: string;
    href?: string;
  };
  payload?: Record<string, unknown>;
  /** Explicit execution time; otherwise now + the setting's delay_minutes. */
  scheduledFor?: string;
};

export type FireAutomationResult = {
  status: "queued" | "completed" | "deduped" | "disabled" | "failed";
  runId?: string;
};

/** Everything executeRun needs, serialized into automation_runs.payload. */
type RunPayload = {
  email?: FireAutomationInput["email"] | null;
  internal_email?: FireAutomationInput["internalEmail"] | null;
  in_app?: FireAutomationInput["inApp"] | null;
  data?: Record<string, unknown>;
};

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" ||
    (error.message ?? "").toLowerCase().includes("duplicate key")
  );
}

/**
 * Record + execute (or schedule) an automation. Never throws: callers must
 * not break on notification failure.
 */
export async function fireAutomation(
  input: FireAutomationInput
): Promise<FireAutomationResult> {
  try {
    const def = AUTOMATION_REGISTRY[input.key];
    if (!def) {
      console.error(`[lifecycle] fireAutomation: unknown automation key "${input.key}"`);
      return { status: "failed" };
    }
    const sb = requireSupabase();

    const { data: settingRow, error: settingError } = await sb
      .from("automation_settings")
      .select("*")
      .eq("id", input.key)
      .maybeSingle();
    if (settingError) {
      console.error(
        `[lifecycle] fireAutomation "${input.key}": failed to load setting, using registry defaults`,
        settingError
      );
    }
    const setting = (settingRow as AutomationSetting | null) ?? null;
    const enabled = setting ? setting.enabled : true;
    const delayMinutes = setting ? setting.delay_minutes : def.defaultDelayMinutes;
    const channel: AutomationChannel = setting ? setting.channel : def.defaultChannel;

    const runPayload: RunPayload = {
      email: input.email ?? null,
      internal_email: input.internalEmail ?? null,
      in_app: input.inApp ?? null,
      data: input.payload ?? {},
    };

    if (!enabled) {
      // Still dedupe-guarded so re-enabling later cannot double-send the event.
      const { data, error } = await sb
        .from("automation_runs")
        .insert({
          automation_key: input.key,
          dedupe_key: input.dedupeKey,
          entity_type: input.entityType,
          entity_id: input.entityId,
          status: "skipped",
          scheduled_for: nowIso(),
          executed_at: nowIso(),
          error: "Automation disabled",
          payload: runPayload,
        })
        .select("id")
        .single();
      if (error) {
        if (isUniqueViolation(error)) return { status: "deduped" };
        console.error(`[lifecycle] fireAutomation "${input.key}": skipped-run insert failed`, error);
        return { status: "failed" };
      }
      return { status: "disabled", runId: (data as { id: string }).id };
    }

    const scheduledFor =
      input.scheduledFor ?? new Date(Date.now() + delayMinutes * 60_000).toISOString();

    const { data, error } = await sb
      .from("automation_runs")
      .insert({
        automation_key: input.key,
        dedupe_key: input.dedupeKey,
        entity_type: input.entityType,
        entity_id: input.entityId,
        status: "pending",
        scheduled_for: scheduledFor,
        payload: runPayload,
      })
      .select("*")
      .single();
    if (error) {
      // Unique violation on dedupe_key = this event already fired. No side effects.
      if (isUniqueViolation(error)) return { status: "deduped" };
      console.error(`[lifecycle] fireAutomation "${input.key}": run insert failed`, error);
      return { status: "failed" };
    }

    const run = data as AutomationRun;
    if (new Date(run.scheduled_for).getTime() <= Date.now()) {
      const status = await executeRun(run, channel);
      return { status, runId: run.id };
    }
    return { status: "queued", runId: run.id };
  } catch (err) {
    console.error(`[lifecycle] fireAutomation "${input.key}" failed`, err);
    return { status: "failed" };
  }
}

/**
 * Execute one run according to the (current) channel. Records the outcome on
 * the run row and never throws.
 */
async function executeRun(
  run: AutomationRun,
  channel: AutomationChannel
): Promise<"completed" | "failed"> {
  const sb = requireSupabase();
  const def = AUTOMATION_REGISTRY[run.automation_key];
  const payload = (run.payload ?? {}) as RunPayload;
  const errors: string[] = [];
  let emailSent = false;

  try {
    if (channel === "email" || channel === "both") {
      if (payload.email) {
        const templateKey = payload.email.templateKeyOverride || def?.templateKey;
        if (!templateKey) {
          errors.push(`No email template configured for automation "${run.automation_key}"`);
        } else {
          const result = await sendTemplatedEmail({
            templateKey,
            to: payload.email.to,
            vars: payload.email.vars,
            leadId: payload.email.leadId,
            bookingId: payload.email.bookingId,
          });
          if (result.ok) emailSent = true;
          else errors.push(`Email failed: ${result.error ?? "unknown error"}`);
        }
      }
      if (payload.internal_email) {
        if (!def?.internalTemplateKey) {
          errors.push(
            `No internal email template configured for automation "${run.automation_key}"`
          );
        } else {
          const result = await sendInternalNotification(
            def.internalTemplateKey,
            payload.internal_email.vars
          );
          if (result.ok) emailSent = true;
          else errors.push(`Internal email failed: ${result.error ?? "unknown error"}`);
        }
      }
    }

    if ((channel === "in_app" || channel === "both") && payload.in_app) {
      const inApp = payload.in_app;
      const { error } = await sb.from("lifecycle_notifications").insert({
        audience: inApp.audience,
        client_id: inApp.clientId ?? null,
        client_user_id: inApp.clientUserId ?? null,
        admin_id: null,
        kind: run.automation_key,
        title: inApp.title,
        body: inApp.body ?? "",
        href: inApp.href ?? null,
        email_sent: emailSent,
      });
      if (error) errors.push(`In-app notification failed: ${error.message}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Automation execution failed");
  }

  const status: "completed" | "failed" = errors.length ? "failed" : "completed";
  try {
    const { error } = await sb
      .from("automation_runs")
      .update({
        status,
        executed_at: nowIso(),
        attempts: run.attempts + 1,
        error: errors.length ? errors.join("; ") : null,
      })
      .eq("id", run.id);
    if (error) {
      console.error(`[lifecycle] executeRun: failed to record outcome for run ${run.id}`, error);
    }
  } catch (err) {
    console.error(`[lifecycle] executeRun: failed to record outcome for run ${run.id}`, err);
  }
  return status;
}

/**
 * Drain due pending runs (cron / admin route). Re-checks that each automation
 * is still enabled before executing.
 */
export async function processDueAutomationRuns(limit = 25): Promise<{
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("automation_runs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to load due automation runs: ${error.message}`);
  }
  const runs = (data ?? []) as AutomationRun[];

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const settingCache = new Map<string, AutomationSetting | null>();

  for (const run of runs) {
    let setting: AutomationSetting | null;
    if (settingCache.has(run.automation_key)) {
      setting = settingCache.get(run.automation_key) ?? null;
    } else {
      const { data: row, error: settingError } = await sb
        .from("automation_settings")
        .select("*")
        .eq("id", run.automation_key)
        .maybeSingle();
      if (settingError) {
        console.error(
          `[lifecycle] processDueAutomationRuns: failed to load setting "${run.automation_key}"`,
          settingError
        );
      }
      setting = (row as AutomationSetting | null) ?? null;
      settingCache.set(run.automation_key, setting);
    }

    const enabled = setting ? setting.enabled : true;
    if (!enabled) {
      const { error: updateError } = await sb
        .from("automation_runs")
        .update({
          status: "skipped",
          executed_at: nowIso(),
          error: "Automation disabled before execution",
        })
        .eq("id", run.id);
      if (updateError) {
        console.error(
          `[lifecycle] processDueAutomationRuns: failed to skip run ${run.id}`,
          updateError
        );
      }
      skipped += 1;
      continue;
    }

    const channel: AutomationChannel = setting
      ? setting.channel
      : AUTOMATION_REGISTRY[run.automation_key]?.defaultChannel ?? "both";
    const status = await executeRun(run, channel);
    if (status === "completed") completed += 1;
    else failed += 1;
  }

  return { processed: runs.length, completed, failed, skipped };
}

/**
 * Admin override: re-execute a failed (or previously skipped) run using the
 * current channel setting, regardless of the enabled flag.
 */
export async function retryFailedRun(
  runId: string
): Promise<{ status: "completed" | "failed"; runId: string }> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load automation run ${runId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Automation run ${runId} not found`);
  }
  const run = data as AutomationRun;
  if (run.status !== "failed" && run.status !== "skipped") {
    throw new Error(
      `Automation run ${runId} is "${run.status}"; only failed or skipped runs can be retried`
    );
  }

  const { data: settingRow, error: settingError } = await sb
    .from("automation_settings")
    .select("*")
    .eq("id", run.automation_key)
    .maybeSingle();
  if (settingError) {
    console.error(
      `[lifecycle] retryFailedRun: failed to load setting "${run.automation_key}"`,
      settingError
    );
  }
  const setting = (settingRow as AutomationSetting | null) ?? null;
  const channel: AutomationChannel = setting
    ? setting.channel
    : AUTOMATION_REGISTRY[run.automation_key]?.defaultChannel ?? "both";

  const status = await executeRun(run, channel);
  return { status, runId: run.id };
}

export async function listAutomationRuns(
  filters: { key?: string; status?: AutomationRunStatus; limit?: number } = {}
): Promise<AutomationRun[]> {
  const sb = requireSupabase();
  let query = sb
    .from("automation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);
  if (filters.key) query = query.eq("automation_key", filters.key);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list automation runs: ${error.message}`);
  }
  return (data ?? []) as AutomationRun[];
}

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------

export type CreateNotificationInput = {
  audience: "client" | "admin";
  clientId?: string;
  clientUserId?: string;
  adminId?: string;
  kind?: string;
  title: string;
  body?: string;
  href?: string;
  emailSent?: boolean;
};

export async function createNotification(
  input: CreateNotificationInput
): Promise<LifecycleNotification> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("lifecycle_notifications")
    .insert({
      audience: input.audience,
      client_id: input.clientId ?? null,
      client_user_id: input.clientUserId ?? null,
      admin_id: input.adminId ?? null,
      kind: input.kind ?? "info",
      title: input.title,
      body: input.body ?? "",
      href: input.href ?? null,
      email_sent: input.emailSent ?? false,
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Failed to create notification "${input.title}": ${error.message}`);
  }
  return data as LifecycleNotification;
}

/**
 * Notification feed, newest first. For a client user, includes both
 * client-wide notifications (client_user_id null) and ones addressed to them.
 */
export async function listNotificationsFor(
  audience: "client" | "admin",
  opts: {
    clientId?: string;
    clientUserId?: string;
    unreadOnly?: boolean;
    limit?: number;
  } = {}
): Promise<LifecycleNotification[]> {
  const sb = requireSupabase();
  let query = sb
    .from("lifecycle_notifications")
    .select("*")
    .eq("audience", audience)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (opts.clientUserId) {
    query = query.or(`client_user_id.is.null,client_user_id.eq.${opts.clientUserId}`);
  }
  if (opts.unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list ${audience} notifications: ${error.message}`);
  }
  return (data ?? []) as LifecycleNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from("lifecycle_notifications")
    .update({ read_at: nowIso() })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    throw new Error(`Failed to mark notification ${id} read: ${error.message}`);
  }
}

export async function markAllRead(
  target: { clientId: string } | { audience: "admin" }
): Promise<void> {
  const sb = requireSupabase();
  let query = sb
    .from("lifecycle_notifications")
    .update({ read_at: nowIso() })
    .is("read_at", null);
  if ("clientId" in target) {
    query = query.eq("audience", "client").eq("client_id", target.clientId);
  } else {
    query = query.eq("audience", "admin");
  }
  const { error } = await query;
  if (error) {
    throw new Error(`Failed to mark all notifications read: ${error.message}`);
  }
}

export async function unreadCount(
  target: { clientId: string } | { audience: "admin" }
): Promise<number> {
  const sb = requireSupabase();
  let query = sb
    .from("lifecycle_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if ("clientId" in target) {
    query = query.eq("audience", "client").eq("client_id", target.clientId);
  } else {
    query = query.eq("audience", "admin");
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }
  return count ?? 0;
}
