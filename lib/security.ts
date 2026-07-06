/**
 * In-process security helpers for API route handlers: request rate limiting
 * and client-IP extraction. State is per server process — plenty for this
 * deployment, swap for Redis/Upstash if the site ever runs multi-instance.
 */

const buckets = new Map<string, number[]>();

/**
 * Sliding-window rate limiter. Returns true if the request is allowed.
 * `key` should combine the route and the client IP, e.g. `contact:1.2.3.4`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}

/** Best-effort client IP (first hop of x-forwarded-for, set by the proxy). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip")?.slice(0, 64) ?? "local";
}

const RATE_LIMIT_RESPONSE = {
  error: "Too many requests. Please wait a few minutes and try again.",
};

export function rateLimitResponse() {
  return Response.json(RATE_LIMIT_RESPONSE, { status: 429 });
}
