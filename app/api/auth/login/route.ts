import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Find user by username
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('username', username)
      .maybeSingle()

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 401 }
      )
    }

    // Get user email from auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userRole.user_id)

    if (authError || !authUser?.user?.email) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 401 }
      )
    }

    // Return the email (password validation happens client-side with Supabase Auth)
    return NextResponse.json({
      email: authUser.user.email,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

