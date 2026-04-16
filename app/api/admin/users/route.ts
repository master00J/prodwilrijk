import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = withAdmin(async () => {
  try {
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Gebruikers ophalen mislukt' },
        { status: 500 }
      )
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, username, role, verified, created_at')
      .order('created_at', { ascending: false })

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json(
        { error: 'Rollen ophalen mislukt' },
        { status: 500 }
      )
    }

    const usersWithRoles = users.users
      .map((user) => {
        const roleData = roles?.find((r) => r.user_id === user.id)
        if (!roleData) return null
        return {
          id: user.id,
          username: roleData.username,
          role: roleData.role || 'user',
          verified: roleData.verified === true,
          created_at: roleData.created_at || user.created_at,
        }
      })
      .filter((user) => user !== null)
      .sort((a, b) => {
        if (a && b) {
          if (a.verified !== b.verified) {
            return a.verified ? 1 : -1
          }
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateB - dateA
        }
        return 0
      })

    return NextResponse.json(usersWithRoles)
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})
