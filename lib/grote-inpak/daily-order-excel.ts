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

const headersC = ['Prioriteit', 'Kisttype', 'Prod.locatie', 'Max voorraad', 'Stock in rek', 'Stock Genk', 'Stock Wilrijk', 'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS', 'Tekort', 'Effectief te produceren', 'Status']
const headersK = ['Prioriteit', 'Kisttype', 'Prod.locatie', 'Stock Genk', 'Stock Wilrijk', 'Stock Willebroek', 'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS', 'Tekort', 'Effectief te produceren', 'Status']

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
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 22 }, { width: 16 },
      ]
    : [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 },
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 22 }, { width: 16 },
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
    return [
      row.priority_rank ?? i + 1, row.case_type, row.productielocatie || '—',
      row.max_voorraad, row.stock_in_rek, row.stock_genk ?? 0, row.stock_wilrijk ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, row.tekort, row.tekort, status,
    ]
  }
  const rowValuesK = (row: any, i: number) => {
    const status = mapStatusForDisplay(row.status || '', row.in_productie ?? 0)
    return [
      row.priority_rank ?? i + 1, row.case_type, row.productielocatie || '—',
      row.stock_genk ?? 0, row.stock_wilrijk ?? 0, row.stock_willebroek ?? row.stock_in_rek ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, row.tekort, row.tekort, status,
    ]
  }

  data.forEach((row: any, i: number) => {
    const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
    const values = variant === 'k' ? rowValuesK(row, i) : rowValuesC(row, i)
    const dRow = ws.addRow(values)
    const colStockGenk = variant === 'k' ? 4 : 6
    const colStockWilrijk = variant === 'k' ? 5 : 7
    const colStockWillebroek = variant === 'k' ? 6 : 0
    const colEffectief = variant === 'k' ? 13 : 14
    const colStatus = variant === 'k' ? 14 : 15

    dRow.eachCell((cell, col) => {
      cell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
        border,
        alignment: { horizontal: col === 2 || col === 3 ? 'left' : 'center', vertical: 'middle' },
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
      if (col === colEffectief && row.tekort > 0) {
        cell.font = { bold: true, color: { argb: 'FFCC0000' } }
      }
    })
  })
}

export function buildDailyOrderWorkbook(
  locatieLabel: string,
  data: any[],
  today: string,
  options?: { kKisten?: any[] }
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
  return wb
}
