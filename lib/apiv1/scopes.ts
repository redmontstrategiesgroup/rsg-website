import { can, type SchedulingPermission, type SchedulingRole } from "../scheduling/permissions.ts";

export const CLIENT_SCOPES = [
  "projects:read", "projects:write", "tickets:read", "tickets:write",
  "briefs:read", "briefs:write", "files:read", "billing:read", "webhooks:manage",
] as const;
export type ClientScope = (typeof CLIENT_SCOPES)[number];

export const ADMIN_SCOPES = [
  "leads:read", "leads:write", "clients:read", "proposals:read",
  "dashboard:read", "dashboard:write", "audit:read", "analytics:read", "webhooks:manage",
] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];
export type Scope = ClientScope | AdminScope;

/** Spec §1.4. null = any admin may hold it. */
export const ADMIN_SCOPE_PERMISSION: Record<AdminScope, SchedulingPermission | null> = {
  "leads:read": "manage_leads",
  "leads:write": "manage_leads",
  "clients:read": "manage_clients",
  "proposals:read": "manage_clients",
  "dashboard:read": "manage_leads",
  "dashboard:write": "manage_leads",
  "audit:read": "view_audit",
  "analytics:read": "view_analytics",
  "webhooks:manage": null,
};

export function isClientScope(s: string): s is ClientScope {
  return (CLIENT_SCOPES as readonly string[]).includes(s);
}

export function isAdminScope(s: string): s is AdminScope {
  return (ADMIN_SCOPES as readonly string[]).includes(s);
}

export function scopesAllowedFor(role: SchedulingRole): AdminScope[] {
  return ADMIN_SCOPES.filter((s) => {
    const p = ADMIN_SCOPE_PERMISSION[s];
    return p === null || can(p, role);
  });
}

export function capAdminScopes(requested: string[], role: SchedulingRole): { allowed: AdminScope[]; rejected: string[] } {
  const allowedSet = new Set(scopesAllowedFor(role));
  const allowed: AdminScope[] = [];
  const rejected: string[] = [];
  for (const s of requested) {
    if (isAdminScope(s) && allowedSet.has(s)) allowed.push(s);
    else rejected.push(s);
  }
  return { allowed, rejected };
}
