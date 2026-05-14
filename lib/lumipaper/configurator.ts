import path from 'path'
import ExcelJS from 'exceljs'

export type LumipaperOrderLine = {
  lineNo: number
  itemCode: string
  description: string
  quantity: number
  deliveryDate: string
  length: number
  width: number
  height: number
  extraDimensions: Array<{
    length: number
    width: number
    divisor: number | null
  }>
}

export type LumipaperGeneratedFile = {
  filename: string
  configuratorCode: string
  lineCount: number
  contentType: string
  base64: string
}

export type LumipaperImportResult = {
  orderNumber: string
  totalLines: number
  unmapped: LumipaperOrderLine[]
  lines: Array<LumipaperOrderLine & { configurator: string | null }>
  generatedFiles: LumipaperGeneratedFile[]
}

const TEMPLATE_DIR = path.join(process.cwd(), 'configuratoren', 'Lumipaper', 'export excels')

const CONFIGURATORS = [
  { code: 'DC31 LUMI NS DK SK', family: 'NS', bodem: 'DKZ', deksel: 'SKZ' },
  { code: 'DC32 LUMI NS DK SL', family: 'NS', bodem: 'DKZ', deksel: 'SLZ' },
  { code: 'DC34 LUMI NS DL SL', family: 'NS', bodem: 'DLZ', deksel: 'SLZ' },
  { code: 'DC35 LUMI FNS DK SK', family: 'FNS', bodem: 'DKZ', deksel: 'SKZ' },
  { code: 'DC36 LUMI FNS DK SL', family: 'FNS', bodem: 'DKZ', deksel: 'SLZ' },
  { code: 'DC54 LUMI GD DLZ SKZ', family: 'GD', bodem: 'DLZ', deksel: 'SKZ' },
  { code: 'DC55 LUMI GD DLZ SLZ', family: 'GD', bodem: 'DLZ', deksel: 'SLZ' },
]

export function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseLumipaperOrderNumber(text: string): string {
  const subjectMatch = text.match(/Bestelbon\s*:\s*(AK\d+)/i)
  if (subjectMatch) return subjectMatch[1]

  const bodyMatch = text.match(/Bestelnummer\s*:\s*(AK\d+)/i)
  if (bodyMatch) return bodyMatch[1]

  return `lumipaper-${new Date().toISOString().slice(0, 10)}`
}

export function parseLumipaperOrderLines(rawText: string): LumipaperOrderLine[] {
  const text = decodeQuotedPrintable(rawText)
  const lines = text.split(/\r?\n/)
  const result: LumipaperOrderLine[] = []

  for (const line of lines) {
    const itemMatch = line.match(
      /^\s*(\d+)\s+([A-Z0-9-]+)\s+(.+?)\s+(\d+)\s+ST\s+([0-9]{1,2}-[a-z]{3}-[0-9]{2})\s*$/i
    )
    if (!itemMatch) continue

    const description = normalizeSpaces(itemMatch[3])
    const dimensionMatches = [...description.matchAll(/(\d{3,4})\s*x\s*(\d{3,4})(?:\/(\d+))?/gi)]
    const firstDimension = dimensionMatches[0]
    if (!firstDimension) continue

    result.push({
      lineNo: Number(itemMatch[1]),
      itemCode: itemMatch[2],
      description,
      quantity: Number(itemMatch[4]),
      deliveryDate: itemMatch[5],
      length: Number(firstDimension[1]),
      width: Number(firstDimension[2]),
      height: 150,
      extraDimensions: dimensionMatches.slice(1).map((match) => ({
        length: Number(match[1]),
        width: Number(match[2]),
        divisor: match[3] ? Number(match[3]) : null,
      })),
    })
  }

  return result
}

export function selectLumipaperConfigurator(orderLine: LumipaperOrderLine): string | null {
  const text = orderLine.description.toUpperCase()
  const family = text.includes('FNS') ? 'FNS' : text.includes('GD') ? 'GD' : 'NS'
  const bodem = text.includes('DLZ') ? 'DLZ' : 'DKZ'
  const deksel = text.includes('SLZ') ? 'SLZ' : 'SKZ'

  return CONFIGURATORS.find((config) =>
    config.family === family &&
    config.bodem === bodem &&
    config.deksel === deksel
  )?.code || null
}

