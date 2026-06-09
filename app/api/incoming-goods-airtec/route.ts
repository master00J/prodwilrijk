import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { sanitizePostgrestOrValue } from '@/lib/api/postgrest-filter'
import { isSpecialPackItemNumber, specialPackItemOrFilter } from '@/lib/airtec/special-pack-items'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const search = sanitizePostgrestOrValue(searchParams.get('search'))
    const specialPackOnly = searchParams.get('specialPack') === 'true'

    // Build query with filters
    let query = supabaseAdmin
      .from('incoming_goods_airtec')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`beschrijving.ilike.%${search}%,item_number.ilike.%${search}%,lot_number.ilike.%${search}%,kistnummer.ilike.%${search}%,divisie.ilike.%${search}%`)
    }

    if (specialPackOnly) {
      query = query.or(specialPackItemOrFilter())
    }

    // Order and paginate
    query = query.order('datum_ontvangen', { ascending: false })

    const { data, error, count } = specialPackOnly
      ? await query
      : await query.range((page - 1) * pageSize, page * pageSize - 1)

    if (error) {
      console.error('Error fetching incoming goods airtec:', error)
      return NextResponse.json(
        { error: 'Failed to fetch incoming goods' },
        { status: 500 }
      )
    }

    let items = data || []
    let resolvedCount = count || 0
    if (specialPackOnly) {
      const filtered = items.filter((row) => isSpecialPackItemNumber(row.item_number))
      resolvedCount = filtered.length
      const from = (page - 1) * pageSize
      items = filtered.slice(from, from + pageSize)
    }

    const totalPages = resolvedCount ? Math.ceil(resolvedCount / pageSize) : 0
    const response = NextResponse.json({
      items,
      total: resolvedCount || 0,
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
        beschrijving: item.beschrijving?.toString().trim() || null,
        item_number: item.item_number?.toString().trim() || null,
        lot_number: item.lot_number?.toString().trim() || null,
        datum_opgestuurd: item.datum_opgestuurd || null,
        kistnummer: item.kistnummer?.toString().trim() || null,
        divisie: item.divisie?.toString().trim() || null,
        quantity: item.quantity ? Number(item.quantity) : 1,
      }))
      .filter((item) => item.beschrijving || item.item_number)

    if (validGoods.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to insert. Please check that all items have at least beschrijving or item_number.' },
        { status: 400 }
      )
    }

    // Insert into incoming_goods_airtec table
    const { data, error } = await supabaseAdmin
      .from('incoming_goods_airtec')
      .insert(validGoods)
      .select()

    if (error) {
      console.error('Database error:', error)
      
      // Check if it's a duplicate error
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Some items already exist in the system.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to insert items.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      insertedRows: data?.length || validGoods.length,
      items: data || [],
      message: `Successfully inserted ${data?.length || validGoods.length} items`,
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

    // Delete from incoming_goods_airtec
    const { error: deleteError } = await supabaseAdmin
      .from('incoming_goods_airtec')
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

