import "server-only";

/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * CAVEAT: state lives in a single process's memory. On a single long-running
 * Node server this works fine. On serverless / multi-instance hosting
 * (Vercel, Lambda) each instance has its own counters, so this only blunts
 * naive single-instance floods — for hard limits use an external store
 * (Upstash Ratelimit, Redis) or your platform's WAF.
 *
 * Note: Firebase already rate-limits the actual sign-in attempts on its side
 * (the password checks hit Firebase directly, not us), so our exposure here
 * is mostly token-replay / endpoint abuse, which this is adequate for.
 */
type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

// Opportunistic cleanup so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of buckets) {
    if (now > w.resetAt) buckets.delete(key);
  }
}

/** Returns true if the request is allowed, false if it should be blocked. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const w = buckets.get(key);
  if (!w || now > w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/** Derive a client identifier from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
