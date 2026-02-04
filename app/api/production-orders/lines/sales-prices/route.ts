import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Save sales prices for production order lines. Body: { orderNumber, prices: { [lineId]: price } } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNumber, prices } = body

    if (!orderNumber || typeof prices !== 'object') {
      return NextResponse.json(
        { error: 'orderNumber en prices (object lineId -> price) zijn verplicht.' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('production_orders')
      .select('id')
      .eq('order_number', String(orderNumber).trim())
      .eq('for_time_registration', true)
      .maybeSingle()

    if (orderError || !order?.id) {
      return NextResponse.json(
        { error: 'Order niet gevonden of niet voor tijdregistratie.' },
        { status: 404 }
      )
    }

    const { data: lines } = await supabaseAdmin
      .from('production_order_lines')
      .select('id')
      .eq('production_order_id', order.id)

    const lineIds = new Set((lines || []).map((l: any) => l.id))
    let updated = 0

    for (const [lineIdStr, priceVal] of Object.entries(prices)) {
      const lineId = parseInt(lineIdStr, 10)
      if (!Number.isFinite(lineId) || !lineIds.has(lineId)) continue

      const price =
        priceVal === null || priceVal === undefined || String(priceVal).trim() === ''
          ? null
          : parseFloat(String(priceVal))
      if (price !== null && (isNaN(price) || price < 0)) continue

      const { error: updErr } = await supabaseAdmin
        .from('production_order_lines')
        .update({ sales_price: price })
        .eq('id', lineId)
        .eq('production_order_id', order.id)

      if (!updErr) updated += 1
    }

    return NextResponse.json({ success: true, updated })
  } catch (error: any) {
    console.error('Error saving sales prices:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij opslaan verkoopprijzen' },
      { status: 500 }
    )
  }
}
