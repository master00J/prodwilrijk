/** Airtec item numbers that require special packaging handling. */
export const SPECIAL_PACK_ITEM_NUMBERS = ['1616677081', '1616988381'] as const

export type SpecialPackItemNumber = (typeof SPECIAL_PACK_ITEM_NUMBERS)[number]

export function normalizeAirtecItemNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.replace(/[\s\-\.]/g, '').toUpperCase()
  return normalized || null
}

export function isSpecialPackItemNumber(value: string | null | undefined): boolean {
  const normalized = normalizeAirtecItemNumber(value)
  if (!normalized) return false
  return SPECIAL_PACK_ITEM_NUMBERS.some((n) => normalized === n || normalized.endsWith(n))
}

/** PostgREST `.or()` filter for exact stored item numbers. */
export function specialPackItemOrFilter(column = 'item_number'): string {
  return SPECIAL_PACK_ITEM_NUMBERS.map((n) => `${column}.eq.${n}`).join(',')
}

export const SPECIAL_PACK_LABEL = 'Speciale verpakking'
