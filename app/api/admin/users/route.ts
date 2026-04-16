import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = withAdmin(async () => {
  try {
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, username, role, verified, created_at')
      .order('created_at', { ascending: false })

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json(
        { error: 'Gebruikers ophalen mislukt' },
        { status: 500 }
      )
    }

    const users = (roles || [])
      .map((r) => ({
        id: r.user_id,
        username: r.username,
        role: r.role || 'user',
        verified: r.verified === true,
        created_at: r.created_at,
      }))
      .sort((a, b) => {
        if (a.verified !== b.verified) return a.verified ? 1 : -1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

    return NextResponse.json(users)
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})
