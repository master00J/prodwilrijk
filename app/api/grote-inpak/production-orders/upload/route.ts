import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { getBcMappingLookup } from '@/lib/bc-mapping/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Upload verwerkt de BC "Prod. Order Line List" export.
 *
 * Kolommen (1-based Excel-notatie):
 *   A  Status           index 0
 *   B  Prod. Order No.  index 1
 *   C  Item No. (FP/GP) index 2
 *   D  Description      index 3
 *   E  Location Code    index 4
 *   K  Finished Piece   index 10
 *   L  Quantity         index 11
 *   M  Remaining Unit   index 12
 *   Q  Due Date         index 16
 *   R  Starting Date-T  index 17
 *   S  Ending Date-T    index 18
 *
 * Tijdens de BC-overgang ondersteunen we BEIDE exports naast elkaar:
 *   - BC36 (nieuw):  item_no = FP-code, locaties = "GENK_EIK" / "Wilrijk" / "Willebroek"
 *   - Legacy (oud):  item_no = GP-code, locaties = "PACK-GENK" / "PACK-WILR" / "PACK-WILL"
 * Bron wordt per rij automatisch gedetecteerd via de location-code.
 *
 * Filter:
 *   - Locaties buiten de drie relevante (Genk/Wilrijk/Willebroek) worden genegeerd
 *     (GENK_WNTRB, SKW_DREEF, SKW_MECH, PACK-MERK, PACK-APER, ... )
 *   - Item moet terug te vinden zijn in grote_inpak_erp_link (via FP→GP→erp_link
 *     voor BC36 of direct GP→erp_link voor legacy).
 *
 * Policy: de upload vervangt enkel de rijen van de BC-bron(nen) die in het
 * bestand voorkomen. Zo blijven bijvoorbeeld de legacy-rijen staan als je
 * enkel een nieuw bc36-bestand opnieuw upload.
 */

type Locatie = 'Genk' | 'Wilrijk' | 'Willebroek'
type BcSource = 'legacy' | 'bc36'

interface LocInfo {
  productielocatie: Locatie
  bc_source: BcSource
}

const LOCATION_MAP: Record<string, LocInfo> = {
  // Nieuwe BC36 (FP-codes)
  GENK_EIK:    { productielocatie: 'Genk',       bc_source: 'bc36' },
  WILRIJK:     { productielocatie: 'Wilrijk',    bc_source: 'bc36' },
  WILLEBROEK:  { productielocatie: 'Willebroek', bc_source: 'bc36' },
  // Oude BC (GP-codes) — PACK-* locaties
  'PACK-GENK': { productielocatie: 'Genk',       bc_source: 'legacy' },
  'PACK-WILR': { productielocatie: 'Wilrijk',    bc_source: 'legacy' },
  'PACK-WILL': { productielocatie: 'Willebroek', bc_source: 'legacy' },
}

function mapLocation(raw: string | null | undefined): LocInfo | null {
  if (!raw) return null
  const key = String(raw).trim().toUpperCase()
  return LOCATION_MAP[key] ?? null
}

