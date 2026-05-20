import * as XLSX from 'xlsx'

export interface AirtecIncomingExcelRow {
  beschrijving: string | null
  item_number: string | null
  lot_number: string | null
  datum_opgestuurd: string | null
  kistnummer: string | null
  divisie: string | null
  quantity: number
}

function firstValue(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const value = row[alias]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return null
}

function asTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function parseDate(value: unknown): string | null {
  if (!value) return null

  const formatDateAtNoonUtc = (date: Date): string | null => {
    if (Number.isNaN(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    // Store at noon UTC so a date-only Excel value cannot shift to the previous day in timezone conversions.
    return `${year}-${month}-${day}T12:00:00.000Z`
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateAtNoonUtc(value)
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(1900, 0, 1)
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
    return formatDateAtNoonUtc(date)
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return formatDateAtNoonUtc(parsed)
  }

  return null
}

function parseQuantity(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 1

  const normalized = String(value).trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function normalizeKistnummer(value: unknown): string | null {
  const text = asTrimmedString(value)
  if (!text || text === '0') return null
  return text.slice(-3)
}

export function mapAirtecIncomingRow(row: Record<string, unknown>): AirtecIncomingExcelRow | null {
  const beschrijving = asTrimmedString(firstValue(row, ['Beschrijving', 'Description', 'Omschrijving']))
  const itemNumber = asTrimmedString(firstValue(row, ['Item Number', 'Artikelnummer', 'Item', 'Itemnumber', 'Itemnummer']))
  const lotOrCoolerQty = firstValue(row, [
    'Lot Number',
    'Lot Number/Qty (coolers)',
    'Partijnummer',
    'Lot',
    'Lotnumber',
    'Lotnummer',
  ])
  const isCooler = String(beschrijving || '').toLowerCase().includes('cooler')
  const explicitQuantity = firstValue(row, ['Qty', 'Quantity', 'Aantal', 'Amount'])
  const quantitySource = explicitQuantity ?? (isCooler ? lotOrCoolerQty : null)

  if (!itemNumber && !beschrijving) return null

  return {
    beschrijving,
    item_number: itemNumber,
    lot_number: isCooler ? null : asTrimmedString(lotOrCoolerQty),
    datum_opgestuurd: parseDate(firstValue(row, ['Datum Opgestuurd', 'Datum opsturen', 'Datum opsturen?', 'Date Sent', 'Datum'])),
    kistnummer: normalizeKistnummer(firstValue(row, ['Kistnummer', 'Box Number', 'Kist', 'Box'])),
    divisie: isCooler ? null : asTrimmedString(firstValue(row, ['Divisie', 'Division', 'Afdeling'])),
    quantity: parseQuantity(quantitySource),
  }
}

export function parseAirtecIncomingExcel(input: Buffer | ArrayBuffer | Uint8Array): AirtecIncomingExcelRow[] {
  const workbook = XLSX.read(input, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: true })

  return rows
    .map(mapAirtecIncomingRow)
    .filter((row): row is AirtecIncomingExcelRow => row !== null)
}
