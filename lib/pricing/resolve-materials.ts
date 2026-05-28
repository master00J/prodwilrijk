import { supabaseAdmin } from '@/lib/supabase/server'
import type { PalletDimensionsInput } from '@/lib/pricing-engine/pallet-dimensions'
import { computePalletComponents } from '@/lib/pricing-engine/pallet-dimensions'

export type PricingMaterialCategory = 'houtsoort' | 'extra' | 'overig'

export interface PricingMaterialRow {
  id: string
  plant_id: string | null
  material_code: string
  name: string
  unit: string
  cost_per_unit: number
  category: PricingMaterialCategory
}

export interface ExtraMaterialInputLine {
  material_id: string
  quantity_per_unit: number
}

export interface ResolvedWood {
  id: string
  code: string
  name: string
  costPerM3: number
}

export interface ResolvedWoodLine {
  componentKey: string
  componentLabel: string
  count: number
  volumeM3PerPallet: number
  wood: ResolvedWood
}

export interface ResolvedExtraLine {
  id: string
  code: string
  name: string
  unit: string
  costPerUnit: number
  quantityPerUnit: number
}

export interface ResolvedPalletMaterials {
  /** Standaard houtsoort (fallback) */
  wood: ResolvedWood | null
  /** Per onderdeel met eigen volume + houtsoort */
  woodLines: ResolvedWoodLine[]
  extras: ResolvedExtraLine[]
}

async function loadMaterialsByIds(ids: string[]): Promise<Map<string, PricingMaterialRow>> {
  if (ids.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from('pricing_materials')
    .select('id, plant_id, material_code, name, unit, cost_per_unit, category')
    .in('id', ids)
    .eq('active', true)

  if (error) throw new Error(error.message)

  const map = new Map<string, PricingMaterialRow>()
  for (const row of data ?? []) {
    map.set(row.id, {
      ...row,
      cost_per_unit: Number(row.cost_per_unit),
      category: row.category as PricingMaterialCategory,
    })
  }
  return map
}

function resolveWoodRow(
  materialId: string,
  byId: Map<string, PricingMaterialRow>,
  plantId: string | null | undefined,
  contextLabel: string,
): ResolvedWood {
  const row = byId.get(materialId)
  if (!row) throw new Error(`Houtsoort niet gevonden (${contextLabel})`)
  if (row.category !== 'houtsoort') throw new Error(`${row.name} is geen houtsoort`)
  if (plantId && row.plant_id && row.plant_id !== plantId) {
    throw new Error(`Houtsoort ${row.name} hoort niet bij de gekozen plant`)
  }
  if (row.unit !== 'm3') throw new Error(`Houtsoort ${row.name} moet eenheid m³ hebben`)
  return {
    id: row.id,
    code: row.material_code,
    name: row.name,
    costPerM3: row.cost_per_unit,
  }
}

/**
 * Haalt kostprijzen uit masterdata — nooit uit onbevestigde frontend-waarden.
 * Later: BC-sync op pricing_materials.cost_per_unit.
 */
export async function resolvePalletMaterials(
  plantId: string | null | undefined,
  input: {
    wood_material_id?: string
    wood_cost_per_m3?: number
    dimensions?: PalletDimensionsInput
    extra_materials?: ExtraMaterialInputLine[]
  },
): Promise<ResolvedPalletMaterials> {
  const woodIds = new Set<string>()
  if (input.wood_material_id) woodIds.add(input.wood_material_id)

  const computed = input.dimensions ? computePalletComponents(input.dimensions) : []
  for (const c of computed) {
    const id = c.wood_material_id || input.wood_material_id
    if (id) woodIds.add(id)
  }

  for (const line of input.extra_materials ?? []) {
    if (line.material_id) woodIds.add(line.material_id)
  }

  const byId = await loadMaterialsByIds([...woodIds])

  let wood: ResolvedWood | null = null
  if (input.wood_material_id) {
    wood = resolveWoodRow(input.wood_material_id, byId, plantId, 'standaard')
  }

  const woodLines: ResolvedWoodLine[] = []
  for (const c of computed) {
    const materialId = c.wood_material_id || input.wood_material_id
    if (!materialId) {
      throw new Error(`Kies een houtsoort voor ${c.label} of een standaard houtsoort`)
    }
    woodLines.push({
      componentKey: c.key,
      componentLabel: c.label,
      count: c.count,
      volumeM3PerPallet: c.volume_m3_per_pallet,
      wood: resolveWoodRow(materialId, byId, plantId, c.label),
    })
  }

  const extras: ResolvedExtraLine[] = []
  for (const line of input.extra_materials ?? []) {
    if (!line.material_id) continue
    const qty = Number(line.quantity_per_unit)
    if (!Number.isFinite(qty) || qty < 0) {
      throw new Error('Hoeveelheid extra materiaal per stuk moet ≥ 0 zijn')
    }
    if (qty === 0) continue

    const row = byId.get(line.material_id)
    if (!row) throw new Error('Extra materiaal niet gevonden in masterdata')
    if (row.category !== 'extra') throw new Error(`${row.name} is geen extra materiaal`)
    if (plantId && row.plant_id && row.plant_id !== plantId) {
      throw new Error(`Extra materiaal ${row.name} hoort niet bij de gekozen plant`)
    }

    extras.push({
      id: row.id,
      code: row.material_code,
      name: row.name,
      unit: row.unit,
      costPerUnit: row.cost_per_unit,
      quantityPerUnit: qty,
    })
  }

  return { wood, woodLines, extras }
}
