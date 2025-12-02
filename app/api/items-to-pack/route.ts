import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Only fetch items that have wms_line_id (from WMS Status 30 import)
    // Items from view-prepack confirmation no longer go here
    const { data: items, error } = await supabaseAdmin
      .from('items_to_pack')
      .select('*')
      .eq('packed', false)
      .not('wms_line_id', 'is', null) // Only items with WMS line ID
      .order('date_added', { ascending: true })

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    // Fetch images for each item
    if (items && items.length > 0) {
      const itemIds = items.map(item => item.id)
      const { data: images } = await supabaseAdmin
        .from('item_images')
        .select('*')
        .eq('item_type', 'items_to_pack')
        .in('item_id', itemIds)

      // Group images by item_id
      const imagesByItemId = new Map<number, string[]>()
      images?.forEach(img => {
        if (!imagesByItemId.has(img.item_id)) {
          imagesByItemId.set(img.item_id, [])
        }
        imagesByItemId.get(img.item_id)?.push(img.image_url)
      })

      // Add images to items
      const itemsWithImages = items.map(item => ({
        ...item,
        images: imagesByItemId.get(item.id) || [],
        image: imagesByItemId.get(item.id)?.[0] || item.image, // Keep first image for backward compatibility
      }))

      return NextResponse.json(itemsWithImages)
    }

    return NextResponse.json(items || [])
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

