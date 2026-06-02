export type DatePeriodPreset =
  | 'vandaag'
  | 'gisteren'
  | 'deze_week'
  | 'vorige_week'
  | 'deze_maand'
  | 'vorige_maand'

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

export function resolvePeriodPreset(preset: string): { date_from: string; date_to: string } | null {
  const key = preset.trim().toLowerCase().replace(/\s+/g, '_')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (key === 'vandaag' || key === 'today') {
    const iso = toIsoDate(today)
    return { date_from: iso, date_to: iso }
  }

  if (key === 'gisteren' || key === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const iso = toIsoDate(y)
    return { date_from: iso, date_to: iso }
  }

  if (key === 'deze_week' || key === 'this_week') {
    const from = startOfWeekMonday(today)
    return { date_from: toIsoDate(from), date_to: toIsoDate(today) }
  }

  if (key === 'vorige_week' || key === 'last_week') {
    const thisWeekStart = startOfWeekMonday(today)
    const prevEnd = new Date(thisWeekStart)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = startOfWeekMonday(prevEnd)
    return { date_from: toIsoDate(prevStart), date_to: toIsoDate(prevEnd) }
  }

  if (key === 'deze_maand' || key === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { date_from: toIsoDate(from), date_to: toIsoDate(today) }
  }

  if (key === 'vorige_maand' || key === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { date_from: toIsoDate(from), date_to: toIsoDate(to) }
  }

  return null
}

export function resolveAssistantDateRange(input?: {
  date_from?: string
  date_to?: string
  period?: string
  defaultDays?: number
}): { date_from: string; date_to: string } {
  if (input?.period) {
    const preset = resolvePeriodPreset(input.period)
    if (preset) return preset
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date_to =
    typeof input?.date_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date_to)
      ? input.date_to
      : toIsoDate(today)

  if (typeof input?.date_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date_from)) {
    return { date_from: input.date_from, date_to }
  }

  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - (input?.defaultDays ?? 7))
  return { date_from: toIsoDate(fromDate), date_to }
}

/** Vorige periode met zelfde lengte als [from, to] (inclusief). */
export function previousPeriodRange(range: { date_from: string; date_to: string }): {
  date_from: string
  date_to: string
} {
  const from = new Date(`${range.date_from}T00:00:00`)
  const to = new Date(`${range.date_to}T00:00:00`)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { date_from: toIsoDate(prevFrom), date_to: toIsoDate(prevTo) }
}
