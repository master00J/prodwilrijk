import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, verified = true } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update user verification status (explicitly set as boolean)
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .update({ verified: verified === true })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating verification status:', error)
      return NextResponse.json(
        { error: 'Failed to update verification status', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      console.error('No data returned after update')
      return NextResponse.json(
        { error: 'User role not found' },
        { status: 404 }
      )
    }

    console.log('Verification status updated:', { userId, verified: data.verified, data })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


