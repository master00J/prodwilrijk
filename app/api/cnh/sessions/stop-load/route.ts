import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/stop-load - Stop loading session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      loading_minutes,
      loading_count,
      loading_persons,
      load_reference,
      container_no,
      truck_plate,
      booking_ref,
      your_ref,
      container_tarra,
      motorIds,
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
        loading_minutes: loading_minutes || 0,
        loading_count: loading_count || 0,
        loading_persons: loading_persons || 1,
        load_reference: load_reference || null,
        container_no: container_no || null,
        truck_plate: truck_plate || null,
        booking_ref: booking_ref || null,
        your_ref: your_ref || null,
        container_tarra: container_tarra || null,
        stopped_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('session_type', 'load')

    if (updateError) {
      console.error('Error updating session:', updateError)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    // Link motors to session
    if (Array.isArray(motorIds) && motorIds.length > 0) {
      const sessionMotors = motorIds.map((motorId: number) => ({
        session_id: sessionId,
        motor_id: motorId,
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

