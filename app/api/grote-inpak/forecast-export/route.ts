import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { supabaseAdmin } from '@/lib/supabase/server'

type ForecastRow = {
  case_label: string
  case_type: string
  arrival_date: string
}

type ErpRow = {
  kistnummer: string
  productielocatie: string | null
  erp_code: string | null
}

type StockRow = {
  erp_code: string | null
  kistnummer?: string | null
  quantity: number | null
  location?: string | null
  stock?: number | null
  inkoop?: number | null
  productie?: number | null
  in_transfer?: number | null
}

type CaseRow = {
  case_label: string
  case_type: string
  arrival_date?: string | null
}

function formatDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const location = String(body.location || 'Wilrijk')
    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : null
    const dateTo = body.dateTo ? new Date(body.dateTo) : null

    const { data: forecastData, error: forecastError } = await supabaseAdmin
      .from('grote_inpak_forecast')
      .select('case_label, case_type, arrival_date')

    if (forecastError) throw forecastError

    const { data: erpData, error: erpError } = await supabaseAdmin
      .from('grote_inpak_erp_link')
      .select('kistnummer, productielocatie, erp_code')

    if (erpError) throw erpError

    const { data: stockData, error: stockError } = await supabaseAdmin
      .from('grote_inpak_stock')
      .select('erp_code, kistnummer, quantity, location, stock, inkoop, productie, in_transfer')

    if (stockError) throw stockError

    const { data: casesData, error: casesError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type, arrival_date')

    if (casesError) throw casesError

    const pilsLabels = new Set(
      (casesData || []).map((row: CaseRow) => String(row.case_label || '').trim()).filter(Boolean)
    )

    const erpByCase = new Map<string, ErpRow>()
    const caseByErp = new Map<string, string>()
    ;(erpData || []).forEach((row: ErpRow) => {
      const caseType = String(row.kistnummer || '').trim()
      if (!caseType) return
      erpByCase.set(caseType, row)
      if (row.erp_code) {
        caseByErp.set(String(row.erp_code).trim(), caseType)
      }
    })

    const stockByCase = new Map<string, number>()
    const inkoopByCase = new Map<string, number>()
    const productieByCase = new Map<string, number>()
    const transferByCase = new Map<string, number>()
    ;(stockData || []).forEach((row: StockRow) => {
      const erpCode = String(row.erp_code || '').trim()
      const kistnummer = String((row as any).kistnummer || '').trim()
      if (!erpCode && !kistnummer) return
      let caseType = kistnummer || caseByErp.get(erpCode)
      if (!caseType && /^[KVC]/i.test(erpCode)) {
        caseType = erpCode.toUpperCase().replace(/^V/, 'K')
      }
      if (!caseType) return
      const qty = Number(row.quantity || 0)
      const stock = Number(row.stock ?? row.quantity ?? 0)
      const inkoop = Number(row.inkoop ?? 0)
      const productie = Number(row.productie ?? 0)
      const inTransfer = Number(row.in_transfer ?? 0)
      if (![qty, stock, inkoop, productie, inTransfer].some((val) => Number.isFinite(val))) return
      const loc = String(row.location || '').toLowerCase()
      if (loc.includes('transfer')) {
        transferByCase.set(caseType, (transferByCase.get(caseType) || 0) + (Number.isFinite(inTransfer) ? inTransfer : 0))
      } else {
        if (Number.isFinite(stock)) {
          stockByCase.set(caseType, (stockByCase.get(caseType) || 0) + stock)
        }
        if (Number.isFinite(inkoop)) {
          inkoopByCase.set(caseType, (inkoopByCase.get(caseType) || 0) + inkoop)
        }
        if (Number.isFinite(productie)) {
          productieByCase.set(caseType, (productieByCase.get(caseType) || 0) + productie)
        }
      }
    })

    const pilsNeedByCase = new Map<string, number>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = String(row.case_type || '').trim()
      if (!caseType) return
      pilsNeedByCase.set(caseType, (pilsNeedByCase.get(caseType) || 0) + 1)
    })

    const netAvailableByCase = new Map<string, number>()
    const availableByCase = new Map<string, number>()
    const allCases = new Set<string>([
      ...Array.from(stockByCase.keys()),
      ...Array.from(inkoopByCase.keys()),
      ...Array.from(productieByCase.keys()),
      ...Array.from(transferByCase.keys()),
      ...Array.from(pilsNeedByCase.keys()),
    ])
    allCases.forEach((caseType) => {
      const available =
        (stockByCase.get(caseType) || 0) +
        (inkoopByCase.get(caseType) || 0) +
        (productieByCase.get(caseType) || 0) +
        (transferByCase.get(caseType) || 0)
      availableByCase.set(caseType, available)
      const used = pilsNeedByCase.get(caseType) || 0
      netAvailableByCase.set(caseType, Math.max(0, Math.round(available) - used))
    })

    const filtered = (forecastData || [])
      .map((row: ForecastRow) => ({
        case_label: String(row.case_label || '').trim(),
        case_type: String(row.case_type || '').trim(),
        arrival_date: String(row.arrival_date || '').trim(),
      }))
      .filter((row) => row.case_label && row.case_type && row.arrival_date)
      .filter((row) => !pilsLabels.has(row.case_label))
      .filter((row) => {
        const arrival = new Date(row.arrival_date)
        if (Number.isNaN(arrival.getTime())) return false
        if (dateFrom && arrival < dateFrom) return false
        if (dateTo && arrival > dateTo) return false
        return true
      })
      .map((row) => {
        const erpRow = erpByCase.get(row.case_type)
        const loc = erpRow?.productielocatie ? String(erpRow.productielocatie) : 'Wilrijk'
        return { ...row, productielocatie: loc }
      })
      .filter((row) => String(row.productielocatie || '').toLowerCase() === location.toLowerCase())

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Geen forecast data gevonden' }, { status: 400 })
    }

    const dateSet = new Set<string>()
    const counts = new Map<string, Map<string, number>>()
    filtered.forEach((row) => {
      const dateLabel = formatDateLabel(row.arrival_date)
      dateSet.add(dateLabel)
      if (!counts.has(row.case_type)) counts.set(row.case_type, new Map())
      const map = counts.get(row.case_type)!
      map.set(dateLabel, (map.get(dateLabel) || 0) + 1)
    })

    const dateCols = Array.from(dateSet).sort((a, b) => {
      const da = new Date(a.split('-').reverse().join('-'))
      const db = new Date(b.split('-').reverse().join('-'))
      return da.getTime() - db.getTime()
    })

    const rows: Array<Record<string, string | number>> = []
    counts.forEach((map, caseType) => {
      const row: Record<string, string | number> = {}
      row['GP CODE'] = erpByCase.get(caseType)?.erp_code || 'Special'
      row['kist'] = caseType
      dateCols.forEach((date) => {
        row[date] = map.get(date) || 0
      })
      rows.push(row)
    })

    rows.forEach((row) => {
      let available = netAvailableByCase.get(String(row['kist'])) || 0
      if (available <= 0) return
      for (const date of dateCols) {
        if (available <= 0) break
        const need = Number(row[date] || 0)
        if (need <= 0) continue
        const take = Math.min(need, available)
        row[date] = need - take
        available -= take
      }
    })

    const filteredDateCols = dateCols.filter((date) => rows.some((row) => Number(row[date] || 0) > 0))
    const finalRows = rows
      .filter((row) => Number(row['TOTAAL'] || 0) > 0)
      .map((row) => {
        const output: Record<string, string | number> = {}
        output['GP CODE'] = row['GP CODE']
        output['kist'] = row['kist']
        filteredDateCols.forEach((date) => {
          output[date] = row[date]
        })
        const total = filteredDateCols.reduce((sum, date) => sum + Number(output[date] || 0), 0)
        output['TOTAAL'] = total
        return output
      })

    if (finalRows.length === 0) {
      return NextResponse.json({ error: 'Geen forecast data met behoefte gevonden' }, { status: 400 })
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Forecast')

    const columns = ['GP CODE', 'kist', ...filteredDateCols, 'TOTAAL']
    ws.addRow(columns)
    finalRows.forEach((row) => {
      ws.addRow(columns.map((col) => row[col] ?? ''))
    })

    const header = ws.getRow(1)
    header.font = { bold: true }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }

    const border = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    }
    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = border
        const numericValue = typeof cell.value === 'number' ? cell.value : Number.NaN
        const colIndex = typeof cell.col === 'number' ? cell.col : 0
        if (rowNumber > 1 && Number.isFinite(numericValue) && numericValue > 0 && colIndex > 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
        }
      })
    })
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
    ws.columns.forEach((col) => {
      col.width = 14
    })

    const statusSheet = wb.addWorksheet('Status')
    const statusColumns = [
      'BC CODE',
      'case_type',
      'productielocatie',
      'forecast_aantal',
      'op_pils',
      'op_stock',
      'in_transfer',
      'in_productie',
      'in_inkooporder',
      'netto_nodig',
    ]

    const pilsByCaseLoc = new Map<string, number>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = String(row.case_type || '').trim()
      if (!caseType) return
      const loc = erpByCase.get(caseType)?.productielocatie || 'Wilrijk'
      const key = `${caseType}||${loc}`
      pilsByCaseLoc.set(key, (pilsByCaseLoc.get(key) || 0) + 1)
    })

    const forecastByCaseLoc = new Map<string, number>()
    filtered.forEach((row) => {
      const key = `${row.case_type}||${row.productielocatie}`
      forecastByCaseLoc.set(key, (forecastByCaseLoc.get(key) || 0) + 1)
    })

    const statusRows: Array<Record<string, string | number>> = []
    const caseLocKeys = new Set<string>([
      ...Array.from(forecastByCaseLoc.keys()),
      ...Array.from(pilsByCaseLoc.keys()),
    ])
    caseLocKeys.forEach((key) => {
      const [caseType, loc] = key.split('||')
      if (loc.toLowerCase() !== location.toLowerCase()) return
      const forecastAantal = (forecastByCaseLoc.get(key) || 0) + (pilsByCaseLoc.get(key) || 0)
      const opPils = pilsByCaseLoc.get(key) || 0
      const opStock = stockByCase.get(caseType) || 0
      const inTransfer = transferByCase.get(caseType) || 0
      const inProductie = productieByCase.get(caseType) || 0
      const inInkoop = inkoopByCase.get(caseType) || 0
      const nettoNodig = Math.max(
        0,
        forecastAantal - (netAvailableByCase.get(caseType) || 0)
      )
      statusRows.push({
        'BC CODE': erpByCase.get(caseType)?.erp_code || 'Special',
        case_type: caseType,
        productielocatie: loc,
        forecast_aantal: forecastAantal,
        op_pils: opPils,
        op_stock: opStock,
        in_transfer: inTransfer,
        in_productie: inProductie,
        in_inkooporder: inInkoop,
        netto_nodig: nettoNodig,
      })
    })

    statusRows.sort((a, b) => String(a.case_type).localeCompare(String(b.case_type)))

    statusSheet.mergeCells(1, 1, 1, statusColumns.length)
    statusSheet.getCell(1, 1).value = `Status ${location}`
    statusSheet.getCell(1, 1).font = { bold: true }
    statusSheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }
    statusSheet.addRow(statusColumns)
    statusRows.forEach((row) => {
      statusSheet.addRow(statusColumns.map((col) => row[col] ?? ''))
    })
    statusSheet.getRow(2).font = { bold: true }
    statusSheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }

    statusSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = border
        if (rowNumber === 1) return
      })
    })
    statusSheet.views = [{ state: 'frozen', ySplit: 2 }]

    const prioritySheet = wb.addWorksheet('Prioriteit')
    const priorityColumns = [
      'priority_rank',
      'case_type',
      'kist_categorie',
      'arrival_date',
      'aantal_op_pils',
      'op_stock',
      'in_productie',
      'in_inkooporder',
      'in_transfer',
      'totaal_beschikbaar',
      'tekort',
      'productielocatie',
      'BC CODE',
    ]

    const pilsGrouped = new Map<string, { count: number; arrival: string | null; loc: string }>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = String(row.case_type || '').trim()
      if (!caseType) return
      const loc = erpByCase.get(caseType)?.productielocatie || 'Wilrijk'
      const key = caseType
      const current = pilsGrouped.get(key)
      const arrival = row.arrival_date ? String(row.arrival_date) : null
      if (!current) {
        pilsGrouped.set(key, { count: 1, arrival, loc })
      } else {
        current.count += 1
        if (arrival && (!current.arrival || arrival < current.arrival)) {
          current.arrival = arrival
        }
      }
    })

    const priorityRows: Array<Record<string, string | number>> = []
    pilsGrouped.forEach((data, caseType) => {
      if (String(data.loc).toLowerCase() !== location.toLowerCase()) return
      const opStock = stockByCase.get(caseType) || 0
      const inTransfer = transferByCase.get(caseType) || 0
      const inProductie = productieByCase.get(caseType) || 0
      const inInkoop = inkoopByCase.get(caseType) || 0
      const total = opStock + inProductie + inInkoop + inTransfer
      if (data.count <= total) return
      const kategoriematch = String(caseType).trim().toUpperCase().match(/^([KC])/)
      const kistCategorie = kategoriematch ? kategoriematch[1] : 'Overig'
      priorityRows.push({
        case_type: caseType,
        kist_categorie: kistCategorie,
        arrival_date: data.arrival ? formatDateLabel(data.arrival) : '',
        aantal_op_pils: data.count,
        op_stock: opStock,
        in_productie: inProductie,
        in_inkooporder: inInkoop,
        in_transfer: inTransfer,
        totaal_beschikbaar: total,
        tekort: Math.max(0, data.count - total),
        productielocatie: data.loc,
        'BC CODE': erpByCase.get(caseType)?.erp_code || 'Special',
      })
    })

    priorityRows.sort((a, b) => {
      const da = new Date(String(a.arrival_date || ''))
      const db = new Date(String(b.arrival_date || ''))
      return da.getTime() - db.getTime()
    })
    priorityRows.forEach((row, index) => {
      row.priority_rank = index + 1
    })

    prioritySheet.mergeCells(1, 1, 1, priorityColumns.length)
    prioritySheet.getCell(1, 1).value = `Productie Prioriteit ${location} (oudste PILS eerst)`
    prioritySheet.getCell(1, 1).font = { bold: true }
    prioritySheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }
    prioritySheet.addRow(priorityColumns)
    priorityRows.forEach((row) => {
      prioritySheet.addRow(priorityColumns.map((col) => row[col] ?? ''))
    })
    prioritySheet.getRow(2).font = { bold: true }
    prioritySheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }
    prioritySheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = border
        if (rowNumber === 1) return
      })
    })
    prioritySheet.views = [{ state: 'frozen', ySplit: 2 }]

    const buffer = await wb.xlsx.writeBuffer()
    const fileName = `Forecast_${location}.xlsx`
    return new Response(buffer as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Forecast export error:', error)
    return NextResponse.json(
      { error: error.message || 'Error exporting forecast' },
      { status: 500 }
    )
  }
}
