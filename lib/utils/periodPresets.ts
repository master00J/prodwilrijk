// Gedeelde periode-preset helpers voor vergelijkingen op admin-pagina's.
// Week loopt maandag t/m zondag (ISO).

export type ComparePresetKey =
  | 'thisWeekVsLastWeek'
  | 'thisMonthVsLastMonth'
  | 'thisMonthVsLastYearSameMonth'
  | 'thisQuarterVsLastQuarter'
  | 'thisYearVsLastYear'

export interface ComparePresetRange {
  primaryFrom: string
  primaryTo: string
  compareFrom: string
  compareTo: string
}

export function toDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfIsoWeek(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfIsoWeek(date: Date): Date {
  const d = startOfIsoWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

export function getComparePreset(preset: ComparePresetKey, today = new Date()): ComparePresetRange {
  const base = new Date(today)
  base.setHours(0, 0, 0, 0)

  let primaryFrom: Date
  let primaryTo: Date
  let compFrom: Date
  let compTo: Date

  if (preset === 'thisWeekVsLastWeek') {
    primaryFrom = startOfIsoWeek(base)
    primaryTo = base
    const prevAnchor = new Date(primaryFrom)
    prevAnchor.setDate(prevAnchor.getDate() - 1)
    compFrom = startOfIsoWeek(prevAnchor)
    compTo = endOfIsoWeek(prevAnchor)
  } else if (preset === 'thisMonthVsLastMonth') {
    primaryFrom = new Date(base.getFullYear(), base.getMonth(), 1)
    primaryTo = base
    compFrom = new Date(base.getFullYear(), base.getMonth() - 1, 1)
    compTo = new Date(base.getFullYear(), base.getMonth(), 0)
  } else if (preset === 'thisMonthVsLastYearSameMonth') {
    primaryFrom = new Date(base.getFullYear(), base.getMonth(), 1)
    primaryTo = base
    compFrom = new Date(base.getFullYear() - 1, base.getMonth(), 1)
    compTo = new Date(base.getFullYear() - 1, base.getMonth() + 1, 0)
  } else if (preset === 'thisQuarterVsLastQuarter') {
    const q = Math.floor(base.getMonth() / 3)
    primaryFrom = new Date(base.getFullYear(), q * 3, 1)
    primaryTo = base
    const startMonth = (q - 1) * 3
    const year = startMonth < 0 ? base.getFullYear() - 1 : base.getFullYear()
    const normalized = startMonth < 0 ? 9 : startMonth
    compFrom = new Date(year, normalized, 1)
    compTo = new Date(year, normalized + 3, 0)
  } else {
    // thisYearVsLastYear
    primaryFrom = new Date(base.getFullYear(), 0, 1)
    primaryTo = base
    compFrom = new Date(base.getFullYear() - 1, 0, 1)
    compTo = new Date(base.getFullYear() - 1, 11, 31)
  }

  return {
    primaryFrom: toDateInput(primaryFrom),
    primaryTo: toDateInput(primaryTo),
    compareFrom: toDateInput(compFrom),
    compareTo: toDateInput(compTo),
  }
}

// Bereken automatisch dezelfde lengte vorige periode op basis van een range.
export function getPreviousPeriodRange(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null
  const f = new Date(`${from}T00:00:00`)
  const t = new Date(`${to}T00:00:00`)
  if (!Number.isFinite(f.getTime()) || !Number.isFinite(t.getTime())) return null
  const msPerDay = 86400000
  const lengthDays = Math.round((t.getTime() - f.getTime()) / msPerDay) + 1
  const prevTo = new Date(f)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (lengthDays - 1))
  return { from: toDateInput(prevFrom), to: toDateInput(prevTo) }
}

export const COMPARE_PRESET_LABELS: { key: ComparePresetKey; label: string }[] = [
  { key: 'thisWeekVsLastWeek', label: 'Deze week ↔ vorige' },
  { key: 'thisMonthVsLastMonth', label: 'Deze maand ↔ vorige' },
  { key: 'thisMonthVsLastYearSameMonth', label: 'Deze maand ↔ jaar geleden' },
  { key: 'thisQuarterVsLastQuarter', label: 'Kwartaal ↔ vorige' },
  { key: 'thisYearVsLastYear', label: 'Jaar ↔ vorig jaar' },
]
