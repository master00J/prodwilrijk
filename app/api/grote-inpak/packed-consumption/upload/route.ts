import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

// Verhoog de body-size limiet voor meerdere XLS-bestanden
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

// ── Source type uit bestandsnaam ─────────────────────────────────────────────
function getSourceType(filename: string): 'Y' | 'N' {
  return filename.toUpperCase().includes('PACKED_N') ? 'N' : 'Y'
}

// ── Parse één XLS buffer ─────────────────────────────────────────────────────
function parseXlsBuffer(
  buffer: Buffer,
  filename: string
): { case_type: string; scan_date: string; quantity: number; source_type: string }[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]

  if (rows.length < 2) return []

  const header = (rows[0] as unknown[]).map(h => String(h ?? '').trim().toUpperCase())

  // Kolom D = PCCATP, Kolom I = PCSCDT (tweede voorkomen)
  let caseTypeIdx = header.indexOf('PCCATP')
  let dateIdx     = header.indexOf('PCSCDT')
  if (caseTypeIdx < 0) caseTypeIdx = 3
  if (dateIdx < 0)     dateIdx     = 8

  // Als er meerdere PCSCDT kolommen zijn: neem de tweede (scandate)
  const allPcscdt = header.reduce<number[]>((acc, h, i) => (h === 'PCSCDT' ? [...acc, i] : acc), [])
  if (allPcscdt.length >= 2) dateIdx = allPcscdt[1]

  const sourceType = getSourceType(filename)
  const counts = new Map<string, number>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row || (row as unknown[]).every(c => c === '' || c === null || c === undefined)) continue

    const caseType = String(row[caseTypeIdx] ?? '').trim().toUpperCase()
    if (!caseType || !caseType.startsWith('C')) continue

    const scanDate = parseIbmDate(row[dateIdx])
    if (!scanDate) continue

    const key = `${caseType}|${scanDate}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return Array.from(counts.entries()).map(([key, qty]) => {
    const [caseType, scanDate] = key.split('|')
    return { case_type: caseType, scan_date: scanDate, quantity: qty, source_type: sourceType }
  })
}

// ── POST: Upload één of meerdere XLS-bestanden ───────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Geen bestanden ontvangen' }, { status: 400 })
    }

    const allRecords: { case_type: string; scan_date: string; quantity: number; source_type: string }[] = []
    const fileResults: { name: string; records: number; error?: string }[] = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const records = parseXlsBuffer(buffer, file.name)
        allRecords.push(...records)
        fileResults.push({ name: file.name, records: records.length })
      } catch (err: any) {
        fileResults.push({ name: file.name, records: 0, error: err.message })
      }
    }

    if (allRecords.length === 0) {
      return NextResponse.json({
        error: 'Geen geldige data gevonden in de bestanden. Controleer of kolom D (PCCATP) en kolom I (PCSCDT) aanwezig zijn.',
        files: fileResults,
      }, { status: 422 })
    }

    // Upsert in batches van 200
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

    // Samenvatting per kisttype
    const summary = new Map<string, number>()
    allRecords.forEach(r => summary.set(r.case_type, (summary.get(r.case_type) || 0) + r.quantity))
    const topKisten = Array.from(summary.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kt, qty]) => ({ case_type: kt, quantity: qty }))

    return NextResponse.json({
      success: true,
      files_processed: fileResults.filter(f => !f.error).length,
      files_failed: fileResults.filter(f => f.error).length,
      records_upserted: upserted,
      files: fileResults,
      top_kisten: topKisten,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
