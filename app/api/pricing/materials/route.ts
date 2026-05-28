import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

/** GET masterdata materialen. Filter: ?plant_id=uuid — later BC-sync (source=bc). */
export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const plantId = searchParams.get('plant_id')
  const category = searchParams.get('category')

  // Geen cost_per_unit naar frontend — kostprijzen alleen server-side bij calculate
  let query = supabaseAdmin
    .from('pricing_materials')
    .select('id, plant_id, material_code, name, unit, category, active, updated_at')
    .eq('active', true)
    .order('category')
    .order('name')

  if (plantId) query = query.eq('plant_id', plantId)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
