import { NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + optional readiness. Always returns 200 when the process is up.
 * Set `?ready=1` to also ping Supabase (503 if missing/unreachable).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ready = url.searchParams.get("ready") === "1";
  const body: Record<string, unknown> = {
    ok: true,
    status: "alive",
    at: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
  };

  if (!ready) {
    return NextResponse.json(body);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ...body, ok: false, status: "not_ready", reason: "supabase_unconfigured" },
      { status: 503 }
    );
  }

  try {
    const sb = getSupabase()!;
    const { error } = await sb.from("leads").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ...body, status: "ready" });
  } catch (err) {
    console.error("[health]", err);
    return NextResponse.json(
      { ...body, ok: false, status: "not_ready", reason: "supabase_unreachable" },
      { status: 503 }
    );
  }
}
