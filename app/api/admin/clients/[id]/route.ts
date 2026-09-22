import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { updateClient } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { Validator, toStr, isEmail, LIMITS } from "@/lib/validate";
import type { ClientPatch } from "@/lib/types";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase } from "@/lib/lifecycle/core";
import { setClientStatus } from "@/lib/lifecycle/paged-admin";

export const runtime = "nodejs";

const StatusSchema = z.enum(["active", "paused", "former"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const v = new Validator();
  const patch: ClientPatch = {};

  if (body.name !== undefined) patch.name = v.optionalString(body.name, LIMITS.name);
  if (body.company !== undefined) patch.company = v.optionalString(body.company, LIMITS.company);
  if (body.plan !== undefined) patch.plan = v.optionalString(body.plan, LIMITS.short);
  if (body.since !== undefined) patch.since = v.optionalString(body.since, LIMITS.short);
  if (body.strategist !== undefined) patch.strategist = v.optionalString(body.strategist, LIMITS.name);

  if (body.email !== undefined) {
    const e = toStr(body.email);
    // Empty string is treated as "no change"; a non-empty value must be valid.
    if (e && !isEmail(e)) v.errors.email = "Enter a valid email address.";
    else if (e) patch.email = e;
  }

  if (body.password !== undefined) {
    const p = typeof body.password === "string" ? body.password : "";
    if (p) {
      if (p.length < LIMITS.passwordMin) {
        v.errors.password = `Password must be at least ${LIMITS.passwordMin} characters.`;
      } else if (p.length > LIMITS.passwordMax) {
        v.errors.password = "Password is too long.";
      } else {
        patch.password = p;
      }
    }
  }

  if (body.metrics !== undefined) {
    if (!Array.isArray(body.metrics)) {
      v.errors.metrics = "Metrics must be a list.";
    } else {
      patch.metrics = body.metrics.map((raw, i) => {
        const m = (raw ?? {}) as Record<string, unknown>;
        return {
          key: toStr(m.key).slice(0, LIMITS.short),
          label: m.label !== undefined ? toStr(m.label).slice(0, LIMITS.short) : undefined,
          value: v.finiteNumber(`metrics[${i}]`, m.value),
          delta: m.delta !== undefined ? toStr(m.delta).slice(0, LIMITS.short) : undefined,
          hint: m.hint !== undefined ? toStr(m.hint).slice(0, LIMITS.short) : undefined,
        };
      });
    }
  }

  let status: z.infer<typeof StatusSchema> | undefined;
  if (body.status !== undefined) {
    const parsedStatus = StatusSchema.safeParse(body.status);
    if (!parsedStatus.success) {
      v.errors.status = "Invalid client status.";
    } else {
      status = parsedStatus.data;
    }
  }

  if (!v.valid) {
    return NextResponse.json(
      { error: "Please correct the highlighted fields.", fields: v.errors },
      { status: 400 }
    );
  }

  if (status !== undefined) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase required" }, { status: 503 });
    }
    // Confirm the Supabase clients row exists FIRST: if the id isn't found
    // there, bail out before touching the local store, so a status patch on
    // an unknown id never leaves other fields mutated with a 404 response.
    const changed = await setClientStatus(requireSupabase(), id, status);
    if (!changed) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "client.status",
      entityType: "client",
      entityId: id,
      metadata: { status },
      ip: clientIp(request),
    });
  }

  const updated = await updateClient(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ client: { ...toPublic(updated), ...(status !== undefined ? { status } : {}) } });
}
