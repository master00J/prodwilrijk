import type { StorageRentalItem } from '@/types/database'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export const toUtcDate = (value: string) => new Date(`${value}T00:00:00Z`)

export function getEffectiveM2(item: StorageRentalItem): number {
  const verpakt = item.packing_status === 'verpakt'
  const m2V = item.m2_verpakt != null ? Number(item.m2_verpakt) : null
  const m2B = item.m2_bare != null ? Number(item.m2_bare) : null
  const m2Fallback = item.m2 != null ? Number(item.m2) : null
  if (verpakt && m2V != null) return m2V
  if (m2B != null) return m2B
  return m2Fallback ?? 0
}

/**
 * Single source of truth for item revenue (geprorrateerd per jaar).
 * Used by dashboard totalRevenue, report cost, and item list display.
 */
export function getItemRevenue(item: StorageRentalItem): number {
  const start = item.start_date ? toUtcDate(item.start_date) : null
  if (!start) return 0
  const end = item.end_date && item.end_date.trim() ? toUtcDate(item.end_date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const effectiveEnd = end ? (end.getTime() < today.getTime() ? end : today) : today
  const price = Number(item.price_per_m2 || 0)
  if (!price) return 0

  const m2Bare = Number(item.m2_bare ?? item.m2 ?? 0)
  const m2Verpakt = Number(item.m2_verpakt ?? item.m2 ?? 0)
  const packedAt = item.packed_at ? toUtcDate(item.packed_at) : null

  if (item.packing_status === 'verpakt' && packedAt && m2Bare > 0 && m2Verpakt > 0) {
    const splitMs = packedAt.getTime()
    const startMs = start.getTime()
    const endMs = effectiveEnd.getTime()
    const daysBare =
      splitMs <= startMs
        ? 0
        : splitMs > endMs
          ? Math.floor((endMs - startMs) / MS_PER_DAY) + 1
          : Math.floor((splitMs - startMs) / MS_PER_DAY)
    const daysVerpakt =
      splitMs > endMs
        ? 0
        : splitMs <= startMs
          ? Math.floor((endMs - startMs) / MS_PER_DAY) + 1
          : Math.floor((endMs - splitMs) / MS_PER_DAY) + 1
    return (m2Bare * price * daysBare + m2Verpakt * price * daysVerpakt) / 365
  }

  const m2 = getEffectiveM2(item)
  const days = Math.floor((effectiveEnd.getTime() - start.getTime()) / MS_PER_DAY) + 1
  if (days <= 0) return 0
  return (m2 * price * days) / 365
}

export function getOverlapDays(
  start: Date | null,
  end: Date | null,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const startMs = Math.max((start || rangeStart).getTime(), rangeStart.getTime())
  const endMs = Math.min((end || rangeEnd).getTime(), rangeEnd.getTime())
  if (endMs < startMs) return 0
  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1
}
