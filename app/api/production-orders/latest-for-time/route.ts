import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Returns the latest production order with for_time_registration=true, incl. lines with sales_price. */
export async function GET() {
  try {
    const { data: orders, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, uploaded_at')
      .eq('for_time_registration', true)
      .is('finished_at', null)
      .order('uploaded_at', { ascending: false })
      .limit(1)

    if (orderError) throw orderError

    const order = orders?.[0]
    if (!order) {
      return NextResponse.json({ order: null, lines: [] })
    }

    const { data: lines, error: linesError } = await supabaseAdmin
      .from('production_order_lines')
      .select('id, line_no, item_no, item_number, description, description_2, quantity, sales_price')
      .eq('production_order_id', order.id)
      .order('line_no', { ascending: true })

    if (linesError) throw linesError

    const itemNumbers = [...new Set((lines || []).map((l: any) => l.item_number).filter(Boolean))]
    let salesPriceMap: Record<string, number> = {}

    if (itemNumbers.length > 0) {
      const { data: sales } = await supabaseAdmin
        .from('sales_orders')
        .select('item_number, price')
        .in('item_number', itemNumbers)
        .order('uploaded_at', { ascending: false })

      const seen = new Set<string>()
      ;(sales || []).forEach((s: any) => {
        const key = String(s.item_number).trim()
        if (!seen.has(key)) {
          seen.add(key)
          salesPriceMap[key] = Number(s.price) || 0
        }
      })
    }

    const linesWithPrice = (lines || []).map((line: any) => {
      const itemNo = line.item_number?.trim()
      const dbPrice = line.sales_price != null ? Number(line.sales_price) : null
      const fromSales = itemNo && salesPriceMap[itemNo] !== undefined ? salesPriceMap[itemNo] : null
      return {
        ...line,
        sales_price: dbPrice ?? fromSales,
        sales_price_source: dbPrice != null ? 'line' : fromSales != null ? 'sales_orders' : null,
      }
    })

    return NextResponse.json({
      order,
      lines: linesWithPrice,
    })
  } catch (error: any) {
    console.error('Error fetching latest for-time order:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen order' },
      { status: 500 }
    )
  }
}
