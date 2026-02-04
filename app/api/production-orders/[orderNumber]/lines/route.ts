import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    const orderValue = String(orderNumber || '').trim()
    if (!orderValue) {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id')
      .eq('order_number', orderValue)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select('id, line_no, item_number, description')
      .eq('production_order_id', order.id)
      .order('line_no', { ascending: true })

    if (linesError) {
      return NextResponse.json({ error: 'Failed to fetch order lines' }, { status: 500 })
    }

    return NextResponse.json({ lines: lines || [] })
  } catch (error) {
    console.error('Error fetching order lines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
