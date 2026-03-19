import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/cnh/motors/receive - Receive motors (from incoming tab)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shippingNote, motors } = body

    if (!shippingNote || !Array.isArray(motors) || motors.length === 0) {
      return NextResponse.json(
        { error: 'shippingNote and motors array are required' },
        { status: 400 }
      )
    }

    // Validate motors format
    const validMotors = motors.every((m: any) => m.motorNr && m.location)
    if (!validMotors) {
      return NextResponse.json(
        { error: 'Each motor must have motorNr and location' },
        { status: 400 }
      )
    }

    // Insert motors with individual locations
    // Status is 'to_check' until verified on the verification page
    const motorsToInsert = motors.map((motor: { motorNr: string; location: string }) => ({
      motor_nr: motor.motorNr.trim(),
      location: motor.location,
      shipping_note: shippingNote.trim(),
      state: 'to_check',
      received_at: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('cnh_motors')
      .insert(motorsToInsert)
      .select()

    if (error) {
      console.error('Error inserting motors:', error)
      return NextResponse.json(
        { error: 'Failed to insert motors' },
        { status: 500 }
      )
    }

    // Log the action
    if (data && data.length > 0) {
      const { error: logError } = await supabaseAdmin
        .from('cnh_logs')
        .insert({
          action: 'receive',
          details: {
            shippingNote,
            count: data.length,
            motorIds: data.map((m: any) => m.id),
            locations: [...new Set(data.map((m: any) => m.location))], // Unique locations
          },
        })
      
      if (logError) {
        console.error('Error logging:', logError)
      }
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      motors: data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

