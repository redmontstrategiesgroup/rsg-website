/**
 * Safe defaults for optional IndustryConfig fields so incomplete demo
 * datasets (contractor/gym/dental) still run without runtime crashes.
 */
import type { IndustryConfig, RoleConfig, Terminology } from "./types";

export const DEFAULT_TERMINOLOGY: Terminology = {
  record: "lead",
  records: "Leads",
  appointment: "Appointment",
  appointments: "Appointments",
};

export const DEFAULT_ROLES: RoleConfig[] = [
  {
    id: "owner",
    label: "Owner",
    description: "Full access to the demo system.",
    nav: [
      "overview",
      "leads",
      "pipeline",
      "conversations",
      "automations",
      "tasks",
      "calendar",
      "reviews",
      "campaigns",
      "analytics",
      "settings",
    ],
  },
];

export function demoTerminology(config: IndustryConfig): Terminology {
  return config.terminology ?? DEFAULT_TERMINOLOGY;
}

export function demoRoles(config: IndustryConfig): RoleConfig[] {
  return config.roles?.length ? config.roles : DEFAULT_ROLES;
}

export function demoScenarios(config: IndustryConfig) {
  return config.scenarios ?? [];
}
