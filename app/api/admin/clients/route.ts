import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { getClients, createClient, findClientByEmail } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { Validator, toStr, isEmail, LIMITS } from "@/lib/validate";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { listClientsPage } from "@/lib/lifecycle/paged-admin";
import { parseListParams } from "@/lib/apiv1/pagination";
import { searchTerm } from "@/lib/apiv1/search";
import { toClientAdminDto } from "@/lib/apiv1/serializers-admin";

export const runtime = "nodejs";

const CLIENT_STATUSES = ["active", "paused", "former"] as const;

const ListQuery = z.object({
  status: z.enum(CLIENT_STATUSES).optional(),
  q: z.string().max(80).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export async function GET(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const url = new URL(request.url);
  const sp = url.searchParams;
  const hasPagedParams =
    sp.has("q") || sp.has("status") || sp.has("limit") || sp.has("cursor");

  if (!hasPagedParams) {
    const clients = await getClients();
    return NextResponse.json({ clients: clients.map(toPublic) });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase required" }, { status: 503 });
  }

  const parsed = ListQuery.safeParse({
    status: sp.get("status") ?? undefined,
    q: sp.get("q") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400 }
    );
  }

  const { limit, cursor } = parseListParams(sp);
  const page = await listClientsPage(requireSupabase(), {
    limit,
    cursor,
    q: searchTerm(parsed.data.q),
    status: parsed.data.status,
  });
  return NextResponse.json({
    data: page.data.map(toClientAdminDto),
    meta: { next_cursor: page.next_cursor, limit },
  });
}

/** Provision a new client account. */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const v = new Validator();
  const name = v.requiredString("name", body.name, LIMITS.name);
  const company = v.requiredString("company", body.company, LIMITS.company);
  const email = toStr(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const plan = v.optionalString(body.plan, LIMITS.short);
  const since = v.optionalString(body.since, LIMITS.short);
  const strategist = v.optionalString(body.strategist, LIMITS.name);

  if (!email) v.errors.email = "Email is required.";
  else if (!isEmail(email)) v.errors.email = "Enter a valid email address.";

  if (!password) v.errors.password = "A temporary password is required.";
  else if (password.length < LIMITS.passwordMin)
    v.errors.password = `Password must be at least ${LIMITS.passwordMin} characters.`;
  else if (password.length > LIMITS.passwordMax)
    v.errors.password = "Password is too long.";

  if (!v.valid) {
    return NextResponse.json(
      { error: Object.values(v.errors)[0] ?? "Please correct the fields.", fields: v.errors },
      { status: 400 }
    );
  }

  const existing = await findClientByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "A client with that email already exists.", fields: { email: "Already in use." } },
      { status: 409 }
    );
  }

  const client = await createClient({
    name,
    company,
    email,
    password,
    plan,
    since,
    strategist,
  });

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: "client.create",
    entityType: "client",
    entityId: client.id,
    ip: clientIp(request),
  });

  return NextResponse.json({ client: toPublic(client) }, { status: 201 });
}
