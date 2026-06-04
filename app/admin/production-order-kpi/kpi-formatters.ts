export const euroFormatter = new Intl.NumberFormat('nl-BE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
export const euroCompactFormatter = new Intl.NumberFormat('nl-BE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
export const numberFormatter = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 })
export const intFormatter = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 0 })

export const formatDate = (d: string | null | undefined) => {
  if (!d) return '–'
  const datePart = d.slice(0, 10)
  const [y, m, day] = datePart.split('-')
  if (!y || !m || !day) return '–'
  return `${day}/${m}/${y}`
}

export const formatDateTime = (d: string | null | undefined) => {
  if (!d) return '–'
  const datePart = formatDate(d)
  const timePart = d.includes('T') ? d.slice(11, 16) : ''
  return timePart ? `${datePart} ${timePart}` : datePart
}

export const formatDateShort = (d: string) => {
  const [, m, day] = d.slice(0, 10).split('-')
  if (!m || !day) return d
  return `${day}/${m}`
}

export const formatHours = (h: number | null | undefined) => {
  if (!Number.isFinite(Number(h))) return '–'
  const value = Number(h) || 0
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${numberFormatter.format(value)} u`
}

export const formatEuro = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? euroFormatter.format(n) : '–'

export const formatEuroCompact = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? euroCompactFormatter.format(n) : '–'

export const formatPct = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? `${numberFormatter.format(n)} %` : '–'

export const marginPct = (revenue: number | null, margin: number | null): number | null => {
  if (margin == null || revenue == null || revenue <= 0) return null
  return (margin / revenue) * 100
}

export const revPerHour = (revenue: number | null, hours: number): number | null => {
  if (revenue == null || !Number.isFinite(hours) || hours <= 0) return null
  return revenue / hours
}

export const marginColorClass = (pct: number | null) => {
  if (pct == null) return 'text-gray-500'
  if (pct < 0) return 'text-red-600 font-medium'
  if (pct < 15) return 'text-amber-600'
  return 'text-emerald-600 font-medium'
}

export const formatDelta = (n: number | null | undefined, unit = '') => {
  if (n == null || !Number.isFinite(n)) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${numberFormatter.format(n)}${unit}`
}

export const formatDeltaPct = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${numberFormatter.format(n)}%`
}

export const formatElapsed = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}u ${min}min`
}

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

export const daysAgoIso = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toIsoDate(d)
}

export const todayIso = () => toIsoDate(new Date())

export const yearStartIso = () => {
  const d = new Date()
  return toIsoDate(new Date(d.getFullYear(), 0, 1))
}
