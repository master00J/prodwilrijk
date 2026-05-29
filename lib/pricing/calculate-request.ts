import { calculateProductPrice } from '@/lib/pricing-engine/component-engine'
import type { ComponentInput, GenericPricingInput } from '@/lib/pricing-engine/component-engine'
import { calculatePrice } from '@/lib/pricing-engine'
import { hasProductTemplate, palletDimensionsToComponents } from '@/lib/pricing-engine/product-templates'
import type { PricingCalculatorInput, PricingResult } from '@/lib/pricing-engine/types'
import { resolveProductMaterials } from '@/lib/pricing/resolve-product-materials'
import type { PalletDimensionsInput } from '@/lib/pricing-engine/pallet-dimensions'

function pickFinancialInput(input: Record<string, unknown>): Omit<GenericPricingInput, 'components' | 'extra_materials'> {
  return {
    quantity: Number(input.quantity),
    labor_minutes_per_unit: Number(input.labor_minutes_per_unit),
    labor_cost_per_hour: Number(input.labor_cost_per_hour),
    transport_cost: Number(input.transport_cost),
    overhead_percentage: Number(input.overhead_percentage),
    margin_percentage: Number(input.margin_percentage),
  }
}

function normalizeComponents(
  code: string,
  input: Record<string, unknown>,
): ComponentInput[] {
  const fromBody = input.components as ComponentInput[] | undefined
  if (Array.isArray(fromBody) && fromBody.length > 0) {
    return fromBody.filter((c) => (c.count ?? 0) > 0)
  }

  if (code === 'PALLET' && input.dimensions) {
    return palletDimensionsToComponents(
      input.dimensions as PalletDimensionsInput,
      input.wood_material_id as string | undefined,
    )
  }

  return []
}

/**
 * Server-side berekening met masterdata — generieke component-engine voor template-producten.
 */
export async function calculatePricingRequest(
  productTypeCode: string,
  input: Record<string, unknown>,
  plantId?: string | null,
): Promise<PricingResult> {
  const code = productTypeCode.toUpperCase().trim()

  if (hasProductTemplate(code)) {
    const components = normalizeComponents(code, input)
    const resolved = await resolveProductMaterials(plantId, code, {
      default_material_id: input.wood_material_id as string | undefined,
      components,
      extra_materials: input.extra_materials as Array<{ material_id: string; quantity_per_unit: number }> | undefined,
    })

    return calculateProductPrice(
      {
        ...pickFinancialInput(input),
        components,
        extra_materials: input.extra_materials as GenericPricingInput['extra_materials'],
      },
      resolved,
    )
  }

  return calculatePrice(productTypeCode, input as PricingCalculatorInput)
}
