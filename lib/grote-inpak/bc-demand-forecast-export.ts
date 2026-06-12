import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

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

// BC "Import from Excel" (Config. Package) vereist een werkboek mét XML-map
// (xl/xmlMaps.xml + connections + tableSingleCells). Die kan ExcelJS niet maken,
// dus we gebruiken een door BC zelf geëxporteerd werkboek als binaire template
// en vervangen alleen de data-onderdelen (sheet, sharedStrings, tabel-range).
const BC_TEMPLATE_PATH = path.join(
  process.cwd(),
  'lib',
  'grote-inpak',
  'templates',
  'bc-demand-forecast-template.xlsx'
)

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function createDemandForecastWorkbook(
  location: LocationName,
  entries: DemandForecastEntry[]
): Promise<ArrayBuffer> {
  const locationCode = BC_LOCATION_BY_SITE[location]
  const templateBuffer = fs.readFileSync(BC_TEMPLATE_PATH)
  const zip = await JSZip.loadAsync(templateBuffer)

  // Shared strings: vaste indices 0–8 (zelfde volgorde als BC-export), daarna dynamisch
  const strings: string[] = [
    BC_FORECAST_SHEET_META,
    'Demand Forecast Entry',
    BC_FORECAST_TABLE_ID,
    ...BC_DEMAND_FORECAST_HEADERS,
  ]
  const stringIndex = new Map(strings.map((value, i) => [value, i]))
  const sIdx = (value: string): number => {
    let i = stringIndex.get(value)
    if (i === undefined) {
      i = strings.length
      strings.push(value)
      stringIndex.set(value, i)
    }
    return i
  }

  let sharedStringRefs = 0
  const sCell = (ref: string, value: string, style?: string): string => {
    sharedStringRefs += 1
    return `<c r="${ref}"${style ? ` s="${style}"` : ''} t="s"><v>${sIdx(value)}</v></c>`
  }
  const nCell = (ref: string, value: number): string => `<c r="${ref}"><v>${value}</v></c>`

  const rowsXml: string[] = []
  rowsXml.push(
    `<row r="1" spans="1:6">${sCell('A1', BC_FORECAST_SHEET_META, '1')}${sCell('B1', 'Demand Forecast Entry', '1')}${sCell('C1', BC_FORECAST_TABLE_ID, '1')}</row>`
  )
  rowsXml.push(
    `<row r="3" spans="1:6">${BC_DEMAND_FORECAST_HEADERS.map((h, i) =>
      sCell(`${String.fromCharCode(65 + i)}3`, h, '1')
    ).join('')}</row>`
  )

  entries.forEach((entry, index) => {
    const r = 4 + index
    rowsXml.push(
      `<row r="${r}" spans="1:6">` +
        nCell(`A${r}`, index + 1) +
        sCell(`B${r}`, BC_FORECAST_NAME) +
        sCell(`C${r}`, entry.itemNo) +
        sCell(`D${r}`, formatForecastDateIso(entry.forecastDate)) +
        nCell(`E${r}`, entry.quantity) +
        sCell(`F${r}`, locationCode) +
      `</row>`
    )
  })

  // Tabel moet minstens één datarij omvatten om geldig te blijven
  const lastRow = 3 + Math.max(1, entries.length)
  if (entries.length === 0) rowsXml.push(`<row r="4" spans="1:6"/>`)

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3">` +
    `<dimension ref="A1:F${lastRow}"/>` +
    `<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="14.4"/>` +
    `<cols><col min="1" max="1" width="16.33203125" customWidth="1"/><col min="2" max="2" width="24.44140625" customWidth="1"/><col min="3" max="3" width="14.6640625" customWidth="1"/><col min="4" max="4" width="15.44140625" customWidth="1"/><col min="5" max="5" width="18.77734375" customWidth="1"/><col min="6" max="6" width="16" customWidth="1"/></cols>` +
    `<sheetData>${rowsXml.join('')}</sheetData>` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `<legacyDrawing r:id="rId1"/>` +
    `<tableParts count="1"><tablePart r:id="rId3"/></tableParts>` +
    `</worksheet>`

  const sharedStringsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStringRefs}" uniqueCount="${strings.length}">` +
    strings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join('') +
    `</sst>`

  // Tabel-range bijwerken in de template-tabel (XML-map-bindings blijven intact)
  const tableXmlRaw = await zip.file('xl/tables/table1.xml')!.async('string')
  const tableXml = tableXmlRaw.replace(/ref="A3:F\d+"/g, `ref="A3:F${lastRow}"`)

  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  zip.file('xl/sharedStrings.xml', sharedStringsXml)
  zip.file('xl/tables/table1.xml', tableXml)

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export function formatExportDateLabel(date = new Date()): string {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
}
