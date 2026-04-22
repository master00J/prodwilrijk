import ExcelJS from 'exceljs'

const thin = { style: 'thin' as const }
const border = { top: thin, left: thin, bottom: thin, right: thin }
const STATUS_COLORS: Record<string, string> = {
  'Productie aanmaken en inleggen': 'FFFF0000',
  'In productie leggen':             'FFFF6600',
  'In productie Wilrijk':            'FFB4D6E8',
  'In productie Genk':               'FFB4D6E8',
  'Gedekt':                          'FFD6E4F0',
  'Laag':                             'FFFFFF00',
  'Ok':                               'FF92D050',
}
const STATUS_FONT_WHITE = new Set(['Productie aanmaken en inleggen'])

function mapStatusForDisplay(status: string, inProductie: number): string {
  if (status === 'Vol') return 'Ok'
  if (status === 'Leeg' || status === 'Productie aanmaken')
    return inProductie > 0 ? 'In productie leggen' : 'Productie aanmaken en inleggen'
  return status || ''
}

const headersC = ['Prioriteit', 'Kisttype', 'Prod.locatie', 'Max voorraad', 'Stock in rek', 'Stock Genk', 'Stock Wilrijk', 'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS', 'Productie nog aanmaken', 'Effectief te produceren', 'Status']
const headersK = ['Prioriteit', 'Kisttype', 'Prod.locatie', 'Stock Genk', 'Stock Wilrijk', 'Stock Willebroek', 'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS', 'Productie nog aanmaken', 'Effectief te produceren', 'Status', 'Info']

// Bereken hoeveel stuks er nog een nieuwe productie-order voor aangemaakt moet worden
// = effectieve behoefte − wat al op een productie-order staat (in productie totaal)
function computeNogAanmaken(row: any, effectief: number): number {
  const inProdTotaal = row.in_productie != null
    ? Number(row.in_productie)
    : (Number(row.in_productie_genk ?? 0) + Number(row.in_productie_wilrijk ?? 0) + Number(row.in_productie_willebroek ?? 0))
  return Math.max(0, Number(effectief ?? 0) - inProdTotaal)
}

function addDailyOrderSheet(
  wb: ExcelJS.Workbook,
  sheetTitle: string,
  titleLabel: string,
  data: any[],
  today: string,
  variant: 'c' | 'k' = 'c'
) {
  const headers = variant === 'k' ? headersK : headersC
  const numCols = headers.length

  const ws = wb.addWorksheet(sheetTitle)
  ws.columns = variant === 'k'
    ? [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 13 }, { width: 14 },
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 22 }, { width: 22 }, { width: 16 }, { width: 28 },
      ]
    : [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 },
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 22 }, { width: 22 }, { width: 16 },
      ]

  const titleRow = ws.addRow([`${titleLabel} — ${today}`])
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

  const rowValuesC = (row: any, i: number) => {
    const status = mapStatusForDisplay(row.status || '', row.in_productie ?? 0)
    const effectief = row.bestel_aantal ?? row.tekort ?? 0
    const nogAanmaken = computeNogAanmaken(row, effectief)
    return [
      row.priority_rank ?? i + 1, row.case_type, row.productielocatie || '—',
      row.max_voorraad, row.stock_in_rek, row.stock_genk ?? 0, row.stock_wilrijk ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, nogAanmaken, effectief, status,
    ]
  }
  const rowValuesK = (row: any, i: number) => {
    const status = mapStatusForDisplay(row.status || '', row.in_productie ?? 0)
    const effectief = row.tekort ?? 0
    const nogAanmaken = computeNogAanmaken(row, effectief)
    return [
      row.priority_rank ?? i + 1, row.case_type, row.productielocatie || '—',
      row.stock_genk ?? 0, row.stock_wilrijk ?? 0, row.stock_willebroek ?? row.stock_in_rek ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, nogAanmaken, effectief, status,
      row.info || '',
    ]
  }

  data.forEach((row: any, i: number) => {
    const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
    const values = variant === 'k' ? rowValuesK(row, i) : rowValuesC(row, i)
    const dRow = ws.addRow(values)
    const colStockGenk = variant === 'k' ? 4 : 6
    const colStockWilrijk = variant === 'k' ? 5 : 7
    const colStockWillebroek = variant === 'k' ? 6 : 0
    const colNogAanmaken = variant === 'k' ? 12 : 13
    const colEffectief = variant === 'k' ? 13 : 14
    const colStatus = variant === 'k' ? 14 : 15

    const colInfo = variant === 'k' ? 15 : 0
    dRow.eachCell((cell, col) => {
      const isTextCol = col === 2 || col === 3 || col === colInfo
      cell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
        border,
        alignment: { horizontal: isTextCol ? 'left' : 'center', vertical: 'middle' },
      }
      if (col === colStockGenk && (row.stock_genk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
      }
      if (col === colStockWilrijk && (row.stock_wilrijk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
      }
      if (variant === 'k' && col === colStockWillebroek && ((row.stock_willebroek ?? row.stock_in_rek ?? 0) > 0)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
      }
      if (col === colStatus) {
        const displayStatus = mapStatusForDisplay(row.status || '', row.in_productie ?? 0)
        const statusColor = STATUS_COLORS[displayStatus]
        if (statusColor) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
          cell.font = { bold: true, color: { argb: STATUS_FONT_WHITE.has(displayStatus) ? 'FFFFFFFF' : 'FF000000' } }
        }
      }
      if (col === colEffectief) {
        const effectief = variant === 'c' ? (row.bestel_aantal ?? row.tekort ?? 0) : (row.tekort ?? 0)
        if (effectief > 0) cell.font = { bold: true, color: { argb: 'FFCC0000' } }
      }
      if (col === colNogAanmaken) {
        const effectiefVal = variant === 'c' ? (row.bestel_aantal ?? row.tekort ?? 0) : (row.tekort ?? 0)
        const nogAanmaken = computeNogAanmaken(row, effectiefVal)
        if (nogAanmaken > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }
          cell.font = { bold: true, color: { argb: 'FFCC0000' } }
        }
      }
      if (col === colInfo && row.info) {
        const infoStr = String(row.info)
        if (infoStr.includes('Niet op Forecast') || infoStr.includes('niet op forecast')) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
          cell.font = { bold: true, color: { argb: 'FF996600' } }
        } else {
          cell.font = { italic: true, color: { argb: 'FF555555' } }
        }
      }
    })
  })
}

