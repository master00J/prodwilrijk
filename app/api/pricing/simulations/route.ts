import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth, pricingError } from '@/lib/pricing/api-helpers'
import { calculatePricingRequest } from '@/lib/pricing/calculate-request'
import { generateSimulationNumber } from '@/lib/pricing/simulation-number'

export const dynamic = 'force-dynamic'

const LIST_SELECT = `
  id,
  simulation_number,
  customer_name,
  customer_code,
  plant_id,
  product_type_id,
  input_data,
  result_data,
  status,
  created_by,
  created_at,
  updated_at,
  pricing_plants ( id, code, name ),
  pricing_product_types ( id, code, name )
`

/** GET — historiek simulaties */
export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') ?? 100), 500)

  const { data, error } = await supabaseAdmin
    .from('pricing_simulations')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST — nieuwe simulatie opslaan (herberekent server-side) */
export async function POST(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const {
      customer_name,
      customer_code,
      plant_id,
      product_type_id,
      product_type_code,
      input,
      status,
    } = body

    if (!product_type_code) return pricingError('product_type_code is verplicht')
    if (!input) return pricingError('input is verplicht')

    const result = await calculatePricingRequest(product_type_code, input, plant_id)
    const simulationNumber = await generateSimulationNumber()

    const { data, error } = await supabaseAdmin
      .from('pricing_simulations')
      .insert({
        simulation_number: simulationNumber,
        customer_name: customer_name?.trim() || null,
        customer_code: customer_code?.trim() || null,
        plant_id: plant_id || null,
        product_type_id: product_type_id || null,
        input_data: input,
        result_data: result,
        status: status ?? 'draft',
        created_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .select(LIST_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Opslaan mislukt'
    return pricingError(message, 400)
  }
}
