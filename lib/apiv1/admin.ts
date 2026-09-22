import { writeAuditEvent } from "@/lib/audit";
import { ApiError } from "./errors.ts";
import type { AdminPrincipal, Principal } from "./principal.ts";

export function adminOf(principal: Principal | null): AdminPrincipal {
  if (!principal || principal.type !== "admin") throw new ApiError(403, "insufficient_scope", "An admin API key is required.");
  return principal;
}

export async function auditVia(
  principal: AdminPrincipal,
  input: { action: string; entityType: string; entityId: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await writeAuditEvent({
    actorType: "admin",
    actorId: principal.adminId,
    actorEmail: principal.email,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: { via: "api", key_id: principal.keyId, ...(input.metadata ?? {}) },
  });
}
