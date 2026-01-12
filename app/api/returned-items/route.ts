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

    let query = supabaseAdmin
      .from('returned_items')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`item_number.ilike.%${search}%,po_number.ilike.%${search}%`)
    }

    // Apply date filters (filter by date_returned)
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      query = query.gte('date_returned', fromDate.toISOString())
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte('date_returned', toDate.toISOString())
    }

    // Order by date_returned descending (newest first)
    query = query.order('date_returned', { ascending: false })

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching returned items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch returned items' },
        { status: 500 }
      )
    }

    // Fetch images for returned items
    let itemsWithImages = data || []
    if (itemsWithImages.length > 0) {
      const itemIds = itemsWithImages.map(item => item.id)
      const { data: images } = await supabaseAdmin
        .from('item_images')
        .select('item_id, image_url')
        .eq('item_type', 'returned_items')
        .in('item_id', itemIds)

      // Group images by item_id
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
      itemsWithImages = itemsWithImages.map(item => ({
        ...item,
        images: imagesByItemId.get(item.id) || [],
      }))
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 0

    return NextResponse.json({
      items: itemsWithImages,
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


