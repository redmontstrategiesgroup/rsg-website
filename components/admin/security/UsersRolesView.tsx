"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, type AdminRole } from "@/lib/types";
import type { SecuritySettings } from "@/lib/security-center/types";
import type { PublicAdmin } from "@/components/admin/SecurityCenterPanel";
import { labelClass, type RunFn } from "@/components/admin/security/shared";
import { MfaSetup } from "@/components/admin/security/MfaSetup";

/**
 * A readable map of what each role can do. Mirrors ROLE_PERMISSIONS but is
 * presentation-only — the server is always the source of truth on enforcement.
 */
const ROLE_SUMMARY: Record<AdminRole, string> = {
  owner: "Full access to every area, including team management and all security controls.",
  administrator: "All areas except team management; full security controls.",
  manager: "Leads, scheduling, analytics, incidents, and AI approvals.",
  scheduler: "Appointments, availability, qualification, and leads.",
  consultant: "Appointments and qualification, including private notes.",
  sales: "Leads, appointments, qualification, and analytics.",
  employee: "Day-to-day appointments, qualification, and leads.",
  contractor: "Limited: view appointments and qualification only.",
  security_reviewer: "Security Center, audit logs, incidents, vendors, retention, and tests.",
  viewer: "Read-only: appointments and analytics.",
};

const PERMISSION_COLUMNS: { key: string; label: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "export", label: "Export" },
  { key: "approve", label: "Approve AI" },
  { key: "logs", label: "View logs" },
  { key: "security", label: "Security" },
  { key: "config", label: "Config" },
];

export function UsersRolesView({
  admins,
  settings,
  canManageSettings,
  selfMfaEnabled,
  canManageMfa,
  run,
  busy,
  onMfaChanged,
}: {
  admins: PublicAdmin[];
  settings: SecuritySettings;
  canManageSettings: boolean;
  selfMfaEnabled: boolean;
  canManageMfa: boolean;
  run: RunFn;
  busy: boolean;
  onMfaChanged: () => void;
}) {
  async function toggleRoleMfa(role: AdminRole, on: boolean) {
    const next = on
      ? Array.from(new Set([...settings.mfaRequiredRoles, role]))
      : settings.mfaRequiredRoles.filter((r) => r !== role);
    await run({ action: "update_settings", mfaRequiredRoles: next });
  }

  return (
    <div className="space-y-8">
      {/* Your account MFA */}
      <section className="space-y-3">
        <p className={labelClass}>Your account</p>
        <MfaSetup enabled={selfMfaEnabled} onChanged={onMfaChanged} />
      </section>

      {/* Admin accounts */}
      <section className="space-y-3">
        <p className={labelClass}>Administrators ({admins.length})</p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">MFA</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3.5 text-white">{a.name}</td>
                  <td className="px-4 py-3.5 text-white/60">{a.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/70">
                      {a.roleLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {a.mfaEnabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                        <ShieldCheck size={13} /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                        <ShieldOff size={13} /> Not set
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40">
          Admin accounts are provisioned in the database. MFA is enrolled by
          each admin from their own account panel above.
          {!canManageMfa && " Your role cannot manage other admins' MFA."}
        </p>
      </section>

      {/* Roles & permissions matrix */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className={labelClass}>Roles & permissions</p>
            <p className="mt-1 max-w-2xl text-xs text-white/45">
              Permissions are enforced server-side on every API route and, for
              Supabase tables, by Row Level Security — hiding a button is never
              the control. This matrix summarizes each role.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[0.54rem] uppercase tracking-label text-white/40">
                <th className="px-4 py-3">Role</th>
                {PERMISSION_COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-3 text-center">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center">MFA required</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_ROLES.map((role) => {
                const grid = roleGrid(role);
                return (
                  <tr key={role} className="border-b border-white/[0.06] last:border-0 align-top">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-white">{ADMIN_ROLE_LABELS[role]}</p>
                      <p className="mt-1 max-w-xs text-xs text-white/40">{ROLE_SUMMARY[role]}</p>
                    </td>
                    {PERMISSION_COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3.5 text-center">
                        {grid[c.key] ? (
                          <span className="text-emerald-300">●</span>
                        ) : (
                          <span className="text-white/15">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={settings.mfaRequiredRoles.includes(role)}
                        disabled={!canManageSettings || busy}
                        onChange={(e) => toggleRoleMfa(role, e.target.checked)}
                        className="h-4 w-4 accent-crimson disabled:opacity-40"
                        aria-label={`Require MFA for ${ADMIN_ROLE_LABELS[role]}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManageSettings ? (
          <p className="text-xs text-white/40">
            Requiring MFA for a role blocks that role&apos;s permission-gated
            actions server-side until the admin enrolls (the owner bootstrap
            account is exempt so recovery is always possible).
          </p>
        ) : (
          <p className="text-xs text-white/40">
            Your role can view this matrix but not change MFA enforcement.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * A coarse capability grid per role for display. Kept in sync with
 * ROLE_PERMISSIONS conceptually; presentation-only.
 */
function roleGrid(role: AdminRole): Record<string, boolean> {
  const F = (v: boolean) => v;
  switch (role) {
    case "owner":
      return { view: true, create: true, edit: true, delete: true, export: true, approve: true, logs: true, security: true, config: true };
    case "administrator":
      return { view: true, create: true, edit: true, delete: true, export: true, approve: true, logs: true, security: true, config: true };
    case "manager":
      return { view: true, create: true, edit: true, delete: F(false), export: true, approve: true, logs: F(false), security: true, config: F(false) };
    case "scheduler":
      return { view: true, create: true, edit: true, delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: true };
    case "consultant":
      return { view: true, create: F(false), edit: true, delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: F(false) };
    case "sales":
      return { view: true, create: true, edit: true, delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: F(false) };
    case "employee":
      return { view: true, create: true, edit: true, delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: F(false) };
    case "contractor":
      return { view: true, create: F(false), edit: F(false), delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: F(false) };
    case "security_reviewer":
      return { view: true, create: true, edit: true, delete: F(false), export: true, approve: F(false), logs: true, security: true, config: F(false) };
    case "viewer":
      return { view: true, create: F(false), edit: F(false), delete: F(false), export: F(false), approve: F(false), logs: F(false), security: F(false), config: F(false) };
  }
}
