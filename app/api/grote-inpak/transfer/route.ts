import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { expandWorksheetRef } from '@/lib/xlsx/expand-worksheet-ref'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import { getBcMappingLookup } from '@/lib/bc-mapping/server'

export const dynamic = 'force-dynamic'

// GET – haal alle actieve transfer-uploads op (gegroepeerd per bestand)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('erp_code, kistnummer, quantity, source_file, uploaded_at')
      .order('uploaded_at', { ascending: false })

    if (error) throw error

    // Groepeer per bestand voor overzicht
    const byFile = new Map<string, { source_file: string; uploaded_at: string; totaal: number; rijen: number }>()
    ;(data || []).forEach((row: any) => {
      const f = row.source_file
      if (!byFile.has(f)) byFile.set(f, { source_file: f, uploaded_at: row.uploaded_at, totaal: 0, rijen: 0 })
      const entry = byFile.get(f)!
      entry.totaal += Number(row.quantity || 0)
      entry.rijen++
    })

    return NextResponse.json({
      data: data || [],
      files: Array.from(byFile.values()).map(f => ({
        source_file: f.source_file,
        uploaded_at: f.uploaded_at,
        aantal_rijen: f.rijen,
        totaal_stuks: f.totaal,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Normaliseer kopregel uit BC Excel (zoals stock-upload). */
function normHeaderCell(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type TransferCols = {
  headerRow: number
  erpIdx: number
  /** effectief aantal stuks voor transfer */
  getQty: (row: any[]) => number
}

/**
 * BC transfer / Lines-export: Item No. in kolom A, hoeveelheid o.a. in "Quantity",
 * "Qty. to Ship", of "Quantity Shipped" − "Quantity Received" (onderweg, nog niet ontvangen).
 * Oude export: kolom A = code, kolom F (index 5) = stuks.
 */
function detectTransferColumns(rows: any[][]): TransferCols {
  const maxScan = Math.min(12, rows.length)
  const maxCol = Math.max(
    40,
    ...rows.slice(0, maxScan).map((r) => (Array.isArray(r) ? r.length : 0)),
  )

  let best: { score: number; headerRow: number; nameToIdx: Map<string, number> } | null = null

  for (let hr = 0; hr < maxScan; hr++) {
    const r = rows[hr]
    if (!r?.length) continue
    const nameToIdx = new Map<string, number>()
    for (let c = 0; c < Math.min(maxCol, r.length); c++) {
      const key = normHeaderCell(r[c])
      if (key) nameToIdx.set(key, c)
    }
    const hasItemNo =
      nameToIdx.has('item no.') ||
      nameToIdx.has('item no') ||
      nameToIdx.has('no.')
    const hasNo = nameToIdx.has('no')
    const hasQty = nameToIdx.has('quantity')
    const hasShip =
      nameToIdx.has('quantity shipped') ||
      nameToIdx.has('qty. shipped') ||
      nameToIdx.has('qty shipped')
    const hasRec =
      nameToIdx.has('quantity received') ||
      nameToIdx.has('qty. received') ||
      nameToIdx.has('qty received')
    const hasToShip =
      nameToIdx.has('qty. to ship') || nameToIdx.has('qty to ship') || nameToIdx.has('qty to ship.')
    const score =
      (hasItemNo || hasNo ? 3 : 0) +
      (hasQty ? 2 : 0) +
      (hasShip && hasRec ? 2 : 0) +
      (hasToShip ? 1 : 0)

    if (score > (best?.score ?? -1)) {
      best = { score, headerRow: hr, nameToIdx }
    }
  }

  const asNum = (row: any[], idx: number | undefined): number => {
    if (idx === undefined || idx < 0) return 0
    const v = row[idx]
    if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.floor(v))
    const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  }

  if (best && best.score >= 3) {
    const m = best.nameToIdx
    const erpIdx =
      m.get('item no.') ??
      m.get('item no') ??
      m.get('no.') ??
      m.get('no') ??
      0

    const idxQty = m.get('quantity')
    const idxToShip = m.get('qty. to ship') ?? m.get('qty to ship') ?? m.get('qty to ship.')
    const idxShipped =
      m.get('quantity shipped') ?? m.get('qty. shipped') ?? m.get('qty shipped')
    const idxReceived =
      m.get('quantity received') ?? m.get('qty. received') ?? m.get('qty received')

    const getQty = (row: any[]): number => {
      if (idxShipped !== undefined && idxReceived !== undefined) {
        const shipped = asNum(row, idxShipped)
        const received = asNum(row, idxReceived)
        const inTransit = shipped - received
        if (inTransit > 0) return inTransit
        if (shipped === 0 && received === 0) {
          /* nog niet uit shipment: kolommen bestaan wél */
        } else {
          /* volledig ontvangen */
          return 0
        }
      }
      if (idxToShip !== undefined) {
        const q = asNum(row, idxToShip)
        if (q > 0) return q
      }
      if (idxQty !== undefined) return asNum(row, idxQty)
      return 0
    }

    return { headerRow: best.headerRow, erpIdx, getQty }
  }

  return {
    headerRow: -1,
    erpIdx: 0,
    getQty: (row: any[]) => asNum(row, 5),
  }
}

// POST – upload en verwerk een transferorder Excel
// BC Lines / Item Tracking: header met "Item No." + "Quantity" / shipped−received; legacy: A + F
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Geen bestanden aangeleverd' }, { status: 400 })
    }

    // ERP LINK ophalen: alleen C-kisten die relevant zijn voor grote inpak
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const erpToKist = new Map<string, string>()
    ;(erpLinkData || []).forEach((row: any) => {
      const norm = normalizeErpCode(row.erp_code)
      if (norm && row.kistnummer) {
        const kist = String(row.kistnummer).toUpperCase().trim()
        erpToKist.set(norm, kist)
        if (/^GP\d+$/i.test(norm)) {
          const numPart = norm.replace(/^GP/i, '')
          const asNum = parseInt(numPart, 10)
          if (!isNaN(asNum)) erpToKist.set(String(asNum), kist)
        }
      }
    })

    const bcMapping = await getBcMappingLookup()
    const erpPairs = Array.from(erpToKist.entries())
    for (const [erpKey, kistVal] of erpPairs) {
      if (!kistVal) continue
      for (const alt of [bcMapping.toNew(erpKey), bcMapping.toOld(erpKey)]) {
        if (!alt) continue
        const aNorm = normalizeErpCode(alt)
        if (aNorm && aNorm !== erpKey) erpToKist.set(aNorm, kistVal)
      }
    }

    const resolveKist = (rawErp: string): string | null => {
      const erpNorm = normalizeErpCode(rawErp)
      if (!erpNorm) return null
      let kist = erpToKist.get(erpNorm) || null
      if (!kist) {
        const n2 = normalizeErpCode(bcMapping.toNew(erpNorm))
        const o2 = normalizeErpCode(bcMapping.toOld(erpNorm))
        kist = (n2 && erpToKist.get(n2)) || (o2 && erpToKist.get(o2)) || null
      }
      if (!kist && /^GP\d+$/i.test(erpNorm)) {
        const numPart = erpNorm.replace(/^GP/i, '')
        const asNum = parseInt(numPart, 10)
        if (!isNaN(asNum)) kist = erpToKist.get(String(asNum)) || null
      }
      if (!kist && /^\d{4,8}$/.test(String(rawErp).trim())) {
        kist = erpToKist.get(String(rawErp).trim()) || null
      }
      return kist
    }

    const results = []

    for (const file of files) {
      const fileName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) continue
      expandWorksheetRef(ws)
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

      const { headerRow, erpIdx, getQty } = detectTransferColumns(rows)
      const startRow = headerRow >= 0 ? headerRow + 1 : 0

      const parsed: { erp_code: string; kistnummer: string; quantity: number; source_file: string }[] = []
      const nietGematcht: string[] = []

      for (let ri = startRow; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row?.length) continue
        const rawErp = String(row[erpIdx] ?? '').trim()

        // Lege rijen en header (bijv. "Item No.") overslaan
        if (!rawErp) continue
        if (/^[a-z\s.]+$/i.test(rawErp) && !/\d/.test(rawErp)) continue

        const qty = getQty(row)
        if (qty <= 0) continue

        const kist = resolveKist(rawErp)

        if (!kist) {
          // Niet in ERP LINK → niet relevant voor grote inpak, bijhouden voor feedback
          if (!nietGematcht.includes(rawErp)) nietGematcht.push(rawErp)
          continue
        }

        // Zelfde kistnummer samenvoegen
        const existing = parsed.find(p => p.kistnummer === kist)
        if (existing) {
          existing.quantity += Math.round(qty)
        } else {
          parsed.push({ erp_code: rawErp, kistnummer: kist, quantity: Math.round(qty), source_file: fileName })
        }
      }

      if (parsed.length === 0) {
        results.push({
          file: fileName,
          status: 'skip',
          message: `Geen C-kisten gevonden via ERP LINK. Niet-gematchte codes: ${nietGematcht.slice(0, 5).join(', ')}${nietGematcht.length > 5 ? '…' : ''}`,
          niet_gematcht: nietGematcht,
        })
        continue
      }

      // Verwijder bestaande data voor dit bestand en sla nieuw op
      await supabaseAdmin.from('grote_inpak_transfer').delete().eq('source_file', fileName)
      const { error: insertError } = await supabaseAdmin.from('grote_inpak_transfer').insert(parsed)
      if (insertError) throw insertError

      results.push({
        file: fileName,
        status: 'ok',
        rijen: parsed.length,
        totaal_stuks: parsed.reduce((s, r) => s + r.quantity, 0),
        niet_gematcht_aantal: nietGematcht.length,
        niet_gematcht_preview: nietGematcht.slice(0, 5),
      })
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE – verwijder alle data van één bestand
export async function DELETE(request: NextRequest) {
  try {
    const { source_file } = await request.json()
    if (!source_file) return NextResponse.json({ error: 'source_file vereist' }, { status: 400 })

    const { error } = await supabaseAdmin.from('grote_inpak_transfer').delete().eq('source_file', source_file)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
