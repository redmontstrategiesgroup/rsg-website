import { NextResponse } from "next/server";
import { verifyPassword, setAdminSessionCookie } from "@/lib/auth";
import { findAdminByEmail } from "@/lib/store";
import { toStr, isEmail, LIMITS } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Brute-force protection: admin sign-in is the most sensitive endpoint.
  if (!rateLimit(`admin-login:${clientIp(request)}`, 6, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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

  await setAdminSessionCookie(admin.id, admin.email);
  return NextResponse.json({ ok: true, name: admin.name });
}
