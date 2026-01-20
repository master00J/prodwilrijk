import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import AdmZip from 'adm-zip'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'prepack-export-template.xlsx')
const MAX_CHART_POINTS = 366
const WORKSHEET_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const columnName = (index: number) => {
  let name = ''
  let current = index
  while (current > 0) {
    const modulo = (current - 1) % 26
    name = String.fromCharCode(65 + modulo) + name
    current = Math.floor((current - 1) / 26)
  }
  return name
}

const inlineCell = (ref: string, value: string) =>
  `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`

const numberCell = (ref: string, value: number) => `<c r="${ref}"><v>${value}</v></c>`

const buildRow = (rowIndex: number, cells: string[]) =>
  `<row r="${rowIndex}">${cells.join('')}</row>`

const replaceSheetData = (sheetXml: string, rowsXml: string) => {
  const sheetData = `<sheetData>${rowsXml}</sheetData>`
  if (sheetXml.includes('<sheetData')) {
    return sheetXml.replace(/<sheetData[\s\S]*?<\/sheetData>/, sheetData)
  }
  return sheetXml.replace('</worksheet>', `${sheetData}</worksheet>`)
}

const buildWorksheetXml = (rowsXml: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<sheetData>${rowsXml}</sheetData>` +
  `</worksheet>`

const getMaxId = (input: string, pattern: RegExp) => {
  let max = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(input))) {
    const value = Number(match[1])
    if (value > max) max = value
  }
  return max
}

const ensureWorksheetEntry = (
  workbookXml: string,
  relsXml: string,
  contentTypesXml: string,
  sheetName: string,
  sheetPath: string
) => {
  if (workbookXml.includes(`name="${sheetName}"`)) {
    return { workbookXml, relsXml, contentTypesXml }
  }

  const nextSheetId = getMaxId(workbookXml, /sheetId="(\d+)"/g) + 1
  const nextRelId = getMaxId(relsXml, /Id="rId(\d+)"/g) + 1
  const sheetEntry = `<sheet name="${sheetName}" sheetId="${nextSheetId}" r:id="rId${nextRelId}"/>`

  const updatedWorkbook = workbookXml.replace(
    /<sheets>/,
    `<sheets>${sheetEntry}`
  )

  const relEntry = `<Relationship Id="rId${nextRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheetPath}"/>`
  const updatedRels = relsXml.replace(
    /<\/Relationships>/,
    `${relEntry}</Relationships>`
  )

  const overrideEntry = `<Override PartName="/xl/${sheetPath}" ContentType="${WORKSHEET_CONTENT_TYPE}"/>`
  const updatedContentTypes = contentTypesXml.includes(`/xl/${sheetPath}`)
    ? contentTypesXml
    : contentTypesXml.replace(/<\/Types>/, `${overrideEntry}</Types>`)

  return {
    workbookXml: updatedWorkbook,
    relsXml: updatedRels,
    contentTypesXml: updatedContentTypes,
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    const stats = await fetchPrepackStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })

    const zip = new AdmZip(TEMPLATE_PATH)
    const workbookXmlPath = 'xl/workbook.xml'
    const relsXmlPath = 'xl/_rels/workbook.xml.rels'
    const contentTypesPath = '[Content_Types].xml'

    let workbookXml = zip.readAsText(workbookXmlPath)
    let relsXml = zip.readAsText(relsXmlPath)
    let contentTypesXml = zip.readAsText(contentTypesPath)

    const match = workbookXml.match(/<sheet[^>]*name="Table"[^>]*r:id="([^"]+)"[^>]*>/)
    if (!match) {
      throw new Error('Table sheet not found in template')
    }
    const tableRelId = match[1]
    const tableRelMatch = relsXml.match(
      new RegExp(`<Relationship[^>]*Id="${tableRelId}"[^>]*Target="([^"]+)"`)
    )
    if (!tableRelMatch) {
      throw new Error('Table sheet relation not found in template')
    }
    const tableSheetPath = `xl/${tableRelMatch[1]}`
    const tableSheetXml = zip.readAsText(tableSheetPath)

    const labels = stats.dailyStats.map((stat) => formatDateLabel(stat.date))
    const trimmedLabels = labels.slice(0, MAX_CHART_POINTS)
    const paddedLabels = trimmedLabels.concat(
      Array(Math.max(0, MAX_CHART_POINTS - trimmedLabels.length)).fill('')
    )

    const labelCells = paddedLabels.map((label, index) =>
      inlineCell(`${columnName(index + 2)}1`, label)
    )

    const seriesRows = [
      {
        label: 'Goederen binnen',
        values: stats.dailyStats.map((stat) => stat.incomingItems).slice(0, MAX_CHART_POINTS),
      },
      {
        label: 'Items verpakt',
        values: stats.dailyStats.map((stat) => stat.itemsPacked).slice(0, MAX_CHART_POINTS),
      },
      {
        label: 'Manuren',
        values: stats.dailyStats.map((stat) => stat.manHours).slice(0, MAX_CHART_POINTS),
      },
      {
        label: 'Items per uur',
        values: stats.dailyStats.map((stat) => stat.itemsPerHour).slice(0, MAX_CHART_POINTS),
      },
      {
        label: 'Omzet (x1000)',
        values: stats.dailyStats
          .map((stat) => Number((stat.revenue / 1000).toFixed(2)))
          .slice(0, MAX_CHART_POINTS),
      },
    ]

    const tableRowsXml = [
      buildRow(1, labelCells),
      ...seriesRows.map((row, rowIndex) => {
        const padded = row.values.concat(
          Array(Math.max(0, MAX_CHART_POINTS - row.values.length)).fill(0)
        )
        const cells = [
          inlineCell(`A${rowIndex + 2}`, row.label),
          ...padded.map((value, index) =>
            numberCell(`${columnName(index + 2)}${rowIndex + 2}`, value)
          ),
        ]
        return buildRow(rowIndex + 2, cells)
      }),
    ].join('')

    const updatedTableXml = replaceSheetData(tableSheetXml, tableRowsXml)
    zip.updateFile(tableSheetPath, Buffer.from(updatedTableXml, 'utf8'))

    const dailySheetPath = 'worksheets/daily-stats.xml'
    const dailyHeader = [
      'Datum',
      'Goederen binnen',
      'Items verpakt',
      'Manuren',
      'Medewerkers',
      'Items per uur',
      'Omzet',
    ]
    const dailyRowsXml = [
      buildRow(
        1,
        dailyHeader.map((value, index) => inlineCell(`${columnName(index + 1)}1`, value))
      ),
      ...stats.dailyStats.map((stat, index) =>
        buildRow(index + 2, [
          inlineCell(`A${index + 2}`, stat.date),
          numberCell(`B${index + 2}`, stat.incomingItems),
          numberCell(`C${index + 2}`, stat.itemsPacked),
          numberCell(`D${index + 2}`, stat.manHours),
          numberCell(`E${index + 2}`, stat.employeeCount),
          numberCell(`F${index + 2}`, stat.itemsPerHour),
          numberCell(`G${index + 2}`, stat.revenue),
        ])
      ),
    ].join('')
    const dailyXml = buildWorksheetXml(dailyRowsXml)
    zip.updateFile(`xl/${dailySheetPath}`, Buffer.from(dailyXml, 'utf8'))

    const itemsSheetPath = 'worksheets/items.xml'
    const itemHeader = [
      'Datum verpakt',
      'Itemnummer',
      'PO nummer',
      'Aantal',
      'Prijs',
      'Omzet',
      'Datum toegevoegd',
    ]
    const itemsRowsXml = [
      buildRow(
        1,
        itemHeader.map((value, index) => inlineCell(`${columnName(index + 1)}1`, value))
      ),
      ...stats.detailedItems.map((item, index) =>
        buildRow(index + 2, [
          inlineCell(`A${index + 2}`, item.date_packed),
          inlineCell(`B${index + 2}`, item.item_number),
          inlineCell(`C${index + 2}`, item.po_number || ''),
          numberCell(`D${index + 2}`, item.amount),
          numberCell(`E${index + 2}`, item.price),
          numberCell(`F${index + 2}`, item.revenue),
          inlineCell(`G${index + 2}`, item.date_added || ''),
        ])
      ),
    ].join('')
    const itemsXml = buildWorksheetXml(itemsRowsXml)
    zip.updateFile(`xl/${itemsSheetPath}`, Buffer.from(itemsXml, 'utf8'))

    const updated = ensureWorksheetEntry(
      workbookXml,
      relsXml,
      contentTypesXml,
      'Dagelijkse stats',
      dailySheetPath
    )
    workbookXml = updated.workbookXml
    relsXml = updated.relsXml
    contentTypesXml = updated.contentTypesXml

    const updatedItems = ensureWorksheetEntry(
      workbookXml,
      relsXml,
      contentTypesXml,
      'Items',
      itemsSheetPath
    )
    workbookXml = updatedItems.workbookXml
    relsXml = updatedItems.relsXml
    contentTypesXml = updatedItems.contentTypesXml

    zip.updateFile(workbookXmlPath, Buffer.from(workbookXml, 'utf8'))
    zip.updateFile(relsXmlPath, Buffer.from(relsXml, 'utf8'))
    zip.updateFile(contentTypesPath, Buffer.from(contentTypesXml, 'utf8'))

    const buffer = zip.toBuffer()

    const fileName = `prepack-stats-${dateFrom || 'start'}-tot-${dateTo || 'eind'}.xlsx`
    return new Response(buffer as BodyInit, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Prepack export error:', error)
    return NextResponse.json(
      { error: 'Failed to export prepack statistics' },
      { status: 500 }
    )
  }
}
