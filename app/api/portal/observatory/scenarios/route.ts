import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppApi, isAppContext } from "@/lib/apps/context";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/security";
import { listScenarios, saveScenario, deleteScenario } from "@/lib/observatory/store";
import type { ScenarioSpec } from "@/lib/observatory/types";

export const runtime = "nodejs";

const APP = "observatory";

const branchSchema = z.object({
  id: z.string().max(60),
  name: z.string().max(200),
  deltas: z.array(z.object({ type: z.string().max(60) }).passthrough()).max(50).default([]),
});

const specSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  objective: z.string().max(4000).default(""),
  worldId: z.string().max(60),
  worldVersion: z.string().max(30),
  horizonDays: z.number().int().min(1).max(2000),
  seeds: z.number().int().min(1).max(200),
  headlineMetric: z.string().max(60),
  metrics: z.array(z.string().max(60)).max(40),
  branches: z.array(branchSchema).max(40),
  paramOverrides: z.record(z.string(), z.number()).default({}),
  watchOrg: z.string().max(60).nullable().default(null),
  assumptionsNotes: z.array(z.string().max(2000)).max(100).default([]),
  flags: z.array(z.object({ level: z.string().max(30), text: z.string().max(2000) })).max(100).default([]),
  reviewed: z.boolean().default(false),
  createdAt: z.string().max(40),
  status: z.string().max(40).default("draft"),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), spec: specSchema }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export async function GET() {
  const auth = await requireAppApi();
  if (!isAppContext(auth)) return auth;
  try {
    const scenarios = await listScenarios(auth.clientId);
    return NextResponse.json({ scenarios });
  } catch (err) {
    console.error("[observatory/scenarios] GET", err);
    return NextResponse.json({ error: "Failed to load scenarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAppApi();
  if (!isAppContext(auth)) return auth;
  if (!(await rateLimit(`${APP}:${auth.clientId}:${clientIp(request)}`, 120, 10 * 60_000))) {
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
      const scenario = await saveScenario(auth.clientId, body.spec as ScenarioSpec);
      return NextResponse.json({ scenario });
    }
    await deleteScenario(auth.clientId, body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[observatory/scenarios] POST", err);
    return NextResponse.json({ error: "Failed to save the scenario." }, { status: 500 });
  }
}
