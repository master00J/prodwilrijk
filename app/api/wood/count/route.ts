import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Registreer een telling op een stock-positie.
// Vergelijkt het getelde aantal met het huidige aantal in wood_stock en logt
// het verschil in wood_stock_corrections (audit trail).
//
// Als het getelde aantal 0 is wordt de stock-regel verwijderd (consistent met
// het pick-gedrag). Anders wordt aantal bijgewerkt en laatst_geteld_op gezet.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      stock_id,
      nieuw_aantal,
      oud_aantal,
      reden,
      opmerking,
      snapshot,
      client_created_at,
    } = body

    const nieuw = Number(nieuw_aantal)

    if (!stock_id || !Number.isInteger(nieuw) || nieuw < 0) {
      return NextResponse.json(
        { error: 'stock_id en een geldig niet-negatief geheel nieuw_aantal zijn verplicht' },
        { status: 400 }
      )
    }

    const { data: stockItem, error: stockError } = await supabaseAdmin
      .from('wood_stock')
      .select('*')
      .eq('id', stock_id)
      .maybeSingle()

    if (stockError) {
      console.error('Error fetching stock for count:', stockError)
      return NextResponse.json({ error: 'Ophalen voorraad mislukt' }, { status: 500 })
    }

    // Stock-regel bestaat niet meer (bv. al opgepikt door iemand anders).
    // We loggen het verschil nog steeds, maar we kunnen geen stock-update doen.
    const currentAantal = stockItem?.aantal ?? (Number.isInteger(Number(oud_aantal)) ? Number(oud_aantal) : null)
    const verschil = currentAantal === null ? 0 : nieuw - currentAantal

    const nowIso = new Date().toISOString()

    const { error: logError } = await supabaseAdmin.from('wood_stock_corrections').insert({
      stock_id: stockItem ? stock_id : null,
      houtsoort: stockItem?.houtsoort ?? snapshot?.houtsoort ?? null,
      pakketnummer: stockItem?.pakketnummer ?? snapshot?.pakketnummer ?? null,
      locatie: stockItem?.locatie ?? snapshot?.locatie ?? null,
      dikte: stockItem?.dikte ?? snapshot?.dikte ?? null,
      breedte: stockItem?.breedte ?? snapshot?.breedte ?? null,
      lengte: stockItem?.lengte ?? snapshot?.lengte ?? null,
      oud_aantal: currentAantal,
      nieuw_aantal: nieuw,
      verschil,
      reden: reden || null,
      opmerking: opmerking || null,
      client_created_at: client_created_at || null,
      synced_at: nowIso,
    })

    if (logError) {
      console.error('Error inserting correction log:', logError)
      return NextResponse.json({ error: 'Audit-log mislukt' }, { status: 500 })
    }

    if (!stockItem) {
      return NextResponse.json({
        success: true,
        note: 'Stock-regel bestond niet meer (mogelijk al opgepikt). Correctie gelogd.',
        verschil,
      })
    }

    if (nieuw === 0) {
      await supabaseAdmin.from('wood_stock').delete().eq('id', stock_id)
    } else {
      await supabaseAdmin
        .from('wood_stock')
        .update({
          aantal: nieuw,
          laatst_geteld_op: nowIso,
          updated_at: nowIso,
        })
        .eq('id', stock_id)
    }

    return NextResponse.json({ success: true, verschil, data: { id: stock_id, aantal: nieuw } })
  } catch (error) {
    console.error('Unexpected error in wood count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Lichte overzicht-endpoint: per stock-positie het laatste correctiemoment.
// (Niet verplicht voor de flow, maar handig als audit-view.)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('wood_stock_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Error fetching corrections:', error)
      return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error fetching corrections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
