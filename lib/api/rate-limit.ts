/**
 * In-memory sliding window rate limiter.
 * Works per serverless instance — not shared across Vercel cold starts,
 * but catches rapid abuse within a single instance lifecycle.
 * For production-grade distributed rate limiting, use Upstash Redis.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - windowMs
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const cutoff = now - config.windowMs

  cleanup(config.windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + config.windowMs - now
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: null,
  }
}

export const RATE_LIMITS = {
  general: { windowMs: 60_000, maxRequests: 100 },
  ai_scan: { windowMs: 60_000, maxRequests: 100 },
  ai_chat: { windowMs: 60_000, maxRequests: 20 },
  email: { windowMs: 60_000, maxRequests: 5 },
  auth: { windowMs: 60_000, maxRequests: 15 },
  admin_write: { windowMs: 60_000, maxRequests: 30 },
} satisfies Record<string, RateLimitConfig>
