import { NextResponse } from "next/server";
import { BriefPayloadSchema, payloadError } from "@/lib/briefs/schema";
import { ingestBrief, verifyIngestionSecret } from "@/lib/briefs/ingest";
import { clientIp, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await rateLimit(`brief-ingest:${clientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
  }
  const providedSecret = request.headers.get("authorization") ?? request.headers.get("x-brief-secret");
  if (!verifyIngestionSecret(providedSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return NextResponse.json({ ok: false, error: "A valid Idempotency-Key header is required." }, { status: 400 });
  }

  let json: unknown;
  try { json = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  const parsed = BriefPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid brief payload.", details: payloadError(parsed.error) }, { status: 422 });
  }
  try {
    const result = await ingestBrief(parsed.data, idempotencyKey, "webhook");
    return NextResponse.json({ ok: true, duplicate: result.duplicate, briefId: result.briefId, requestId: result.requestId }, { status: result.duplicate ? 200 : 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "The brief could not be processed. Review the ingestion log." }, { status: 500 });
  }
}
