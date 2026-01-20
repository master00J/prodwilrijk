import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import XlsxPopulate from 'xlsx-populate'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates',
  'prepack-export-template.xlsx'
)

const MAX_CHART_POINTS = 366

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    const stats = await fetchPrepackStats({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })

    const workbook = await XlsxPopulate.fromFileAsync(TEMPLATE_PATH)
    const tableSheet = workbook.sheet('Table')

    const labels = stats.dailyStats.map((stat) => formatDateLabel(stat.date))
    const trimmedLabels = labels.slice(0, MAX_CHART_POINTS)
    const paddedLabels = trimmedLabels.concat(
      Array(Math.max(0, MAX_CHART_POINTS - trimmedLabels.length)).fill('')
    )

    tableSheet.cell('B1').value([paddedLabels])

    const rows = [
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

    rows.forEach((row, index) => {
      const rowIndex = index + 2
      const padded = row.values.concat(
        Array(Math.max(0, MAX_CHART_POINTS - row.values.length)).fill(0)
      )
      tableSheet.cell(`A${rowIndex}`).value(row.label)
      tableSheet.cell(`B${rowIndex}`).value([padded])
    })

    const dailySheet = workbook.sheet('Dagelijkse stats') || workbook.addSheet('Dagelijkse stats')
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

    const detailSheet = workbook.sheet('Items') || workbook.addSheet('Items')
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
