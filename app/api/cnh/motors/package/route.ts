import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/cnh/motors/package - Mark motors as packaged
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { motors } = body

    if (!Array.isArray(motors) || motors.length === 0) {
      return NextResponse.json(
        { error: 'Motors array is required' },
        { status: 400 }
      )
    }

    // Update each motor
    const updates = motors.map(async (motor: { motorId: number; bodemsLow?: number; bodemsHigh?: number }) => {
      const updateData: any = {
        state: 'packaged',
        packaged_at: new Date().toISOString(),
      }

      if (motor.bodemsLow !== undefined) {
        updateData.bodem_low = motor.bodemsLow
      }
      if (motor.bodemsHigh !== undefined) {
        updateData.bodem_high = motor.bodemsHigh
      }

      const { error } = await supabaseAdmin
        .from('cnh_motors')
        .update(updateData)
        .eq('id', motor.motorId)
        .eq('state', 'received') // Only update if still in received state

      if (error) {
        console.error(`Error updating motor ${motor.motorId}:`, error)
        throw error
      }
    })

    await Promise.all(updates)

    // Log the action
    await supabaseAdmin
      .from('cnh_logs')
      .insert({
        action: 'package',
        details: {
          count: motors.length,
          motorIds: motors.map((m: any) => m.motorId),
        },
      })
      .catch((err) => console.error('Error logging:', err))

    return NextResponse.json({
      success: true,
      count: motors.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

