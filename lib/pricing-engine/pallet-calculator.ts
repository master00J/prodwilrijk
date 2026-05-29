import type { PalletPricingInput, PricingResult } from '@/lib/pricing-engine/types'
import type { ResolvedPalletMaterials } from '@/lib/pricing/resolve-materials'
import { calculateProductPrice } from '@/lib/pricing-engine/component-engine'
import { palletDimensionsToComponents } from '@/lib/pricing-engine/product-templates'

/**
 * @deprecated Gebruik calculatePricingRequest + calculateProductPrice.
 * Behouden voor backward-compat tests die ResolvedPalletMaterials doorgeven.
 */
export function calculatePalletPrice(
  raw: PalletPricingInput,
  resolved?: ResolvedPalletMaterials,
): PricingResult {
  if (!resolved?.woodLines?.length) {
    throw new Error('Palletberekening vereist opgeloste materialen (via calculatePricingRequest)')
  }

  const components = raw.dimensions
    ? palletDimensionsToComponents(raw.dimensions, raw.wood_material_id)
    : (raw.components ?? [])

  return calculateProductPrice(
    {
      quantity: raw.quantity,
      components,
      extra_materials: raw.extra_materials,
      labor_minutes_per_unit: raw.labor_minutes_per_unit,
      labor_cost_per_hour: raw.labor_cost_per_hour,
      transport_cost: raw.transport_cost,
      overhead_percentage: raw.overhead_percentage,
      margin_percentage: raw.margin_percentage,
    },
    {
      components: resolved.woodLines.map((line) => ({
        input: {
          key: line.componentKey,
          label: line.componentLabel,
          count: line.count,
        },
        material: {
          id: line.wood.id,
          name: line.wood.name,
          material_code: line.wood.code,
          costing_unit: 'm3',
          cost_per_unit: line.wood.costPerM3,
        },
      })),
      extras: resolved.extras.map((e) => ({
        name: e.name,
        unit: e.unit,
        costPerUnit: e.costPerUnit,
        quantityPerUnit: e.quantityPerUnit,
      })),
    },
  )
}
