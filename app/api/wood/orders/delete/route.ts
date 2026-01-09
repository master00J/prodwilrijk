import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// DELETE - Delete one or multiple wood orders
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Order IDs are required' },
        { status: 400 }
      )
    }

    // Convert all IDs to numbers
    const orderIds = ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))

    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid order IDs' },
        { status: 400 }
      )
    }

    // Delete orders
    const { error } = await supabaseAdmin
      .from('wood_orders')
      .delete()
      .in('id', orderIds)

    if (error) {
      console.error('Error deleting orders:', error)
      return NextResponse.json(
        { error: 'Failed to delete orders', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${orderIds.length} order(s)` 
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

