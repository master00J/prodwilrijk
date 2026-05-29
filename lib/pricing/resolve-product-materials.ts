import { supabaseAdmin } from '@/lib/supabase/server'
import type {
  ComponentInput,
  ExtraLineResolved,
  ResolvedComponentLine,
  ResolvedMaterial,
  ResolvedProductMaterials,
} from '@/lib/pricing-engine/component-engine'
import { getTemplate } from '@/lib/pricing-engine/product-templates'
import { unitToCostingUnit } from '@/lib/pricing/material-unit'

export type PricingMaterialCategory = 'houtsoort' | 'extra' | 'overig' | 'plaat'

interface PricingMaterialRow {
  id: string
  plant_id: string | null
  material_code: string
  name: string
  unit: string
  cost_per_unit: number
  category: PricingMaterialCategory
}

interface ExtraMaterialInputLine {
  material_id: string
  quantity_per_unit: number
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

function toResolvedMaterial(row: PricingMaterialRow): ResolvedMaterial {
  return {
    id: row.id,
    name: row.name,
    material_code: row.material_code,
    costing_unit: unitToCostingUnit(row.unit),
    cost_per_unit: row.cost_per_unit,
  }
}

function resolveMaterialRow(
  materialId: string,
  byId: Map<string, PricingMaterialRow>,
  plantId: string | null | undefined,
  contextLabel: string,
  expectedCategory?: string,
): ResolvedMaterial {
  const row = byId.get(materialId)
  if (!row) throw new Error(`Materiaal niet gevonden (${contextLabel})`)
  if (plantId && row.plant_id && row.plant_id !== plantId) {
    throw new Error(`Materiaal ${row.name} hoort niet bij de gekozen plant`)
  }
  if (expectedCategory && row.category !== expectedCategory) {
    throw new Error(`${row.name} hoort niet bij categorie ${expectedCategory} (${contextLabel})`)
  }
  return toResolvedMaterial(row)
}

export async function resolveProductMaterials(
  plantId: string | null | undefined,
  productTypeCode: string,
  input: {
    default_material_id?: string
    components?: ComponentInput[]
    extra_materials?: ExtraMaterialInputLine[]
  },
): Promise<ResolvedProductMaterials> {
  const template = getTemplate(productTypeCode)
  const materialIds = new Set<string>()

  if (input.default_material_id) materialIds.add(input.default_material_id)

  for (const comp of input.components ?? []) {
    if ((comp.count ?? 0) <= 0) continue
    const id = comp.material_id || input.default_material_id
    if (id) materialIds.add(id)
  }

  for (const line of input.extra_materials ?? []) {
    if (line.material_id) materialIds.add(line.material_id)
  }

  const byId = await loadMaterialsByIds([...materialIds])
  const componentLines: ResolvedComponentLine[] = []

  for (const comp of input.components ?? []) {
    if ((comp.count ?? 0) <= 0) continue

    const materialId = comp.material_id || input.default_material_id
    if (!materialId) {
      throw new Error(`Kies een materiaal voor ${comp.label ?? comp.key}`)
    }

    const slot = template?.slots.find((s) => s.key === comp.key)
    const expectedCategory = slot?.materialCategory

    componentLines.push({
      input: comp,
      material: resolveMaterialRow(
        materialId,
        byId,
        plantId,
        comp.label ?? comp.key,
        expectedCategory,
      ),
    })
  }

  if (componentLines.length === 0) {
    throw new Error('Voeg minstens één actief component met materiaal toe')
  }

  const extras: ExtraLineResolved[] = []
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

    extras.push({
      name: row.name,
      unit: row.unit,
      costPerUnit: row.cost_per_unit,
      quantityPerUnit: qty,
    })
  }

  return { components: componentLines, extras }
}
