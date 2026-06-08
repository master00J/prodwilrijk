import ExcelJS from 'exceljs'

export type LocationName = 'Wilrijk' | 'Genk'

export type DemandForecastEntry = {
  itemNo: string
  forecastDate: Date
  quantity: number
  description: string
}

export type ForecastMatrixItem = {
  code: string
  description: string
  quantities: number[]
}

export const BC_DEMAND_FORECAST_HEADERS = [
  'Entry No.',
  'Demand Forecast Name',
  'Item No.',
  'Forecast Date',
  'Forecast Quantity',
  'Location Code',
] as const

export const BC_FORECAST_NAME = 'FORECAST'
export const BC_FORECAST_SHEET_META = 'NG_FORECAST_AC'
export const BC_FORECAST_TABLE_ID = '99000852'

/** Productielocatie uit ERP LINK → BC Location Code (Demand Forecast Entry). */
export const BC_LOCATION_BY_SITE: Record<LocationName, string> = {
  Wilrijk: 'Wilrijk',
  Genk: 'GENK_EIK',
}

export const OUTPUT_LOCATIONS: LocationName[] = ['Wilrijk', 'Genk']

const RED_FILL_RGB = 'FFC7CE'

export function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function normalizeLocation(value: unknown): LocationName | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'wilrijk') return 'Wilrijk'
  if (normalized === 'genk') return 'Genk'
  return null
}

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const raw = String(value).trim()
  if (!raw) return 0
  const normalized = raw.replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseExcelSerialDate(value: number): Date | null {
  if (!Number.isFinite(value) || value <= 0) return null
  const utcDays = Math.floor(value - 25569)
  const utcValue = utcDays * 86400
  const date = new Date(utcValue * 1000)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseDateHeader(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') return parseExcelSerialDate(value)

  const raw = String(value ?? '').trim()
  if (!raw) return null

  let match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (match) {
    const [, month, day, yearValue] = match
    const year = yearValue.length === 2 ? 2000 + Number(yearValue) : Number(yearValue)
    return new Date(year, Number(month) - 1, Number(day))
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  return null
}

export function formatForecastDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCellText(row: ExcelJS.Row, column: number): string {
  const value = row.getCell(column).value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text ?? '')
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '')
  return String(value)
}

function getFillRgb(cell: ExcelJS.Cell): string {
  const fill = cell.fill
  if (!fill || fill.type !== 'pattern') return ''
  const color = fill.fgColor?.argb || fill.bgColor?.argb || ''
  return color.slice(-6).toUpperCase()
}

function isRedForecastCell(cell: ExcelJS.Cell): boolean {
  return getFillRgb(cell) === RED_FILL_RGB
}

function findHeaderColumn(headerRow: ExcelJS.Row, name: string, maxCol = headerRow.cellCount): number {
  const target = normalizeHeader(name)
  for (let col = 1; col <= maxCol; col += 1) {
    if (normalizeHeader(headerRow.getCell(col).value) === target) return col
  }
  return -1
}

function getHeaderColumnCount(headerRow: ExcelJS.Row, worksheet: ExcelJS.Worksheet): number {
  return Math.max(headerRow.cellCount, worksheet.columnCount || 0, headerRow.actualCellCount || 0)
}

export type ParsedForecastMatrix = {
  dateColumns: Array<{ column: number; date: Date }>
  rowsByLocation: Record<LocationName, ForecastMatrixItem[]>
  skippedNonFp: Array<{ code: string; location: string; quantity: number }>
  sourceRows: number
}

