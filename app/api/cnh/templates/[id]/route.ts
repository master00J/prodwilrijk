import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/cnh/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    const {
      name,
      load_location,
      load_reference,
      container_number,
      truck_plate,
      booking_ref,
      your_ref,
      container_tarra,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (name !== undefined) updateData.name = name.trim()
    if (load_location !== undefined) updateData.load_location = load_location?.trim() || null
    if (load_reference !== undefined) updateData.load_reference = load_reference?.trim() || null
    if (container_number !== undefined) updateData.container_number = container_number?.trim() || null
    if (truck_plate !== undefined) updateData.truck_plate = truck_plate?.trim() || null
    if (booking_ref !== undefined) updateData.booking_ref = booking_ref?.trim() || null
    if (your_ref !== undefined) updateData.your_ref = your_ref?.trim() || null
    if (container_tarra !== undefined) updateData.container_tarra = container_tarra

    const { data, error } = await supabaseAdmin
      .from('cnh_templates')
      .update(updateData)
      .eq('id', parseInt(id, 10))
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cnh/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
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

    const { error } = await supabaseAdmin
      .from('cnh_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json(
        { error: 'Failed to delete template' },
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

