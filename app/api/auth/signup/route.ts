import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validate username
    if (username.length < 3 || username.length > 64) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 64 characters long' },
        { status: 400 }
      )
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain lowercase letters, numbers, and underscores' },
        { status: 400 }
      )
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 128 characters long' },
        { status: 400 }
      )
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain uppercase, lowercase, and a number' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('user_roles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking username:', checkError)
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'Account aanmaken mislukt' },
        { status: 400 }
      )
    }

    // Create a unique email for Supabase Auth (username@system.local)
    // This email is only used internally by Supabase
    const internalEmail = `${username}@system.local`

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true, // Auto-confirm since we're using internal emails
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      if (authError?.code === 'email_exists') {
        return NextResponse.json(
          { error: 'Deze gebruikersnaam is al in gebruik' },
          { status: 400 }
        )
      }
      if (authError?.status === 500 || authError?.code === 'unexpected_failure') {
        return NextResponse.json(
          { error: 'Database fout bij aanmaken account. Probeer het later opnieuw of neem contact op met een admin.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: 'Account aanmaken mislukt' },
        { status: 500 }
      )
    }

    // Create user role with username
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        username: username,
        role: 'user',
        verified: false,
      })
      .select()
      .single()

    if (roleError) {
      console.error('Error creating user role:', roleError)
      // Try to delete the auth user if role creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      username: username,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




