import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, reason, imageUrls } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    // Get item from items_to_pack
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('items_to_pack')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Insert into returned_items
    const { data: returnedItem, error: insertError } = await supabaseAdmin
      .from('returned_items')
      .insert({
        item_number: item.item_number,
        po_number: item.po_number,
        amount: item.amount,
        date_added: item.date_added,
        reason: reason || null,
        original_id: item.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting returned item:', insertError)
      return NextResponse.json(
        { error: 'Failed to save returned item' },
        { status: 500 }
      )
    }

    // If images were provided, link them to the returned item
    if (imageUrls && imageUrls.length > 0 && returnedItem) {
      const imageRecords = imageUrls.map((url: string) => ({
        item_id: returnedItem.id,
        item_type: 'returned_items',
        image_url: url,
      }))

      await supabaseAdmin
        .from('item_images')
        .insert(imageRecords)
    }

    // Delete from items_to_pack
    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting item:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete item from items_to_pack' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Item returned successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

