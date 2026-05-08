import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Upload-endpoint voor de BC "Prod. Order Line List" productie-orders.
 *
 * De originele Excel kan 100k+ rijen bevatten (tijdens de BC-overgang zelfs
 * 140k+) en overschrijdt dan de Vercel body-limiet van 4.5 MB als we hem
 * server-side parsen. Daarom doet de client het zware werk:
 *   1. Excel in de browser lezen met xlsx
 *   2. Locatie-filter (Genk / Wilrijk / Willebroek — nieuw en oud BC)
 *   3. Match tegen ERP LINK (GP → kistnummer) via een in-memory lookup
 *   4. Alleen de relevante rijen (max enkele duizenden) POSTen als JSON
 *
 * Bij elke upload: volledige tabel `grote_inpak_production_orders` leegmaken,
 * daarna enkel de rijen van deze import in één keer inladen (geen merge met
 * vorige runs).
 */

type Locatie = 'Genk' | 'Wilrijk' | 'Willebroek'
type BcSource = 'legacy' | 'bc36'

interface IncomingRow {
  status?: string | null
  prod_order_no: string
  item_no: string
  description?: string | null
  location_code?: string | null
  productielocatie: Locatie
  kistnummer: string
  bc_source: BcSource
  quantity?: number | null
  finished_quantity?: number | null
  remaining_quantity?: number | null
  due_date?: string | null
  starting_date?: string | null
  ending_date?: string | null
}

const VALID_LOCATIES = new Set<Locatie>(['Genk', 'Wilrijk', 'Willebroek'])
const VALID_SOURCES = new Set<BcSource>(['legacy', 'bc36'])

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Verwacht application/json body (parse de Excel op de client)' },
        { status: 415 }
      )
    }

    const body = await request.json() as {
      rows?: IncomingRow[]
      source_file?: string
    }

    const rows = Array.isArray(body.rows) ? body.rows : []
    const sourceFile = body.source_file || 'upload.xlsx'

    // Defensieve validatie + dedup (client kan stuk zijn of gemanipuleerd worden).
    const seen = new Set<string>()
    const sourcesInFile = new Set<BcSource>()
    const perSourceCount: Record<BcSource, number> = { legacy: 0, bc36: 0 }
    const clean: Array<IncomingRow & { source_file: string }> = []

    for (const r of rows) {
      if (!r || typeof r !== 'object') continue
      const prodNo = String(r.prod_order_no || '').trim()
      const itemNo = String(r.item_no || '').trim()
      const kist = String(r.kistnummer || '').trim().toUpperCase()
      const loc = r.productielocatie as Locatie
      const src = r.bc_source as BcSource

      if (!prodNo || !itemNo || !kist) continue
      if (!VALID_LOCATIES.has(loc)) continue
      if (!VALID_SOURCES.has(src)) continue

      const dedupKey = `${prodNo}::${itemNo}::${src}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      sourcesInFile.add(src)
      perSourceCount[src]++

      clean.push({
        status: r.status ?? null,
        prod_order_no: prodNo,
        item_no: itemNo,
        description: r.description ?? null,
        location_code: r.location_code ?? null,
        productielocatie: loc,
        kistnummer: kist,
        bc_source: src,
        quantity: r.quantity ?? null,
        finished_quantity: r.finished_quantity ?? null,
        remaining_quantity: r.remaining_quantity ?? null,
        due_date: r.due_date ?? null,
        starting_date: r.starting_date ?? null,
        ending_date: r.ending_date ?? null,
        source_file: sourceFile,
      })
    }

    // Volledige vervanging: alles wissen vóór insert (ook als deze import 0 rijen heeft).
    const { error: delError } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .delete()
      .gte('id', 0)
    if (delError) throw delError

    if (clean.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < clean.length; i += CHUNK) {
        const chunk = clean.slice(i, i + CHUNK)
        const { error: insertError } = await supabaseAdmin
          .from('grote_inpak_production_orders')
          .insert(chunk)
        if (insertError) throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      file: sourceFile,
      ingevoegd: clean.length,
      bronnen: Array.from(sourcesInFile),
      per_bron: perSourceCount,
    })
  } catch (error: any) {
    console.error('Prod order upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload mislukt' }, { status: 500 })
  }
}
