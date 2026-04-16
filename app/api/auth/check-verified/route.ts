import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Checks verification status for the authenticated user only.
 * Uses middleware-injected x-user-id header to prevent IDOR.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ verified: false })
  }

  try {
    const { data } = await supabaseAdmin
      .from('user_roles')
      .select('verified')
      .eq('user_id', userId)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ verified: false })
    }

    return NextResponse.json({ verified: data.verified === true })
  } catch {
    return NextResponse.json({ verified: false })
  }
}
