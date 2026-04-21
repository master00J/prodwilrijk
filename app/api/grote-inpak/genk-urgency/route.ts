import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { getBcMappingLookup } from '@/lib/bc-mapping/server'

export const dynamic = 'force-dynamic'

// GET: JSON overzicht van urgente K-kisten voor Genk
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const onlyNotInWB = sp.get('only_not_in_wb') !== 'false' // default: true

    // Haal alle Genk cases op die K-kisten zijn (incl. V = vaszak-variant van K)
    let query = supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date, item_number, erp_code, stapel, in_willebroek, productielocatie, deadline, dagen_te_laat')
      .or('case_type.ilike.K%,case_type.ilike.V%')
      .eq('productielocatie', 'Genk')
      .order('arrival_date', { ascending: true }) // oudste eerst = meest dringend

    if (onlyNotInWB) {
      query = query.eq('in_willebroek', false)
    }

    const { data: cases, error: casesError } = await query
    if (casesError) throw casesError

    // Haal stock op voor alle relevante kistnummers
    const caseTypes = [...new Set((cases || []).map((c: any) => c.case_type).filter(Boolean))]

    // Stock per kistnummer per locatie
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, location, quantity, kistnummer')

    if (stockError) throw stockError

    // ERP LINK: kistnummer → erp_code en omgekeerd
    const { data: erpLink } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, erp_code, description')

    const erpToKist = new Map<string, string>()
    const kistToErp = new Map<string, string>()
    const kistToDesc = new Map<string, string>()
    ;(erpLink || []).forEach((e: any) => {
      if (e.erp_code && e.kistnummer) {
        erpToKist.set(String(e.erp_code).toUpperCase().trim(), String(e.kistnummer).toUpperCase().trim())
        kistToErp.set(String(e.kistnummer).toUpperCase().trim(), String(e.erp_code).toUpperCase().trim())
      }
      if (e.kistnummer && e.description) {
        kistToDesc.set(String(e.kistnummer).toUpperCase().trim(), e.description)
      }
    })

    // Bouw stockmap: kistnummer → { locatie → qty }
    const stockByKist = new Map<string, Map<string, number>>()
    ;(stockData || []).forEach((s: any) => {
      let kist = s.kistnummer ? String(s.kistnummer).toUpperCase().trim() : null
      if (!kist && s.erp_code) {
        kist = erpToKist.get(String(s.erp_code).toUpperCase().trim()) || null
      }
      if (!kist) return

      const loc = String(s.location || '').trim()
      const qty = Number(s.quantity || 0)
      if (!stockByKist.has(kist)) stockByKist.set(kist, new Map())
      const locMap = stockByKist.get(kist)!
      locMap.set(loc, (locMap.get(loc) || 0) + qty)
    })

    // Groepeer cases per case_type (kistnummer), met alle caselabels + datums
    const grouped = new Map<string, {
      case_type: string
      erp_code: string | null
      description: string | null
      stapel: number
      cases: { case_label: string; arrival_date: string | null; dagen_te_laat: number }[]
      oldest_arrival: string | null
      total_count: number
      stock_genk: number
      stock_willebroek: number
      stock_wilrijk: number
      stock_in_productie: number
    }>()

    ;(cases || []).forEach((c: any) => {
      const kt = String(c.case_type || '').toUpperCase().trim()
      if (!grouped.has(kt)) {
        const stockMap = stockByKist.get(kt) || new Map()
        let stockGenk = 0, stockWB = 0, stockWilrijk = 0, stockProd = 0
        stockMap.forEach((qty, loc) => {
          const l = loc.toLowerCase()
          if (l.includes('genk')) stockGenk += qty
          else if (l.includes('willebroek') || l === 'wlb') stockWB += qty
          else if (l.includes('wilrijk')) stockWilrijk += qty
          else if (l.includes('productie') || l.includes('prod')) stockProd += qty
        })

        grouped.set(kt, {
          case_type: kt,
          erp_code: c.erp_code || kistToErp.get(kt) || null,
          description: kistToDesc.get(kt) || null,
          stapel: c.stapel || 1,
          cases: [],
          oldest_arrival: null,
          total_count: 0,
          stock_genk: stockGenk,
          stock_willebroek: stockWB,
          stock_wilrijk: stockWilrijk,
          stock_in_productie: stockProd,
        })
      }
      const g = grouped.get(kt)!
      g.cases.push({
        case_label: c.case_label,
        arrival_date: c.arrival_date,
        dagen_te_laat: c.dagen_te_laat || 0,
      })
      g.total_count++
      if (c.arrival_date) {
        if (!g.oldest_arrival || c.arrival_date < g.oldest_arrival) {
          g.oldest_arrival = c.arrival_date
        }
      }
    })

    // Sorteer: eerst overdue (dagen_te_laat > 0), dan op oudste arrival_date
    const result = Array.from(grouped.values()).sort((a, b) => {
      const aOverdue = a.cases.some(c => c.dagen_te_laat > 0) ? 1 : 0
      const bOverdue = b.cases.some(c => c.dagen_te_laat > 0) ? 1 : 0
      if (bOverdue !== aOverdue) return bOverdue - aOverdue
      if (!a.oldest_arrival && !b.oldest_arrival) return 0
      if (!a.oldest_arrival) return 1
      if (!b.oldest_arrival) return -1
      return a.oldest_arrival.localeCompare(b.oldest_arrival)
    })

    return NextResponse.json({ data: result, count: result.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Genereer Excel urgentielijst voor Genk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data: urgencyData } = body

    // Als geen data meegestuurd, haal zelf op
    let rows: any[] = urgencyData
    if (!rows) {
      const res = await GET(request)
      const json = await res.json()
      rows = json.data || []
    }

    const wb = new ExcelJS.Workbook()
    const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const bcMapping = await getBcMappingLookup()

    // ── Sheet 1: Overzicht per kisttype ──────────────────────────────────
    const wsOverview = wb.addWorksheet('Urgentielijst Genk')
    wsOverview.columns = [
      { width: 12 }, // Rang
      { width: 14 }, // Kisttype
      { width: 30 }, // Omschrijving
      { width: 14 }, // BC CODE
      { width: 14 }, // oude BC CODE
      { width: 10 }, // Stapel
      { width: 10 }, // Aantal
      { width: 16 }, // Vroegste datum
      { width: 12 }, // Overdue
      { width: 14 }, // Stock Genk
      { width: 16 }, // Stock Willebroek
      { width: 14 }, // Stock Wilrijk
      { width: 16 }, // In productie
    ]

    const thin = { style: 'thin' as const }
    const border = { top: thin, left: thin, bottom: thin, right: thin }

    const titleRow = wsOverview.addRow([`Urgentielijst K-kisten Genk — ${today}`])
    wsOverview.mergeCells(1, 1, 1, 13)
    titleRow.getCell(1).style = {
      font: { bold: true, size: 14 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } },
      font2: undefined,
      alignment: { horizontal: 'center', vertical: 'middle' },
    } as any
    titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    titleRow.height = 28

    wsOverview.addRow([]) // lege rij

    const headers = ['Rang', 'Kisttype', 'Omschrijving', 'BC CODE', 'oude BC CODE', 'Stapel', 'Aantal', 'Vroegste datum', 'Overdue', 'Stock Genk', 'Stock Willebroek', 'Stock Wilrijk', 'In productie']
    const hRow = wsOverview.addRow(headers)
    hRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border,
      }
    })
    hRow.height = 18

    rows.forEach((row: any, i: number) => {
      const isOverdue = row.cases?.some((c: any) => c.dagen_te_laat > 0)
      const maxOverdue = Math.max(0, ...(row.cases || []).map((c: any) => c.dagen_te_laat || 0))
      const fgColor = isOverdue ? 'FFFFF2CC' : i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'

      const oldErp = row.erp_code || ''
      const newErp = oldErp ? bcMapping.toNew(oldErp) : ''
      const dataRow = wsOverview.addRow([
        i + 1,
        row.case_type,
        row.description || '',
        newErp,
        oldErp,
        row.stapel || 1,
        row.total_count,
        row.oldest_arrival ? new Date(row.oldest_arrival).toLocaleDateString('nl-NL') : '—',
        isOverdue ? `${maxOverdue} dagen` : '',
        row.stock_genk || 0,
        row.stock_willebroek || 0,
        row.stock_wilrijk || 0,
        row.stock_in_productie || 0,
      ])

      dataRow.eachCell((cell, col) => {
        cell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
          border,
          alignment: { horizontal: col <= 3 ? 'left' : 'center', vertical: 'middle' },
        }
        if (col === 8 && isOverdue) {
          cell.font = { bold: true, color: { argb: 'FFCC0000' } }
        }
        if (col === 7 && isOverdue) {
          cell.font = { bold: true, color: { argb: 'FFCC0000' } }
        }
      })
    })

    // ── Sheet 2: Detail per caselabel ─────────────────────────────────────
    const wsDetail = wb.addWorksheet('Detail per caselabel')
    wsDetail.columns = [
      { width: 10 }, // Rang
      { width: 14 }, // Kisttype
      { width: 22 }, // Case Label
      { width: 16 }, // Arrival Date
      { width: 12 }, // Overdue
    ]

    const dTitleRow = wsDetail.addRow([`Detail caselabels — ${today}`])
    wsDetail.mergeCells(1, 1, 1, 5)
    dTitleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    dTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    dTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    dTitleRow.height = 28

    wsDetail.addRow([])

    const dHeaders = ['Rang', 'Kisttype', 'Case Label', 'Arrival Date', 'Overdue (dagen)']
    const dHRow = wsDetail.addRow(dHeaders)
    dHRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border,
      }
    })

    let detailRank = 1
    rows.forEach((row: any, i: number) => {
      ;(row.cases || [])
        .sort((a: any, b: any) => {
          if (!a.arrival_date && !b.arrival_date) return 0
          if (!a.arrival_date) return 1
          if (!b.arrival_date) return -1
          return a.arrival_date.localeCompare(b.arrival_date)
        })
        .forEach((c: any) => {
          const isOverdue = c.dagen_te_laat > 0
          const fgColor = isOverdue ? 'FFFFF2CC' : detailRank % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
          const dRow = wsDetail.addRow([
            i + 1,
            row.case_type,
            c.case_label,
            c.arrival_date ? new Date(c.arrival_date).toLocaleDateString('nl-NL') : '—',
            c.dagen_te_laat > 0 ? c.dagen_te_laat : '',
          ])
          dRow.eachCell((cell, col) => {
            cell.style = {
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
              border,
              alignment: { horizontal: col <= 3 ? 'left' : 'center', vertical: 'middle' },
            }
            if (col === 5 && isOverdue) cell.font = { bold: true, color: { argb: 'FFCC0000' } }
          })
          detailRank++
        })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const dateStr = new Date().toISOString().split('T')[0]

    return new Response(new Uint8Array(buffer) as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Urgentielijst_Genk_${dateStr}.xlsx"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
