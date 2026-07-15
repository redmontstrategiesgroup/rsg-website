import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordPageView } from "@/lib/store";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { toStr } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * First-party page-view collection. Records nothing unless the visitor
 * accepted cookies (rsg_consent=all) and carries the anonymous rsg_vid id.
 */
export async function POST(request: Request) {
  if (!(await rateLimit(`analytics:${clientIp(request)}`, 120, 10 * 60_000))) {
    return rateLimitResponse();
  }

  const store = await cookies();
  const consent = store.get("rsg_consent")?.value;
  const vid = store.get("rsg_vid")?.value ?? "";
  if (consent !== "all" || !vid || vid.length > 64) {
    // No consent, nothing recorded — respond quietly.
    return NextResponse.json({ ok: true, recorded: false });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const path = toStr(body.path).slice(0, 200);
  if (!path.startsWith("/") || path.includes("://")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }
  // Marketing pages only — never track the portal or admin.
  if (
    path.startsWith("/portal") ||
    path.startsWith("/admin") ||
    path.startsWith("/login")
  ) {
    return NextResponse.json({ ok: true, recorded: false });
  }

  // Keep only the referrer's host — enough for attribution, nothing more.
  let referrer = "";
  const rawRef = toStr(body.referrer).slice(0, 300);
  if (rawRef) {
    try {
      const url = new URL(rawRef);
      if (url.host !== request.headers.get("host")) referrer = url.host;
    } catch {
      /* unparseable referrer — drop it */
    }
  }

  await recordPageView({
    vid,
    path,
    referrer,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, recorded: true });
}
