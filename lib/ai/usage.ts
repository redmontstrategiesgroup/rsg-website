import { requireSupabase, periodMonth } from "@/lib/lifecycle/core";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { UsageRecord } from "@/lib/ai/proxy";

/**
 * Per-tenant AI usage metering. Records each server-side Anthropic call
 * (exact tokens) and enforces a monthly per-tenant ceiling, so the shared key
 * can never be silently drained by one tenant. Pass recordAiUsage as the
 * lib/ai/proxy `onUsage` hook; call isTenantOverAiCap before a proxy
 * invocation to enforce the cap (the app-mount helper wires both automatically).
 *
 * Backed by the ai_usage table (service-role only). DB round-trips require
 * Supabase to be configured; when it is not, recording no-ops and the cap
 * check fails OPEN so local/preview never breaks.
 */

/**
 * Approximate per-model USD rates as { input, output } per 1,000,000 tokens.
 * These are ESTIMATES for internal cost attribution only — verify against
 * current Anthropic pricing before showing any dollar figure to a customer.
 * Tokens stored are exact; only the derived cost is an estimate. Override the
 * whole map (or add models) via AI_PRICES_JSON.
 */
const DEFAULT_PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-fable-5": { in: 1, out: 5 },
};

function prices(): Record<string, { in: number; out: number }> {
  const raw = process.env.AI_PRICES_JSON;
  if (!raw) return DEFAULT_PRICES;
  try {
    return { ...DEFAULT_PRICES, ...(JSON.parse(raw) as Record<string, { in: number; out: number }>) };
  } catch {
    return DEFAULT_PRICES;
  }
}

/**
 * Estimated USD cost of one call: exact token counts × approximate per-model
 * rate. An unknown model returns 0 (tokens are still recorded) rather than a
 * fabricated figure. Rounded to 6dp to match the numeric(12,6) column.
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = prices()[model];
  if (!rate) return 0;
  const cost = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  return Math.round(cost * 1e6) / 1e6;
}

/** Default monthly per-tenant token ceiling (input + output). Override via env. */
export const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP ?? 5_000_000);

/**
 * Persist one usage row. Shaped to be passed directly as lib/ai/proxy's
 * onUsage hook. NEVER throws — metering must not break a user-facing AI call.
 */
export async function recordAiUsage(u: UsageRecord): Promise<void> {
  try {
    const sb = requireSupabase();
    await sb.from("ai_usage").insert({
      client_id: u.tenantId,
      app: u.app,
      model: u.model,
      input_tokens: u.inputTokens,
      output_tokens: u.outputTokens,
      cost_usd: estimateCostUsd(u.model, u.inputTokens, u.outputTokens),
      period: periodMonth(),
    });
  } catch (err) {
    console.error("[ai/usage] failed to record usage", err);
  }
}

export type TenantUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
};

/**
 * This-month usage for one tenant (exact tokens; estimated cost). Sums the
 * month's rows in app code — fine at current volumes; a rollup table or a
 * Postgres aggregate is the scale path if a tenant's monthly row count grows
 * large. Throws if Supabase is unavailable (callers that must not fail should
 * use isTenantOverAiCap, which swallows that).
 */
export async function tenantUsageThisMonth(clientId: string): Promise<TenantUsage> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("ai_usage")
    .select("input_tokens, output_tokens, cost_usd")
    .eq("client_id", clientId)
    .eq("period", periodMonth());
  if (error) throw new Error(`ai_usage query failed: ${error.message}`);
  const rows = (data ?? []) as {
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number | string | null;
  }[];
  const inputTokens = rows.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const outputTokens = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const costUsd = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd };
}

/**
 * True when a tenant has reached the monthly token ceiling. Call BEFORE a proxy
 * invocation to enforce a hard cap.
 *
 * Failure mode is deliberately asymmetric:
 *  - Supabase NOT configured (local/preview) → fail OPEN (false). There is no
 *    shared production key to protect and metering is expected to be absent.
 *  - Supabase configured but the read FAILS (query error, or the `ai_usage`
 *    table missing/unmigrated in production) → fail CLOSED (true). This is
 *    exactly the case where the cap would otherwise silently disappear and one
 *    tenant could drain the shared key uncapped, so we block and shout instead.
 *    The fix for the resulting outage is to apply the ai_usage migration, not
 *    to fail open.
 */
export async function isTenantOverAiCap(clientId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false; // local/preview — nothing to protect
  try {
    const usage = await tenantUsageThisMonth(clientId);
    return usage.totalTokens >= MONTHLY_TOKEN_CAP;
  } catch (err) {
    console.error(
      "[ai/usage] cap check FAILED with Supabase configured — failing CLOSED. " +
        "Is the ai_usage table migrated? Blocking AI to protect the shared key.",
      err
    );
    return true;
  }
}
