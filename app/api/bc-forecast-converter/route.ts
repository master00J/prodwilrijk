import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LocationName = 'Wilrijk' | 'Genk'

type ForecastItem = {
  code: string
  description: string
  quantities: number[]
}

type ConversionSummary = {
  files: Array<{ location: LocationName; rows: number; totalQuantity: number; filename: string }>
  skippedNonFp: Array<{ code: string; location: string; quantity: number }>
  sourceRows: number
}

const OUTPUT_LOCATIONS: LocationName[] = ['Wilrijk', 'Genk']
const RED_FILL_RGB = 'FFC7CE'

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeLocation(value: unknown): LocationName | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'wilrijk') return 'Wilrijk'
  if (normalized === 'genk') return 'Genk'
  return null
}

function parseNumber(value: unknown): number {
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

function parseDateHeader(value: unknown): Date | null {
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

  return null
}

function formatBcDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
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

function findHeaderColumn(headerRow: ExcelJS.Row, name: string): number {
  const target = normalizeHeader(name)
  for (let col = 1; col <= headerRow.cellCount; col += 1) {
    if (normalizeHeader(headerRow.getCell(col).value) === target) return col
  }
  return -1
}

async function createLocationWorkbook(location: LocationName, dates: Date[], rows: ForecastItem[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(`Nog te starten ${location}`)
  const header = ['No.', 'Description', ...dates.map(formatBcDate)]

  worksheet.addRow(header)
  rows.forEach((item) => {
    worksheet.addRow([item.code, item.description, ...item.quantities])
  })

  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: header.length },
  }

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      }
      cell.alignment = { vertical: 'middle' }
      if (rowNumber > 1 && colNumber > 2 && parseNumber(cell.value) > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
      }
    })
  })

  worksheet.getColumn(1).width = 14
  worksheet.getColumn(2).width = 18
  for (let col = 3; col <= header.length; col += 1) {
    worksheet.getColumn(col).width = 10
  }

  return workbook.xlsx.writeBuffer()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const forecastResponse = await fetch(`${request.nextUrl.origin}/api/grote-inpak/forecast-export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        location: 'Alle',
        dateFrom: body.dateFrom || null,
        dateTo: body.dateTo || null,
      }),
    })

    if (!forecastResponse.ok) {
      const error = await forecastResponse.json().catch(() => null)
      throw new Error(error?.error || 'Forecast export ophalen mislukt.')
    }

    const workbook = new ExcelJS.Workbook()
    const buffer = Buffer.from(await forecastResponse.arrayBuffer())
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.getWorksheet('Forecast') || workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Geen Forecast-tabblad gevonden.' }, { status: 400 })
    }

    const headerRow = worksheet.getRow(1)
    const codeCol = findHeaderColumn(headerRow, 'BC CODE')
    const descriptionCol = findHeaderColumn(headerRow, 'kist')
    const locationCol = findHeaderColumn(headerRow, 'productielocatie')
    const totalForecastCol = findHeaderColumn(headerRow, 'Totaal forecast')

    if (codeCol < 0 || locationCol < 0 || totalForecastCol < 0) {
      return NextResponse.json(
        { error: 'Kolommen BC CODE, productielocatie of Totaal forecast niet gevonden.' },
        { status: 400 }
      )
    }

    const dateColumns: Array<{ column: number; date: Date }> = []
    for (let col = 1; col < totalForecastCol; col += 1) {
      const date = parseDateHeader(headerRow.getCell(col).value)
      if (date) dateColumns.push({ column: col, date })
    }

    if (dateColumns.length === 0) {
      return NextResponse.json({ error: 'Geen datumkolommen gevonden in het Forecast-tabblad.' }, { status: 400 })
    }

    const rowsByLocation: Record<LocationName, ForecastItem[]> = { Wilrijk: [], Genk: [] }
    const skippedNonFp: ConversionSummary['skippedNonFp'] = []
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

    const zip = new JSZip()
    const summary: ConversionSummary = { files: [], skippedNonFp, sourceRows }
    const sourceDate = new Date()
    const dateLabel = `${String(sourceDate.getDate()).padStart(2, '0')}-${String(sourceDate.getMonth() + 1).padStart(2, '0')}-${sourceDate.getFullYear()}`

    for (const location of OUTPUT_LOCATIONS) {
      const rows = rowsByLocation[location]
      const outputFilename = `Demand Forecast FP Nog te starten ${location} ${dateLabel}.xlsx`
      const output = await createLocationWorkbook(location, dateColumns.map((item) => item.date), rows)
      zip.file(outputFilename, output)
      summary.files.push({
        location,
        rows: rows.length,
        totalQuantity: rows.reduce(
          (sum, row) => sum + row.quantities.reduce((rowSum, value) => rowSum + value, 0),
          0
        ),
        filename: outputFilename,
      })
    }

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="BC Forecast FP Nog te starten ${dateLabel}.zip"`,
        'X-Forecast-Summary': encodeURIComponent(JSON.stringify(summary)),
      },
    })
  } catch (error: any) {
    console.error('BC forecast conversion failed:', error)
    return NextResponse.json({ error: error.message || 'Forecast conversie mislukt.' }, { status: 500 })
  }
}
