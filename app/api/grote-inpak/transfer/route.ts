import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

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

// POST – upload en verwerk een transferorder Excel
// Structuur: kolom A = ERP code (GP-code of item nummer), kolom F = stuks
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Geen bestanden aangeleverd' }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      const fileName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

      const parsed: { erp_code: string; kistnummer: null; quantity: number; source_file: string }[] = []
      let skipped = 0

      for (const row of rows) {
        const rawErp = String(row[0] ?? '').trim()
        const rawQty = row[5]  // Kolom F = stuks

        // Sla lege rijen en headerrij over
        if (!rawErp || rawErp === '') { skipped++; continue }
        // Header detectie: kolom A bevat letters zonder cijfers achteraan (bijv. "Item No.")
        if (/^[a-z\s.]+$/i.test(rawErp) && !/\d/.test(rawErp)) { skipped++; continue }

        const qty = Number(rawQty)
        if (isNaN(qty) || qty <= 0) { skipped++; continue }

        // Sla ERP code op zoals hij is — mapping naar kistnummer gebeurt in de kanban route
        parsed.push({
          erp_code: rawErp,
          kistnummer: null,
          quantity: Math.round(qty),
          source_file: fileName,
        })
      }

      if (parsed.length === 0) {
        results.push({ file: fileName, status: 'skip', message: `Geen geldige rijen gevonden (${skipped} overgeslagen)` })
        continue
      }

      // Verwijder bestaande data voor dit bestand (per-file overschrijven)
      await supabaseAdmin.from('grote_inpak_transfer').delete().eq('source_file', fileName)

      const { error: insertError } = await supabaseAdmin.from('grote_inpak_transfer').insert(parsed)
      if (insertError) throw insertError

      results.push({
        file: fileName,
        status: 'ok',
        rijen: parsed.length,
        totaal_stuks: parsed.reduce((s, r) => s + r.quantity, 0),
        overgeslagen: skipped,
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
