import {
  scryptSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";

/**
 * Zero-dependency auth primitives for the RSG client portal.
 *
 * Passwords are hashed with scrypt (salt stored alongside the digest).
 * Sessions are stateless, signed tokens (HMAC-SHA256) stored in an
 * httpOnly cookie — a compact JWT-style envelope without pulling in a lib.
 *
 * In production set AUTH_SECRET to a long random string.
 */

/**
 * No hardcoded fallback secret: a guessable signing key would let anyone
 * forge session cookies. Production fails closed without AUTH_SECRET —
 * resolved lazily (at first use, not module load) so `next build` can
 * collect page data without env vars. Development generates a random
 * per-process secret (sessions simply reset when the dev server restarts).
 */
let cachedSecret: string | null = null;
/**
 * Shared HMAC signing secret. Fails closed in production (throws without a
 * 16+ char AUTH_SECRET); development uses a per-process random secret.
 * Exported so other signed-token flows (e.g. the MFA pending ticket) share
 * the same guarantees instead of a weaker inline fallback.
 */
export function getAuthSecret(): string {
  return getSecret();
}

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.trim().length >= 16) {
    cachedSecret = configured.trim();
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET must be set (16+ random characters) in production. See .env.example."
    );
  }
  // Dev: one random secret per server process, cached on globalThis because
  // each route bundle gets its own module instance.
  const g = globalThis as { __rsgDevAuthSecret?: string };
  g.__rsgDevAuthSecret ??= randomBytes(48).toString("hex");
  cachedSecret = g.__rsgDevAuthSecret;
  return cachedSecret;
}

export const SESSION_COOKIE = "rsg_session";
export const ADMIN_COOKIE = "rsg_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Re-issue an active session at most once an hour (sliding expiration). */
const RENEW_AFTER_SECONDS = 60 * 60;

/* ----------------------------- Passwords ----------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * A fixed valid scrypt hash used only to burn the same CPU as a real password
 * check when an account doesn't exist — closes the login timing side-channel
 * that would otherwise reveal whether an email is registered.
 */
let decoyHash: string | null = null;
export function verifyPasswordDecoy(password: string): void {
  decoyHash ??= hashPassword("rsg-decoy-account-password");
  verifyPassword(password, decoyHash);
}

/* ------------------------------ Tokens ------------------------------- */

type SessionPayload = {
  sub: string; // client id (or admin id)
  email: string;
  role?: "admin";
  sid?: string; // session id — links the cookie to a revocable DB record
  iat?: number; // unix seconds (issued at)
  exp: number; // unix seconds
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(
  sub: string,
  email: string,
  role?: "admin",
  sid?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub,
    email,
    ...(role ? { role } : {}),
    ...(sid ? { sid } : {}),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/* --------------------------- Cookie helpers -------------------------- */

/**
 * Set (or renew) the client session cookie. Pass an existing `sid` to keep
 * the same server-side session record across sliding renewals; omit it on a
 * fresh login to mint a new session id. Returns the session id so the login
 * route can create the matching DB record.
 */
export async function setSessionCookie(
  clientId: string,
  email: string,
  sid?: string
): Promise<string> {
  const sessionId = sid ?? randomUUID();
  const token = createSessionToken(clientId, email, undefined, sessionId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/* ---------------------------- Admin cookie --------------------------- */

/**
 * Set (or renew) the admin session cookie. Pass an existing `sid` to keep
 * the same revocable DB record across sliding renewals.
 */
export async function setAdminSessionCookie(
  adminId: string,
  email: string,
  sid?: string
): Promise<string> {
  const sessionId = sid ?? randomUUID();
  const token = createSessionToken(adminId, email, "admin", sessionId);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function clearAdminSessionCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (payload?.role !== "admin") return null;
  // Revocation check is done in requireAdminSession / page loaders that
  // call isAdminSessionLive — keep this fast for API hot paths that already
  // verified recently. Callers that need hard revoke should use
  // requireLiveAdminSession().
  return payload;
}

/**
 * Admin session that also checks the revocable DB record when a sid is present.
 */
export async function requireLiveAdminSession(): Promise<SessionPayload | null> {
  const payload = await getAdminSession();
  if (!payload) return null;
  if (!payload.sid) return payload; // legacy cookies until re-login
  const { isAdminSessionLive } = await import("@/lib/store");
  const live = await isAdminSessionLive(payload.sid);
  return live ? payload : null;
}

/* ------------------------- Sliding expiration ------------------------- */

function issuedAt(payload: SessionPayload): number {
  return payload.iat ?? payload.exp - SESSION_TTL_SECONDS;
}

/**
 * Re-issue the client session cookie if the current token is more than an
 * hour old, so active portal users stay signed in indefinitely while idle
 * sessions still expire after 7 days. Call from route handlers only
 * (cookies can't be written from server components).
 */
export async function renewSession(): Promise<void> {
  const payload = await getSession();
  if (!payload) return;
  const age = Math.floor(Date.now() / 1000) - issuedAt(payload);
  if (age < RENEW_AFTER_SECONDS) return;
  // Reuse the existing session id so the DB record stays linked.
  await setSessionCookie(payload.sub, payload.email, payload.sid);
}

/** Same sliding renewal for the admin console session. */
export async function renewAdminSession(): Promise<void> {
  const payload = await getAdminSession();
  if (!payload) return;
  const age = Math.floor(Date.now() / 1000) - issuedAt(payload);
  if (age < RENEW_AFTER_SECONDS) return;
  await setAdminSessionCookie(payload.sub, payload.email, payload.sid);
}