function addOverdueSheet(
  wb: ExcelJS.Workbook,
  sheetTitle: string,
  titleLabel: string,
  data: any[],
  today: string
) {
  const headers = [
    'Case Label', 'Kisttype', 'Prod. locatie',
    'PILS aankomst', 'Deadline', 'Dagen te laat',
    'Eerst geplande datum', 'Huidige forecast datum', '# Verschuivingen',
  ]
  const numCols = headers.length

  const ws = wb.addWorksheet(sheetTitle)
  ws.columns = [
    { width: 22 }, { width: 12 }, { width: 14 },
    { width: 16 }, { width: 14 }, { width: 14 },
    { width: 22 }, { width: 22 }, { width: 14 },
  ]

  const titleRow = ws.addRow([`${titleLabel} — ${today}`])
  ws.mergeCells(1, 1, 1, numCols)
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B1414' } }
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  titleRow.height = 28
  ws.addRow([])

  const hRow = ws.addRow(headers)
  hRow.eachCell(cell => {
    cell.style = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border,
    }
  })
  hRow.height = 30

  const fmtDate = (val: string | null | undefined) => {
    if (!val) return '—'
    const d = new Date(val)
    return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('nl-NL')
  }

  data.forEach((row: any, i: number) => {
    const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFFDE8E8'
    const days = row.dagen_te_laat ?? 0
    const verschuivingen = row.aantal_verschuivingen ?? 0

    // Detecteer grote verschuiving: eerste vs huidige forecast datum
    const eersteDate = row.eerste_geplande_datum ? new Date(row.eerste_geplande_datum) : null
    const huidigDate = row.huidige_forecast_datum ? new Date(row.huidige_forecast_datum) : null
    const verschuivingDagen = eersteDate && huidigDate && !isNaN(eersteDate.getTime()) && !isNaN(huidigDate.getTime())
      ? Math.round((huidigDate.getTime() - eersteDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

    const dRow = ws.addRow([
      row.case_label || '—',
      row.case_type || '—',
      row.productielocatie || '—',
      fmtDate(row.arrival_date),
      fmtDate(row.deadline),
      days,
      fmtDate(row.eerste_geplande_datum),
      fmtDate(row.huidige_forecast_datum),
      verschuivingen,
    ])
    dRow.eachCell((cell, col) => {
      cell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
        border,
        alignment: { horizontal: col <= 3 ? 'left' : 'center', vertical: 'middle' },
      }
      // Dagen te laat: kleurschaal
      if (col === 6) {
        const bgColor = days >= 5 ? 'FFFF0000' : days >= 2 ? 'FFFF6600' : 'FFFFFF00'
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.font = { bold: true, color: { argb: days >= 5 ? 'FFFFFFFF' : 'FF000000' } }
      }
      // Huidige forecast datum: oranje/geel als later dan eerst geplande datum
      if (col === 8 && verschuivingDagen !== null && verschuivingDagen > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verschuivingDagen >= 14 ? 'FFFF6600' : 'FFFFFF00' } }
        cell.font = { bold: true, color: { argb: 'FF000000' } }
      }
      // # Verschuivingen: rood als veel
      if (col === 9 && verschuivingen >= 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
        cell.font = { bold: true, color: { argb: 'FF9C0006' } }
      }
    })
  })
}

export function buildDailyOrderWorkbook(
  locatieLabel: string,
  data: any[],
  today: string,
  options?: { kKisten?: any[]; overdueKisten?: any[] }
) {
  const wb = new ExcelJS.Workbook()
  addDailyOrderSheet(
    wb,
    `C kisten daily order ${locatieLabel}`,
    `C kisten daily order ${locatieLabel}`,
    data,
    today
  )
  if (options?.kKisten && options.kKisten.length > 0) {
    addDailyOrderSheet(
      wb,
      `K kisten daily order ${locatieLabel}`,
      `K kisten daily order ${locatieLabel}`,
      options.kKisten,
      today,
      'k'
    )
  }
  if (options?.overdueKisten && options.overdueKisten.length > 0) {
    addOverdueSheet(
      wb,
      `Te laat ${locatieLabel}`,
      `Te laat kisten ${locatieLabel}`,
      options.overdueKisten,
      today
    )
  }
  return wb
}
