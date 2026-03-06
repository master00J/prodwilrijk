import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { normalizeErpCode, normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

type ForecastRow = {
  case_label: string
  case_type: string
  arrival_date: string
  source_file?: string | null
}

type ErpRow = {
  kistnummer: string
  productielocatie: string | null
  erp_code: string | null
}

type StockRow = {
  erp_code: string | null
  kistnummer?: string | null
  item_number?: string | null
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

const normalizeCaseType = normalizeKistnummer

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0
  const raw = String(value).trim()
  if (!raw) return 0
  let cleaned = raw.replace(/\s+/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }
  const num = Number(cleaned)
  return Number.isFinite(num) ? Math.max(0, num) : 0
}

function formatDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const pageSize = 1000
  let from = 0
  let all: T[] = []
  while (true) {
    const { data, error } = await supabaseAdmin.from(table).select(select).range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    all = all.concat(rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const location = String(body.location || 'Wilrijk')
    const isAlle = location.toLowerCase() === 'alle'
    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : null
    const dateTo = body.dateTo ? new Date(body.dateTo) : null

    const forecastData = await fetchAllRows<ForecastRow>(
      'grote_inpak_forecast',
      'case_label, case_type, arrival_date, source_file'
    )
    const erpData = await fetchAllRows<ErpRow>(
      'grote_inpak_erp_link',
      'kistnummer, productielocatie, erp_code'
    )
    const stockData = await fetchAllRows<StockRow>(
      'grote_inpak_stock',
      'erp_code, kistnummer, quantity, location, stock, inkoop, productie, in_transfer, item_number'
    )
    const casesData = await fetchAllRows<CaseRow & { erp_code?: string | null }>(
      'grote_inpak_cases',
      'case_label, case_type, arrival_date, erp_code'
    )
    const transferData = await fetchAllRows<{ kistnummer: string | null; erp_code: string | null; quantity: number }>(
      'grote_inpak_transfer',
      'kistnummer, erp_code, quantity'
    )

    const pilsLabels = new Set(
      (casesData || []).map((row: CaseRow) => String(row.case_label || '').trim()).filter(Boolean)
    )

    const erpByCase = new Map<string, ErpRow>()
    const caseByErp = new Map<string, string>()
    ;(erpData || []).forEach((row: ErpRow) => {
      const caseType = normalizeCaseType(row.kistnummer || '')
      if (!caseType) return
      erpByCase.set(caseType, { ...row, kistnummer: caseType })
      const normalized = normalizeErpCode(String(row.erp_code || ''))
      if (normalized) {
        caseByErp.set(normalized, caseType)
      }
    })
    const erpToCaseType = new Map<string, string>()
    ;(casesData || []).forEach((c: CaseRow & { erp_code?: string | null }) => {
      const caseType = c.case_type ? normalizeCaseType(c.case_type) : null
      if (c.erp_code && caseType) {
        const erpNorm = normalizeErpCode(String(c.erp_code))
        if (erpNorm) erpToCaseType.set(erpNorm, caseType)
      }
    })

    const stockByCase = new Map<string, number>()
    const stockByCaseByLoc = new Map<string, Map<string, number>>() // caseType -> loc -> qty
    const inkoopByCase = new Map<string, number>()
    const productieByCase = new Map<string, number>()
    const productieByCaseByLoc = new Map<string, Map<string, number>>() // caseType -> loc -> qty
    const transferByCase = new Map<string, number>()
    ;(stockData || []).forEach((row: StockRow) => {
      const erpCodeRaw = String(row.erp_code || '').trim()
      const erpCode = normalizeErpCode(erpCodeRaw) || erpCodeRaw
      const kistnummer = normalizeCaseType((row as any).kistnummer || '')
      const itemNo = row.item_number ? String(row.item_number).toUpperCase().trim() : ''
      if (!erpCode && !kistnummer && !itemNo) return
      let caseType = kistnummer || caseByErp.get(erpCode) || (itemNo ? caseByErp.get(normalizeErpCode(itemNo) || itemNo) : null)
      if (!caseType) caseType = erpToCaseType.get(erpCode) || (itemNo ? erpToCaseType.get(normalizeErpCode(itemNo) || itemNo) : null)
      if (!caseType && erpCode && /^[KVC]\d+/.test(erpCode)) caseType = normalizeCaseType(erpCode)
      if (!caseType && itemNo && /^[KVC]\d+/.test(itemNo)) caseType = normalizeCaseType(itemNo)
      caseType = normalizeCaseType(caseType || '')
      if (!caseType) return
      const qty = parseNumber(row.quantity)
      const stock = parseNumber(row.stock ?? row.quantity ?? 0)
      const inkoop = parseNumber(row.inkoop)
      const productie = parseNumber(row.productie)
      const inTransfer = parseNumber(row.in_transfer)
      if (![qty, stock, inkoop, productie, inTransfer].some((val) => Number.isFinite(val))) return
      const loc = String(row.location || '').toLowerCase()
      const locKey = loc.includes('genk') ? 'Genk' : loc.includes('wilrijk') ? 'Wilrijk' : loc.includes('willebroek') || loc.includes('wlb') || loc.includes('pac3pl') ? 'Willebroek' : loc.includes('transfer') ? 'Transfer' : null
      if (loc.includes('transfer')) {
        transferByCase.set(caseType, (transferByCase.get(caseType) || 0) + (Number.isFinite(inTransfer) ? inTransfer : 0))
      } else {
        if (Number.isFinite(stock)) {
          stockByCase.set(caseType, (stockByCase.get(caseType) || 0) + stock)
          if (locKey) {
            if (!stockByCaseByLoc.has(caseType)) stockByCaseByLoc.set(caseType, new Map())
            stockByCaseByLoc.get(caseType)!.set(locKey, (stockByCaseByLoc.get(caseType)!.get(locKey) || 0) + stock)
          }
        }
        if (Number.isFinite(inkoop)) {
          inkoopByCase.set(caseType, (inkoopByCase.get(caseType) || 0) + inkoop)
        }
        if (Number.isFinite(productie) && productie > 0) {
          productieByCase.set(caseType, (productieByCase.get(caseType) || 0) + productie)
          if (locKey) {
            if (!productieByCaseByLoc.has(caseType)) productieByCaseByLoc.set(caseType, new Map())
            productieByCaseByLoc.get(caseType)!.set(locKey, (productieByCaseByLoc.get(caseType)!.get(locKey) || 0) + productie)
          }
        }
      }
    })

    // Transferorders (grote_inpak_transfer) — al geproduceerd, onderweg via ERP LINK
    ;(transferData || []).forEach((row) => {
      let kt = normalizeCaseType(row.kistnummer || '')
      if (!kt && row.erp_code) {
        const erpNorm = normalizeErpCode(String(row.erp_code))
        if (erpNorm) kt = caseByErp.get(erpNorm) || erpToCaseType.get(erpNorm) || ''
        if (kt) kt = normalizeCaseType(kt)
      }
      if (!kt) return
      transferByCase.set(kt, (transferByCase.get(kt) || 0) + parseNumber(row.quantity))
    })

    const pilsNeedByCase = new Map<string, number>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = normalizeCaseType(row.case_type || '')
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
    // Beschikbaar = stock + inkoop + transfer + productie (alle locaties) — productie telt mee als "al in order"
    allCases.forEach((caseType) => {
      const available =
        (stockByCase.get(caseType) || 0) +
        (inkoopByCase.get(caseType) || 0) +
        (transferByCase.get(caseType) || 0) +
        (productieByCase.get(caseType) || 0)
      availableByCase.set(caseType, available)
      const used = pilsNeedByCase.get(caseType) || 0
      netAvailableByCase.set(caseType, Math.max(0, Math.round(available) - used))
    })

    const filtered = (forecastData || [])
      .map((row: ForecastRow) => ({
        case_label: String(row.case_label || '').trim(),
        case_type: normalizeCaseType(row.case_type || ''),
        arrival_date: String(row.arrival_date || '').trim(),
        source_file: String(row.source_file || '').trim(),
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
        const erpRow = erpByCase.get(normalizeCaseType(row.case_type))
        const loc = erpRow?.productielocatie ? String(erpRow.productielocatie) : 'Wilrijk'
        return { ...row, productielocatie: loc }
      })
      .filter((row) => isAlle || String(row.productielocatie || '').toLowerCase() === location.toLowerCase())

    if (filtered.length === 0) {
      const wb = new ExcelJS.Workbook()
      const legendaWs = wb.addWorksheet('Legenda')
      legendaWs.mergeCells(1, 1, 1, 2)
      legendaWs.getCell(1, 1).value = 'Legenda — Betekenis kleuren in Forecast-tabblad'
      legendaWs.getCell(1, 1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      legendaWs.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
      legendaWs.addRow([])
      ;[
        ['Kleur', 'Betekenis'],
        ['Groen', 'Volledig gedekt'],
        ['Geel', 'Gedeeltelijk gedekt'],
        ['Rood', 'Niet gedekt'],
      ].forEach(([label, uitleg], i) => {
        const r = legendaWs.addRow([label, uitleg])
        if (i === 0) { r.font = { bold: true }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } } }
        else if (label === 'Groen') r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }
        else if (label === 'Geel') r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }
        else if (label === 'Rood') r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } }
      })
      legendaWs.columns = [{ width: 14 }, { width: 70 }]
      const ws = wb.addWorksheet('Forecast')
      ws.addRow(['GP CODE', 'kist', 'productielocatie', 'Totaal al in productie order', 'Totaal nog in productie order te leggen', 'productie genk', 'productie wilrijk', 'productie willebroek', 'Totaal forecast', 'op stock', 'stock genk', 'stock wilrijk', 'stock willebroek', 'in transfer', 'in inkooporder'])
      const header = ws.getRow(1)
      header.font = { bold: true }
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }
      ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
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
    }

    const dateSet = new Set<string>()
    const counts = new Map<string, Map<string, number>>()
    filtered.forEach((row) => {
      const dateLabel = formatDateLabel(row.arrival_date)
      dateSet.add(dateLabel)
      const caseType = normalizeCaseType(row.case_type)
      if (!counts.has(caseType)) counts.set(caseType, new Map())
      const map = counts.get(caseType)!
      map.set(dateLabel, (map.get(dateLabel) || 0) + 1)
    })

    const dateCols = Array.from(dateSet).sort((a, b) => {
      const da = new Date(a.split('-').reverse().join('-'))
      const db = new Date(b.split('-').reverse().join('-'))
      return da.getTime() - db.getTime()
    })

    const rows: Array<Record<string, string | number> & { _stockCoverage?: Map<string, number>; _prodCoverage?: Map<string, number> }> = []
    counts.forEach((map, caseType) => {
      const row: Record<string, string | number> & { _stockCoverage?: Map<string, number>; _prodCoverage?: Map<string, number> } = {}
      const normalizedCaseType = normalizeCaseType(caseType)
      row['GP CODE'] = erpByCase.get(normalizedCaseType)?.erp_code || 'Special'
      row['kist'] = normalizedCaseType
      row['productielocatie'] = erpByCase.get(normalizedCaseType)?.productielocatie || 'Wilrijk'
      dateCols.forEach((date) => {
        row[date] = map.get(date) || 0
      })
      rows.push(row)
    })

    // Per-datum coverage: eerst stock/inkoop/transfer, daarna productie, dan rood
    rows.forEach((row) => {
      const kist = String(row['kist'])
      let stockLeft = Math.max(
        0,
        (stockByCase.get(kist) || 0) + (inkoopByCase.get(kist) || 0) + (transferByCase.get(kist) || 0) - (pilsNeedByCase.get(kist) || 0)
      )
      let prodLeft = productieByCase.get(kist) || 0
      const stockCoverage = new Map<string, number>()
      const prodCoverage = new Map<string, number>()
      for (const date of dateCols) {
        const need = Number(row[date] || 0)
        if (need <= 0) continue
        const stockUsed = Math.min(need, stockLeft)
        stockLeft -= stockUsed
        const prodUsed = Math.min(need - stockUsed, prodLeft)
        prodLeft -= prodUsed
        stockCoverage.set(date, stockUsed)
        prodCoverage.set(date, prodUsed)
      }
      row._stockCoverage = stockCoverage
      row._prodCoverage = prodCoverage
    })

    const filteredDateCols = dateCols.filter((date) => rows.some((row) => Number(row[date] || 0) > 0))
    const finalRows = rows
      .filter((row) => {
        const totalForecast = filteredDateCols.reduce((sum, date) => sum + Number(row[date] || 0), 0)
        row['Totaal forecast'] = totalForecast
        const kist = String(row['kist'])
        const stockMap = stockByCaseByLoc.get(kist)
        const prodMap = productieByCaseByLoc.get(kist)
        const opStock = stockByCase.get(kist) || 0
        const inTransfer = transferByCase.get(kist) || 0
        const inInkoop = inkoopByCase.get(kist) || 0
        const alInProd = productieByCase.get(kist) || 0
        const beschikbaar = opStock + inTransfer + inInkoop + alInProd
        row['op stock'] = opStock
        row['stock genk'] = stockMap?.get('Genk') ?? 0
        row['stock wilrijk'] = stockMap?.get('Wilrijk') ?? 0
        row['stock willebroek'] = stockMap?.get('Willebroek') ?? 0
        row['in transfer'] = inTransfer
        row['in inkooporder'] = inInkoop
        row['Totaal al in productie order'] = alInProd
        row['productie genk'] = prodMap?.get('Genk') ?? 0
        row['productie wilrijk'] = prodMap?.get('Wilrijk') ?? 0
        row['productie willebroek'] = prodMap?.get('Willebroek') ?? 0
        row['Totaal nog in productie order te leggen'] = Math.max(0, Math.round(totalForecast - beschikbaar))
        return totalForecast >= 0
      })
      .map((row) => {
        const output: Record<string, string | number> & { _stockCoverage?: Map<string, number>; _prodCoverage?: Map<string, number> } = {}
        output['GP CODE'] = row['GP CODE']
        output['kist'] = row['kist']
        output['productielocatie'] = row['productielocatie'] ?? ''
        output['Totaal al in productie order'] = row['Totaal al in productie order'] ?? 0
        output['Totaal nog in productie order te leggen'] = row['Totaal nog in productie order te leggen'] ?? 0
        filteredDateCols.forEach((date) => {
          output[date] = row[date]
        })
        output['Totaal forecast'] = row['Totaal forecast'] ?? 0
        output['op stock'] = row['op stock'] ?? 0
        output['stock genk'] = row['stock genk'] ?? 0
        output['stock wilrijk'] = row['stock wilrijk'] ?? 0
        output['stock willebroek'] = row['stock willebroek'] ?? 0
        output['in transfer'] = row['in transfer'] ?? 0
        output['in inkooporder'] = row['in inkooporder'] ?? 0
        output['productie genk'] = row['productie genk'] ?? 0
        output['productie wilrijk'] = row['productie wilrijk'] ?? 0
        output['productie willebroek'] = row['productie willebroek'] ?? 0
        output._stockCoverage = row._stockCoverage
        output._prodCoverage = row._prodCoverage
        return output
      })

    const wb = new ExcelJS.Workbook()

    // Legenda als eerste tabblad
    const legendaSheet = wb.addWorksheet('Legenda')
    legendaSheet.mergeCells(1, 1, 1, 2)
    legendaSheet.getCell(1, 1).value = 'Legenda — Betekenis kleuren in Forecast-tabblad'
    legendaSheet.getCell(1, 1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    legendaSheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } }
    legendaSheet.getCell(1, 1).alignment = { horizontal: 'left', vertical: 'middle' }
    legendaSheet.addRow([])
    const legendaData = [
      ['Kleur', 'Betekenis'],
      ['Groen', 'Reeds op stock — vraag is volledig gedekt door stock, transfer of inkooporder'],
      ['Geel', 'Al in productie — vraag is gedekt door een lopende productie order'],
      ['Rood', 'Nog te starten — nog geen productie order aangemaakt'],
    ]
    legendaData.forEach(([label, uitleg], i) => {
      const r = legendaSheet.addRow([label, uitleg])
      if (i === 0) {
        r.font = { bold: true }
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }
      } else if (label === 'Groen') {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }
      } else if (label === 'Geel') {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }
      } else if (label === 'Rood') {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } }
      }
    })
    legendaSheet.columns = [{ width: 14 }, { width: 70 }]
    legendaSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      })
    })

    const ws = wb.addWorksheet('Forecast')

    const forecastColumns = [
      'GP CODE',
      'kist',
      'productielocatie',
      'Totaal al in productie order',
      'Totaal nog in productie order te leggen',
      'productie genk',
      'productie wilrijk',
      'productie willebroek',
      ...filteredDateCols,
      'Totaal forecast',
      'op stock',
      'stock genk',
      'stock wilrijk',
      'stock willebroek',
      'in transfer',
      'in inkooporder',
    ]
    ws.addRow(forecastColumns)
    finalRows.forEach((row) => {
      ws.addRow(forecastColumns.map((col) => row[col] ?? ''))
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
      row.eachCell((cell, colNumber) => {
        cell.border = border
        if (rowNumber <= 1) return
        const dataRow = finalRows[rowNumber - 2]
        const colTitle = forecastColumns[colNumber - 1]
        const numericValue = typeof cell.value === 'number' ? cell.value : Number.NaN
        if (colTitle && filteredDateCols.includes(colTitle) && Number.isFinite(numericValue) && numericValue > 0) {
          const need = Number(dataRow[colTitle] ?? 0)
          const stockCovered = dataRow._stockCoverage?.get(colTitle) ?? 0
          const prodCovered = dataRow._prodCoverage?.get(colTitle) ?? 0
          if (need > 0) {
            if (stockCovered >= need) {
              // Volledig gedekt door stock/inkoop/transfer → groen
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } }
            } else if (stockCovered + prodCovered >= need) {
              // Gedekt door lopende productie order → geel
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9C' } }
            } else {
              // Nog geen productie order → rood
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } }
            }
          }
        }
      })
    })
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: forecastColumns.length } }
    ws.columns.forEach((col) => {
      col.width = 14
    })

    const statusSheet = wb.addWorksheet('Status')
    const statusColumns = [
      'BC CODE',
      'case type',
      'productielocatie',
      'forecast aantal',
      'op pils',
      'stock genk',
      'stock wilrijk',
      'stock willebroek',
      'op stock',
      'in transfer',
      'productie genk',
      'productie wilrijk',
      'productie willebroek',
      'in productie',
      'in inkooporder',
      'nog te produceren',
    ]

    const pilsByCaseLoc = new Map<string, number>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = normalizeCaseType(row.case_type || '')
      if (!caseType) return
      const loc = erpByCase.get(caseType)?.productielocatie || 'Wilrijk'
      const key = `${caseType}||${loc}`
      pilsByCaseLoc.set(key, (pilsByCaseLoc.get(key) || 0) + 1)
    })

    const forecastByCaseLoc = new Map<string, number>()
    filtered.forEach((row) => {
      const key = `${normalizeCaseType(row.case_type)}||${row.productielocatie}`
      forecastByCaseLoc.set(key, (forecastByCaseLoc.get(key) || 0) + 1)
    })

    const statusRows: Array<Record<string, string | number>> = []
    const caseLocKeys = new Set<string>([
      ...Array.from(forecastByCaseLoc.keys()),
      ...Array.from(pilsByCaseLoc.keys()),
    ])
    caseLocKeys.forEach((key) => {
      const [caseType, loc] = key.split('||')
      if (!isAlle && loc.toLowerCase() !== location.toLowerCase()) return
      const normalizedCase = normalizeCaseType(caseType)
      const forecastAantal = (forecastByCaseLoc.get(key) || 0) + (pilsByCaseLoc.get(key) || 0)
      const opPils = pilsByCaseLoc.get(key) || 0
      const stockMap = stockByCaseByLoc.get(normalizedCase)
      const prodMap = productieByCaseByLoc.get(normalizedCase)
      const stockGenk = stockMap?.get('Genk') || 0
      const stockWilrijk = stockMap?.get('Wilrijk') || 0
      const stockWillebroek = stockMap?.get('Willebroek') || 0
      const opStock = stockByCase.get(normalizedCase) || 0
      const inTransfer = transferByCase.get(normalizedCase) || 0
      const inProductie = productieByCase.get(normalizedCase) || 0
      const prodGenk = prodMap?.get('Genk') || 0
      const prodWilrijk = prodMap?.get('Wilrijk') || 0
      const prodWillebroek = prodMap?.get('Willebroek') || 0
      const inInkoop = inkoopByCase.get(normalizedCase) || 0
      const nettoNodig = Math.max(0, opPils - (opStock + inTransfer + inInkoop))
      statusRows.push({
        'BC CODE': erpByCase.get(normalizedCase)?.erp_code || 'Special',
        'case type': normalizedCase,
        productielocatie: loc,
        'forecast aantal': forecastAantal,
        'op pils': opPils,
        'stock genk': stockGenk,
        'stock wilrijk': stockWilrijk,
        'stock willebroek': stockWillebroek,
        'op stock': opStock,
        'in transfer': inTransfer,
        'productie genk': prodGenk,
        'productie wilrijk': prodWilrijk,
        'productie willebroek': prodWillebroek,
        'in productie': inProductie,
        'in inkooporder': inInkoop,
        'nog te produceren': nettoNodig,
      })
    })

    statusRows.sort((a, b) => String(a['case type']).localeCompare(String(b['case type'])))

    statusSheet.mergeCells(1, 1, 1, statusColumns.length)
    statusSheet.getCell(1, 1).value = isAlle ? 'Status Alle locaties' : `Status ${location}`
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
    statusSheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: statusColumns.length } }
    statusSheet.views = [{ state: 'frozen', ySplit: 2 }]

    const prioritySheet = wb.addWorksheet('Prioriteit')
    const priorityColumns = [
      'priority rank',
      'case type',
      'kist categorie',
      'arrival date',
      'aantal op pils',
      'op stock',
      'stock genk',
      'stock wilrijk',
      'stock willebroek',
      'in transfer',
      'productie genk',
      'productie wilrijk',
      'productie willebroek',
      'in productie',
      'in inkooporder',
      'totaal beschikbaar',
      'tekort',
      'productielocatie',
      'BC CODE',
    ]

    const pilsGrouped = new Map<string, { count: number; arrival: string | null; loc: string }>()
    ;(casesData || []).forEach((row: CaseRow) => {
      const caseType = normalizeCaseType(row.case_type || '')
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
      if (!isAlle && String(data.loc).toLowerCase() !== location.toLowerCase()) return
      const normalizedCase = normalizeCaseType(caseType)
      const stockMap = stockByCaseByLoc.get(normalizedCase)
      const prodMap = productieByCaseByLoc.get(normalizedCase)
      const opStock = stockByCase.get(normalizedCase) || 0
      const stockGenk = stockMap?.get('Genk') || 0
      const stockWilrijk = stockMap?.get('Wilrijk') || 0
      const stockWillebroek = stockMap?.get('Willebroek') || 0
      const inTransfer = transferByCase.get(normalizedCase) || 0
      const inProductie = productieByCase.get(normalizedCase) || 0
      const prodGenk = prodMap?.get('Genk') || 0
      const prodWilrijk = prodMap?.get('Wilrijk') || 0
      const prodWillebroek = prodMap?.get('Willebroek') || 0
      const inInkoop = inkoopByCase.get(normalizedCase) || 0
      const total = opStock + inInkoop + inTransfer
      if (data.count <= total) return
      const kategoriematch = String(normalizedCase).trim().toUpperCase().match(/^([KC])/)
      const kistCategorie = kategoriematch ? kategoriematch[1] : 'Overig'
      priorityRows.push({
        'case type': normalizedCase,
        'kist categorie': kistCategorie,
        'arrival date': data.arrival ? formatDateLabel(data.arrival) : '',
        'aantal op pils': data.count,
        'op stock': opStock,
        'stock genk': stockGenk,
        'stock wilrijk': stockWilrijk,
        'stock willebroek': stockWillebroek,
        'in transfer': inTransfer,
        'productie genk': prodGenk,
        'productie wilrijk': prodWilrijk,
        'productie willebroek': prodWillebroek,
        'in productie': inProductie,
        'in inkooporder': inInkoop,
        'totaal beschikbaar': total,
        tekort: Math.max(0, data.count - total),
        productielocatie: data.loc,
        'BC CODE': erpByCase.get(caseType)?.erp_code || 'Special',
      })
    })

    // Sorteer: eerst stock laag → hoog (bijna leeg = urgenter), dan arrival date, dan case type
    priorityRows.sort((a, b) => {
      const stockA = Number(a['op stock'] ?? 0)
      const stockB = Number(b['op stock'] ?? 0)
      if (stockA !== stockB) return stockA - stockB
      const da = new Date(String(a['arrival date'] || ''))
      const db = new Date(String(b['arrival date'] || ''))
      if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime()
      return String(a['case type'] || '').localeCompare(String(b['case type'] || ''))
    })
    priorityRows.forEach((row, index) => {
      row['priority rank'] = index + 1
    })

    prioritySheet.mergeCells(1, 1, 1, priorityColumns.length)
    prioritySheet.getCell(1, 1).value = isAlle ? 'Productie Prioriteit Alle locaties (lage stock eerst)' : `Productie Prioriteit ${location} (lage stock eerst)`
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
    prioritySheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: priorityColumns.length } }
    prioritySheet.views = [{ state: 'frozen', ySplit: 2 }]

    const caseLabelsSheet = wb.addWorksheet('Case labels')
    caseLabelsSheet.addRow(['Case label', 'Case type', 'Arrival date', 'Source file', 'Productielocatie'])
    const caseHeader = caseLabelsSheet.getRow(1)
    caseHeader.font = { bold: true }
    caseHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } }
    const caseRows = filtered
      .map((row) => ({
        case_label: row.case_label,
        case_type: row.case_type,
        arrival_date: row.arrival_date,
        source_file: row.source_file || '',
        productielocatie: row.productielocatie || '',
      }))
      .sort((a, b) => {
        const da = new Date(a.arrival_date)
        const db = new Date(b.arrival_date)
        return da.getTime() - db.getTime()
      })
    caseRows.forEach((row) => {
      caseLabelsSheet.addRow([
        row.case_label,
        row.case_type,
        formatDateLabel(row.arrival_date),
        row.source_file,
        row.productielocatie,
      ])
    })
    caseLabelsSheet.columns.forEach((col) => {
      col.width = 18
    })

    const buffer = await wb.xlsx.writeBuffer()
    const fileName = isAlle ? 'Forecast_Alle_locaties.xlsx' : `Forecast_${location}.xlsx`
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
