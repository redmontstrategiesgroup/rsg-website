import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "rsg_live_";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BODY_LENGTH = 32;
const TOUCH_INTERVAL_MS = 60_000;

export type ApiKeyRow = {
  id: string;
  principal_type: "client" | "admin";
  principal_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const bytes = randomBytes(BODY_LENGTH);
  let body = "";
  for (let i = 0; i < BODY_LENGTH; i++) body += ALPHABET[bytes[i]! % ALPHABET.length];
  const plaintext = KEY_PREFIX + body;
  return { plaintext, prefix: body.slice(0, 8), hash: hashApiKey(plaintext) };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^bearer\s+(.+)$/i.exec(header.trim());
  const token = m?.[1]?.trim();
  return token ? token : null;
}

export type KeyDeps = {
  findByHash(hash: string): Promise<ApiKeyRow | null>;
  touch(id: string): Promise<void>;
  now?: () => number;
};

const lastTouched = new Map<string, number>();

export async function resolveApiKey(bearer: string | null, deps: KeyDeps): Promise<ApiKeyRow | null> {
  if (!bearer || !bearer.startsWith(KEY_PREFIX) || bearer.length !== KEY_PREFIX.length + BODY_LENGTH) return null;
  const row = await deps.findByHash(hashApiKey(bearer));
  if (!row) return null;
  const now = deps.now ? deps.now() : Date.now();
  if (row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= now) return null;
  const prev = lastTouched.get(row.id) ?? 0;
  if (now - prev >= TOUCH_INTERVAL_MS) {
    lastTouched.set(row.id, now);
    deps.touch(row.id).catch(() => { /* best effort */ });
  }
  return row;
}
