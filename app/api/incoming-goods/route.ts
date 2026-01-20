import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const search = searchParams.get('search') || ''

    // Build query with filters
    let query = supabaseAdmin
      .from('incoming_goods')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`item_number.ilike.%${search}%,po_number.ilike.%${search}%`)
    }

    // Order and paginate
    query = query.order('date_added', { ascending: false })
    
    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching incoming goods:', error)
      return NextResponse.json(
        { error: 'Failed to fetch incoming goods' },
        { status: 500 }
      )
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 0
    const response = NextResponse.json({
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages,
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const goods = Array.isArray(body) ? body : [body]

    if (!Array.isArray(goods) || goods.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected an array.' },
        { status: 400 }
      )
    }

    // Validate and filter data
    const validGoods = goods
      .map((item) => ({
        item_number: item.item_number?.toString().trim() || null,
        po_number: item.po_number?.toString().trim() || null,
        amount: item.amount ? Number(item.amount) : null,
      }))
      .filter(
        (item) => item.item_number && item.po_number && item.amount && item.amount > 0
      )

    if (validGoods.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to insert.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('items_to_pack')
      .insert(validGoods)
      .select('id')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to insert items into Items to Pack.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validGoods.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input. Expected array of IDs.' },
        { status: 400 }
      )
    }

    // Delete from incoming_goods
    const { error: deleteError } = await supabaseAdmin
      .from('incoming_goods')
      .delete()
      .in('id', ids)

    if (deleteError) {
      console.error('Error deleting items:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${ids.length} item(s) deleted successfully`,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


