// Tiny in-memory rate limiter for public API routes.
//
// Scope: a single Node process (the one pm2 instance on EC2). State is lost
// on restart, which is fine — these limits exist to slow down accidental
// hammering and amateur scraping, not to defeat a distributed attacker. If
// we ever scale horizontally, swap this for Upstash / Redis.
//
// Algorithm: fixed-window counter keyed by (route, identifier). Every
// `windowMs`, the counter resets. Cheap O(1) hash lookups.
//
// Usage:
//   import { rateLimit } from "@/lib/rate-limit";
//   const limited = rateLimit({ key: `contact:${ip}`, max: 5, windowMs: 60_000 });
//   if (limited) return new NextResponse("Slow down", { status: 429 });

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow forever from unique IPs. Runs
// once per minute and only when the module is alive, which on the server is
// effectively continuously.
let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }, 60_000);
  // Don't keep the process alive just for this.
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

interface RateLimitOptions {
  /** Stable key per consumer per route, e.g. `"contact:1.2.3.4"`. */
  key: string;
  /** Max requests allowed in the window. */
  max: number;
  /** Window length in ms (e.g. 60_000 = 1 minute). */
  windowMs: number;
}

export interface RateLimitResult {
  /** True if the request should be rejected (429). */
  limited: boolean;
  /** Requests remaining in the current window. 0 when limited. */
  remaining: number;
  /** When the window resets (epoch ms). */
  resetAt: number;
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const bucket = store.get(opts.key);

  if (!bucket || bucket.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + opts.windowMs };
    store.set(opts.key, fresh);
    return { limited: false, remaining: opts.max - 1, resetAt: fresh.resetAt };
  }

  bucket.count += 1;
  const limited = bucket.count > opts.max;
  return {
    limited,
    remaining: Math.max(0, opts.max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Best-effort caller-IP extractor for Next.js route handlers. */
export function callerIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
