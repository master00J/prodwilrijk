import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { requirePricingAuth } from '@/lib/pricing/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePricingAuth(request)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('pricing_product_types')
    .select('id, code, name, description, active')
    .eq('active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
