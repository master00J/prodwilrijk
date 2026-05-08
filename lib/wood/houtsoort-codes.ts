/**
 * Houtsoortcodes na Business Central-migratie:
 * NHV → CWF, MEP → PEP (legacy blijft herkend voor matching).
 */

const LEGACY_TO_BC36: Record<string, string> = {
  NHV: 'CWF',
  MEP: 'PEP',
}

/** Standaarddropdown: volgorde zoals eerder NHV/MEP-plekken. */
export const WOOD_HOUTSOORTEN_BASIC = ['SXT', 'SCH', 'CWF', 'OSB', 'PEP', 'HDB'] as const

/** Uitgebreid (o.a. target stock). */
export const WOOD_HOUTSOORTEN_FULL = [
  ...WOOD_HOUTSOORTEN_BASIC,
  'KD',
  'HBO',
  'MPX',
] as const

/** Herkenning in vrije tekst / oude exports (subset + legacy). */
export const KNOWN_WOOD_TYPE_PREFIXES = [
  'SXT',
  'SCH',
  'CWF',
  'NHV',
  'OSB',
  'PEP',
  'MEP',
  'HDB',
  'KD',
  'HBO',
  'MPX',
  'MDF',
  'HDF',
] as const

export function normalizeWoodTypeCode(raw: string | null | undefined): string {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  return LEGACY_TO_BC36[u] ?? u
}

/** Zelfde materiaal na migratie (NHV ↔ CWF, MEP ↔ PEP). */
export function woodTypeCodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeWoodTypeCode(a) === normalizeWoodTypeCode(b)
}
