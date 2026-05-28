import { calculatorNotImplemented } from '@/lib/pricing-engine/stub-calculator'
import { calculatePalletPrice } from '@/lib/pricing-engine/pallet-calculator'
import type { PalletPricingInput, PricingCalculatorInput, PricingResult } from '@/lib/pricing-engine/types'
import type { ResolvedPalletMaterials } from '@/lib/pricing/resolve-materials'

export type { PalletPricingInput, PricingResult, PricingCalculatorInput }

/**
 * Centrale pricing-engine: kiest calculator op product_type_code.
 * Voor PALLET: optioneel resolved masterdata (houtsoort + extra materialen).
 */
export function calculatePrice(
  productTypeCode: string,
  input: PricingCalculatorInput,
  resolvedMaterials?: ResolvedPalletMaterials,
): PricingResult {
  const code = productTypeCode.toUpperCase().trim()

  switch (code) {
    case 'PALLET':
      return calculatePalletPrice(input as PalletPricingInput, resolvedMaterials)
    case 'CRATE':
      return calculatorNotImplemented('CRATE')
    case 'CARTON':
      return calculatorNotImplemented('CARTON')
    case 'COMBI':
      return calculatorNotImplemented('COMBI')
    case 'CUSTOM':
      return calculatorNotImplemented('CUSTOM')
    default:
      throw new Error(`Onbekend producttype: ${productTypeCode}`)
  }
}
