/** Manuele vloerstatus (Genk); komt niet uit BC. */
export const PO_FLOOR_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Nog niet gestart' },
  { value: 'sawmill', label: 'Zagerij' },
  { value: 'assembly', label: 'Assemblage' },
  { value: 'ready_transport', label: 'Klaar voor transport' },
  { value: 'completed', label: 'Afgerond (vloer)' },
] as const

export type PoFloorStatusValue = (typeof PO_FLOOR_STATUS_OPTIONS)[number]['value']

const ALLOWED = new Set<string>(PO_FLOOR_STATUS_OPTIONS.map((o) => o.value))

export function isValidPoFloorStatus(v: string | null | undefined): v is PoFloorStatusValue {
  return Boolean(v && ALLOWED.has(v))
}

export function poFloorStatusLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const opt = PO_FLOOR_STATUS_OPTIONS.find((o) => o.value === value)
  return opt?.label ?? value
}
