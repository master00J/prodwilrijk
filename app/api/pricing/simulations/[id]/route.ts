import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth, pricingError } from '@/lib/pricing/api-helpers'
import { calculatePricingRequest } from '@/lib/pricing/calculate-request'

export const dynamic = 'force-dynamic'

const DETAIL_SELECT = `
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('pricing_simulations')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

/** PUT — status of herberekening bij gewijzigde input */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const body = await request.json()
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status) updates.status = body.status
    if (body.customer_name !== undefined) updates.customer_name = body.customer_name?.trim() || null
    if (body.customer_code !== undefined) updates.customer_code = body.customer_code?.trim() || null

    if (body.input && body.product_type_code) {
      updates.input_data = body.input
      updates.result_data = await calculatePricingRequest(
        body.product_type_code,
        body.input,
        body.plant_id,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_simulations')
      .update(updates)
      .eq('id', id)
      .select(DETAIL_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bijwerken mislukt'
    return pricingError(message, 400)
  }
}
