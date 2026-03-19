import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Returns production orders for time registration. Supports ?finished=true for afgewerkte orders, ?q= for search. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const finished = searchParams.get('finished') === 'true'
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    let query = supabaseAdmin
      .from('production_orders')
      .select('id, order_number, sales_order_number, uploaded_at, finished_at')
      .eq('for_time_registration', true)

    if (finished) {
      query = query.not('finished_at', 'is', null)
    } else {
      query = query.is('finished_at', null)
    }

    query = query.order('uploaded_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    let orders = data || []
    if (q) {
      orders = orders.filter(
        (r) =>
          (r.order_number || '').toLowerCase().includes(q) ||
          (r.sales_order_number || '').toLowerCase().includes(q)
      )
    }

    return NextResponse.json({
      orders: orders.map((r) => ({
        order_number: r.order_number,
        sales_order_number: r.sales_order_number || null,
        uploaded_at: r.uploaded_at,
        finished_at: r.finished_at || null,
      })),
    })
  } catch (error: any) {
    console.error('Error listing production orders for time:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen orders' },
      { status: 500 }
    )
  }
}
