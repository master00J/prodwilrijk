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
  quantity: number | null
}

type CaseRow = {
  case_label: string
  case_type: string
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
      .select('erp_code, quantity')

    if (stockError) throw stockError

    const { data: casesData, error: casesError } = await supabaseAdmin
      .from('grote_inpak_cases')
      .select('case_label, case_type')

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

    const availableByCase = new Map<string, number>()
    ;(stockData || []).forEach((row: StockRow) => {
      const erpCode = String(row.erp_code || '').trim()
      if (!erpCode) return
      const caseType = caseByErp.get(erpCode)
      if (!caseType) return
      const qty = Number(row.quantity || 0)
      if (!Number.isFinite(qty)) return
      availableByCase.set(caseType, (availableByCase.get(caseType) || 0) + qty)
    })

    const pilsNeedByCase = new Map<string, number>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = String(row.case_type || '').trim()
      if (!caseType) return
      pilsNeedByCase.set(caseType, (pilsNeedByCase.get(caseType) || 0) + 1)
    })

    const netAvailableByCase = new Map<string, number>()
    availableByCase.forEach((avail, caseType) => {
      const used = pilsNeedByCase.get(caseType) || 0
      netAvailableByCase.set(caseType, Math.max(0, Math.round(avail) - used))
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
    rows.forEach((row) => {
      const total = filteredDateCols.reduce((sum, date) => sum + Number(row[date] || 0), 0)
      row['TOTAAL'] = total
    })

    const finalRows = rows
      .filter((row) => Number(row['TOTAAL'] || 0) > 0)
      .map((row) => {
        const output: Record<string, string | number> = {}
        output['GP CODE'] = row['GP CODE']
        output['kist'] = row['kist']
        filteredDateCols.forEach((date) => {
          output[date] = row[date]
        })
        output['TOTAAL'] = row['TOTAAL']
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
        if (rowNumber > 1 && Number.isFinite(numericValue) && numericValue > 0 && cell.col > 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
        }
      })
    })
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
    ws.columns.forEach((col) => {
      col.width = 14
    })

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
