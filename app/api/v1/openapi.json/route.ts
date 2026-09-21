import { NextResponse } from "next/server";
import { apiPlatformEnabled } from "@/lib/env";
import { buildOpenApi } from "@/lib/apiv1/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The generated OpenAPI 3.1 document. Deliberately outside `withApi`: it is
 * keyless, must not register itself as an operation, is not rate-limited and
 * does not log usage. `scripts/gen-v1-index.mjs` skips this file.
 */
export async function GET() {
  if (!apiPlatformEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const doc = await buildOpenApi();
  return NextResponse.json(doc, {
    headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
