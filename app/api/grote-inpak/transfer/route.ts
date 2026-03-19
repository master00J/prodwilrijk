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

    // ERP LINK ophalen: alleen C-kisten die relevant zijn voor grote inpak
    const { data: erpLinkData } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const erpToKist = new Map<string, string>()
    ;(erpLinkData || []).forEach((row: any) => {
      const norm = normalizeErpCode(row.erp_code)
      if (norm && row.kistnummer) erpToKist.set(norm, String(row.kistnummer).toUpperCase().trim())
    })

    const results = []

    for (const file of files) {
      const fileName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

      const parsed: { erp_code: string; kistnummer: string; quantity: number; source_file: string }[] = []
      const nietGematcht: string[] = []
      let headerOvergeslagen = 0

      for (const row of rows) {
        const rawErp = String(row[0] ?? '').trim()
        const rawQty = row[5]  // Kolom F = stuks

        // Lege rijen en header (bijv. "Item No.") overslaan
        if (!rawErp) continue
        if (/^[a-z\s.]+$/i.test(rawErp) && !/\d/.test(rawErp)) { headerOvergeslagen++; continue }

        const qty = Number(rawQty)
        if (isNaN(qty) || qty <= 0) continue

        // Match via ERP LINK
        const erpNorm = normalizeErpCode(rawErp)
        const kist = erpNorm ? erpToKist.get(erpNorm) || null : null

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
