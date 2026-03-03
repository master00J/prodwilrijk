import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Haal rekindeling op
    const { data: config, error: configError } = await supabaseAdmin
      .from('grote_inpak_kanban_config')
      .select('*')
      .eq('actief', true)
      .order('verbruik_per_dag', { ascending: false })

    if (configError) throw configError

    // 2. Haal stock op (alle locaties)
    const { data: stockRaw, error: stockError } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, location, quantity')

    if (stockError) throw stockError

    // 3. ERP LINK voor kistnummer → erp_code mapping
    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const kistToErp = new Map<string, string>()
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.kistnummer && e.erp_code) {
        kistToErp.set(String(e.kistnummer).toUpperCase().trim(), String(e.erp_code).toUpperCase().trim())
        erpToKist.set(String(e.erp_code).toUpperCase().trim(), String(e.kistnummer).toUpperCase().trim())
      }
    })

    // 4. Bouw stockmap per kistnummer per locatie
    const stockByKist = new Map<string, { genk: number; willebroek: number; wilrijk: number; totaal: number }>()

    ;(stockRaw || []).forEach((s: any) => {
      let kist = s.kistnummer ? String(s.kistnummer).toUpperCase().trim() : null
      if (!kist && s.erp_code) {
        kist = erpToKist.get(String(s.erp_code).toUpperCase().trim()) || null
      }
      // Probeer ook directe match als erp_code zelf een kistnummer is (C-kisten)
      if (!kist && s.erp_code) {
        const code = String(s.erp_code).toUpperCase().trim()
        if (code.match(/^C\d+/)) kist = code
      }
      if (!kist) return

      const loc = String(s.location || '').toLowerCase()
      const qty = Math.max(0, Number(s.quantity || 0))

      if (!stockByKist.has(kist)) {
        stockByKist.set(kist, { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0 })
      }
      const entry = stockByKist.get(kist)!
      if (loc.includes('genk')) entry.genk += qty
      else if (loc.includes('willebroek') || loc === 'wlb') entry.willebroek += qty
      else if (loc.includes('wilrijk')) entry.wilrijk += qty
      entry.totaal += qty
    })

    // 5. Combineer config met stock en bereken besteladvies
    const result = (config || []).map((row: any) => {
      const kt = String(row.case_type).toUpperCase().trim()
      const stapelsPerPos = row.stapels_per_pos || 2
      const maxVoorraad = row.posities * row.stapel * stapelsPerPos
      const bestelpunt = Math.ceil(maxVoorraad * 0.5) // 50% = bestelpunt (1 kanban leeg)

      const stock = stockByKist.get(kt) || { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0 }
      // Kanban stock = enkel Stock Willebroek (wat er in het rek ligt)
      const stockInRek = stock.willebroek
      const tekort = Math.max(0, maxVoorraad - stockInRek)
      // Besteladvies = afgerond op stapelhoogte
      const bestelAantal = tekort > 0 ? Math.ceil(tekort / row.stapel) * row.stapel : 0
      const statusLabel =
        stockInRek === 0 ? 'Leeg'
        : stockInRek < bestelpunt ? 'Bestellen'
        : stockInRek < maxVoorraad ? 'Laag'
        : 'Vol'

      return {
        id: row.id,
        case_type: kt,
        rek_sectie: row.rek_sectie,
        rek_niveau: row.rek_niveau,
        rek_kolom: row.rek_kolom,
        productielocatie: row.productielocatie,
        stapel: row.stapel,
        posities: row.posities,
        stapels_per_pos: stapelsPerPos,
        max_voorraad: maxVoorraad,
        bestelpunt,
        verbruik_per_dag: row.verbruik_per_dag,
        prioriteit: row.prioriteit,
        notitie: row.notitie,
        stock_genk: stock.genk,
        stock_willebroek: stock.willebroek,
        stock_wilrijk: stock.wilrijk,
        stock_totaal: stock.totaal,
        stock_in_rek: stockInRek,
        tekort,
        bestel_aantal: bestelAantal,
        status: statusLabel,
      }
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Genereer besteladvies Excel per locatie (Genk / Wilrijk apart)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data: rows, alleenBestellen } = body

    const toExport = alleenBestellen
      ? (rows || []).filter((r: any) => r.bestel_aantal > 0)
      : (rows || [])

    const wb = new ExcelJS.Workbook()
    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const thin = { style: 'thin' as const }
    const border = { top: thin, left: thin, bottom: thin, right: thin }
    const STATUS_COLORS: Record<string, string> = {
      'Leeg':     'FFFF0000',
      'Bestellen':'FFFF6600',
      'Laag':     'FFFFFF00',
      'Vol':      'FF92D050',
    }
    const headers = ['Kisttype', 'Prod.locatie', 'Sectie', 'Niveau', 'Stapel', 'Posities', 'Max voorraad', 'Stock in rek', 'Tekort', 'Bestellen (st)', 'Verbruik/dag', 'Status']

    const addBesteladviesSheet = (locatieLabel: string, data: any[]) => {
      const ws = wb.addWorksheet(`Besteladvies ${locatieLabel}`)
      ws.columns = [
        { width: 12 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
        { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 },
      ]
      const titleRow = ws.addRow([`Besteladvies C-kisten ${locatieLabel} — ${today}`])
      ws.mergeCells(1, 1, 1, 12)
      titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      titleRow.height = 28
      ws.addRow([])
      const hRow = ws.addRow(headers)
      hRow.eachCell(cell => {
        cell.style = {
          font: { bold: true, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border,
        }
      })
      hRow.height = 18
      data.forEach((row: any, i: number) => {
        const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
        const dRow = ws.addRow([
          row.case_type,
          row.productielocatie || '—',
          row.rek_sectie || '—',
          row.rek_niveau ? `Niveau ${row.rek_niveau}` : '—',
          row.stapel,
          row.posities,
          row.max_voorraad,
          row.stock_in_rek,
          row.tekort,
          row.bestel_aantal,
          row.verbruik_per_dag ? Number(row.verbruik_per_dag).toFixed(2) : '—',
          row.status,
        ])
        dRow.eachCell((cell, col) => {
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
            border,
            alignment: { horizontal: col === 1 || col === 2 ? 'left' : 'center', vertical: 'middle' },
          }
          if (col === 12) {
            const statusColor = STATUS_COLORS[row.status]
            if (statusColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
              cell.font = { bold: true, color: { argb: row.status === 'Leeg' ? 'FFFFFFFF' : 'FF000000' } }
            }
          }
          if (col === 10 && row.bestel_aantal > 0) {
            cell.font = { bold: true, color: { argb: 'FFCC0000' } }
          }
        })
      })
    }

    const locGenk = (loc: string) => String(loc || '').toLowerCase().includes('genk')
    const locWilrijk = (loc: string) => String(loc || '').toLowerCase().includes('wilrijk')
    const genkRows = toExport.filter((r: any) => locGenk(r.productielocatie))
    const wilrijkRows = toExport.filter((r: any) => locWilrijk(r.productielocatie))

    addBesteladviesSheet('Genk', genkRows)
    addBesteladviesSheet('Wilrijk', wilrijkRows)

    // ── Sheet 3: Volledig overzicht met stock per locatie ─────────────────
    const ws2 = wb.addWorksheet('Stock detail')
    ws2.columns = [
      { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 },
    ]
    const t2Row = ws2.addRow([`Stock detail per locatie — ${today}`])
    ws2.mergeCells(1, 1, 1, 8)
    t2Row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    t2Row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    t2Row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    t2Row.height = 28
    ws2.addRow([])
    const h2Row = ws2.addRow(['Kisttype', 'Max voorraad', 'Stock Willebroek', 'Stock Genk', 'Stock Wilrijk', 'Totaal stock', 'Tekort', 'Status'])
    h2Row.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border,
      }
    })
    rows.forEach((row: any, i: number) => {
      const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
      const r2 = ws2.addRow([
        row.case_type,
        row.max_voorraad,
        row.stock_willebroek,
        row.stock_genk,
        row.stock_wilrijk,
        row.stock_totaal,
        row.tekort,
        row.status,
      ])
      r2.eachCell((cell, col) => {
        cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } }, border, alignment: { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' } }
        if (col === 8) {
          const statusColor = STATUS_COLORS[row.status]
          if (statusColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
        }
      })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const dateStr = new Date().toISOString().split('T')[0]
    return new Response(new Uint8Array(buffer) as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Besteladvies_Ckisten_${dateStr}.xlsx"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
