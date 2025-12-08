import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const kistnummerFilter = searchParams.get('kistnummer') || ''

    let query = supabaseAdmin
      .from('packed_items_airtec')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`beschrijving.ilike.%${search}%,item_number.ilike.%${search}%,lot_number.ilike.%${search}%,kistnummer.ilike.%${search}%,divisie.ilike.%${search}%`)
    }

    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      query = query.gte('date_packed', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte('date_packed', toDate.toISOString())
    }

    // Apply kistnummer filter
    if (kistnummerFilter) {
      query = query.eq('kistnummer', kistnummerFilter)
    }

    // Order by date_packed descending (newest first)
    query = query.order('date_packed', { ascending: false })

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching packed items airtec:', error)
      return NextResponse.json(
        { error: 'Failed to fetch packed items' },
        { status: 500 }
      )
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 0

    return NextResponse.json({
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

