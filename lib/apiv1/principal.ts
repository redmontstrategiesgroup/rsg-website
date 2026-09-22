import type { PortalContext } from "../lifecycle/access.ts";
import type { SchedulingRole } from "../scheduling/permissions.ts";
import type { ApiKeyRow } from "./keys.ts";
import { scopesAllowedFor } from "./scopes.ts";

export type ClientPrincipal = { type: "client"; keyId: string; keyName: string; scopes: string[]; portal: PortalContext };
export type AdminPrincipal = { type: "admin"; keyId: string; keyName: string; scopes: string[]; adminId: string; email: string; role: SchedulingRole };
export type Principal = ClientPrincipal | AdminPrincipal;

export type PrincipalDeps = {
  getClient(id: string): Promise<{ id: string; name: string; company: string; email: string; status: string } | null>;
  getAdmin(id: string): Promise<{ id: string; email: string; role: SchedulingRole } | null>;
};

// clients.status values are prospect/onboarding/active/paused/support/former
// (20260717120000_client_lifecycle.sql); onboarding, active and support clients may use the API.
const BLOCKED_CLIENT_STATUSES = new Set(["former", "paused", "prospect"]);

export async function resolvePrincipal(key: ApiKeyRow, deps: PrincipalDeps): Promise<Principal | null> {
  if (key.principal_type === "client") {
    const client = await deps.getClient(key.principal_id);
    if (!client || BLOCKED_CLIENT_STATUSES.has(client.status)) return null;
    return {
      type: "client",
      keyId: key.id,
      keyName: key.name,
      scopes: [...key.scopes],
      portal: {
        client: { id: client.id, name: client.name, company: client.company, email: client.email, status: client.status },
        user: { id: key.id, name: key.name, email: client.email, role: "owner", isLegacyOwner: false },
      },
    };
  }
  const admin = await deps.getAdmin(key.principal_id);
  if (!admin) return null;
  const allowed = new Set<string>(scopesAllowedFor(admin.role));
  return {
    type: "admin",
    keyId: key.id,
    keyName: key.name,
    scopes: key.scopes.filter((s) => allowed.has(s)),
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  };
}
