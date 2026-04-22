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
 *   C  Item No. (FP)    index 2
 *   D  Description      index 3
 *   E  Location Code    index 4
 *   K  Finished Qty     index 10
 *   L  Quantity         index 11
 *   M  Remaining Qty    index 12
 *   Q  Due Date         index 16
 *   R  Starting Date-T  index 17
 *   S  Ending Date-T    index 18
 *
 * Filter:
 *   - Locaties: GENK_EIK → Genk, Wilrijk → Wilrijk, Willebroek → Willebroek
 *     (al de rest: GENK_WNTRB, SKW_DREEF, SKW_MECH … wordt genegeerd)
 *   - Item moet terug te vinden zijn in grote_inpak_erp_link via FP→GP mapping
 *     (items die niet in onze ERP link staan zijn niet relevant voor grote inpak)
 *
 * Policy: elke upload vervangt ALLE bestaande productie-orders (truncate + insert).
 * BC is daarbij steeds de single source of truth van de huidige open PO's.
 */

const LOCATION_MAP: Record<string, 'Genk' | 'Wilrijk' | 'Willebroek'> = {
  GENK_EIK: 'Genk',
  WILRIJK: 'Wilrijk',
  WILLEBROEK: 'Willebroek',
}

function mapLocation(raw: string | null | undefined): 'Genk' | 'Wilrijk' | 'Willebroek' | null {
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
      productielocatie: 'Genk' | 'Wilrijk' | 'Willebroek'
      kistnummer: string
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
    const unmatchedFps = new Set<string>()

    // Headerdetectie: we detecteren rijen die een echte PO-No bevatten.
    // Echte PO's beginnen met PO (POF..., POI..., POS..., POT...) — al dan niet met jaarprefix.
    const poPattern = /^PO[A-Z]?\d/i

    for (const row of rows) {
      const rawPoNo = String(row[1] ?? '').trim()
      const rawItem = String(row[2] ?? '').trim()
      const rawLoc = String(row[4] ?? '').trim()

      if (!rawPoNo || !poPattern.test(rawPoNo)) continue
      if (!rawItem) continue

      const productielocatie = mapLocation(rawLoc)
      if (!productielocatie) {
        skippedLocation++
        continue
      }

      // FP → GP via bc-mapping, GP → kistnummer via ERP link.
      // Als het al een GP-code is kan normalizeErpCode dat ook hanteren.
      const fpNorm = normalizeErpCode(rawItem)
      let kist: string | null = null
      if (fpNorm) {
        const gpCandidate = normalizeErpCode(bcLookup.toOld(fpNorm)) || fpNorm
        kist = gpToKist.get(gpCandidate) || gpToKist.get(fpNorm) || null
      }

      if (!kist) {
        skippedNoMatch++
        if (fpNorm) unmatchedFps.add(fpNorm)
        continue
      }

      // Dedup binnen het bestand (PO + item is uniek in één export).
      const key = `${rawPoNo}::${rawItem}`
      if (seen.has(key)) continue
      seen.add(key)

      parsed.push({
        status: String(row[0] ?? '').trim() || null,
        prod_order_no: rawPoNo,
        item_no: rawItem,
        description: String(row[3] ?? '').trim() || null,
        location_code: rawLoc,
        productielocatie,
        kistnummer: kist,
        finished_quantity: parseNumber(row[10]),
        quantity: parseNumber(row[11]),
        remaining_quantity: parseNumber(row[12]),
        due_date: parseDate(row[16])?.toISOString().slice(0, 10) ?? null,
        starting_date: parseDate(row[17])?.toISOString() ?? null,
        ending_date: parseDate(row[18])?.toISOString() ?? null,
        source_file: file.name,
      })
    }

    // Volledige replace: BC is de bron van waarheid voor open PO's.
    const { error: delError } = await supabaseAdmin
      .from('grote_inpak_production_orders')
      .delete()
      .neq('id', 0) // alles verwijderen zonder filter lukt niet in supabase-js zonder neq trick
    if (delError) throw delError

    if (parsed.length > 0) {
      // In batches van 500 inserten om payload-limieten te vermijden.
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
      overgeslagen_locatie: skippedLocation,
      overgeslagen_niet_in_erp: skippedNoMatch,
      unmatched_fp_preview: Array.from(unmatchedFps).slice(0, 10),
      unmatched_fp_total: unmatchedFps.size,
    })
  } catch (error: any) {
    console.error('Prod order upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload mislukt' }, { status: 500 })
  }
}
