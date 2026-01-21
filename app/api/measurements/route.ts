import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// GET - Fetch measurements (optionally filtered by item_id)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemId = searchParams.get('item_id')

    let query = supabaseAdmin
      .from('measurements')
      .select(`
        *,
        items_to_pack (
          id,
          item_number,
          po_number,
          amount
        )
      `)
      .order('created_at', { ascending: false })

    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching measurements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch measurements' },
        { status: 500 }
      )
    }

    return NextResponse.json({ measurements: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create or update a measurement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_id, packaging_method, dimensions, net_weight, special_instructions, created_by } = body

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      )
    }

    // Check if measurement already exists for this item
    const { data: existing } = await supabaseAdmin
      .from('measurements')
      .select('id')
      .eq('item_id', item_id)
      .single()

    let result
    if (existing) {
      // Update existing measurement
      const { data, error } = await supabaseAdmin
        .from('measurements')
        .update({
          packaging_method: packaging_method || null,
          dimensions: dimensions || null,
          net_weight: net_weight ? parseFloat(net_weight) : null,
          special_instructions: special_instructions || null,
          created_by: created_by || null,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', item_id)
        .select()
        .single()

      if (error) {
        console.error('Error updating measurement:', error)
        return NextResponse.json(
          { error: 'Failed to update measurement' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Insert new measurement
      const { data, error } = await supabaseAdmin
        .from('measurements')
        .insert({
          item_id,
          packaging_method: packaging_method || null,
          dimensions: dimensions || null,
          net_weight: net_weight ? parseFloat(net_weight) : null,
          special_instructions: special_instructions || null,
          created_by: created_by || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating measurement:', error)
        return NextResponse.json(
          { error: 'Failed to create measurement' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({ measurement: result, success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update measurement processed status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, processed } = body

    if (!id || typeof processed !== 'boolean') {
      return NextResponse.json(
        { error: 'id and processed are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('measurements')
      .update({
        processed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id,item_id,processed')
      .single()

    if (error || !data) {
      console.error('Error updating measurement status:', error)
      return NextResponse.json(
        { error: 'Failed to update measurement status' },
        { status: 500 }
      )
    }

    const { error: itemError } = await supabaseAdmin
      .from('items_to_pack')
      .update({ measurement: !processed })
      .eq('id', data.item_id)

    if (itemError) {
      console.error('Error updating item measurement flag:', itemError)
      return NextResponse.json(
        { error: 'Failed to update item measurement flag' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, measurement: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a measurement
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const itemId = searchParams.get('item_id')

    if (!itemId) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('measurements')
      .delete()
      .eq('item_id', itemId)

    if (error) {
      console.error('Error deleting measurement:', error)
      return NextResponse.json(
        { error: 'Failed to delete measurement' },
        { status: 500 }
      )
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
