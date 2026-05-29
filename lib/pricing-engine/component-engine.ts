import {
  assertNonNegative,
  assertPositive,
  assertRequired,
  roundMoney,
} from '@/lib/pricing-engine/utils'
import type { PricingResult } from '@/lib/pricing-engine/types'

/**
 * Generieke component-/BOM-prijsmotor voor alle producttypes.
 */

export type CostingUnit = 'm3' | 'm2' | 'meter' | 'kg' | 'piece'

export interface ResolvedMaterial {
  id: string
  name: string
  material_code?: string
  costing_unit: CostingUnit
  cost_per_unit: number
  density_kg_m3?: number
  weight_per_piece_kg?: number
}

export interface ComponentInput {
  key: string
  label?: string
  material_id?: string
  count: number
  length_mm?: number
  width_mm?: number
  thickness_mm?: number
}

export interface ResolvedComponentLine {
  input: ComponentInput
  material: ResolvedMaterial
}

export interface ExtraLineResolved {
  name: string
  unit: string
  quantityPerUnit: number
  costPerUnit: number
}

export interface ResolvedProductMaterials {
  components: ResolvedComponentLine[]
  extras?: ExtraLineResolved[]
}

export interface GenericPricingInput {
  quantity: number
  components?: ComponentInput[]
  extra_materials?: { material_id: string; quantity_per_unit: number }[]
  labor_minutes_per_unit: number
  labor_cost_per_hour: number
  transport_cost: number
  overhead_percentage: number
  margin_percentage: number
}

const UNIT_LABEL: Record<CostingUnit, string> = {
  m3: 'm³',
  m2: 'm²',
  meter: 'm',
  kg: 'kg',
  piece: 'st',
}

export function componentQuantity(c: ComponentInput, m: ResolvedMaterial): number {
  const n = c.count ?? 0
  const L = c.length_mm ?? 0
  const W = c.width_mm ?? 0
  const T = c.thickness_mm ?? 0
  const volumeM3 = (L * W * T) / 1e9

  switch (m.costing_unit) {
    case 'm3':
      return n * volumeM3
    case 'm2':
      return n * (L * W) / 1e6
    case 'meter':
      return n * L / 1000
    case 'piece':
      return n
    case 'kg':
      if (m.weight_per_piece_kg) return n * m.weight_per_piece_kg
      if (m.density_kg_m3) return n * volumeM3 * m.density_kg_m3
      return 0
    default:
      return 0
  }
}

export function calculateProductPrice(
  raw: GenericPricingInput,
  resolved: ResolvedProductMaterials,
): PricingResult {
  assertRequired(raw.quantity, 'Aantal')
  const quantity = assertPositive(raw.quantity, 'Aantal')

  const laborMinutesPerUnit = assertNonNegative(raw.labor_minutes_per_unit, 'Arbeid minuten per stuk')
  const laborCostPerHour = assertNonNegative(raw.labor_cost_per_hour, 'Arbeidskost per uur')
  const transportCost = assertNonNegative(raw.transport_cost, 'Transportkost')
  const overheadPct = assertNonNegative(raw.overhead_percentage, 'Overheadpercentage')
  const marginPct = assertNonNegative(raw.margin_percentage, 'Margepercentage')

  const componentBreakdown: PricingResult['breakdown'] = []
  const componentMeta: NonNullable<PricingResult['meta']>['component_lines'] = []
  let materialCost = 0

  for (const line of resolved.components) {
    const qtyPerUnit = componentQuantity(line.input, line.material)
    if (qtyPerUnit <= 0) continue
    const lineCost = roundMoney(quantity * qtyPerUnit * line.material.cost_per_unit)
    materialCost += lineCost
    const u = UNIT_LABEL[line.material.costing_unit]
    componentBreakdown.push({
      label: `${line.input.label ?? line.input.key} (${line.input.count} st, ${qtyPerUnit.toFixed(4)} ${u}/stuk × ${line.material.name})`,
      amount: lineCost,
    })
    componentMeta.push({
      key: line.input.key,
      label: line.input.label ?? line.input.key,
      count: line.input.count,
      quantity_per_unit: roundMoney(qtyPerUnit),
      costing_unit: line.material.costing_unit,
      material: line.material.name,
    })
  }
  materialCost = roundMoney(materialCost)

  const laborCost = roundMoney(quantity * (laborMinutesPerUnit / 60) * laborCostPerHour)

  const breakdownExtras: PricingResult['breakdown'] = []
  let extraMaterialCost = 0
  for (const line of resolved.extras ?? []) {
    const lineTotal = roundMoney(quantity * line.quantityPerUnit * line.costPerUnit)
    extraMaterialCost += lineTotal
    breakdownExtras.push({
      label: `Extra — ${line.name} (${line.quantityPerUnit} ${line.unit}/st × ${quantity} st)`,
      amount: lineTotal,
    })
  }
  extraMaterialCost = roundMoney(extraMaterialCost)

  const baseCost = roundMoney(materialCost + laborCost + extraMaterialCost + transportCost)
  const overheadCost = roundMoney(baseCost * (overheadPct / 100))
  const totalCost = roundMoney(baseCost + overheadCost)
  const marginAmount = roundMoney(totalCost * (marginPct / 100))
  const salesPrice = roundMoney(totalCost + marginAmount)
  const pricePerUnit = roundMoney(salesPrice / quantity)

  const volumeM3PerUnit = componentMeta
    .filter((c) => c.costing_unit === 'm3')
    .reduce((sum, c) => sum + (c.quantity_per_unit ?? 0), 0)

  return {
    materialCost,
    laborCost,
    extraMaterialCost,
    transportCost: roundMoney(transportCost),
    overheadCost,
    totalCost,
    marginAmount,
    salesPrice,
    pricePerUnit,
    breakdown: [
      ...componentBreakdown,
      { label: 'Arbeid', amount: laborCost },
      ...breakdownExtras,
      { label: 'Transport', amount: roundMoney(transportCost) },
      { label: 'Overhead', amount: overheadCost },
      { label: 'Marge', amount: marginAmount },
    ],
    meta: {
      wood_volume_m3_per_pallet: volumeM3PerUnit > 0 ? roundMoney(volumeM3PerUnit) : undefined,
      wood_volume_m3_total: volumeM3PerUnit > 0 ? roundMoney(volumeM3PerUnit * quantity) : undefined,
      component_lines: componentMeta.length > 0 ? componentMeta : undefined,
      extra_lines: (resolved.extras ?? []).map((e) => ({
        name: e.name,
        unit: e.unit,
        qty_per_unit: e.quantityPerUnit,
        cost_per_unit: e.costPerUnit,
      })),
    },
  }
}
