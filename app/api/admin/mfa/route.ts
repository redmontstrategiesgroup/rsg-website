import { NextResponse } from "next/server";
import {
  isAdminContext,
  rateLimitAdminMutator,
  requireAdmin,
} from "@/lib/admin-auth";
import { updateAdminMfa } from "@/lib/store";
import {
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotp,
} from "@/lib/totp";
import { writeAuditEvent } from "@/lib/audit";
import { clientIp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * MFA setup for DB admins.
 * POST { action: "start" } → { secret, otpauthUrl }
 * POST { action: "enable", secret, code } → enable MFA
 * POST { action: "disable", code } → disable MFA
 */
export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_mfa");
  if (!isAdminContext(ctx)) return ctx;

  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  if (ctx.admin.id === "rsg-env-admin" || ctx.admin.id === "rsg-admin") {
    return NextResponse.json(
      {
        error:
          "MFA requires a database admin row. Insert into public.admins, then sign in with that account.",
      },
      { status: 400 }
    );
  }

  let body: { action?: string; secret?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const action = body.action;

  if (action === "start") {
    const secret = generateTotpSecret();
    return NextResponse.json({
      secret,
      otpauthUrl: totpOtpauthUrl({
        secret,
        email: ctx.admin.email,
      }),
    });
  }

  if (action === "enable") {
    const secret = typeof body.secret === "string" ? body.secret : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!secret || !verifyTotp(secret, code)) {
      return NextResponse.json(
        { error: "Invalid authenticator code." },
        { status: 400 }
      );
    }
    const ok = await updateAdminMfa({
      adminId: ctx.admin.id,
      secret,
      enabled: true,
    });
    if (!ok) {
      return NextResponse.json({ error: "Could not enable MFA." }, { status: 500 });
    }
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "admin.mfa_enable",
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, mfaEnabled: true });
  }

  if (action === "disable") {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!ctx.admin.mfaSecret || !verifyTotp(ctx.admin.mfaSecret, code)) {
      return NextResponse.json(
        { error: "Invalid authenticator code." },
        { status: 400 }
      );
    }
    const ok = await updateAdminMfa({
      adminId: ctx.admin.id,
      secret: null,
      enabled: false,
    });
    if (!ok) {
      return NextResponse.json({ error: "Could not disable MFA." }, { status: 500 });
    }
    await writeAuditEvent({
      actorType: "admin",
      actorId: ctx.admin.id,
      actorEmail: ctx.admin.email,
      action: "admin.mfa_disable",
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, mfaEnabled: false });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
