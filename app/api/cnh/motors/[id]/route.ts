import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/cnh/motors/[id] - Update a motor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    const { motor_nr, location, shipping_note, state, bodem_low, bodem_high, load_reference, container_number, truck_plate } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (motor_nr !== undefined) updateData.motor_nr = motor_nr.trim()
    if (location !== undefined) updateData.location = location
    if (shipping_note !== undefined) updateData.shipping_note = shipping_note?.trim() || null
    if (state !== undefined) updateData.state = state
    if (bodem_low !== undefined) updateData.bodem_low = bodem_low
    if (bodem_high !== undefined) updateData.bodem_high = bodem_high
    if (load_reference !== undefined) updateData.load_reference = load_reference?.trim() || null
    if (container_number !== undefined) updateData.container_number = container_number?.trim() || null
    if (truck_plate !== undefined) updateData.truck_plate = truck_plate?.trim() || null

    const { data, error } = await supabaseAdmin
      .from('cnh_motors')
      .update(updateData)
      .eq('id', parseInt(id, 10))
      .select()
      .single()

    if (error) {
      console.error('Error updating motor:', error)
      return NextResponse.json(
        { error: 'Failed to update motor' },
        { status: 500 }
      )
    }

    // Log the action
    const { error: logError } = await supabaseAdmin
      .from('cnh_logs')
      .insert({
        action: 'update',
        details: {
          motorId: parseInt(id, 10),
          updates: updateData,
        },
      })

    if (logError) {
      console.error('Error logging:', logError)
    }

    return NextResponse.json({
      success: true,
      motor: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cnh/motors/[id] - Delete a motor
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const motorId = parseInt(id, 10)
    if (Number.isNaN(motorId)) {
      return NextResponse.json(
        { error: 'id is invalid' },
        { status: 400 }
      )
    }

    const { data: motor, error: fetchError } = await supabaseAdmin
      .from('cnh_motors')
      .select('id, motor_nr')
      .eq('id', motorId)
      .single()

    if (fetchError) {
      console.error('Error fetching motor:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch motor' },
        { status: 500 }
      )
    }

    const { error: logDeleteError } = await supabaseAdmin
      .from('cnh_logs')
      .delete()
      .eq('motor_id', motorId)

    if (logDeleteError) {
      console.error('Error deleting motor logs:', logDeleteError)
      return NextResponse.json(
        { error: 'Failed to delete motor logs' },
        { status: 500 }
      )
    }

    const { error } = await supabaseAdmin
      .from('cnh_motors')
      .delete()
      .eq('id', motorId)

    if (error) {
      console.error('Error deleting motor:', error)
      return NextResponse.json(
        { error: 'Failed to delete motor' },
        { status: 500 }
      )
    }

    const { error: logError } = await supabaseAdmin
      .from('cnh_logs')
      .insert({
        action: 'delete',
        details: {
          motorId,
          motorNr: motor?.motor_nr || null,
        },
      })

    if (logError) {
      console.error('Error logging motor delete:', logError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

