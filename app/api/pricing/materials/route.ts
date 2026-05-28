import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

/** GET masterdata materialen. Filter: ?plant_id=uuid — later BC-sync (source=bc). */
export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const plantId = new URL(request.url).searchParams.get('plant_id')

  let query = supabaseAdmin
    .from('pricing_materials')
    .select('id, plant_id, material_code, name, unit, cost_per_unit, source, active, updated_at')
    .eq('active', true)
    .order('name')

  if (plantId) query = query.eq('plant_id', plantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
