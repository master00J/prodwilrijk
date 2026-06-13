import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { sanitizePostgrestOrValue } from '@/lib/api/postgrest-filter'
import { withAdmin, withAuth } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import {
  deleteItemsSchema,
  isErrorResponse,
  packItemsSchema,
  validateBody,
} from '@/lib/api/validation'
import { consumeStageKistenForPackedPowertoolsItems } from '@/lib/prepack/stage-kisten-stock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const search = sanitizePostgrestOrValue(searchParams.get('search'))
    const dateFilter = searchParams.get('date') || ''
    const priorityOnly = searchParams.get('priority') === 'true'
    const measurementOnly = searchParams.get('measurement') === 'true'
    const problemOnly = searchParams.get('problem') === 'true'

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

    // Apply problem filter
    if (problemOnly) {
      query = query.eq('problem', true)
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

      const { data: measurements } = await supabaseAdmin
        .from('measurements')
        .select('item_id, dimensions')
        .in('item_id', itemIds)

      const measuredItemIds = new Set<number>()
      measurements?.forEach((measurement: any) => {
        if (measurement.item_id && String(measurement.dimensions || '').trim().length > 0) {
          measuredItemIds.add(measurement.item_id)
        }
      })

      // Add images and measurement completion state to items
      const itemsWithImages = items.map(item => {
        const itemImages = imagesByItemId.get(item.id) || []
        return {
          ...item,
          measurement_filled: measuredItemIds.has(item.id),
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

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await validateBody(request, packItemsSchema)
    if (isErrorResponse(body)) return body
    const { ids, employeeId, employeeName, quantitiesById } = body

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

    const packQuantityFor = (item: any) => {
      const requested = quantitiesById?.[String(item.id)]
      const currentAmount = Math.max(1, Number(item.amount) || 1)
      if (requested == null) return currentAmount
      return Math.min(currentAmount, Math.max(1, Number(requested) || 1))
    }

    const packedItems = items.map(item => ({
      item_number: item.item_number,
      po_number: item.po_number,
      amount: packQuantityFor(item),
      date_added: item.date_added,
      original_id: item.id,
      packed_by_employee_id: employeeId ?? null,
      packed_by_name: employeeName ?? null,
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

    try {
      await consumeStageKistenForPackedPowertoolsItems(
        items.map((item: any) => ({
          item_number: item.item_number,
          amount: packQuantityFor(item),
        }))
      )
    } catch (e) {
      console.error('Stagekisten stock-afname (prepack):', e)
    }

    const fullyPackedIds: number[] = []
    const partialUpdates: Array<{ id: number; amount: number }> = []

    for (const item of items) {
      const currentAmount = Math.max(1, Number(item.amount) || 1)
      const packedAmount = packQuantityFor(item)
      const remaining = currentAmount - packedAmount
      if (remaining > 0) {
        partialUpdates.push({ id: item.id, amount: remaining })
      } else {
        fullyPackedIds.push(item.id)
      }
    }

    for (const update of partialUpdates) {
      const { error: updateError } = await supabaseAdmin
        .from('items_to_pack')
        .update({ amount: update.amount })
        .eq('id', update.id)

      if (updateError) {
        console.error('Error updating partial packed item:', updateError)
        return NextResponse.json(
          { error: 'Failed to update remaining quantity' },
          { status: 500 }
        )
      }
    }

    if (fullyPackedIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('items_to_pack')
        .delete()
        .in('id', fullyPackedIds)

      if (deleteError) {
        console.error('Error deleting items:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete packed items' },
          { status: 500 }
        )
      }
    }

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'items_confirmed',
      resource_type: 'items_to_pack',
      details: {
        count: ids.length,
        ids,
        quantities_by_id: quantitiesById ?? null,
        fully_packed_ids: fullyPackedIds,
        partial_updates: partialUpdates,
        employee_id: employeeId ?? null,
        employee_name: employeeName ?? null,
      },
    })

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
})

export const DELETE = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await validateBody(request, deleteItemsSchema)
    if (isErrorResponse(body)) return body
    const { ids } = body

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

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'items_deleted',
      resource_type: 'items_to_pack',
      details: { count: ids.length, ids },
    })

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
})

