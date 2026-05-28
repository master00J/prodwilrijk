/**
 * Maatvoering pallet-onderdelen → houtvolume (m³).
 * Geometrie alleen; kostprijs gebeurt in pallet-calculator + masterdata.
 */

export const PALLET_COMPONENT_KEYS = [
  'onderplanken',
  'tussenplanken',
  'blokken',
  'bovenplanken',
] as const

export type PalletComponentKey = (typeof PALLET_COMPONENT_KEYS)[number]

export const PALLET_COMPONENT_LABELS: Record<PalletComponentKey, string> = {
  onderplanken: 'Onderplanken',
  tussenplanken: 'Tussenplanken',
  blokken: 'Blokken',
  bovenplanken: 'Bovenplanken',
}

export interface PalletComponentInput {
  /** Aantal stuks van dit onderdeel per pallet */
  count: number
  length_mm: number
  width_mm: number
  /** Dikte / hoogte van het onderdeel in mm */
  thickness_mm: number
  /** Optionele houtsoort; anders pallet-breed houtsoort */
  wood_material_id?: string
}

export interface PalletDimensionsInput {
  /** Totale pallet-afmeting (optioneel, voor referentie / historiek) */
  pallet_length_mm?: number
  pallet_width_mm?: number
  components: Partial<Record<PalletComponentKey, PalletComponentInput>>
}

export interface ComputedPalletComponent {
  key: PalletComponentKey
  label: string
  count: number
  length_mm: number
  width_mm: number
  thickness_mm: number
  wood_material_id?: string
  /** Volume van dit onderdeel voor één pallet (m³) */
  volume_m3_per_pallet: number
}

/** mm³ → m³ */
export function pieceVolumeM3(length_mm: number, width_mm: number, thickness_mm: number): number {
  return (length_mm / 1000) * (width_mm / 1000) * (thickness_mm / 1000)
}

export function computePalletComponents(
  dimensions: PalletDimensionsInput,
): ComputedPalletComponent[] {
  const result: ComputedPalletComponent[] = []

  for (const key of PALLET_COMPONENT_KEYS) {
    const raw = dimensions.components[key]
    if (!raw) continue

    const count = Number(raw.count)
    if (!Number.isFinite(count) || count <= 0) continue

    const length_mm = Number(raw.length_mm)
    const width_mm = Number(raw.width_mm)
    const thickness_mm = Number(raw.thickness_mm)

    if (![length_mm, width_mm, thickness_mm].every((n) => Number.isFinite(n) && n > 0)) {
      throw new Error(`Ongeldige afmetingen voor ${PALLET_COMPONENT_LABELS[key]}`)
    }

    const volOne = pieceVolumeM3(length_mm, width_mm, thickness_mm)
    result.push({
      key,
      label: PALLET_COMPONENT_LABELS[key],
      count,
      length_mm,
      width_mm,
      thickness_mm,
      wood_material_id: raw.wood_material_id,
      volume_m3_per_pallet: volOne * count,
    })
  }

  if (result.length === 0) {
    throw new Error('Voeg minstens één pallet-onderdeel met maatvoering toe')
  }

  return result
}

export function totalWoodVolumePerPallet(components: ComputedPalletComponent[]): number {
  return components.reduce((sum, c) => sum + c.volume_m3_per_pallet, 0)
}

/** Standaard startwaarden EUR-pallet (indicatief, aanpasbaar door sales) */
/** Indicatief volume in UI (geen prijslogica) */
export function previewWoodVolumePerPallet(dimensions: PalletDimensionsInput): number {
  try {
    return totalWoodVolumePerPallet(computePalletComponents(dimensions))
  } catch {
    return 0
  }
}

export function defaultPalletDimensions(): PalletDimensionsInput {
  return {
    pallet_length_mm: 1200,
    pallet_width_mm: 800,
    components: {
      onderplanken: { count: 5, length_mm: 1200, width_mm: 100, thickness_mm: 22 },
      bovenplanken: { count: 5, length_mm: 1200, width_mm: 145, thickness_mm: 22 },
      blokken: { count: 9, length_mm: 145, width_mm: 100, thickness_mm: 78 },
      tussenplanken: { count: 0, length_mm: 1200, width_mm: 100, thickness_mm: 15 }, // optioneel: zet count > 0
    },
  }
}
