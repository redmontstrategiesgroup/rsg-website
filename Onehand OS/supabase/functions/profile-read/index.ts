// ============================================================================
// `profile-read` — serve a person's ability profile to a granted app.
//
// The ability profile lives ONLY in this project (docs/per-app-supabase.md §2).
// The other four apps do not get a mirror of it; they call here, and the grant
// is checked on every single call. That is the point: revocation takes effect
// immediately, not at the next sync.
//
// Deploy:  supabase functions deploy profile-read
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const KNOWN_APPS = ["ghost", "nexus", "observatory", "forge"];

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("RSG_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let app = "";
  try {
    app = String((await req.json())?.app ?? "").toLowerCase();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!KNOWN_APPS.includes(app)) return json({ error: "unknown app" }, 400);

  // ---- the grant check ----------------------------------------------------
  const { data: granted, error: grantErr } = await admin
    .rpc("onehand_has_grant", { p_user: userId, p_app: app });

  if (grantErr) {
    console.error("grant check failed", { userId, app, error: grantErr.message });
    return json({ error: "grant check unavailable" }, 503);
  }

  if (!granted) {
    // Log the denial too — "an app tried and was refused" is exactly the kind of
    // thing the person should be able to see in their access log.
    await admin.from("onehand_access_log")
      .insert({ user_id: userId, app, action: "read", ok: false });
    return json({ error: "no grant for this app", code: "not_granted" }, 403);
  }

  const { data: p, error: readErr } = await admin
    .from("onehand_profiles").select("*").eq("user_id", userId).maybeSingle();

  if (readErr) {
    console.error("profile read failed", { userId, app, error: readErr.message });
    return json({ error: "profile unavailable" }, 503);
  }

  await admin.from("onehand_access_log")
    .insert({ user_id: userId, app, action: "read", ok: true });

  // No profile is a normal state, and it is NOT an error: CONTRACTS.md requires
  // each app to fall back to its own defaults when the profile is missing.
  if (!p) return json({ profile: null }, 200);

  // Shape it as rsg.ability.v1 (CONTRACTS.md Contract 1).
  //
  // Unanswered dimensions are OMITTED, never emitted as a guessed middle value.
  // ability-resolver.js reports absent fields in layout.unresolved so the gap
  // stays visible; sending "moderate" for a question nobody answered produces a
  // layout tuned to a person who does not exist, and hides that it did.
  const profile: Record<string, unknown> = {
    v: 1,
    hand: p.hand,
    fingers: p.fingers,
    reachMM: p.reach_mm,
    inputs: p.inputs ?? [],
    targetScale: Number(p.target_scale),
  };
  if (p.grip !== null)       profile.grip = p.grip;
  if (p.fatigue !== null)    profile.fatigue = p.fatigue;
  if (p.precision !== null)  profile.precision = p.precision;
  if (p.permanence !== null) profile.permanence = p.permanence;

  return json({ profile }, 200);
});
