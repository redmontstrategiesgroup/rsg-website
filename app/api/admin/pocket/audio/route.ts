import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminContext, requireAdmin } from "@/lib/admin-auth";
import { getAudioUrl } from "@/lib/pocket/recordings";
import { IntegrationError } from "@/lib/integration-log";

export const runtime = "nodejs";

/** Short-lived signed URL for playing back a recording in the console. */
export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_leads");
  if (!isAdminContext(ctx)) return ctx;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  try {
    const url = await getAudioUrl(id);
    if (!url) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // Pocket keeps transcripts after it drops the audio file; that is an
    // expected "no audio" state, not a server fault.
    if (err instanceof IntegrationError && err.errorClass === "not_found") {
      // 200, not 404: the browser logs every 4xx as a console error, and
      // this is a normal state the panel explains inline.
      return NextResponse.json(
        { url: null, available: false, error: "Pocket no longer has the audio for this recording." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[/api/admin/pocket/audio]", err);
    return NextResponse.json({ error: "Audio unavailable." }, { status: 500 });
  }
}
