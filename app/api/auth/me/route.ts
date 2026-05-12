import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { SITES } from '@/lib/sites'

export const dynamic = 'force-dynamic'

/**
 * Returns the authenticated user's own role and verification status.
 * User ID comes from middleware-injected headers (validated JWT),
 * so there's no IDOR risk.
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ user: null, isAdmin: false, verified: false })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('role, verified, username, must_change_password, allowed_sites')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ user: null, isAdmin: false, verified: false, mustChangePassword: false })
    }

    const allowedSites = Array.isArray(data.allowed_sites) && data.allowed_sites.length > 0
      ? data.allowed_sites
      : [...SITES]

    return NextResponse.json({
      user: {
        id: userId,
        username: data.username,
        role: data.role,
      },
      isAdmin: data.role === 'admin',
      verified: data.verified === true,
      mustChangePassword: data.must_change_password === true,
      allowedSites,
    })
  } catch {
    return NextResponse.json({ user: null, isAdmin: false, verified: false })
  }
}
