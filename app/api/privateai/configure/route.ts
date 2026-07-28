import { NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { privateAiSubmitSchema } from "@/lib/private-ai/schema";
import { createPrivateAiOpportunity } from "@/lib/private-ai/opportunities";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await rateLimit(`private-ai:${clientIp(request)}`, 6, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const parsed = privateAiSubmitSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Please check the highlighted fields.", fields },
      { status: 400 }
    );
  }

  // Honeypot
  if (parsed.data.company_site?.trim()) {
    return NextResponse.json({ ok: true });
  }

  // Bot heuristic — too fast
  if (parsed.data.elapsedMs < 2500) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { opportunity } = await createPrivateAiOpportunity(parsed.data);
    return NextResponse.json({
      ok: true,
      id: opportunity.id,
      architecture: opportunity.architecture,
    });
  } catch (err) {
    console.error("[private-ai] submit failed", err);
    return NextResponse.json(
      { error: "Could not save your configuration. Please try again or email us." },
      { status: 500 }
    );
  }
}
