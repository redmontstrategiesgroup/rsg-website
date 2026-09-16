import { createHash } from "node:crypto";

/**
 * Idempotency key store for API requests.
 * - beginIdempotent: insert or retrieve an idempotency row, handling race conditions.
 *   Returns "new" ONLY when a row is successfully inserted (owned by caller).
 *   Returns "in_flight" if a row exists but caller cannot own it (conflict on retry).
 * - completeIdempotent: mark row as done with response (warns on error, never throws).
 * - abandonIdempotent: delete in-flight row on handler error (warns on error, never throws).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IdemDb = { from(table: "api_idempotency"): any };

export function requestHash(method: string, path: string, rawBody: string): string {
  return createHash("sha256").update(`${method.toUpperCase()} ${path}\n${rawBody}`).digest("hex");
}

export function keylessPrincipalId(ip: string): string {
  const h = createHash("sha256").update(ip).digest("hex").slice(0, 12);
  return `00000000-0000-4000-8000-${h}`;
}

export type BeginResult =
  | { kind: "new" }
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "mismatch" }
  | { kind: "in_flight" };

export async function beginIdempotent(
  db: IdemDb,
  input: { principalId: string; key: string; requestHash: string },
): Promise<BeginResult> {
  // Retry loop: at most 2 insert attempts (handles race where row vanishes).
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await db.from("api_idempotency").insert({
      principal_id: input.principalId,
      key: input.key,
      request_hash: input.requestHash,
      status: "in_flight",
    });
    if (!error) return { kind: "new" }; // Successfully inserted; we own this row.
    if (error.code !== "23505") throw new Error(`idempotency insert: ${error.message}`);
    // 23505 conflict: check if a row exists.
    const { data } = await db
      .from("api_idempotency")
      .select("request_hash,status,response_status,response_body")
      .eq("principal_id", input.principalId)
      .eq("key", input.key)
      .maybeSingle();
    if (data) {
      // Row exists: check hash and status.
      if (data.request_hash !== input.requestHash) return { kind: "mismatch" };
      if (data.status === "in_flight") return { kind: "in_flight" };
      return { kind: "replay", status: data.response_status ?? 200, body: data.response_body };
    }
    // Row vanished; retry insert on first attempt.
    if (attempt === 1) continue;
    // On second attempt, row still vanished: return in_flight so caller retries.
    return { kind: "in_flight" };
  }
  return { kind: "in_flight" }; // Unreachable; loop bounds guarantee return above.
}

export async function completeIdempotent(
  db: IdemDb,
  input: { principalId: string; key: string; status: number; body: unknown },
): Promise<void> {
  const { error } = await db
    .from("api_idempotency")
    .update({ status: "done", response_status: input.status, response_body: input.body })
    .eq("principal_id", input.principalId)
    .eq("key", input.key);
  if (error) console.warn("[apiv1] idempotency complete failed:", error.message);
}

export async function abandonIdempotent(db: IdemDb, input: { principalId: string; key: string }): Promise<void> {
  const { error } = await db.from("api_idempotency").delete().eq("principal_id", input.principalId).eq("key", input.key);
  if (error) console.warn("[apiv1] idempotency abandon failed:", error.message);
}
