import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cnh/sessions - Get all sessions with motors
export async function GET(request: NextRequest) {
  try {
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('cnh_sessions')
      .select('*')
      .order('started_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Get motors for each session
    const sessionsWithMotors = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: sessionMotors } = await supabaseAdmin
          .from('cnh_session_motors')
          .select('motor_id')
          .eq('session_id', session.id)

        const motorIds = sessionMotors?.map((sm) => sm.motor_id) || []

        const { data: motors } = await supabaseAdmin
          .from('cnh_motors')
          .select('*')
          .in('id', motorIds)

        return {
          ...session,
          motors: motors || [],
        }
      })
    )

    return NextResponse.json(sessionsWithMotors)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

