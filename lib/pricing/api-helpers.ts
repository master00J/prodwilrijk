import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'

export const dynamic = 'force-dynamic'

export async function requirePricingAuth(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  return auth
}

export function pricingError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
