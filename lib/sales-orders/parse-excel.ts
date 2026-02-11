import * as XLSX from 'xlsx'

/** Mogelijke kopteksten voor itemnummer (GP-nummer), bijv. "No." of " No." (met spatie). */
const NO_COLUMNS = ['No.', ' No.']
/** Mogelijke kopteksten voor verkoopprijs. */
const PRICE_COLUMNS = ['Unit Price Excl. VAT', 'Special Unit Price per PU']

function parseFlexibleNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/\s/g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeHeader(val: string): string {
  return val.replace(/\u00a0/g, ' ').trim().toLowerCase()
}

function findColumnIndex(headerRow: any[], columnName: string): number {
  const normalized = normalizeHeader(columnName)
  return headerRow.findIndex((cell: any) => {
    const val = cell != null ? String(cell) : ''
    return normalizeHeader(val) === normalized
  })
}

function findColumnIndexByAlternatives(headerRow: any[], alternatives: string[]): number {
  for (const name of alternatives) {
    const idx = findColumnIndex(headerRow, name)
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * Zoekt de headerrij en kolomindices voor itemnummer (No. / No.) en prijs (Unit Price Excl. VAT of Special Unit Price per PU).
 */
function detectColumns(rows: any[][]): {
  noIndex: number
  priceIndex: number
  headerRowIndex: number
  found: boolean
} {
  const maxSearchRows = Math.min(20, rows.length)
  for (let r = 0; r < maxSearchRows; r++) {
    const row = rows[r]
    if (!row || !Array.isArray(row)) continue
    const noIndex = findColumnIndexByAlternatives(row, NO_COLUMNS)
    const priceIndex = findColumnIndexByAlternatives(row, PRICE_COLUMNS)
    if (noIndex >= 0 && priceIndex >= 0) {
      return { noIndex, priceIndex, headerRowIndex: r, found: true }
    }
  }
  return { noIndex: -1, priceIndex: -1, headerRowIndex: 0, found: false }
}

export function detectSalesOrderColumns(rows: any[][]): {
  descriptionIndex: number
  priceIndex: number
  detected: boolean
} {
  const { noIndex, priceIndex, found } = detectColumns(rows)
  return {
    descriptionIndex: noIndex >= 0 ? noIndex : 0,
    priceIndex: priceIndex >= 0 ? priceIndex : 0,
    detected: found,
  }
}

export async function processSalesOrderExcel(file: File): Promise<Array<{ item_number: string; price: number; description: string }>> {
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })

  const workbook = XLSX.read(data, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

  const { noIndex, priceIndex, headerRowIndex, found } = detectColumns(jsonData)

  if (!found) {
    throw new Error(
      `Kolommen voor itemnummer (bijv. "${NO_COLUMNS.join('" of "')}") en prijs (bijv. "${PRICE_COLUMNS.join('" of "')}") niet gevonden. Controleer of de Excel de juiste kopteksten heeft.`
    )
  }

  const validItems: Array<{ item_number: string; price: number; description: string }> = []

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || row.length === 0) continue

    const noValue = row[noIndex]
    const itemNumber = noValue != null ? String(noValue).trim() : ''
    const price = parseFlexibleNumber(row[priceIndex])

    if (!itemNumber || price === null || isNaN(price) || price < 0) continue

    validItems.push({ item_number: itemNumber, price, description: itemNumber })
  }

  return validItems
}
