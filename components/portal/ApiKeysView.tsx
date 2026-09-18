"use client";

import { ApiKeysManager } from "@/components/shared/ApiKeysManager";
import type { ApiKeyDto } from "@/lib/apiv1/key-store";

export type { ApiKeyDto };

/**
 * Thin portal wrapper around the shared ApiKeysManager (extracted for
 * Task 19 so the admin console's ApiKeysAdminPanel can reuse the same
 * table + create/revoke modals with a different endpoint/scopes).
 */
export function ApiKeysView({
  initialKeys,
  scopes,
  endpoint,
}: {
  initialKeys: ApiKeyDto[];
  scopes: string[];
  endpoint: string;
}) {
  return <ApiKeysManager endpoint={endpoint} scopes={scopes} initialKeys={initialKeys} />;
}
