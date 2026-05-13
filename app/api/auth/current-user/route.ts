import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const requestedUserId = searchParams.get('userId')
    const userId = requestedUserId || user.id

    if (requestedUserId && requestedUserId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Geen toegang tot deze gebruiker' },
        { status: 403 }
      )
    }

    // Get username from user_roles
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching username:', error)
      return NextResponse.json(
        { error: 'Failed to fetch username' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      username: data?.username || 'Unknown',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