function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function parseDate(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    // Excel serial number fallback (mocht cellDates uitgeschakeld zijn)
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + v * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Geen bestand aangeleverd' }, { status: 400 })
    }

    const [{ data: erpLinkData }, bcLookup] = await Promise.all([
      supabaseAdmin.from('grote_inpak_erp_link').select('kistnummer, erp_code'),
      getBcMappingLookup(),
    ])

    // GP-code → kistnummer (ERP link gebruikt de oude GP-code in erp_code).
    const gpToKist = new Map<string, string>()
    ;(erpLinkData || []).forEach((row: any) => {
      const norm = normalizeErpCode(row.erp_code)
      if (norm && row.kistnummer) {
        gpToKist.set(norm, String(row.kistnummer).toUpperCase().trim())
      }
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

    interface Row {
      status: string | null
      prod_order_no: string
      item_no: string
      description: string | null
      location_code: string
      productielocatie: Locatie
      kistnummer: string
      bc_source: BcSource
      quantity: number | null
      finished_quantity: number | null
      remaining_quantity: number | null
      due_date: string | null
      starting_date: string | null
      ending_date: string | null
      source_file: string
    }

    const parsed: Row[] = []
    const seen = new Set<string>()
    let skippedLocation = 0
    let skippedNoMatch = 0
    const unmatchedItems = new Set<string>()
    const sourcesInFile = new Set<BcSource>()
    const perSourceCount: Record<BcSource, number> = { legacy: 0, bc36: 0 }

    // Echte PO's beginnen met PO/PSO/PFO/PVO/POF/POI/POS/POT, … — minstens twee
    // hoofdletters gevolgd door een cijfer. Alles anders zijn header/totalrijen.
    const poPattern = /^P[A-Z]{1,3}\d/i

    for (const row of rows) {
      const rawPoNo = String(row[1] ?? '').trim()
      const rawItem = String(row[2] ?? '').trim()
      const rawLoc = String(row[4] ?? '').trim()

      if (!rawPoNo || !poPattern.test(rawPoNo)) continue
      if (!rawItem) continue

      const locInfo = mapLocation(rawLoc)
      if (!locInfo) {
        skippedLocation++
        continue
      }

      // Match item → kistnummer. Voor FP-codes (bc36) gaan we via bc-mapping
      // naar de GP-code; voor GP-codes (legacy) kunnen we direct lookuppen.
      const norm = normalizeErpCode(rawItem)
      let kist: string | null = null
      if (norm) {
        const gpCandidate = normalizeErpCode(bcLookup.toOld(norm)) || norm
        kist = gpToKist.get(gpCandidate) || gpToKist.get(norm) || null
      }

      if (!kist) {
        skippedNoMatch++
        if (norm) unmatchedItems.add(norm)
        continue
      }

      // Dedup binnen het bestand: zelfde PO-lijn mag niet dubbel voorkomen.
      const key = `${rawPoNo}::${rawItem}::${locInfo.bc_source}`
      if (seen.has(key)) continue
      seen.add(key)

      sourcesInFile.add(locInfo.bc_source)
      perSourceCount[locInfo.bc_source]++

      parsed.push({
        status: String(row[0] ?? '').trim() || null,
        prod_order_no: rawPoNo,
        item_no: rawItem,
        description: String(row[3] ?? '').trim() || null,
        location_code: rawLoc,
        productielocatie: locInfo.productielocatie,
        kistnummer: kist,
        bc_source: locInfo.bc_source,
        finished_quantity: parseNumber(row[10]),
        quantity: parseNumber(row[11]),
        remaining_quantity: parseNumber(row[12]),
        due_date: parseDate(row[16])?.toISOString().slice(0, 10) ?? null,
        starting_date: parseDate(row[17])?.toISOString() ?? null,
        ending_date: parseDate(row[18])?.toISOString() ?? null,
        source_file: file.name,
      })
    }

    // Alleen de bronnen wissen die in deze upload voorkomen, zodat de andere
    // BC-omgeving (die je vorige upload vulde) ongemoeid blijft.
    if (sourcesInFile.size > 0) {
      const { error: delError } = await supabaseAdmin
        .from('grote_inpak_production_orders')
        .delete()
        .in('bc_source', Array.from(sourcesInFile))
      if (delError) throw delError
    }

    if (parsed.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK)
        const { error: insertError } = await supabaseAdmin
          .from('grote_inpak_production_orders')
          .insert(chunk)
        if (insertError) throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      file: file.name,
      ingevoegd: parsed.length,
      bronnen: Array.from(sourcesInFile),
      per_bron: perSourceCount,
      overgeslagen_locatie: skippedLocation,
      overgeslagen_niet_in_erp: skippedNoMatch,
      unmatched_preview: Array.from(unmatchedItems).slice(0, 10),
      unmatched_total: unmatchedItems.size,
    })
  } catch (error: any) {
    console.error('Prod order upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload mislukt' }, { status: 500 })
  }
}
