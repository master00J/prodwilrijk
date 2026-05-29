import { calculatorNotImplemented } from '@/lib/pricing-engine/stub-calculator'
import { hasProductTemplate } from '@/lib/pricing-engine/product-templates'
import type { PricingCalculatorInput, PricingResult } from '@/lib/pricing-engine/types'

export type { PalletPricingInput, PricingResult, PricingCalculatorInput } from '@/lib/pricing-engine/types'
export { calculateProductPrice, componentQuantity } from '@/lib/pricing-engine/component-engine'
export type { ComponentInput, GenericPricingInput, ResolvedProductMaterials } from '@/lib/pricing-engine/component-engine'
export { getTemplate, hasProductTemplate, PRODUCT_TEMPLATES, emptyComponentsForTemplate } from '@/lib/pricing-engine/product-templates'

/**
 * Directe calculator-aanroep zonder masterdata-resolve.
 * Template-producten (PALLET, CRATE, CARTON) moeten via calculatePricingRequest.
 */
export function calculatePrice(
  productTypeCode: string,
  input: PricingCalculatorInput,
): PricingResult {
  const code = productTypeCode.toUpperCase().trim()

  if (hasProductTemplate(code)) {
    throw new Error(`${code}: gebruik calculatePricingRequest (masterdata vereist)`)
  }

  switch (code) {
    case 'COMBI':
      return calculatorNotImplemented('COMBI')
    case 'CUSTOM':
      return calculatorNotImplemented('CUSTOM')
    default:
      throw new Error(`Onbekend producttype: ${productTypeCode}`)
  }
}
