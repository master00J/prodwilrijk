import { calculatePrice } from '@/lib/pricing-engine'
import type { PricingCalculatorInput, PricingResult } from '@/lib/pricing-engine/types'
import { resolvePalletMaterials } from '@/lib/pricing/resolve-materials'

/**
 * Server-side berekening met masterdata voor houtsoort & extra materialen.
 */
export async function calculatePricingRequest(
  productTypeCode: string,
  input: Record<string, unknown>,
  plantId?: string | null,
): Promise<PricingResult> {
  const code = productTypeCode.toUpperCase().trim()

  if (code === 'PALLET') {
    const resolved = await resolvePalletMaterials(plantId, {
      wood_material_id: input.wood_material_id as string | undefined,
      wood_cost_per_m3: input.wood_cost_per_m3 as number | undefined,
      dimensions: input.dimensions as import('@/lib/pricing-engine/pallet-dimensions').PalletDimensionsInput | undefined,
      extra_materials: input.extra_materials as Array<{ material_id: string; quantity_per_unit: number }> | undefined,
    })

    return calculatePrice(code, input as PricingCalculatorInput, resolved)
  }

  return calculatePrice(productTypeCode, input as PricingCalculatorInput)
}
