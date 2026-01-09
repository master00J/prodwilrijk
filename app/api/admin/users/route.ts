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
      .select('user_id, username, role, verified, created_at')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json(
        { error: 'Failed to fetch user roles' },
        { status: 500 }
      )
    }

    // Combine user data with roles
    // Only show users that have an entry in user_roles (properly registered users)
    const usersWithRoles = users.users
      .map((user) => {
        const roleData = roles?.find((r) => r.user_id === user.id)
        // Only include users that have a role entry
        if (!roleData) return null
        return {
          id: user.id,
          username: roleData.username,
          role: roleData.role,
          verified: roleData.verified || false,
          created_at: roleData.created_at || user.created_at,
        }
      })
      .filter((user) => user !== null) // Remove null entries
      // Sort: unverified users first, then by created_at (newest first)
      .sort((a, b) => {
        if (a && b) {
          // Unverified users first
          if (a.verified !== b.verified) {
            return a.verified ? 1 : -1
          }
          // Then sort by created_at (newest first)
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateB - dateA
        }
        return 0
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

