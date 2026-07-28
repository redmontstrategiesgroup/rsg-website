// ============================================================================
// `ai` — server-side Anthropic proxy.
//
// Canonical copy: shared/supabase/functions/ai/index.ts
// Vendored to:    <app>/supabase/functions/ai/index.ts  (do not edit there)
//
// Closes the standing gap in CONTRACTS.md Contract 2: the Anthropic key stops
// living in localStorage where any XSS on the shared origin can read it, and
// moves into this project's Supabase secrets. The browser never sees it.
//
// Ported from `basic website/lib/ai/proxy` + `lib/ai/usage`, which stay in the
// website for the website's own AI features (docs/per-app-supabase.md §4).
//
// Deploy:  supabase functions deploy ai
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// USD per million tokens. VERIFY THESE against current Anthropic pricing before
// go-live and whenever a model is added — a stale table silently under-bills and
// lets a user sail past their cap.
//
// UNKNOWN_RATE is deliberately high. An unrecognised model must over-estimate,
// never under-estimate: under-estimating is what turns a $5 cap into a $500 bill.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-5":              { in: 15.00, out: 75.00 },
  "claude-sonnet-5":            { in: 3.00,  out: 15.00 },
  "claude-haiku-4-5-20251001":  { in: 1.00,  out: 5.00 },
  "claude-fable-5":             { in: 15.00, out: 75.00 },
  "claude-opus-4-8":            { in: 15.00, out: 75.00 },
};
const UNKNOWN_RATE = { in: 15.00, out: 75.00 };

const APP = Deno.env.get("RSG_APP") ?? "unknown";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("RSG_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function costOf(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? UNKNOWN_RATE;
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller with THEIR token, not the service role. An anonymous
  // caller must not be able to spend the key.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  const admin = createClient(url, serviceKey);

  // ---- spend cap, checked BEFORE the call ---------------------------------
  const { data: remaining, error: capErr } = await admin
    .rpc("ai_cap_remaining", { p_user: userId });

  if (capErr) {
    // Fail CLOSED. If the cap cannot be read, the safe answer is no — an
    // unmetered proxy is the exact failure this function exists to prevent.
    console.error("cap check failed", { userId, app: APP, error: capErr.message });
    return json({ error: "spend cap unavailable" }, 503);
  }
  if (Number(remaining) <= 0) {
    return json({
      error: "monthly AI spend cap reached",
      code: "cap_exceeded",
      remaining_usd: 0,
    }, 402);
  }

  // ---- request ------------------------------------------------------------
  let body: {
    model?: string; system?: string; messages?: unknown[];
    max_tokens?: number; schema?: unknown; stream?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const model = String(body.model ?? "claude-haiku-4-5-20251001");
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages[] required" }, 400);
  }

  const payload: Record<string, unknown> = {
    model,
    max_tokens: Math.min(Number(body.max_tokens ?? 1024), 8192),
    messages: body.messages,
  };
  if (body.system) payload.system = body.system;

  // Structured output, matching the shared claude-bridge contract.
  if (body.schema) {
    payload.tools = [{
      name: "respond",
      description: "Return the structured result.",
      input_schema: body.schema,
    }];
    payload.tool_choice = { type: "tool", name: "respond" };
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set", { app: APP });
    return json({ error: "AI is not configured" }, 503);
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("anthropic unreachable", { app: APP, userId, err: String(err) });
    return json({ error: "AI provider unreachable" }, 502);
  }

  const out = await res.json().catch(() => null);

  // ---- meter --------------------------------------------------------------
  // Record usage even on a failed call: if the provider counted the tokens,
  // so do we. Not metering failures is a hole someone will eventually find.
  const usage = (out && (out as { usage?: { input_tokens?: number; output_tokens?: number } }).usage) ?? {};
  const inTok = Number(usage.input_tokens ?? 0);
  const outTok = Number(usage.output_tokens ?? 0);

  if (inTok || outTok) {
    const { data: link } = await admin
      .from("app_users").select("client_id").eq("id", userId).maybeSingle();

    const { error: meterErr } = await admin.from("ai_usage").insert({
      user_id: userId,
      client_id: link?.client_id ?? null,
      app: APP,
      model,
      input_tokens: inTok,
      output_tokens: outTok,
      cost_usd: costOf(model, inTok, outTok).toFixed(6),
      ok: res.ok,
    });
    // Never fail the user's request because metering failed — but make the gap
    // loud, because unrecorded spend is the thing the cap depends on.
    if (meterErr) {
      console.error("METERING FAILED — spend not recorded", {
        app: APP, userId, model, inTok, outTok, error: meterErr.message,
      });
    }
  }

  if (!res.ok) {
    console.error("anthropic error", { app: APP, userId, status: res.status });
    return json({ error: "AI request failed", status: res.status, detail: out }, res.status);
  }

  return json(out, 200);
});
