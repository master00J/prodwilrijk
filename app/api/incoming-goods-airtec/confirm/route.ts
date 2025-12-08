import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

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

    // Get items from incoming_goods_airtec
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('incoming_goods_airtec')
      .select('*')
      .in('id', ids)

    if (fetchError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items not found' },
        { status: 404 }
      )
    }

    // Insert into confirmed_items_airtec
    const confirmedItems = items.map(item => ({
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
      .from('confirmed_items_airtec')
      .insert(confirmedItems)

    if (insertError) {
      console.error('Error inserting confirmed items:', insertError)
      return NextResponse.json(
        { error: 'Failed to save confirmed items' },
        { status: 500 }
      )
    }

    // Insert into items_to_pack_airtec
    const itemsToPack = items.map(item => ({
      beschrijving: item.beschrijving,
      item_number: item.item_number,
      lot_number: item.lot_number,
      datum_opgestuurd: item.datum_opgestuurd,
      kistnummer: item.kistnummer,
      divisie: item.divisie,
      quantity: item.quantity,
      datum_ontvangen: item.datum_ontvangen,
    }))

    const { error: packInsertError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .insert(itemsToPack)

    if (packInsertError) {
      console.error('Error inserting items to pack:', packInsertError)
      return NextResponse.json(
        { error: 'Failed to save items to pack' },
        { status: 500 }
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
      message: 'Items confirmed successfully. They will appear in Items to Pack Airtec.',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

