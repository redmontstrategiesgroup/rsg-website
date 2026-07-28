/**
 * Role capability map. Env bootstrap admin maps to Owner.
 * DB admins carry their role on AdminRecord.
 */

import type { AdminRole } from "@/lib/types";

export type SchedulingRole = AdminRole;

export type SchedulingPermission =
  | "view_appointments"
  | "edit_appointments"
  | "cancel_appointments"
  | "view_qualification"
  | "override_qualification"
  | "edit_qualification_rules"
  | "edit_availability"
  | "edit_notification_templates"
  | "manage_team"
  | "export_bookings"
  | "view_analytics"
  | "view_private_notes"
  | "manage_leads"
  | "manage_clients"
  | "manage_billing"
  | "view_audit"
  | "manage_mfa"
  // Security Center
  | "view_security"
  | "manage_incidents"
  | "manage_vendors"
  | "manage_retention"
  | "approve_ai_actions"
  | "manage_security_tests"
  | "manage_security_settings"
  // Client lifecycle (Client OS)
  | "manage_proposals"
  | "manage_projects"
  | "manage_support"
  | "manage_training"
  | "manage_automations";

const ALL: SchedulingPermission[] = [
  "view_appointments",
  "edit_appointments",
  "cancel_appointments",
  "view_qualification",
  "override_qualification",
  "edit_qualification_rules",
  "edit_availability",
  "edit_notification_templates",
  "manage_team",
  "export_bookings",
  "view_analytics",
  "view_private_notes",
  "manage_leads",
  "manage_clients",
  "manage_billing",
  "view_audit",
  "manage_mfa",
  "view_security",
  "manage_incidents",
  "manage_vendors",
  "manage_retention",
  "approve_ai_actions",
  "manage_security_tests",
  "manage_security_settings",
  "manage_proposals",
  "manage_projects",
  "manage_support",
  "manage_training",
  "manage_automations",
];

const ROLE_PERMISSIONS: Record<SchedulingRole, SchedulingPermission[]> = {
  owner: ALL,
  administrator: ALL.filter((p) => p !== "manage_team"),
  manager: [
    "view_appointments",
    "edit_appointments",
    "cancel_appointments",
    "view_qualification",
    "override_qualification",
    "edit_availability",
    "export_bookings",
    "view_analytics",
    "manage_leads",
    "view_security",
    "manage_incidents",
    "approve_ai_actions",
    "manage_projects",
    "manage_support",
    "manage_training",
  ],
  scheduler: [
    "view_appointments",
    "edit_appointments",
    "cancel_appointments",
    "view_qualification",
    "edit_availability",
    "view_analytics",
    "manage_leads",
  ],
  consultant: [
    "view_appointments",
    "edit_appointments",
    "view_qualification",
    "view_private_notes",
  ],
  sales: [
    "view_appointments",
    "view_qualification",
    "override_qualification",
    "view_analytics",
    "manage_leads",
    "manage_proposals",
  ],
  employee: [
    "view_appointments",
    "edit_appointments",
    "view_qualification",
    "view_analytics",
    "manage_leads",
  ],
  contractor: ["view_appointments", "view_qualification"],
  security_reviewer: [
    "view_security",
    "view_audit",
    "view_analytics",
    "manage_incidents",
    "manage_vendors",
    "manage_retention",
    "manage_security_tests",
  ],
  viewer: ["view_appointments", "view_analytics"],
};

/** Env admin / default is always Owner. */
export function getAdminRole(role?: SchedulingRole | null): SchedulingRole {
  return role ?? "owner";
}

export function can(
  permission: SchedulingPermission,
  role?: SchedulingRole | null
): boolean {
  const r = getAdminRole(role);
  return ROLE_PERMISSIONS[r].includes(permission);
}

export function requirePermission(
  permission: SchedulingPermission,
  role?: SchedulingRole | null
): boolean {
  return can(permission, role);
}

/** Map scheduling POST actions → required permission. */
export const SCHEDULING_ACTION_PERMISSION: Record<string, SchedulingPermission> = {
  upsert_service: "edit_availability",
  upsert_appointment_type: "edit_availability",
  upsert_question: "edit_qualification_rules",
  reorder_questions: "edit_qualification_rules",
  save_rule_set: "edit_qualification_rules",
  publish_rule_set: "edit_qualification_rules",
  test_qualification: "view_qualification",
  override_qualification: "override_qualification",
  save_availability_windows: "edit_availability",
  add_block: "edit_availability",
  delete_block: "edit_availability",
  update_settings: "edit_notification_templates",
  update_template: "edit_notification_templates",
  send_test_email: "edit_notification_templates",
  create_manual_booking: "edit_appointments",
  admin_cancel: "cancel_appointments",
  admin_reschedule: "edit_appointments",
  mark_status: "edit_appointments",
  send_booking_link: "edit_appointments",
  upsert_webhook: "manage_team",
  upsert_team_member: "manage_team",
  update_internal_notes: "view_private_notes",
  pause_bookings: "edit_availability",
};

export const SCHEDULING_SECTION_PERMISSION: Record<string, SchedulingPermission> = {
  dashboard: "view_analytics",
  bookings: "view_appointments",
  calendar: "view_appointments",
  config: "edit_availability",
  jobs: "view_analytics",
  analytics: "view_analytics",
};
