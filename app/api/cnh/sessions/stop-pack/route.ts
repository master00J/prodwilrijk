import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/stop-pack - Stop packaging session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      packaging_minutes,
      packaging_count,
      packaging_persons,
      operator_minutes,
      location,
      motors,
    } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('cnh_sessions')
      .update({
        packaging_minutes: packaging_minutes || 0,
        packaging_count: packaging_count || 0,
        packaging_persons: packaging_persons || 1,
        operator_minutes: operator_minutes || 0,
        location: location || 'N/A',
        stopped_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('session_type', 'pack')

    if (updateError) {
      console.error('Error updating session:', updateError)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    // Link motors to session
    if (Array.isArray(motors) && motors.length > 0) {
      const sessionMotors = motors.map((m: { motorId: number }) => ({
        session_id: sessionId,
        motor_id: m.motorId,
      }))

      const { error: linkError } = await supabaseAdmin
        .from('cnh_session_motors')
        .insert(sessionMotors)

      if (linkError) {
        console.error('Error linking motors:', linkError)
        // Don't fail the request, just log it
      }
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

