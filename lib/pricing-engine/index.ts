import { calculatorNotImplemented } from '@/lib/pricing-engine/stub-calculator'
import { calculatePalletPrice } from '@/lib/pricing-engine/pallet-calculator'
import type { PalletPricingInput, PricingCalculatorInput, PricingResult } from '@/lib/pricing-engine/types'

export type { PalletPricingInput, PricingResult, PricingCalculatorInput }

/**
 * Centrale pricing-engine: kiest calculator op product_type_code.
 * Business Central later: input kan verrijkt worden met BC-materiaal- en klantprijzen vóór calculate.
 */
export function calculatePrice(
  productTypeCode: string,
  input: PricingCalculatorInput,
): PricingResult {
  const code = productTypeCode.toUpperCase().trim()

  switch (code) {
    case 'PALLET':
      return calculatePalletPrice(input as PalletPricingInput)
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
