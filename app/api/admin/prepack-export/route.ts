import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import XlsxPopulate from 'xlsx-populate'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { JSDOM } from 'jsdom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChartOptions = {
  chart: string
  titles: string[]
  fields: string[]
  data: Record<string, number[]>
  file?: string
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

async function generateChartFile(options: ChartOptions, targetFile: string) {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  const previousWindow = (globalThis as any).window
  const previousDocument = (globalThis as any).document
  const previousNavigator = (globalThis as any).navigator

  ;(globalThis as any).window = dom.window
  ;(globalThis as any).document = dom.window.document
  ;(globalThis as any).navigator = dom.window.navigator

  const { default: XlsxChart } = await import('xlsx-chart')
  const chart = new (XlsxChart as any)()
  await new Promise<void>((resolve, reject) => {
    const payload = { ...options, file: targetFile }
    chart.writeFile(payload, (err: Error | null) => {
      if (err) return reject(err)
      resolve()
    })
  })

  ;(globalThis as any).window = previousWindow
  ;(globalThis as any).document = previousDocument
  ;(globalThis as any).navigator = previousNavigator
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

    const tmpFile = path.join(os.tmpdir(), `prepack-export-${Date.now()}.xlsx`)
    let workbook: any

    if (stats.dailyStats.length > 0) {
      const labels = stats.dailyStats.map((stat) => formatDateLabel(stat.date))
      const fields = [
        'Goederen binnen',
        'Items verpakt',
        'Manuren',
        'Items per uur',
        'Omzet (x1000)',
      ]
      const data = {
        'Goederen binnen': stats.dailyStats.map((stat) => stat.incomingItems),
        'Items verpakt': stats.dailyStats.map((stat) => stat.itemsPacked),
        Manuren: stats.dailyStats.map((stat) => stat.manHours),
        'Items per uur': stats.dailyStats.map((stat) => stat.itemsPerHour),
        'Omzet (x1000)': stats.dailyStats.map((stat) => Number((stat.revenue / 1000).toFixed(2))),
      }

      await generateChartFile(
        {
          chart: 'line',
          titles: labels,
          fields,
          data,
        },
        tmpFile
      )

      workbook = await XlsxPopulate.fromFileAsync(tmpFile)
    } else {
      workbook = await XlsxPopulate.fromBlankAsync()
    }

    const dailySheet = workbook.addSheet('Dagelijkse stats')
    const dailyRows = [
      [
        'Datum',
        'Goederen binnen',
        'Items verpakt',
        'Manuren',
        'Medewerkers',
        'Items per uur',
        'Omzet',
      ],
      ...stats.dailyStats.map((stat) => [
        stat.date,
        stat.incomingItems,
        stat.itemsPacked,
        stat.manHours,
        stat.employeeCount,
        stat.itemsPerHour,
        stat.revenue,
      ]),
    ]
    dailySheet.cell('A1').value(dailyRows)

    const detailSheet = workbook.addSheet('Items')
    const detailRows = [
      [
        'Datum verpakt',
        'Itemnummer',
        'PO nummer',
        'Aantal',
        'Prijs',
        'Omzet',
        'Datum toegevoegd',
      ],
      ...stats.detailedItems.map((item) => [
        item.date_packed,
        item.item_number,
        item.po_number,
        item.amount,
        item.price,
        item.revenue,
        item.date_added,
      ]),
    ]
    detailSheet.cell('A1').value(detailRows)

    const buffer = await workbook.outputAsync()
    await fs.unlink(tmpFile).catch(() => undefined)

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
