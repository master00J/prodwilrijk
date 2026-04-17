import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST - Voeg hout handmatig rechtstreeks toe aan de stock (zonder wood_package)
// Gebruik dit wanneer een pakket op aankomst niet correct verwerkt is en manueel
// moet worden nageboekt.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      houtsoort,
      pakketnummer,
      dikte,
      breedte,
      lengte,
      locatie,
      aantal,
    } = body

    const toNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') return null
      const n = Number(String(value).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }

    const diktN = toNumber(dikte)
    const breedteN = toNumber(breedte)
    const lengteN = toNumber(lengte)
    const aantalN = toNumber(aantal)

    if (!houtsoort || !String(houtsoort).trim()) {
      return NextResponse.json({ error: 'Houtsoort is verplicht' }, { status: 400 })
    }
    if (!locatie || !String(locatie).trim()) {
      return NextResponse.json({ error: 'Locatie is verplicht' }, { status: 400 })
    }
    if (diktN === null || diktN <= 0) {
      return NextResponse.json({ error: 'Dikte (mm) is verplicht en moet > 0 zijn' }, { status: 400 })
    }
    if (breedteN === null || breedteN <= 0) {
      return NextResponse.json({ error: 'Breedte (mm) is verplicht en moet > 0 zijn' }, { status: 400 })
    }
    if (lengteN === null || lengteN <= 0) {
      return NextResponse.json({ error: 'Lengte (mm) is verplicht en moet > 0 zijn' }, { status: 400 })
    }
    if (aantalN === null || aantalN <= 0 || !Number.isInteger(aantalN)) {
      return NextResponse.json({ error: 'Aantal planken moet een positief geheel getal zijn' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const manualTag = () => {
      const d = new Date()
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
      const hms = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
      return `MANUAL-${ymd}-${hms}`
    }

    const pakketnummerFinal =
      pakketnummer && String(pakketnummer).trim().length > 0
        ? String(pakketnummer).trim()
        : manualTag()

    const { data, error } = await supabaseAdmin
      .from('wood_stock')
      .insert({
        package_id: null,
        houtsoort: String(houtsoort).trim().toUpperCase(),
        pakketnummer: pakketnummerFinal,
        dikte: diktN,
        breedte: breedteN,
        lengte: lengteN,
        locatie: String(locatie).trim(),
        aantal: aantalN,
        ontvangen_op: now,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting manual wood stock:', error)
      return NextResponse.json(
        { error: error.message || 'Toevoegen mislukt' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error in add-stock:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
