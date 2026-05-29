import type { ComponentInput } from '@/lib/pricing-engine/component-engine'
import type { CostingUnit } from '@/lib/pricing-engine/component-engine'
import {
  PALLET_COMPONENT_KEYS,
  PALLET_COMPONENT_LABELS,
  type PalletDimensionsInput,
} from '@/lib/pricing-engine/pallet-dimensions'

export interface SlotDef {
  key: string
  label: string
  materialCategory: string
  dims: Array<'length' | 'width' | 'thickness'>
  defaultCount?: number
  defaultDims?: { length_mm?: number; width_mm?: number; thickness_mm?: number }
  unitHint?: CostingUnit
  help?: string
}

export interface ProductTemplate {
  code: string
  label: string
  allowExtraLines: boolean
  slots: SlotDef[]
}

export const PRODUCT_TEMPLATES: Record<string, ProductTemplate> = {
  PALLET: {
    code: 'PALLET',
    label: 'Pallet',
    allowExtraLines: true,
    slots: [
      { key: 'onderplanken', label: 'Onderplanken', materialCategory: 'houtsoort', dims: ['length', 'width', 'thickness'], defaultCount: 5, defaultDims: { length_mm: 1200, width_mm: 100, thickness_mm: 22 } },
      { key: 'bovenplanken', label: 'Bovenplanken', materialCategory: 'houtsoort', dims: ['length', 'width', 'thickness'], defaultCount: 5, defaultDims: { length_mm: 1200, width_mm: 145, thickness_mm: 22 } },
      { key: 'blokken', label: 'Blokken', materialCategory: 'houtsoort', dims: ['length', 'width', 'thickness'], defaultCount: 9, defaultDims: { length_mm: 145, width_mm: 100, thickness_mm: 78 } },
      { key: 'tussenplanken', label: 'Tussenplanken', materialCategory: 'houtsoort', dims: ['length', 'width', 'thickness'], defaultCount: 0, defaultDims: { length_mm: 1200, width_mm: 100, thickness_mm: 15 } },
    ],
  },

  CRATE: {
    code: 'CRATE',
    label: 'Kist',
    allowExtraLines: true,
    slots: [
      { key: 'wandpanelen', label: 'Wandpanelen (plaat)', materialCategory: 'plaat', dims: ['length', 'width'], defaultCount: 4, unitHint: 'm2', help: 'Plaatmateriaal rekent per m².' },
      { key: 'bodem', label: 'Bodem (plaat)', materialCategory: 'plaat', dims: ['length', 'width'], defaultCount: 1, unitHint: 'm2' },
      { key: 'deksel', label: 'Deksel (plaat)', materialCategory: 'plaat', dims: ['length', 'width'], defaultCount: 1, unitHint: 'm2' },
      { key: 'framehout', label: 'Frame / regels (hout)', materialCategory: 'houtsoort', dims: ['length', 'width', 'thickness'], defaultCount: 0, unitHint: 'm3' },
      { key: 'sluiting', label: 'Sluitingen / nagels', materialCategory: 'extra', dims: [], defaultCount: 0, unitHint: 'piece' },
    ],
  },

  CARTON: {
    code: 'CARTON',
    label: 'Karton / verpakking',
    allowExtraLines: true,
    slots: [
      { key: 'kartonblad', label: 'Kartonblad', materialCategory: 'plaat', dims: ['length', 'width'], defaultCount: 1, unitHint: 'm2' },
      { key: 'foam', label: 'Foam / inlay', materialCategory: 'plaat', dims: ['length', 'width', 'thickness'], defaultCount: 0, help: 'Per m² of per kg afhankelijk van het materiaal.' },
      { key: 'omsnoering', label: 'Omsnoering / band', materialCategory: 'extra', dims: ['length'], defaultCount: 0, unitHint: 'meter' },
      { key: 'etiket', label: 'Etiket', materialCategory: 'extra', dims: [], defaultCount: 0, unitHint: 'piece' },
    ],
  },
}

export function getTemplate(code: string): ProductTemplate | undefined {
  return PRODUCT_TEMPLATES[code.toUpperCase().trim()]
}

export function hasProductTemplate(code: string): boolean {
  return Boolean(getTemplate(code))
}

export function emptyComponentsForTemplate(code: string): ComponentInput[] {
  const tpl = getTemplate(code)
  if (!tpl) return []
  return tpl.slots.map((s) => ({
    key: s.key,
    label: s.label,
    count: s.defaultCount ?? 0,
    length_mm: s.defaultDims?.length_mm,
    width_mm: s.defaultDims?.width_mm,
    thickness_mm: s.defaultDims?.thickness_mm,
  }))
}

export function palletDimensionsToComponents(
  dimensions: PalletDimensionsInput,
  defaultWoodMaterialId?: string,
): ComponentInput[] {
  return PALLET_COMPONENT_KEYS.map((key) => {
    const c = dimensions.components[key]
    return {
      key,
      label: PALLET_COMPONENT_LABELS[key],
      material_id: c?.wood_material_id ?? defaultWoodMaterialId,
      count: c?.count ?? 0,
      length_mm: c?.length_mm,
      width_mm: c?.width_mm,
      thickness_mm: c?.thickness_mm,
    }
  }).filter((c) => (c.count ?? 0) > 0)
}