export function parseForecastMatrixWorksheet(worksheet: ExcelJS.Worksheet): ParsedForecastMatrix {
  const headerRow = worksheet.getRow(1)
  const maxCol = getHeaderColumnCount(headerRow, worksheet)
  const codeCol = findHeaderColumn(headerRow, 'BC CODE', maxCol)
  const descriptionCol = findHeaderColumn(headerRow, 'kist', maxCol)
  const locationCol = findHeaderColumn(headerRow, 'productielocatie', maxCol)

  if (codeCol < 0 || locationCol < 0) {
    throw new Error('Kolommen BC CODE of productielocatie niet gevonden.')
  }

  // Datumkolommen staan in de matrix-export ná de vaste metadata (niet vóór Totaal forecast).
  const dateColumns: Array<{ column: number; date: Date }> = []
  for (let col = 1; col <= maxCol; col += 1) {
    const date = parseDateHeader(headerRow.getCell(col).value)
    if (date) dateColumns.push({ column: col, date })
  }

  if (dateColumns.length === 0) {
    throw new Error(
      'Geen datumkolommen gevonden in het Forecast-tabblad. Controleer of er forecast-data is voor de gekozen periode.'
    )
  }

  const rowsByLocation: Record<LocationName, ForecastMatrixItem[]> = { Wilrijk: [], Genk: [] }
  const skippedNonFp: ParsedForecastMatrix['skippedNonFp'] = []
  let sourceRows = 0

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const location = normalizeLocation(row.getCell(locationCol).value)
    const code = getCellText(row, codeCol).trim()
    if (!code || !location) continue

    sourceRows += 1
    const quantities = dateColumns.map(({ column }) => {
      const cell = row.getCell(column)
      return isRedForecastCell(cell) ? parseNumber(cell.value) : 0
    })

    const total = quantities.reduce((sum, value) => sum + value, 0)
    if (total <= 0) continue

    if (!code.toUpperCase().startsWith('FP')) {
      skippedNonFp.push({ code, location, quantity: total })
      continue
    }

    rowsByLocation[location].push({
      code,
      description: descriptionCol > 0 ? getCellText(row, descriptionCol).trim() : '',
      quantities,
    })
  }

  return { dateColumns, rowsByLocation, skippedNonFp, sourceRows }
}

/** Zet matrixrijen om naar BC Demand Forecast Entry-regels (1 rij per item + datum). */
export function matrixToDemandForecastEntries(
  rows: ForecastMatrixItem[],
  dates: Date[],
  _location: LocationName
): DemandForecastEntry[] {
  const entries: DemandForecastEntry[] = []

  for (const row of rows) {
    dates.forEach((date, index) => {
      const quantity = row.quantities[index] || 0
      if (quantity <= 0) return
      entries.push({
        itemNo: row.code,
        forecastDate: date,
        quantity,
        description: row.description,
      })
    })
  }

  entries.sort((a, b) => {
    const dateDiff = a.forecastDate.getTime() - b.forecastDate.getTime()
    if (dateDiff !== 0) return dateDiff
    return a.itemNo.localeCompare(b.itemNo)
  })

  return entries
}

export async function createDemandForecastWorkbook(
  location: LocationName,
  entries: DemandForecastEntry[]
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Demand Forecast Entry')
  const locationCode = BC_LOCATION_BY_SITE[location]

  worksheet.addRow([BC_FORECAST_SHEET_META, 'Demand Forecast Entry', BC_FORECAST_TABLE_ID])
  worksheet.addRow([])
  worksheet.addRow([...BC_DEMAND_FORECAST_HEADERS])

  entries.forEach((entry, index) => {
    worksheet.addRow([
      index + 1,
      BC_FORECAST_NAME,
      entry.itemNo,
      formatForecastDateIso(entry.forecastDate),
      entry.quantity,
      locationCode,
    ])
  })

  const headerRowNumber = 3
  worksheet.getRow(headerRowNumber).eachCell((cell) => {
    cell.font = { bold: true }
  })

  worksheet.getColumn(1).width = 12
  worksheet.getColumn(2).width = 24
  worksheet.getColumn(3).width = 14
  worksheet.getColumn(4).width = 14
  worksheet.getColumn(5).width = 18
  worksheet.getColumn(6).width = 16

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

export function formatExportDateLabel(date = new Date()): string {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}
