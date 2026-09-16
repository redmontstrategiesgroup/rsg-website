import { createHash } from "node:crypto";

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
  const { error } = await db.from("api_idempotency").insert({
    principal_id: input.principalId,
    key: input.key,
    request_hash: input.requestHash,
    status: "in_flight",
  });
  if (!error) return { kind: "new" };
  if (error.code !== "23505") throw new Error(`idempotency insert: ${error.message}`);
  const { data } = await db
    .from("api_idempotency")
    .select("request_hash,status,response_status,response_body")
    .eq("principal_id", input.principalId)
    .eq("key", input.key)
    .maybeSingle();
  if (!data) return { kind: "new" }; // row vanished between insert and select: treat as fresh
  if (data.request_hash !== input.requestHash) return { kind: "mismatch" };
  if (data.status === "in_flight") return { kind: "in_flight" };
  return { kind: "replay", status: data.response_status ?? 200, body: data.response_body };
}

export async function completeIdempotent(
  db: IdemDb,
  input: { principalId: string; key: string; status: number; body: unknown },
): Promise<void> {
  await db
    .from("api_idempotency")
    .update({ status: "done", response_status: input.status, response_body: input.body })
    .eq("principal_id", input.principalId)
    .eq("key", input.key);
}

export async function abandonIdempotent(db: IdemDb, input: { principalId: string; key: string }): Promise<void> {
  await db.from("api_idempotency").delete().eq("principal_id", input.principalId).eq("key", input.key);
}
