import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/cancel-load - Cancel loading session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // Delete session motors first (cascade should handle this, but explicit is better)
    await supabaseAdmin
      .from('cnh_session_motors')
      .delete()
      .eq('session_id', sessionId)

    // Delete session
    const { error } = await supabaseAdmin
      .from('cnh_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('session_type', 'load')

    if (error) {
      console.error('Error deleting session:', error)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

