import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'

export const dynamic = 'force-dynamic'

// GET – haal alle actieve transfer-uploads op (gegroepeerd per bestand)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .select('kistnummer, erp_code, quantity, source_file, uploaded_at')
      .order('uploaded_at', { ascending: false })

    if (error) throw error

    // Groepeer per bestand voor overzicht
    const byFile = new Map<string, { source_file: string; uploaded_at: string; rows: any[]; totaal: number }>()
    ;(data || []).forEach((row: any) => {
      const f = row.source_file
      if (!byFile.has(f)) {
        byFile.set(f, { source_file: f, uploaded_at: row.uploaded_at, rows: [], totaal: 0 })
      }
      const entry = byFile.get(f)!
      entry.rows.push(row)
      entry.totaal += Number(row.quantity || 0)
    })

    return NextResponse.json({
      data: data || [],
      files: Array.from(byFile.values()).map(f => ({
        source_file: f.source_file,
        uploaded_at: f.uploaded_at,
        aantal_rijen: f.rows.length,
        totaal_stuks: f.totaal,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST – upload en verwerk een transferorder Excel
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Geen bestanden aangeleverd' }, { status: 400 })
    }

    // ERP LINK ophalen voor ERP code → kistnummer mapping
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const erpToKist = new Map<string, string>()
    ;(erpLinkData || []).forEach((row: any) => {
      const normalized = normalizeErpCode(row.erp_code)
      if (!normalized || !row.kistnummer) return
      erpToKist.set(normalized, String(row.kistnummer).toUpperCase().trim())
    })

    const results = []

    for (const file of files) {
      const fileName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

      const parsed: { erp_code: string; kistnummer: string; quantity: number; source_file: string }[] = []

      for (const row of rows) {
        const rawErp = String(row[0] ?? '').trim()       // Kolom A = ERP code
        const rawQty = row[5]                             // Kolom F = stuks
        if (!rawErp || rawErp === '' || isNaN(Number(rawQty))) continue

        const qty = Math.max(0, Math.round(Number(rawQty)))
        if (qty === 0) continue

        const erpNorm = normalizeErpCode(rawErp)
        let kist = erpNorm ? erpToKist.get(erpNorm) || null : null

        // Direct C/K-code in kolom A
        if (!kist && rawErp.match(/^[CK]\d+/i)) kist = rawErp.toUpperCase()

        if (!kist) continue  // Onbekende ERP code overslaan

        parsed.push({ erp_code: rawErp, kistnummer: kist, quantity: qty, source_file: fileName })
      }

      if (parsed.length === 0) {
        results.push({ file: fileName, status: 'skip', message: 'Geen geldige rijen gevonden' })
        continue
      }

      // Verwijder bestaande data voor dit bestand (per-file overschrijven)
      await supabaseAdmin
        .from('grote_inpak_transfer')
        .delete()
        .eq('source_file', fileName)

      const { error: insertError } = await supabaseAdmin
        .from('grote_inpak_transfer')
        .insert(parsed)

      if (insertError) throw insertError

      results.push({ file: fileName, status: 'ok', rijen: parsed.length, totaal_stuks: parsed.reduce((s, r) => s + r.quantity, 0) })
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

    const { error } = await supabaseAdmin
      .from('grote_inpak_transfer')
      .delete()
      .eq('source_file', source_file)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
