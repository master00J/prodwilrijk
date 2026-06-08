import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { expandWorksheetRef } from '@/lib/xlsx/expand-worksheet-ref'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Datum parser: IBM AS/400 YYMMDD numeriek → 'YYYY-MM-DD' ─────────────────
function parseIbmDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const num = Math.round(Number(raw))
  if (isNaN(num) || num <= 0) return null
  const str = String(num).padStart(6, '0')
  if (str.length !== 6) return null
  const yy = parseInt(str.slice(0, 2), 10)
  const mm = parseInt(str.slice(2, 4), 10)
  const dd = parseInt(str.slice(4, 6), 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const year = yy < 50 ? 2000 + yy : 1900 + yy
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function getSourceType(filename: string): 'Y' | 'N' {
  return filename.toUpperCase().includes('PACKED_N') ? 'N' : 'Y'
}

interface ParsedRecord {
  case_label: string   // PCCANO (kolom C) — individueel caselabel
  case_type:  string   // PCCATP (kolom D) — kisttype
  scan_date:  string
  source_type: string
}

// ── Parse één XLS buffer ─────────────────────────────────────────────────────
function parseXlsBuffer(buffer: Buffer, filename: string): ParsedRecord[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  expandWorksheetRef(ws)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  const header = (rows[0] as unknown[]).map(h => String(h ?? '').trim().toUpperCase())

  // Kolomindexen bepalen op basis van header-namen
  let caseLabelIdx = header.indexOf('PCCANO')   // kolom C — caselabel
  let caseTypeIdx  = header.indexOf('PCCATP')   // kolom D — kisttype
  let dateIdx      = header.indexOf('PCSCDT')   // kolom I — scandatum

  // Fallback naar vaste kolomposities
  if (caseLabelIdx < 0) caseLabelIdx = 2
  if (caseTypeIdx  < 0) caseTypeIdx  = 3
  if (dateIdx      < 0) dateIdx      = 8

  // Als er meerdere PCSCDT zijn: neem de tweede (scandate, niet packdate)
  const allPcscdt = header.reduce<number[]>((acc, h, i) => (h === 'PCSCDT' ? [...acc, i] : acc), [])
  if (allPcscdt.length >= 2) dateIdx = allPcscdt[1]

  const sourceType = getSourceType(filename)
  const records: ParsedRecord[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue

    const caseType  = String(row[caseTypeIdx]  ?? '').trim().toUpperCase()
    if (!caseType || !caseType.startsWith('C')) continue

    const caseLabel = String(row[caseLabelIdx] ?? '').trim().toUpperCase()
    const scanDate  = parseIbmDate(row[dateIdx])
    if (!scanDate) continue

    records.push({ case_label: caseLabel, case_type: caseType, scan_date: scanDate, source_type: sourceType })
  }

  return records
}

// ── POST: Upload één of meerdere XLS-bestanden ───────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Geen bestanden ontvangen' }, { status: 400 })
    }

    const allParsed: ParsedRecord[] = []
    const fileResults: { name: string; records: number; error?: string }[] = []

    for (const file of files) {
      try {
        const buffer  = Buffer.from(await file.arrayBuffer())
        const records = parseXlsBuffer(buffer, file.name)
        allParsed.push(...records)
        fileResults.push({ name: file.name, records: records.length })
      } catch (err: any) {
        fileResults.push({ name: file.name, records: 0, error: err.message })
      }
    }

    if (allParsed.length === 0) {
      return NextResponse.json({
        error: 'Geen geldige data gevonden. Controleer of kolom C (PCCANO), D (PCCATP) en I (PCSCDT) aanwezig zijn.',
        files: fileResults,
      }, { status: 422 })
    }

    // ── Aggregeer voor consumption tabel (case_type + scan_date + source_type → quantity) ──
    const countMap = new Map<string, number>()
    allParsed.forEach(r => {
      const key = `${r.case_type}|${r.scan_date}|${r.source_type}`
      countMap.set(key, (countMap.get(key) || 0) + 1)
    })
    const allRecords = Array.from(countMap.entries()).map(([key, qty]) => {
      const [case_type, scan_date, source_type] = key.split('|')
      return { case_type, scan_date, quantity: qty, source_type }
    })

    const uniqueCaseTypes = [...new Set(allParsed.map(r => r.case_type))]

    // ── Vergelijk met bestaande data (voor bijgekomen/afgegaan tellingen) ────
    const { data: existingConsumption } = await supabaseAdmin
      .from('grote_inpak_packed_consumption')
      .select('case_type, scan_date, source_type')
      .in('case_type', uniqueCaseTypes)

    const existingKeys      = new Set((existingConsumption || []).map((r: any) => `${r.case_type}|${r.scan_date}|${r.source_type}`))
    const existingCaseTypes = new Set((existingConsumption || []).map((r: any) => r.case_type))

    const uploadKeys = [...new Set(allRecords.map(r => `${r.case_type}|${r.scan_date}|${r.source_type}`))]
    const cntAdded   = uploadKeys.filter(k => !existingKeys.has(k)).length
    const cntUpdated = uploadKeys.filter(k =>  existingKeys.has(k)).length

    // Nieuwe kisttypes (voor het eerst gezien)
    const caseTypesNew = uniqueCaseTypes.filter(ct => !existingCaseTypes.has(ct))

    // ── Caselabels: bijgekomen (PCCANO nieuw in DB) ──────────────────────────
    // Haal alle bestaande PCCANO labels op voor de case_types in deze upload
    const { data: existingLabels } = await supabaseAdmin
      .from('grote_inpak_packed_labels')
      .select('case_label, case_type')
      .in('case_type', uniqueCaseTypes)

    const existingLabelSet = new Set((existingLabels || []).map((r: any) => String(r.case_label || '').trim()))
    const existingTypeByLabel = new Map(
      (existingLabels || []).map((r: any) => [
        String(r.case_label || '').trim(),
        r.case_type ? String(r.case_type).trim() : null,
      ])
    )
    const uploadTypeByLabel = new Map(
      allParsed
        .filter((r) => r.case_label)
        .map((r) => [String(r.case_label).trim(), r.case_type ? String(r.case_type).trim() : null])
    )

    // Unieke PCCANO labels in deze upload
    const uploadLabelSet = new Set(allParsed.map(r => r.case_label).filter(Boolean))
    const labelsAdded    = [...uploadLabelSet].filter(l => !existingLabelSet.has(l)).sort()
    // "Afgegaan" = labels die eerder wel voorkwamen maar niet in deze batch zitten
    // (alleen relevant voor labels die in hetzelfde datumbereik verwacht worden)
    const labelsRemoved  = [...existingLabelSet].filter(l => !uploadLabelSet.has(l)).sort()
    const labelsAddedDetail = labelsAdded.map((label) => ({
      label,
      case_type: uploadTypeByLabel.get(label) ?? null,
    }))
    const labelsRemovedDetail = labelsRemoved.map((label) => ({
      label,
      case_type: existingTypeByLabel.get(label) ?? null,
    }))

    // ── Sla caselabels op voor toekomstige vergelijkingen ───────────────────
    // Upsert alle PCCANO → case_type relaties
    if (allParsed.length > 0) {
      const labelRecords = [...new Map(
        allParsed
          .filter(r => r.case_label)
          .map(r => [r.case_label, { case_label: r.case_label, case_type: r.case_type, last_seen: r.scan_date }])
      ).values()]
      const LABEL_BATCH = 500
      for (let i = 0; i < labelRecords.length; i += LABEL_BATCH) {
        await supabaseAdmin
          .from('grote_inpak_packed_labels')
          .upsert(labelRecords.slice(i, i + LABEL_BATCH), { onConflict: 'case_label', ignoreDuplicates: false })
          .then(() => {}) // negeer fouten als tabel nog niet bestaat
      }
    }

    // ── Upsert consumption data ──────────────────────────────────────────────
    const BATCH = 200
    let upserted = 0
    for (let i = 0; i < allRecords.length; i += BATCH) {
      const slice = allRecords.slice(i, i + BATCH)
      const { error } = await supabaseAdmin
        .from('grote_inpak_packed_consumption')
        .upsert(slice, { onConflict: 'case_type,scan_date,source_type', ignoreDuplicates: false })
      if (error) throw new Error(`DB fout (batch ${i / BATCH + 1}): ${error.message}`)
      upserted += slice.length
    }

    // ── Log naar upload history ──────────────────────────────────────────────
    const sourceFiles = fileResults.filter(f => !f.error).map(f => f.name).join(', ')
    await supabaseAdmin
      .from('grote_inpak_packed_upload_log')
      .insert({
        source_files:   sourceFiles,
        files_count:    fileResults.filter(f => !f.error).length,
        cnt_added:      cntAdded,
        cnt_updated:    cntUpdated,
        total_records:  upserted,
        case_types_new: caseTypesNew.length > 0 ? caseTypesNew : null,
        // Labels beperkt tot 500 om DB-rij niet te zwaar te maken
        labels_added:   labelsAdded.length   > 0 ? labelsAdded.slice(0, 500)   : null,
        labels_removed: labelsRemoved.length > 0 ? labelsRemoved.slice(0, 500) : null,
        labels_added_detail: labelsAddedDetail.length > 0 ? labelsAddedDetail.slice(0, 500) : null,
        labels_removed_detail: labelsRemovedDetail.length > 0 ? labelsRemovedDetail.slice(0, 500) : null,
      })

    // ── Top kisten samenvatting ──────────────────────────────────────────────
    const summary = new Map<string, number>()
    allParsed.forEach(r => summary.set(r.case_type, (summary.get(r.case_type) || 0) + 1))
    const topKisten = Array.from(summary.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([case_type, quantity]) => ({ case_type, quantity }))

    return NextResponse.json({
      success: true,
      files_processed:  fileResults.filter(f => !f.error).length,
      files_failed:     fileResults.filter(f => f.error).length,
      records_upserted: upserted,
      cnt_added:        cntAdded,
      cnt_updated:      cntUpdated,
      case_types_new:   caseTypesNew,
      labels_added:     labelsAdded.slice(0, 50),   // preview in UI
      labels_removed:   labelsRemoved.slice(0, 50),
      labels_added_total:   labelsAdded.length,
      labels_removed_total: labelsRemoved.length,
      files:      fileResults,
      top_kisten: topKisten,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
