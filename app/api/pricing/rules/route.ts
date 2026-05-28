import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

/** GET actieve prijsregels. Filter: ?plant_id=&product_type_id= */
export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const plantId = searchParams.get('plant_id')
  const productTypeId = searchParams.get('product_type_id')

  let query = supabaseAdmin
    .from('pricing_rules')
    .select('id, plant_id, product_type_id, name, rule_config, version, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (plantId) query = query.eq('plant_id', plantId)
  if (productTypeId) query = query.eq('product_type_id', productTypeId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
