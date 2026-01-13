import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/start-load - Start loading session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { location, loading_persons } = body

    const { data, error } = await supabaseAdmin
      .from('cnh_sessions')
      .insert({
        session_type: 'load',
        location: location || 'N/A',
        loading_persons: loading_persons || 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating load session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId: data.id,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

