import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching airtec unlisted items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      )
    }

    const items = (data || []).map((row) => ({
      ...row,
      photo_urls: row.photo_urls || [],
    }))

    return NextResponse.json({ items })
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
    const {
      beschrijving,
      item_number,
      lot_number,
      datum_opgestuurd,
      kistnummer,
      divisie,
      quantity,
      opmerking,
    } = body

    if (!beschrijving || !String(beschrijving).trim()) {
      return NextResponse.json(
        { error: 'Beschrijving is verplicht' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .insert({
        beschrijving: String(beschrijving).trim(),
        item_number: item_number ? String(item_number).trim() : null,
        lot_number: lot_number ? String(lot_number).trim() : null,
        datum_opgestuurd: datum_opgestuurd || null,
        kistnummer: kistnummer ? String(kistnummer).trim() : null,
        divisie: divisie ? String(divisie).trim() : null,
        quantity: quantity != null ? Math.max(1, parseInt(String(quantity), 10) || 1) : 1,
        opmerking: opmerking ? String(opmerking).trim() : null,
        status: 'pending',
        photo_urls: [],
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting airtec unlisted item:', error)
      return NextResponse.json(
        { error: 'Failed to add item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: { ...data, photo_urls: data?.photo_urls || [] },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
