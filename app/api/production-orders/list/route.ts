import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Returns order numbers of production orders uploaded for time registration only (for /production-order-time page). */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('production_orders')
      .select('order_number')
      .eq('for_time_registration', true)
      .is('finished_at', null)
      .order('uploaded_at', { ascending: false })

    if (error) throw error

    const orderNumbers = (data || []).map((r) => r.order_number).filter(Boolean)
    return NextResponse.json({ orders: orderNumbers })
  } catch (error: any) {
    console.error('Error listing production orders for time:', error)
    return NextResponse.json(
      { error: error.message || 'Fout bij ophalen orders' },
      { status: 500 }
    )
  }
}
