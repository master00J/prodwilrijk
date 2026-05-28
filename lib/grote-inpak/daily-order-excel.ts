import ExcelJS from 'exceljs'
import type { EndingDateEntry } from './production-orders'
import { normalizeKistnummer } from '@/lib/utils/erp-code-normalizer'

const thin = { style: 'thin' as const }
const border = { top: thin, left: thin, bottom: thin, right: thin }

const DAILY_ORDER_UNITS_NOTE = 'Alles is in stuks en niet in kanbans'

const headersC = [
  'Prioriteit', 'Kisttype', 'Prod.locatie', 'Max voorraad', 'Stock in rek', 'Stock Genk', 'Stock Wilrijk',
  'Bouwpakket', 'BP stock Genk', 'BP stock Wilrijk', 'BP stock WLB', 'BP stock totaal',
  'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS',
  'Productieorder nog aanmaken', 'Effectief te produceren', 'Einddatum productie',
]
const headersK = [
  'Prioriteit', 'Kisttype', 'BC FP', 'Prod.locatie', 'Stock Genk', 'Stock Wilrijk', 'Stock Willebroek',
  'Bouwpakket', 'BP stock Genk', 'BP stock Wilrijk', 'BP stock WLB', 'BP stock totaal',
  'Prod. Genk', 'Prod. Wilrijk', 'Prod. Willebroek', 'In transfer', 'Op PILS',
  'Productieorder nog aanmaken', 'Effectief te produceren', 'Einddatum productie', 'Info',
]

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
  variant: 'c' | 'k' = 'c',
  endingDatesByKist?: Map<string, EndingDateEntry[]>
) {
  const headers = variant === 'k' ? headersK : headersC
  const numCols = headers.length

  const ws = wb.addWorksheet(sheetTitle)
  ws.columns = variant === 'k'
    ? [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 }, { width: 14 },
        { width: 14 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 12 },
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 24 }, { width: 22 }, { width: 24 }, { width: 28 },
      ]
    : [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 13 },
        { width: 14 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 12 },
        { width: 11 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 24 }, { width: 22 }, { width: 24 },
      ]

  const unitsNoteRow = ws.addRow([DAILY_ORDER_UNITS_NOTE])
  ws.mergeCells(1, 1, 1, numCols)
  unitsNoteRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1F3864' } }
  unitsNoteRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  unitsNoteRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  unitsNoteRow.height = 22

  const titleRow = ws.addRow([`${titleLabel} — ${today}`])
  ws.mergeCells(2, 1, 2, numCols)
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

  const lookupEinddatum = (caseType: string | null | undefined): string => {
    if (!endingDatesByKist || !caseType) return ''
    const key = normalizeKistnummer(String(caseType).toUpperCase().trim())
    const list = endingDatesByKist.get(key)
    if (!list || list.length === 0) return ''
    // Formaat per regel: "DD/MM/YYYY (qty)" — qty = openstaand aantal op de PO-lijn(en)
    // voor dat kisttype op die einddatum.
    return list
      .map(({ date, qty }) => {
        const d = new Date(date)
        if (isNaN(d.getTime())) return ''
        const label = d.toLocaleDateString('nl-BE')
        return qty > 0 ? `${label} (${qty})` : label
      })
      .filter(Boolean)
      .join('\n')
  }

  const rowValuesC = (row: any, i: number) => {
    const effectief = row.bestel_aantal ?? row.tekort ?? 0
    const nogAanmaken = computeNogAanmaken(row, effectief)
    const einddatum = lookupEinddatum(row.case_type)
    return [
      row.priority_rank ?? i + 1, row.case_type, row.productielocatie || '—',
      row.max_voorraad, row.stock_in_rek, row.stock_genk ?? 0, row.stock_wilrijk ?? 0,
      row.bouwpakket_code || '—',
      row.bouwpakket_stock_genk ?? 0, row.bouwpakket_stock_wilrijk ?? 0, row.bouwpakket_stock_willebroek ?? 0,
      row.bouwpakket_stock_totaal ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, nogAanmaken, effectief, einddatum,
    ]
  }
  const rowValuesK = (row: any, i: number) => {
    const effectief = row.tekort ?? 0
    const nogAanmaken = computeNogAanmaken(row, effectief)
    const einddatum = lookupEinddatum(row.case_type)
    return [
      row.priority_rank ?? i + 1,
      row.case_type,
      row.bc_fp || '—',
      row.productielocatie || '—',
      row.stock_genk ?? 0, row.stock_wilrijk ?? 0, row.stock_willebroek ?? row.stock_in_rek ?? 0,
      row.bouwpakket_code || '—',
      row.bouwpakket_stock_genk ?? 0, row.bouwpakket_stock_wilrijk ?? 0, row.bouwpakket_stock_willebroek ?? 0,
      row.bouwpakket_stock_totaal ?? 0,
      row.in_productie_genk ?? 0, row.in_productie_wilrijk ?? 0, row.in_productie_willebroek ?? 0,
      row.in_transfer ?? 0, row.op_pils ?? 0, nogAanmaken, effectief, einddatum,
      row.info || '',
    ]
  }

  data.forEach((row: any, i: number) => {
    const fgColor = i % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2'
    const values = variant === 'k' ? rowValuesK(row, i) : rowValuesC(row, i)
    const dRow = ws.addRow(values)
    const colStockGenk = variant === 'k' ? 5 : 6
    const colStockWilrijk = variant === 'k' ? 6 : 7
    const colStockWillebroek = variant === 'k' ? 7 : 0
    const colBpCode = 8
    const colBpGenk = 9
    const colBpWilrijk = 10
    const colBpWlb = 11
    const colBpTotaal = 12
    const colNogAanmaken = 18
    const colEffectief = 19
    const colEinddatum = 20
    const colInfo = variant === 'k' ? 21 : 0
    dRow.eachCell((cell, col) => {
      const isTextCol =
        variant === 'k'
          ? col === 2 || col === 3 || col === 4 || col === colBpCode || col === colInfo
          : col === 2 || col === 3 || col === colBpCode
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
      if (col === colBpGenk && (row.bouwpakket_stock_genk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
        cell.font = { bold: true, color: { argb: 'FF375623' } }
      }
      if (col === colBpWilrijk && (row.bouwpakket_stock_wilrijk ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
        cell.font = { bold: true, color: { argb: 'FF375623' } }
      }
      if (col === colBpWlb && (row.bouwpakket_stock_willebroek ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
        cell.font = { bold: true, color: { argb: 'FF375623' } }
      }
      if (col === colBpTotaal && (row.bouwpakket_stock_totaal ?? 0) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }
        cell.font = { bold: true, color: { argb: 'FF000000' } }
      }
      if (col === colBpCode && row.bouwpakket_code) {
        cell.font = { bold: true, color: { argb: 'FF1F497D' } }
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
      if (col === colEinddatum && endingDatesByKist) {
        const key = row.case_type ? normalizeKistnummer(String(row.case_type).toUpperCase().trim()) : ''
        const list = key ? endingDatesByKist.get(key) : undefined
        if (list && list.length > 0) {
          const now = Date.now()
          const anyOverdue = list.some(({ date }) => {
            const t = new Date(date).getTime()
            return !isNaN(t) && t < now
          })
          // Line-wrap zodat meerdere datums onder elkaar staan.
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          if (anyOverdue) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
            cell.font = { bold: true, color: { argb: 'FFCC0000' } }
          } else {
            cell.font = { bold: true, color: { argb: 'FF1F497D' } }
          }
          // Rij-hoogte opschalen afhankelijk van aantal datums (min 18, +14 per extra lijn).
          const needed = 18 + Math.max(0, list.length - 1) * 14
          if (!dRow.height || dRow.height < needed) dRow.height = needed
        } else {
          cell.font = { color: { argb: 'FF999999' } }
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

  // Kolommen A–D + titel en koprij vast bij horizontaal scrollen
  ws.views = [
    {
      state: 'frozen',
      xSplit: 4,
      ySplit: 4,
      topLeftCell: 'E5',
      activeCell: 'E5',
    },
  ]
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

export type DailyOrderLocationOptions = {
  kKisten?: any[]
  overdueKisten?: any[]
  /**
   * Map van kistnummer (UPPERCASE) → array van `{ date, qty }` van lopende
   * productie-orders in Business Central, gesorteerd oplopend op datum.
   */
  endingDatesByKist?: Map<string, EndingDateEntry[]>
}

/** Voeg C-, K- en Te-laat-tabbladen toe voor één locatie aan een bestaand workbook. */
export function appendDailyOrderLocationSheets(
  wb: ExcelJS.Workbook,
  locatieLabel: string,
  data: any[],
  today: string,
  options?: DailyOrderLocationOptions
) {
  addDailyOrderSheet(
    wb,
    `C kisten daily order ${locatieLabel}`,
    `C kisten daily order ${locatieLabel}`,
    data,
    today,
    'c',
    options?.endingDatesByKist,
  )
  if (options?.kKisten && options.kKisten.length > 0) {
    addDailyOrderSheet(
      wb,
      `K kisten daily order ${locatieLabel}`,
      `K kisten daily order ${locatieLabel}`,
      options.kKisten,
      today,
      'k',
      options?.endingDatesByKist,
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
}

export function buildDailyOrderWorkbook(
  locatieLabel: string,
  data: any[],
  today: string,
  options?: DailyOrderLocationOptions
) {
  const wb = new ExcelJS.Workbook()
  appendDailyOrderLocationSheets(wb, locatieLabel, data, today, options)
  return wb
}

/** Eén Excel met Genk + Wilrijk (alle tabbladen). */
export function buildCombinedDailyOrderWorkbook(
  genk: { data: any[]; options?: DailyOrderLocationOptions },
  wilrijk: { data: any[]; options?: DailyOrderLocationOptions },
  today: string
) {
  const wb = new ExcelJS.Workbook()
  appendDailyOrderLocationSheets(wb, 'Genk', genk.data, today, genk.options)
  appendDailyOrderLocationSheets(wb, 'Wilrijk', wilrijk.data, today, wilrijk.options)
  return wb
}
