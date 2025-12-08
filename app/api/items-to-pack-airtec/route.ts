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
    const priorityOnly = searchParams.get('priority') === 'true'
    const kistnummerFilter = searchParams.get('kistnummer') || ''

    // Build query with filters
    let query = supabaseAdmin
      .from('items_to_pack_airtec')
      .select('*', { count: 'exact' })
      .eq('packed', false)

    // Apply search filter
    if (search) {
      query = query.or(`beschrijving.ilike.%${search}%,item_number.ilike.%${search}%,lot_number.ilike.%${search}%,kistnummer.ilike.%${search}%,divisie.ilike.%${search}%`)
    }

    // Apply kistnummer filter
    if (kistnummerFilter) {
      query = query.eq('kistnummer', kistnummerFilter)
    }

    // Apply priority filter
    if (priorityOnly) {
      query = query.eq('priority', true)
    }

    // Order and paginate
    query = query.order('datum_ontvangen', { ascending: true })
    
    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: items, error, count } = await query

    if (error) {
      console.error('Error fetching items to pack airtec:', error)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 0
    const response = NextResponse.json({
      items: items || [],
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
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input. Expected array of IDs.' },
        { status: 400 }
      )
    }

    // Get items to pack
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .select('*')
      .in('id', ids)

    if (fetchError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items not found' },
        { status: 404 }
      )
    }

    // Insert into packed_items_airtec
    const packedItems = items.map(item => ({
      beschrijving: item.beschrijving,
      item_number: item.item_number,
      lot_number: item.lot_number,
      datum_opgestuurd: item.datum_opgestuurd,
      kistnummer: item.kistnummer,
      divisie: item.divisie,
      quantity: item.quantity,
      datum_ontvangen: item.datum_ontvangen,
      original_id: item.id,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('packed_items_airtec')
      .insert(packedItems)

    if (insertError) {
      console.error('Error inserting packed items:', insertError)
      return NextResponse.json(
        { error: 'Failed to save packed items' },
        { status: 500 }
      )
    }

    // Delete from items_to_pack_airtec
    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack_airtec')
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
      message: 'Items successfully packed',
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

    // Delete from items_to_pack_airtec
    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack_airtec')
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

