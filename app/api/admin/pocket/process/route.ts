import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { rateLimit, rateLimitResponse } from "@/lib/security";
import { getRecording, processRecording } from "@/lib/pocket/recordings";
import { canStartProcessing } from "@/lib/pocket/rules";

export const runtime = "nodejs";
// Whisper on a 25 MB file plus the Claude summary can take a few minutes.
export const maxDuration = 300;

const BodySchema = z.object({ id: z.string().uuid() });

/** Step 2 of an upload (or a retry): transcribe + summarize one recording. */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;
  if (!(await rateLimit(`pocket:process:${ctx.admin.id}`, 20, 10 * 60_000))) {
    return rateLimitResponse();
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const existing = await getRecording(parsed.data.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Synced recordings are processed by Pocket; a retry is just a fresh pull.
  if (existing.source === "upload" && !canStartProcessing(existing)) {
    return NextResponse.json(
      { error: "This recording is already being processed.", recording: existing },
      { status: 409 },
    );
  }

  const recording = await processRecording(parsed.data.id);
  if (!recording) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ recording });
}
