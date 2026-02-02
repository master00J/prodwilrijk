import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawLot = String(body?.lot_number || '')
    const rawClean = rawLot
      .replace(/[\r\n\t]/g, '')
      .trim()
      .toUpperCase()
    const lotNumber = rawClean.replace(/^(2W|S)/, '')

    const lotCandidates = Array.from(
      new Set([
        rawClean,
        lotNumber,
        lotNumber ? `S${lotNumber}` : '',
        lotNumber ? `2W${lotNumber}` : '',
      ].filter(Boolean))
    )

    if (!lotNumber) {
      return NextResponse.json(
        { error: 'Lot number is verplicht' },
        { status: 400 }
      )
    }

    const { data: items, error: fetchError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .select('*')
      .in('lot_number', lotCandidates)
      .or('packed.is.null,packed.eq.false')

    if (fetchError) {
      console.error('Error fetching item by lot number:', fetchError)
      return NextResponse.json(
        { error: 'Item ophalen mislukt' },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: `Geen open item gevonden voor lotnummer ${lotNumber}` },
        { status: 404 }
      )
    }

    if (items.length > 1) {
      return NextResponse.json(
        { error: `Meerdere items gevonden voor lotnummer ${lotNumber}` },
        { status: 409 }
      )
    }

    const item = items[0]

    const packedItems = [
      {
        beschrijving: item.beschrijving,
        item_number: item.item_number,
        lot_number: item.lot_number,
        datum_opgestuurd: item.datum_opgestuurd,
        kistnummer: item.kistnummer,
        divisie: item.divisie,
        quantity: item.quantity,
        datum_ontvangen: item.datum_ontvangen,
        original_id: item.id,
      },
    ]

    const { error: insertError } = await supabaseAdmin
      .from('packed_items_airtec')
      .insert(packedItems)

    if (insertError) {
      console.error('Error inserting packed item:', insertError)
      return NextResponse.json(
        { error: 'Packed item opslaan mislukt' },
        { status: 500 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .delete()
      .eq('id', item.id)

    if (deleteError) {
      console.error('Error deleting item:', deleteError)
      return NextResponse.json(
        { error: 'Item verwijderen mislukt' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
