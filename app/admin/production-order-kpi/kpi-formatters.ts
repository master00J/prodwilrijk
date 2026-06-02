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
  const value = Number(h) || 0
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${value.toFixed(2)} u`
}

export const formatEuro = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? `€ ${n.toFixed(2)}` : '–'

export const formatPct = (n: number | null | undefined) =>
  n != null && Number.isFinite(n) ? `${n.toFixed(1)}%` : '–'

export const formatDelta = (n: number | null | undefined, unit = '') => {
  if (n == null || !Number.isFinite(n)) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}${unit}`
}

export const formatDeltaPct = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export const formatElapsed = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}u ${min}min`
}

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)
