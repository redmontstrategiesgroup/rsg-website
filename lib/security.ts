/**
 * Rate limiting + client IP helpers.
 * Prefers Upstash Redis when configured (multi-instance safe); falls back
 * to an in-process sliding window for local/dev.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const buckets = new Map<string, number[]>();
const limiters = new Map<string, Ratelimit>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!upstashConfigured()) return null;
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    const redis = Redis.fromEnv();
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "rsg-rl",
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Sliding-window rate limiter. Returns true if the request is allowed.
 * `key` should combine the route and the client IP, e.g. `contact:1.2.3.4`.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return memoryRateLimit(key, limit, windowMs);
  try {
    const result = await limiter.limit(key);
    return result.success;
  } catch (err) {
    console.warn("[security] Upstash rate limit failed — using memory fallback.", err);
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Best-effort client IP for rate limiting. Prefers x-real-ip (set by the
 * platform proxy and not client-controllable). Falls back to the RIGHTMOST
 * x-forwarded-for entry — the hop the trusted proxy appended — rather than
 * the leftmost, which a client can spoof to rotate its apparent IP and defeat
 * per-IP caps.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim().slice(0, 64);
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 64);
  }
  return "local";
}

const RATE_LIMIT_RESPONSE = {
  error: "Too many requests. Please wait a few minutes and try again.",
};

export function rateLimitResponse() {
  return Response.json(RATE_LIMIT_RESPONSE, { status: 429 });
}
