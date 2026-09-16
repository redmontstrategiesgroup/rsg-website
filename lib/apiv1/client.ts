// lib/apiv1/client.ts
import { ApiError } from "./errors.ts";
import type { ClientPrincipal, Principal } from "./principal.ts";

/** Defensive: the pipeline already enforces `auth: "client"` before a handler runs. */
export function clientOf(principal: Principal | null): ClientPrincipal {
  if (!principal || principal.type !== "client") {
    throw new ApiError(403, "insufficient_scope", "A client API key is required.");
  }
  return principal;
}
