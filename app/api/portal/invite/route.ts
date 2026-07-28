import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { acceptInvite } from "@/lib/lifecycle/access";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(10).max(200),
});

/** Public (token-authenticated) — a new teammate setting their password. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not available." }, { status: 503 });
  }
  if (!(await rateLimit(`invite-accept:${clientIp(request)}`, 10, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Choose a password of at least 10 characters." },
      { status: 400 },
    );
  }

  try {
    await acceptInvite(body.token, { password: body.password });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invitation invalid." },
      { status: 400 },
    );
  }
}
