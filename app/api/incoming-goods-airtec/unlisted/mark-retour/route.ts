import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** POST: Markeer unlisted items als retour (niet verpakken, terug naar klant). Body: { ids: number[], opmerking?: string } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, opmerking } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids (array) is verplicht' },
        { status: 400 }
      )
    }

    const { data: items, error: fetchError } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .select('id')
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
        { error: 'Geen items gevonden om als retour te markeren.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('airtec_unlisted_items')
      .update({
        status: 'retour',
        retour_datum: now,
        retour_opmerking: opmerking ? String(opmerking).trim() : null,
      })
      .in('id', items.map((i) => i.id))

    if (updateError) {
      console.error('Error updating unlisted items:', updateError)
      return NextResponse.json(
        { error: 'Kon items niet als retour markeren.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${items.length} item(s) als retour gelogd.`,
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
