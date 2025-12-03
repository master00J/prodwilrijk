import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get all users from auth.users and join with user_roles
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Get all user roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, verified, created_at')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json(
        { error: 'Failed to fetch user roles' },
        { status: 500 }
      )
    }

    // Combine user data with roles
    const usersWithRoles = users.users.map((user) => {
      const roleData = roles?.find((r) => r.user_id === user.id)
      return {
        id: user.id,
        email: user.email || 'No email',
        role: roleData?.role || 'user',
        verified: roleData?.verified || false,
        created_at: roleData?.created_at || user.created_at,
      }
    })

    return NextResponse.json(usersWithRoles)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

