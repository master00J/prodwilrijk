import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/cnh/sessions/[id] - Update a session
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    // Pack session fields
    if (body.packaging_minutes !== undefined) updateData.packaging_minutes = body.packaging_minutes
    if (body.packaging_count !== undefined) updateData.packaging_count = body.packaging_count
    if (body.packaging_persons !== undefined) updateData.packaging_persons = body.packaging_persons
    if (body.operator_minutes !== undefined) updateData.operator_minutes = body.operator_minutes

    // Load session fields
    if (body.loading_minutes !== undefined) updateData.loading_minutes = body.loading_minutes
    if (body.loading_count !== undefined) updateData.loading_count = body.loading_count
    if (body.loading_persons !== undefined) updateData.loading_persons = body.loading_persons
    if (body.load_reference !== undefined) updateData.load_reference = body.load_reference?.trim() || null
    if (body.container_no !== undefined) updateData.container_no = body.container_no?.trim() || null
    if (body.truck_plate !== undefined) updateData.truck_plate = body.truck_plate?.trim() || null
    if (body.booking_ref !== undefined) updateData.booking_ref = body.booking_ref?.trim() || null
    if (body.your_ref !== undefined) updateData.your_ref = body.your_ref?.trim() || null
    if (body.container_tarra !== undefined) updateData.container_tarra = body.container_tarra

    // Common fields
    if (body.location !== undefined) updateData.location = body.location?.trim() || null

    const { data, error } = await supabaseAdmin
      .from('cnh_sessions')
      .update(updateData)
      .eq('id', parseInt(id, 10))
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

