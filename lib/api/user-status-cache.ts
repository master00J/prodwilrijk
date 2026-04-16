/**
 * In-memory cache for user verified/role status.
 * Shared between middleware and admin routes for cache invalidation.
 *
 * Note: In-memory caches are per-process. In a serverless/edge environment,
 * invalidation only works if the route handler runs in the same process as
 * middleware. On Vercel edge, middleware runs separately — the 5-minute TTL
 * acts as the upper bound for stale data in that case.
 */

interface CachedStatus {
  verified: boolean
  role: string
  expires: number
}

const cache = new Map<string, CachedStatus>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getCachedStatus(userId: string): CachedStatus | null {
  const entry = cache.get(userId)
  if (entry && entry.expires > Date.now()) {
    return entry
  }
  if (entry) cache.delete(userId)
  return null
}

export function setCachedStatus(userId: string, status: { verified: boolean; role: string }) {
  cache.set(userId, { ...status, expires: Date.now() + CACHE_TTL })
}

export function invalidateCachedStatus(userId: string) {
  cache.delete(userId)
}

export function clearAllCachedStatus() {
  cache.clear()
}
