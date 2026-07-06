import { NextResponse } from "next/server";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { findClientByEmail } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { toStr, isEmail, LIMITS } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Brute-force protection: 8 attempts per IP per 10 minutes.
  if (!rateLimit(`login:${clientIp(request)}`, 8, 10 * 60_000)) {
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
  // Reject malformed input before doing any (expensive) hashing work.
  if (!isEmail(email) || password.length > LIMITS.passwordMax) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  const client = await findClientByEmail(email);
  // Constant-ish response whether or not the account exists.
  if (!client || !client.passwordHash || !verifyPassword(password, client.passwordHash)) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  await setSessionCookie(client.id, client.email);
  return NextResponse.json({ client: toPublic(client) });
}
