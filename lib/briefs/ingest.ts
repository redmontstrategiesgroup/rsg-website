import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import type { BriefPayload } from "@/lib/briefs/schema";

export function hashPayload(payload: BriefPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function verifyIngestionSecret(provided: string | null): boolean {
  const expected = process.env.BRIEF_INGESTION_SECRET?.trim();
  if (!expected || expected.length < 24 || !provided) return false;
  const candidate = provided.startsWith("Bearer ") ? provided.slice(7) : provided;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function ingestBrief(
  payload: BriefPayload,
  idempotencyKey: string,
  sourceType: "webhook" | "api" | "manual" | "email" = "webhook"
) {
  const db = getSupabase();
  if (!db) throw new Error("Dashboard storage is not configured.");

  const payloadHash = hashPayload(payload);
  const { data, error } = await db.rpc("ingest_executive_brief", {
    payload,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    source_type: sourceType,
  });
  if (error) {
    await db.from("ingestion_logs").insert({
      // A failed attempt must not reserve the sender's idempotency key; the
      // same delivery can be retried after the underlying problem is fixed.
      idempotency_key: `failed:${idempotencyKey}:${Date.now()}`.slice(0, 500),
      status: "failed",
      payload_hash: payloadHash,
      raw_payload: payload,
      error_message: `Key ${idempotencyKey.slice(0, 120)}: ${error.message}`.slice(0, 500),
      processed_at: new Date().toISOString(),
    }).then(() => undefined);
    throw new Error("Brief ingestion failed.");
  }
  return data as { duplicate: boolean; briefId: string; requestId?: string };
}
