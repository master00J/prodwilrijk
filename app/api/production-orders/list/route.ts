import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryValue = String(searchParams.get('q') || '').trim()

    let query = supabaseAdmin
      .from('production_orders')
      .select('order_number')
      .order('uploaded_at', { ascending: false })
      .limit(200)

    if (queryValue) {
      query = query.ilike('order_number', `%${queryValue}%`)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    const orders = (data || [])
      .map((row: any) => String(row.order_number || '').trim())
      .filter(Boolean)

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching production orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
