import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, role = 'user' } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if role already exists
    const { data: existing } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'User role already exists' },
        { status: 400 }
      )
    }

    // Create user role
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating user role:', error)
      return NextResponse.json(
        { error: 'Failed to create user role' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

