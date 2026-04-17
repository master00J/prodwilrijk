import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/sessions/start-load - Start loading session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      location,
      loading_persons,
      template_id,
      load_reference,
      container_no,
      truck_plate,
      booking_ref,
      your_ref,
      container_tarra,
    } = body

    const insertPayload: Record<string, unknown> = {
      session_type: 'load',
      location: location || 'N/A',
      loading_persons: loading_persons || 1,
    }

    if (template_id !== undefined && template_id !== null && template_id !== '') {
      const parsed = typeof template_id === 'string' ? parseInt(template_id, 10) : Number(template_id)
      if (Number.isFinite(parsed)) insertPayload.template_id = parsed
    }

    // Als de lader al referenties heeft ingevuld (of de template heeft ze gepre-filled),
    // zetten we ze meteen op de sessie zodat het overzicht tijdens het laden correct is.
    if (load_reference) insertPayload.load_reference = String(load_reference).trim()
    if (container_no) insertPayload.container_no = String(container_no).trim()
    if (truck_plate) insertPayload.truck_plate = String(truck_plate).trim()
    if (booking_ref) insertPayload.booking_ref = String(booking_ref).trim()
    if (your_ref) insertPayload.your_ref = String(your_ref).trim()
    if (container_tarra !== undefined && container_tarra !== null && container_tarra !== '') {
      const n = Number(container_tarra)
      if (Number.isFinite(n)) insertPayload.container_tarra = n
    }

    const { data, error } = await supabaseAdmin
      .from('cnh_sessions')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Error creating load session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId: data.id,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
