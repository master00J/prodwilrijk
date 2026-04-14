import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import { fetchAirtecStats } from '@/lib/airtec/stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function shortNlDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Geen omzet/materiaalkosten — enkel volumes en manuren voor het productie-Tscherm.
 * Standaard: laatste N dagen (inclusief vandaag), default 14.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const daysParam = searchParams.get('days')
    const days = Math.min(Math.max(parseInt(daysParam || '14', 10) || 14, 1), 90)

    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    const dateTo = end.toISOString().split('T')[0]
    const dateFrom = start.toISOString().split('T')[0]

    const [prepack, airtec] = await Promise.all([
      fetchPrepackStats({ dateFrom, dateTo, includeDetails: false }),
      fetchAirtecStats({ dateFrom, dateTo, includeDetails: false }),
    ])

    const byDay = new Map<
      string,
      {
        date: string
        prepackItems: number
        airtecItems: number
        prepackManHours: number
        airtecManHours: number
      }
    >()

    const ensure = (d: string) => {
      if (!byDay.has(d)) {
        byDay.set(d, {
          date: d,
          prepackItems: 0,
          airtecItems: 0,
          prepackManHours: 0,
          airtecManHours: 0,
        })
      }
      return byDay.get(d)!
    }

    for (const row of prepack.dailyStats) {
      const e = ensure(row.date)
      e.prepackItems += row.itemsPacked
      e.prepackManHours += row.manHours
    }
    for (const row of airtec.dailyStats) {
      const e = ensure(row.date)
      e.airtecItems += row.itemsPacked
      e.airtecManHours += row.manHours
    }

    const allDates: string[] = []
    const [fy, fm, fd] = dateFrom.split('-').map(Number)
    const [ty, tm, td] = dateTo.split('-').map(Number)
    const cursor = new Date(Date.UTC(fy, fm - 1, fd))
    const endUtc = new Date(Date.UTC(ty, tm - 1, td))
    while (cursor <= endUtc) {
      allDates.push(cursor.toISOString().split('T')[0])
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const daily = allDates.map((d) => {
      const row = byDay.get(d) ?? {
        date: d,
        prepackItems: 0,
        airtecItems: 0,
        prepackManHours: 0,
        airtecManHours: 0,
      }
      return {
        ...row,
        label: shortNlDate(d),
        itemsTotal: row.prepackItems + row.airtecItems,
        manHoursTotal: row.prepackManHours + row.airtecManHours,
      }
    })

    const totalItemsPrepack = prepack.totals.totalItemsPacked
    const totalItemsAirtec = airtec.totals.totalItemsPacked
    const totalManPrepack = prepack.totals.totalManHours
    const totalManAirtec = airtec.totals.totalManHours

    const response = NextResponse.json({
      dateFrom,
      dateTo,
      days,
      daily,
      totals: {
        itemsPacked: totalItemsPrepack + totalItemsAirtec,
        itemsPrepack: totalItemsPrepack,
        itemsAirtec: totalItemsAirtec,
        manHours: totalManPrepack + totalManAirtec,
        manHoursPrepack: totalManPrepack,
        manHoursAirtec: totalManAirtec,
      },
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: unknown) {
    console.error('packing-stats:', error)
    return NextResponse.json({ error: 'Kon inpakstatistieken niet laden' }, { status: 500 })
  }
}
