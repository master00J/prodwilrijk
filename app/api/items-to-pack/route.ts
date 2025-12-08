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
    const dateFilter = searchParams.get('date') || ''
    const priorityOnly = searchParams.get('priority') === 'true'
    const measurementOnly = searchParams.get('measurement') === 'true'

    // Build query with filters
    let query = supabaseAdmin
      .from('items_to_pack')
      .select('*', { count: 'exact' })
      .eq('packed', false)

    // Apply search filter
    if (search) {
      query = query.or(`item_number.ilike.%${search}%,po_number.ilike.%${search}%`)
    }

    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter)
      filterDate.setHours(0, 0, 0, 0)
      const nextDay = new Date(filterDate)
      nextDay.setDate(nextDay.getDate() + 1)
      query = query.gte('date_added', filterDate.toISOString())
      query = query.lt('date_added', nextDay.toISOString())
    }

    // Apply priority filter
    if (priorityOnly) {
      query = query.eq('priority', true)
    }

    // Apply measurement filter
    if (measurementOnly) {
      query = query.eq('measurement', true)
    }

    // Order and paginate
    query = query.order('date_added', { ascending: true })
    
    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: items, error, count } = await query

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    // Fetch images for items in a single optimized query
    if (items && items.length > 0) {
      const itemIds = items.map(item => item.id)
      const { data: images } = await supabaseAdmin
        .from('item_images')
        .select('item_id, image_url')
        .eq('item_type', 'items_to_pack')
        .in('item_id', itemIds)

      // Group images by item_id using Map for O(1) lookup
      const imagesByItemId = new Map<number, string[]>()
      images?.forEach(img => {
        if (img.item_id && img.image_url) {
          if (!imagesByItemId.has(img.item_id)) {
            imagesByItemId.set(img.item_id, [])
          }
          imagesByItemId.get(img.item_id)!.push(img.image_url)
        }
      })

      // Add images to items
      const itemsWithImages = items.map(item => {
        const itemImages = imagesByItemId.get(item.id) || []
        return {
          ...item,
          images: itemImages,
          image: itemImages[0] || item.image, // Keep first image for backward compatibility
        }
      })

      const totalPages = count ? Math.ceil(count / pageSize) : 0
      const response = NextResponse.json({
        items: itemsWithImages,
        total: count || 0,
        page,
        pageSize,
        totalPages,
      })
      // Add cache headers for better performance
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
      return response
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
      .from('items_to_pack')
      .select('*')
      .in('id', ids)

    if (fetchError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items not found' },
        { status: 404 }
      )
    }

    // Insert into packed_items
    const packedItems = items.map(item => ({
      item_number: item.item_number,
      po_number: item.po_number,
      amount: item.amount,
      date_added: item.date_added,
      original_id: item.id,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('packed_items')
      .insert(packedItems)

    if (insertError) {
      console.error('Error inserting packed items:', insertError)
      return NextResponse.json(
        { error: 'Failed to save packed items' },
        { status: 500 }
      )
    }

    // Delete from items_to_pack
    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack')
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

    // Delete from items_to_pack (without moving to packed_items)
    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack')
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

