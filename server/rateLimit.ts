import type { Request } from "express";

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Suitable for a single backend instance (e.g. one Railway service). For a
 * multi-instance/horizontal setup, swap the store for Redis.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    buckets.forEach((b, k) => {
      if (now > b.resetAt) buckets.delete(k);
    });
  }

  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= opts.max) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP, honoring the proxy header set by Railway. */
export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const fromHeader = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return (fromHeader?.trim() || req.socket?.remoteAddress || "unknown").toLowerCase();
}

/** Test-only: clears all rate-limit state. */
export function __resetRateLimits() {
  buckets.clear();
}
