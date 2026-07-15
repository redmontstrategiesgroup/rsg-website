import { NextResponse } from "next/server";
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

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;
  const clients = await getClients();
  return NextResponse.json({ clients: clients.map(toPublic) });
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
