import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid log ID' },
        { status: 400 }
      )
    }

    // Check if log exists and is active
    const { data: log, error: fetchError } = await supabaseAdmin
      .from('time_logs')
      .select('*')
      .eq('id', id)
      .is('end_time', null)
      .single()

    if (fetchError || !log) {
      return NextResponse.json(
        { error: 'Active time log not found' },
        { status: 404 }
      )
    }

    // Update end_time
    const { error: updateError } = await supabaseAdmin
      .from('time_logs')
      .update({ end_time: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('Error stopping time log:', updateError)
      return NextResponse.json(
        { error: 'Failed to stop time log' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Time log stopped successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


