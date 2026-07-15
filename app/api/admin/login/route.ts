import { NextResponse } from "next/server";
import {
  verifyPassword,
  setAdminSessionCookie,
} from "@/lib/auth";
import {
  findAdminByEmail,
  createAdminSessionRecord,
} from "@/lib/store";
import { toStr, isEmail, LIMITS } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/security";
import { verifyTotp } from "@/lib/totp";
import { writeAuditEvent } from "@/lib/audit";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const MFA_PENDING_TTL_MS = 5 * 60_000;
const SESSION_RECORD_DAYS = 90;

/** Short-lived signed ticket proving password step passed (MFA pending). */
function signMfaTicket(adminId: string, email: string, exp: number): string {
  const secret = process.env.AUTH_SECRET || "dev";
  const body = Buffer.from(JSON.stringify({ sub: adminId, email, exp })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyMfaTicket(
  ticket: string
): { sub: string; email: string } | null {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const secret = process.env.AUTH_SECRET || "dev";
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { sub: string; email: string; exp: number };
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

async function issueAdminSession(
  request: Request,
  admin: { id: string; email: string; name: string }
) {
  const sessionId = await setAdminSessionCookie(admin.id, admin.email);
  await createAdminSessionRecord({
    sessionId,
    adminId: admin.id,
    expiresAt: new Date(Date.now() + SESSION_RECORD_DAYS * 24 * 60 * 60_000),
    userAgent: request.headers.get("user-agent") ?? undefined,
    ip: clientIp(request),
  });
  await writeAuditEvent({
    actorType: "admin",
    actorId: admin.id,
    actorEmail: admin.email,
    action: "admin.login",
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, name: admin.name });
}

export async function POST(request: Request) {
  if (!(await rateLimit(`admin-login:${clientIp(request)}`, 6, 10 * 60_000))) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: {
    email?: unknown;
    password?: unknown;
    mfaCode?: unknown;
    mfaTicket?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // MFA second step
  const mfaTicket =
    typeof body.mfaTicket === "string" ? body.mfaTicket : "";
  const mfaCode = typeof body.mfaCode === "string" ? body.mfaCode.trim() : "";
  if (mfaTicket) {
    const ticket = verifyMfaTicket(mfaTicket);
    if (!ticket) {
      return NextResponse.json(
        { error: "MFA session expired. Sign in again." },
        { status: 401 }
      );
    }
    const admin = await findAdminByEmail(ticket.email);
    if (!admin || !admin.mfaEnabled || !admin.mfaSecret) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    if (!verifyTotp(admin.mfaSecret, mfaCode)) {
      return NextResponse.json({ error: "Invalid authenticator code." }, { status: 401 });
    }
    return issueAdminSession(request, admin);
  }

  const email = toStr(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  if (!isEmail(email) || password.length > LIMITS.passwordMax) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  const admin = await findAdminByEmail(email);
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  if (admin.mfaEnabled && admin.mfaSecret) {
    const ticket = signMfaTicket(
      admin.id,
      admin.email,
      Date.now() + MFA_PENDING_TTL_MS
    );
    return NextResponse.json({
      ok: true,
      mfaRequired: true,
      mfaTicket: ticket,
    });
  }

  return issueAdminSession(request, admin);
}
