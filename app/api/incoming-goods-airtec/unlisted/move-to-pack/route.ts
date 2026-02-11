import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** POST: Verplaats goedgekeurde unlisted items naar items_to_pack_airtec. Body: { ids: number[] } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids (array) is verplicht' },
        { status: 400 }
      )
    }

    const { data: items, error: fetchError } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('*')
      .in('id', ids)
      .in('status', ['email_sent', 'pending'])

    if (fetchError) {
      console.error('Error fetching unlisted items:', fetchError)
      return NextResponse.json(
        { error: 'Kon items niet ophalen' },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Geen items gevonden om te verplaatsen (alleen email_sent of pending).' },
        { status: 400 }
      )
    }

    const datumOntvangen = new Date().toISOString()
    const itemsToPack = items.map((item) => ({
      beschrijving: item.beschrijving ?? null,
      item_number: item.item_number ?? null,
      lot_number: item.lot_number ?? null,
      datum_opgestuurd: item.datum_opgestuurd ?? null,
      kistnummer: item.kistnummer ?? null,
      divisie: item.divisie ?? null,
      quantity: item.quantity ?? 1,
      datum_ontvangen: item.created_at || datumOntvangen,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('items_to_pack_airtec')
      .insert(itemsToPack)

    if (insertError) {
      console.error('Error inserting items_to_pack_airtec:', insertError)
      return NextResponse.json(
        { error: 'Kon items niet toevoegen aan Items to Pack.' },
        { status: 500 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .update({ status: 'approved' })
      .in('id', items.map((i) => i.id))

    if (updateError) {
      console.error('Error updating unlisted status:', updateError)
      // Items are already in items_to_pack; we only failed to mark as approved
    }

    return NextResponse.json({
      success: true,
      message: `${items.length} item(s) toegevoegd aan Items to Pack Airtec.`,
      count: items.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Interne fout' },
      { status: 500 }
    )
  }
}
