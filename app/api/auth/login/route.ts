import { NextResponse } from "next/server";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { findClientByEmail, createSessionRecord } from "@/lib/store";
import { toPublic } from "@/lib/seed";
import { toStr, isEmail, LIMITS } from "@/lib/validate";
import { rateLimit, clientIp } from "@/lib/security";

// DB session records are a 90-day backstop; the cookie's 7-day sliding
// window is the real idle timeout. Decoupling them means renewals don't
// need to touch the database.
const SESSION_RECORD_DAYS = 90;

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Brute-force protection: 8 attempts per IP per 10 minutes.
  if (!(await rateLimit(`login:${clientIp(request)}`, 8, 10 * 60_000))) {
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

  const sessionId = await setSessionCookie(client.id, client.email);
  await createSessionRecord({
    sessionId,
    clientId: client.id,
    expiresAt: new Date(Date.now() + SESSION_RECORD_DAYS * 24 * 60 * 60_000),
    userAgent: request.headers.get("user-agent") ?? undefined,
    ip: clientIp(request),
  });
  return NextResponse.json({ client: toPublic(client) });
}
