import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/cnh/shipping-notes - Get all unique shipping notes with motor counts
export async function GET(request: NextRequest) {
  try {
    // Get all motors with shipping notes
    const { data: motors, error } = await supabaseAdmin
      .from('cnh_motors')
      .select('shipping_note, received_at')
      .not('shipping_note', 'is', null)
      .order('received_at', { ascending: false })

    if (error) {
      console.error('Error fetching shipping notes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch shipping notes' },
        { status: 500 }
      )
    }

    // Group by shipping note and count motors
    const shippingNotesMap = new Map<string, { count: number; received_at: string | null }>()
    
    motors?.forEach((motor) => {
      if (motor.shipping_note) {
        const existing = shippingNotesMap.get(motor.shipping_note)
        if (existing) {
          existing.count++
          // Keep the most recent received_at
          if (motor.received_at && (!existing.received_at || motor.received_at > existing.received_at)) {
            existing.received_at = motor.received_at
          }
        } else {
          shippingNotesMap.set(motor.shipping_note, {
            count: 1,
            received_at: motor.received_at || null,
          })
        }
      }
    })

    // Convert to array and sort by received_at (most recent first)
    const shippingNotes = Array.from(shippingNotesMap.entries())
      .map(([shipping_note, data]) => ({
        shipping_note,
        motor_count: data.count,
        received_at: data.received_at,
      }))
      .sort((a, b) => {
        if (!a.received_at) return 1
        if (!b.received_at) return -1
        return new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      })

    return NextResponse.json(shippingNotes)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

