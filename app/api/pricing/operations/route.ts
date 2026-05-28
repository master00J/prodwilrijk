import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

/** GET bewerkingen / uurloon. Filter: ?plant_id=uuid — later BC-sync. */
export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const plantId = new URL(request.url).searchParams.get('plant_id')

  let query = supabaseAdmin
    .from('pricing_operations')
    .select('id, plant_id, code, name, cost_per_hour, default_minutes, active, updated_at')
    .eq('active', true)
    .order('name')

  if (plantId) query = query.eq('plant_id', plantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
