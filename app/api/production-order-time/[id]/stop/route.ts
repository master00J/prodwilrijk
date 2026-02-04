import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { checkAndMarkOrderFinished } from '@/lib/production-order/check-finished'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid log ID' },
        { status: 400 }
      )
    }

    const { data: log, error: fetchError } = await supabaseAdmin
      .from('time_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !log) {
      return NextResponse.json(
        { error: 'Time log not found' },
        { status: 404 }
      )
    }

    if (log.end_time) {
      return NextResponse.json({
        success: true,
        message: 'Time log was already stopped',
      })
    }

    const { error: updateError } = await supabaseAdmin
      .from('time_logs')
      .update({ end_time: new Date().toISOString() })
      .eq('id', id)
      .is('end_time', null)

    if (updateError) {
      console.error('Error stopping time log:', updateError)
      return NextResponse.json(
        { error: 'Failed to stop time log' },
        { status: 500 }
      )
    }

    const orderNumber = log.production_order_number
    if (orderNumber) {
      void checkAndMarkOrderFinished(orderNumber)
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
