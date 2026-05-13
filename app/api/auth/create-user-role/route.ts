import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { isErrorResponse, validateBody } from '@/lib/api/validation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createUserRoleSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
})

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await validateBody(request, createUserRoleSchema)
    if (isErrorResponse(body)) return body
    const { userId } = body

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

    // Create user role (new users are not verified by default)
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'user',
        verified: false, // New accounts need manual verification
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
})

