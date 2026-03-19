import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Returns lines for a production order. Only orders with for_time_registration = true are allowed (used by /production-order-time). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    if (!orderNumber) {
      return NextResponse.json({ error: 'Ordernummer ontbreekt' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id')
      .eq('order_number', orderNumber)
      .eq('for_time_registration', true)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order?.id) {
      return NextResponse.json(
        { error: 'Order niet gevonden of niet beschikbaar voor tijdregistratie' },
        { status: 404 }
      )
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select('id, line_no, item_no, item_number, description, description_2, quantity')
      .eq('production_order_id', order.id)
      .order('line_no', { ascending: true })

    if (linesError) throw linesError

    return NextResponse.json({ lines: lines || [] })
  } catch (error: any) {
    console.error('Error fetching production order lines:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen orderlijnen' },
      { status: 500 }
    )
  }
}
