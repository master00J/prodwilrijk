import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import {
  createDemandForecastWorkbook,
  formatExportDateLabel,
  matrixToDemandForecastEntries,
  OUTPUT_LOCATIONS,
  parseForecastMatrixWorksheet,
  type LocationName,
} from '@/lib/grote-inpak/bc-demand-forecast-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ConversionSummary = {
  files: Array<{
    location: LocationName
    entries: number
    items: number
    totalQuantity: number
    filename: string
  }>
  skippedNonFp: Array<{ code: string; location: string; quantity: number }>
  sourceRows: number
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
    const buffer = await forecastResponse.arrayBuffer()
    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.getWorksheet('Forecast') || workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: 'Geen Forecast-tabblad gevonden.' }, { status: 400 })
    }

    const { dateColumns, rowsByLocation, skippedNonFp, sourceRows } = parseForecastMatrixWorksheet(worksheet)
    const dates = dateColumns.map((item) => item.date)

    const zip = new JSZip()
    const summary: ConversionSummary = { files: [], skippedNonFp, sourceRows }
    const dateLabel = formatExportDateLabel()

    for (const location of OUTPUT_LOCATIONS) {
      const rows = rowsByLocation[location]
      const entries = matrixToDemandForecastEntries(rows, dates, location)
      const outputFilename = `Demand Forecast ${location} ${dateLabel}.xlsx`
      const output = await createDemandForecastWorkbook(location, entries)
      zip.file(outputFilename, output)

      const uniqueItems = new Set(entries.map((entry) => entry.itemNo))
      summary.files.push({
        location,
        entries: entries.length,
        items: uniqueItems.size,
        totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
        filename: outputFilename,
      })
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="BC Demand Forecast Import ${dateLabel}.zip"`,
        'X-Forecast-Summary': encodeURIComponent(JSON.stringify(summary)),
      },
    })
  } catch (error: any) {
    console.error('BC forecast conversion failed:', error)
    return NextResponse.json({ error: error.message || 'Forecast conversie mislukt.' }, { status: 500 })
  }
}
