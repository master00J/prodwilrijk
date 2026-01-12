import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Get open orders (non-archived orders with open packages)
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('wood_orders')
      .select('*')
      .eq('gearchiveerd', false)
      .order('priority', { ascending: false })
      .order('besteld_op', { ascending: false })

    if (error) {
      console.error('Error fetching open orders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch open orders' },
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

// PATCH - Update order (priority, archive, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('wood_orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating order:', error)
      return NextResponse.json(
        { error: 'Failed to update order' },
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


