// ─────────────────────────────────────────────
//  In-memory sliding-window rate limiter
// ─────────────────────────────────────────────
const buckets = new Map<string, number[]>()

// periodic cleanup to avoid leaks
let lastSweep = Date.now()
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < 60_000)
    if (alive.length === 0) buckets.delete(key)
    else buckets.set(key, alive)
  }
}

/**
 * Rate limit by key. Returns true if allowed, false if exceeded.
 * @param key    unique bucket key (e.g. "login:ip1.2.3.4")
 * @param limit  max hits in window
 * @param windowMs window size in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  sweep()
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'local'
}
