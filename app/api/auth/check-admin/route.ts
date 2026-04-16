import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Checks admin status for the authenticated user only.
 * Uses middleware-injected x-user-id header to prevent IDOR.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ isAdmin: false })
  }

  try {
    const { data } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    return NextResponse.json({ isAdmin: !!data })
  } catch {
    return NextResponse.json({ isAdmin: false })
  }
}
