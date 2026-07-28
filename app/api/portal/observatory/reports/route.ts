import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppApi, isAppContext } from "@/lib/apps/context";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { listReports, saveReport, deleteReport } from "@/lib/observatory/store";

export const runtime = "nodejs";

const APP = "observatory";

const metaSchema = z
  .object({
    engine: z.string().max(60),
    app: z.string().max(60),
    world: z.string().max(120),
    specHash: z.number(),
    seeds: z.array(z.number()).max(500),
    params: z.record(z.string(), z.number()),
    ranAt: z.string().max(40),
  })
  .partial();

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    report: z.object({
      reportId: z.string().min(1).max(120),
      specId: z.string().min(1).max(120),
      name: z.string().min(1).max(200),
      html: z.string().max(600_000),
      meta: metaSchema.default({}),
    }),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export async function GET() {
  const auth = await requireAppApi();
  if (!isAppContext(auth)) return auth;
  try {
    const reports = await listReports(auth.clientId);
    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[observatory/reports] GET", err);
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAppApi();
  if (!isAppContext(auth)) return auth;
  if (!(await rateLimit(`${APP}-rep:${auth.clientId}:${clientIp(request)}`, 60, 10 * 60_000))) {
    return rateLimitResponse();
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "save") {
      const report = await saveReport(auth.clientId, body.report);
      return NextResponse.json({ report });
    }
    await deleteReport(auth.clientId, body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[observatory/reports] POST", err);
    return NextResponse.json({ error: "Failed to save the report." }, { status: 500 });
  }
}
