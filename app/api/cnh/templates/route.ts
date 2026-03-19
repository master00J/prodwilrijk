import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cnh/templates - Get all templates
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('cnh_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/cnh/templates - Create template
export async function POST(request: NextRequest) {
  try {
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

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('cnh_templates')
      .insert({
        name: name.trim(),
        load_location: load_location || null,
        load_reference: load_reference || null,
        container_number: container_number || null,
        truck_plate: truck_plate || null,
        booking_ref: booking_ref || null,
        your_ref: your_ref || null,
        container_tarra: container_tarra || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json(
        { error: 'Failed to create template' },
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

