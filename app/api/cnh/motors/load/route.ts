import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/cnh/motors/load - Mark motors as loaded
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { motorIds, loadReference, containerNumber, truckPlate } = body

    if (!Array.isArray(motorIds) || motorIds.length === 0) {
      return NextResponse.json(
        { error: 'motorIds array is required' },
        { status: 400 }
      )
    }

    if (!loadReference || !containerNumber) {
      return NextResponse.json(
        { error: 'loadReference and containerNumber are required' },
        { status: 400 }
      )
    }

    // Update motors
    const { error } = await supabaseAdmin
      .from('cnh_motors')
      .update({
        state: 'loaded',
        loaded_at: new Date().toISOString(),
        load_reference: loadReference,
        container_number: containerNumber,
        truck_plate: truckPlate || null,
      })
      .in('id', motorIds)
      .eq('state', 'packaged') // Only update if still in packaged state

    if (error) {
      console.error('Error updating motors:', error)
      return NextResponse.json(
        { error: 'Failed to update motors' },
        { status: 500 }
      )
    }

    // Log the action
    await supabaseAdmin
      .from('cnh_logs')
      .insert({
        action: 'load',
        details: {
          count: motorIds.length,
          motorIds,
          loadReference,
          containerNumber,
          truckPlate,
        },
      })
      .catch((err) => console.error('Error logging:', err))

    return NextResponse.json({
      success: true,
      count: motorIds.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

