import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

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

    // 2. Haal stock op (alle locaties, incl. productie = Qty. on Prod. Order)
    const { data: stockRaw, error: stockError } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, location, quantity, productie, item_number')

    if (stockError) throw stockError

    // 3. ERP LINK voor kistnummer → erp_code mapping
    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code')

    const kistToErp = new Map<string, string>()
    const erpToKist = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.kistnummer && e.erp_code) {
        const kist = String(e.kistnummer).toUpperCase().trim()
        const erpNorm = normalizeErpCode(e.erp_code)
        if (erpNorm) {
          kistToErp.set(kist, erpNorm)
          erpToKist.set(erpNorm, kist)
        }
      }
    })

    // 3b. Fallback: cases-tabel heeft erp_code → case_type koppeling (zelfde als transport route)
    const { data: casesLink } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('erp_code, case_type')
    const erpToCaseType = new Map<string, string>()
    ;(casesLink || []).forEach((c: any) => {
      if (c.erp_code && c.case_type) {
        const erpNorm = normalizeErpCode(c.erp_code)
        if (erpNorm) erpToCaseType.set(erpNorm, String(c.case_type).toUpperCase().trim())
      }
    })

    // 4. Bouw stockmap per kistnummer per locatie (quantity + productie = Qty. on Prod. Order)
    const stockByKist = new Map<string, {
      genk: number
      willebroek: number
      wilrijk: number
      totaal: number
      in_productie_willebroek: number
    }>()

    ;(stockRaw || []).forEach((s: any) => {
      let kist = s.kistnummer ? String(s.kistnummer).toUpperCase().trim() : null
      const erpRaw = s.erp_code ? String(s.erp_code).trim() : ''
      const erpNorm = erpRaw ? normalizeErpCode(erpRaw) : null
      const itemNo = s.item_number ? String(s.item_number).toUpperCase().trim() : ''
      // 1. Via ERP LINK tabel
      if (!kist && erpNorm) kist = erpToKist.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToKist.get(normalizeErpCode(itemNo) || itemNo) || null
      // 2. Fallback: via cases-tabel (zelfde als transport route)
      if (!kist && erpNorm) kist = erpToCaseType.get(erpNorm) || null
      if (!kist && itemNo) kist = erpToCaseType.get(normalizeErpCode(itemNo) || itemNo) || null
      // 3. Als de erp_code zelf al een C-code is
      if (!kist && erpNorm && /^C\d+/.test(erpNorm)) kist = erpNorm
      if (!kist && itemNo && /^C\d+/.test(itemNo)) kist = itemNo
      if (!kist) return

      const loc = String(s.location || '').toLowerCase()
      const qty = Math.max(0, Number(s.quantity || 0))
      const productie = Math.max(0, Number(s.productie || 0))

      if (!stockByKist.has(kist)) {
        stockByKist.set(kist, { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0, in_productie_willebroek: 0 })
      }
      const entry = stockByKist.get(kist)!
      if (loc.includes('genk')) {
        entry.genk += qty
      } else if (loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl')) {
        entry.willebroek += qty
        entry.in_productie_willebroek += productie
      } else if (loc.includes('wilrijk')) {
        entry.wilrijk += qty
      }
      entry.totaal += qty
    })

    // 5. Combineer config met stock en bereken besteladvies
    const result = (config || []).map((row: any) => {
      const kt = String(row.case_type).toUpperCase().trim()
      const stapelsPerPos = row.stapels_per_pos || 2
      const maxVoorraad = row.posities * row.stapel * stapelsPerPos
      const bestelpunt = Math.ceil(maxVoorraad * 0.5) // 50% = bestelpunt (1 kanban leeg)

      const stock = stockByKist.get(kt) || { genk: 0, willebroek: 0, wilrijk: 0, totaal: 0, in_productie_willebroek: 0 }
      const stockInRek = stock.willebroek
      const inProductie = stock.in_productie_willebroek ?? 0
      // Tekort en status alleen op fysieke stock in rek; in productie telt niet mee als stock
      const tekort = Math.max(0, maxVoorraad - stockInRek)
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
        in_productie: inProductie,
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

// Hulpfunctie: maak één besteladvies-workbook voor één locatie (zonder Sectie, Niveau, Stapel, Posities)
function buildBesteladviesWorkbook(locatieLabel: string, data: any[], today: string) {
  const wb = new ExcelJS.Workbook()
  const thin = { style: 'thin' as const }
  const border = { top: thin, left: thin, bottom: thin, right: thin }
  const STATUS_COLORS: Record<string, string> = {
    'Leeg':     'FFFF0000',
    'Bestellen':'FFFF6600',
    'Laag':     'FFFFFF00',
    'Vol':      'FF92D050',
  }
  // Vereenvoudigde kolommen: Sectie, Niveau, Stapel, Posities weg — alleen wat nog in productie moet
  const headers = ['Kisttype', 'Prod.locatie', 'Max voorraad', 'Stock in rek', 'In productie', 'Tekort', 'Effectief te produceren', 'Verbruik/dag', 'Status']
  const numCols = headers.length

  const ws = wb.addWorksheet(`Besteladvies ${locatieLabel}`)
  ws.columns = [
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 18 }, { width: 12 }, { width: 12 },
  ]
  const titleRow = ws.addRow([`Besteladvies C-kisten ${locatieLabel} — ${today}`])
  ws.mergeCells(1, 1, 1, numCols)
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
      row.max_voorraad,
      row.stock_in_rek,
      row.in_productie ?? 0,
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
      if (col === 9) {
        const statusColor = STATUS_COLORS[row.status]
        if (statusColor) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
          cell.font = { bold: true, color: { argb: row.status === 'Leeg' ? 'FFFFFFFF' : 'FF000000' } }
        }
      }
      if (col === 7 && row.bestel_aantal > 0) {
        cell.font = { bold: true, color: { argb: 'FFCC0000' } }
      }
    })
  })
  return wb
}

// POST: Genereer 2 aparte Excel-bestanden (Genk + Wilrijk) in één ZIP, zonder Sectie/Niveau/Stapel/Posities
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data: rows, alleenBestellen } = body

    const toExport = alleenBestellen
      ? (rows || []).filter((r: any) => r.bestel_aantal > 0)
      : (rows || [])

    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = new Date().toISOString().split('T')[0]

    const locGenk = (loc: string) => String(loc || '').toLowerCase().includes('genk')
    const locWilrijk = (loc: string) => String(loc || '').toLowerCase().includes('wilrijk')
    const genkRows = toExport.filter((r: any) => locGenk(r.productielocatie))
    const wilrijkRows = toExport.filter((r: any) => locWilrijk(r.productielocatie))

    const wbGenk = buildBesteladviesWorkbook('Genk', genkRows, today)
    const wbWilrijk = buildBesteladviesWorkbook('Wilrijk', wilrijkRows, today)

    const bufGenk = await wbGenk.xlsx.writeBuffer() as ArrayBuffer
    const bufWilrijk = await wbWilrijk.xlsx.writeBuffer() as ArrayBuffer

    const zip = new JSZip()
    zip.file(`Besteladvies_Genk_${dateStr}.xlsx`, bufGenk)
    zip.file(`Besteladvies_Wilrijk_${dateStr}.xlsx`, bufWilrijk)

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Besteladvies_Genk_Wilrijk_${dateStr}.zip"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
