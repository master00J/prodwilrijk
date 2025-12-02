import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input format. Expected an array of IDs.' },
        { status: 400 }
      )
    }

    // Get items from incoming_goods
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('incoming_goods')
      .select('*')
      .in('id', ids)

    if (fetchError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items not found' },
        { status: 404 }
      )
    }

    // Prepare items for items_to_pack
    const itemsToPack = items.map(item => ({
      item_number: item.item_number,
      po_number: item.po_number,
      amount: item.amount,
      date_added: item.date_added || new Date().toISOString(),
    }))

    // Insert into items_to_pack
    const { error: insertError } = await supabaseAdmin
      .from('items_to_pack')
      .insert(itemsToPack)

    if (insertError) {
      console.error('Error inserting items to pack:', insertError)
      return NextResponse.json(
        { error: 'Failed to move items to pack' },
        { status: 500 }
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
        { error: 'Failed to delete items from incoming goods' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Items confirmed and moved to Items to Pack',
      movedCount: items.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

