import { NextRequest, NextResponse } from 'next/server'
import { calculatePricingRequest } from '@/lib/pricing/calculate-request'
import { requirePricingAuth, pricingError } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pricing/calculate
 * Server-side prijsberekening — geen marges/kostprijzen in frontend.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const { product_type_code, input, plant_id } = body

    if (!product_type_code || typeof product_type_code !== 'string') {
      return pricingError('product_type_code is verplicht')
    }
    if (!input || typeof input !== 'object') {
      return pricingError('input is verplicht')
    }

    const result = await calculatePricingRequest(product_type_code, input, plant_id)
    return NextResponse.json({ success: true, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Berekening mislukt'
    return pricingError(message, 400)
  }
}