function copyRowValues(sourceRow: ExcelJS.Row, targetRow: ExcelJS.Row) {
  sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const targetCell = targetRow.getCell(colNumber)
    targetCell.value = cell.value
    targetCell.style = JSON.parse(JSON.stringify(cell.style || {}))
    targetCell.numFmt = cell.numFmt
    targetCell.alignment = cell.alignment
    targetCell.border = cell.border
    targetCell.fill = cell.fill
    targetCell.font = cell.font
    targetCell.protection = cell.protection
  })
}

function getColumnByHeader(worksheet: ExcelJS.Worksheet, headerName: string): number {
  const headerRow = worksheet.getRow(1)
  let targetColumn = 0

  headerRow.eachCell((cell, colNumber) => {
    if (String(cell.value || '').trim() === headerName) {
      targetColumn = colNumber
    }
  })

  if (!targetColumn) {
    throw new Error(`Kolom "${headerName}" niet gevonden in ${worksheet.name}`)
  }

  return targetColumn
}

function setByHeader(worksheet: ExcelJS.Worksheet, row: ExcelJS.Row, headerName: string, value: ExcelJS.CellValue) {
  row.getCell(getColumnByHeader(worksheet, headerName)).value = value
}

async function generateConfiguratorFile(
  orderNumber: string,
  configuratorCode: string,
  orderLines: LumipaperOrderLine[]
): Promise<LumipaperGeneratedFile> {
  const templateFile = path.join(TEMPLATE_DIR, `${configuratorCode}.xlsx`)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templateFile)

  const worksheet = workbook.getWorksheet('Lines') || workbook.worksheets[0]
  const templateRow = worksheet.getRow(2)

  orderLines.forEach((orderLine, index) => {
    const rowNumber = 2 + index
    const row = worksheet.getRow(rowNumber)

    if (rowNumber !== 2) {
      copyRowValues(templateRow, row)
    }

    setByHeader(worksheet, row, 'BOM Calc. Template Code', configuratorCode)
    setByHeader(worksheet, row, 'Type', 'Item Configuration')
    setByHeader(worksheet, row, 'Source No.', orderLine.itemCode)
    setByHeader(worksheet, row, 'Length', orderLine.length)
    setByHeader(worksheet, row, 'Width', orderLine.width)
    setByHeader(worksheet, row, 'Height', orderLine.height)
    setByHeader(worksheet, row, 'PG Weight [kg]', 0)
    setByHeader(worksheet, row, 'Unit', orderLine.quantity)

    const headerValues = worksheet.getRow(1).values as ExcelJS.CellValue[]
    const flexoColumn = headerValues.findIndex((value) => String(value || '').trim() === 'DCX LUMI FLEXO')
    if (flexoColumn > 0) {
      row.getCell(flexoColumn).value = orderLine.extraDimensions.length > 0
        ? orderLine.extraDimensions
          .map((dim) => `${dim.length}x${dim.width}${dim.divisor ? `/${dim.divisor}` : ''}`)
          .join(' / ')
        : 0
    }

    row.commit()
  })

  worksheet.spliceRows(2 + orderLines.length, Math.max(0, worksheet.rowCount - (1 + orderLines.length)))

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return {
    filename: `${orderNumber} - ${configuratorCode}.xlsx`,
    configuratorCode,
    lineCount: orderLines.length,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: buffer.toString('base64'),
  }
}

export async function generateLumipaperImport(rawText: string): Promise<LumipaperImportResult> {
  const decoded = decodeQuotedPrintable(rawText)
  const orderNumber = parseLumipaperOrderNumber(decoded)
  const orderLines = parseLumipaperOrderLines(decoded)

  if (orderLines.length === 0) {
    throw new Error('Geen Lumipaper-bestellijnen gevonden in de mail.')
  }

  const grouped = new Map<string, LumipaperOrderLine[]>()
  const unmapped: LumipaperOrderLine[] = []

  for (const orderLine of orderLines) {
    const configuratorCode = selectLumipaperConfigurator(orderLine)
    if (!configuratorCode) {
      unmapped.push(orderLine)
      continue
    }

    const lines = grouped.get(configuratorCode) || []
    lines.push(orderLine)
    grouped.set(configuratorCode, lines)
  }

  const generatedFiles: LumipaperGeneratedFile[] = []
  for (const [configuratorCode, lines] of grouped.entries()) {
    generatedFiles.push(await generateConfiguratorFile(orderNumber, configuratorCode, lines))
  }

  return {
    orderNumber,
    totalLines: orderLines.length,
    unmapped,
    generatedFiles,
    lines: orderLines.map((line) => ({
      ...line,
      configurator: selectLumipaperConfigurator(line),
    })),
  }
}
