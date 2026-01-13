import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT - Update a specific field of an order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { field, value } = body

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    // List of allowed fields to update
    const allowedFields = [
      'houtsoort',
      'min_lengte',
      'dikte',
      'breedte',
      'aantal_pakken',
      'planken_per_pak',
      'locatie',
      'bc_code',
      'opmerkingen'
    ]

    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: `Field ${field} cannot be updated` },
        { status: 400 }
      )
    }

    // Validate and process value based on field type
    let processedValue: any = value
    
    if (['dikte', 'breedte', 'min_lengte', 'aantal_pakken', 'planken_per_pak'].includes(field)) {
      const numValue = parseFloat(value)
      if (isNaN(numValue)) {
        return NextResponse.json(
          { error: 'Invalid numeric value' },
          { status: 400 }
        )
      }
      processedValue = numValue
    }

    // Convert empty strings to null
    if (processedValue === '') {
      processedValue = null
    }

    // Update the order
    const { data, error } = await supabaseAdmin
      .from('wood_orders')
      .update({
        [field]: processedValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating order:', error)
      return NextResponse.json(
        { error: 'Failed to update order', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



