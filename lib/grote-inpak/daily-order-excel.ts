import ExcelJS from 'exceljs'

export function buildDailyOrderWorkbook(locatieLabel: string, data: any[], today: string) {
  const wb = new ExcelJS.Workbook()
  const thin = { style: 'thin' as const }
  const border = { top: thin, left: thin, bottom: thin, right: thin }
  const STATUS_COLORS: Record<string, string> = {
    'Leeg':               'FFFF0000',
    'Productie aanmaken': 'FFFF6600',
    'Gedekt':             'FFD6E4F0',
    'Laag':               'FFFFFF00',
    'Vol':                'FF92D050',
  }
  const STATUS_FONT_WHITE = new Set(['Leeg'])
  const headers = ['Prioriteit', 'Kisttype', 'Prod.locatie', 'Max voorraad', 'Stock in rek', 'Stock Genk', 'Stock Wilrijk', 'In productie', 'In transfer', 'Op PILS', 'Tekort', 'Effectief te produceren', 'Status']
  const numCols = headers.length

  const ws = wb.addWorksheet(`C kisten daily order ${locatieLabel}`)
  ws.columns = [
    { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 },
    { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 22 }, { width: 16 },
  ]
  const titleRow = ws.addRow([`C kisten daily order ${locatieLabel} — ${today}`])
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
      row.priority_rank ?? i + 1,
      row.case_type,
      row.productielocatie || '—',
      row.max_voorraad,
      row.stock_in_rek,
      row.stock_genk ?? 0,
      row.stock_wilrijk ?? 0,
      row.in_productie ?? 0,
      row.in_transfer ?? 0,
      row.op_pils ?? 0,
      row.tekort,
      row.tekort,
      row.status,
    ])
    dRow.eachCell((cell, col) => {
      cell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } },
        border,
        alignment: { horizontal: col === 2 || col === 3 ? 'left' : 'center', vertical: 'middle' },
      }
      if (col === 6 && (row.stock_genk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
      }
      if (col === 7 && (row.stock_wilrijk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
      }
      if (col === 13) {
        const statusColor = STATUS_COLORS[row.status]
        if (statusColor) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } }
          cell.font = { bold: true, color: { argb: STATUS_FONT_WHITE.has(row.status) ? 'FFFFFFFF' : 'FF000000' } }
        }
      }
      if (col === 12 && row.tekort > 0) {
        cell.font = { bold: true, color: { argb: 'FFCC0000' } }
      }
    })
  })
  return wb
}
