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

    const daily = Array.from(byDay.values())
      .filter((row) => row.prepackItems + row.airtecItems > 0 || row.prepackManHours + row.airtecManHours > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        label: shortNlDate(row.date),
        itemsTotal: row.prepackItems + row.airtecItems,
        manHoursTotal: row.prepackManHours + row.airtecManHours,
      }))

    const totalItemsPrepack = prepack.totals.totalItemsPacked
    const totalItemsAirtec = airtec.totals.totalItemsPacked
    const totalManPrepack = prepack.totals.totalManHours
    const totalManAirtec = airtec.totals.totalManHours

    // Vorige week berekenen (ma-vr van vorige week)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=zo, 1=ma
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() + mondayOffset)
    const thisFriday = new Date(thisMonday)
    thisFriday.setDate(thisMonday.getDate() + 4)

    const prevMonday = new Date(thisMonday)
    prevMonday.setDate(thisMonday.getDate() - 7)
    const prevFriday = new Date(prevMonday)
    prevFriday.setDate(prevMonday.getDate() + 4)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const [prevPrepack, prevAirtec, thisPrepack, thisAirtec] = await Promise.all([
      fetchPrepackStats({ dateFrom: fmt(prevMonday), dateTo: fmt(prevFriday), includeDetails: false }),
      fetchAirtecStats({ dateFrom: fmt(prevMonday), dateTo: fmt(prevFriday), includeDetails: false }),
      fetchPrepackStats({ dateFrom: fmt(thisMonday), dateTo: fmt(thisFriday), includeDetails: false }),
      fetchAirtecStats({ dateFrom: fmt(thisMonday), dateTo: fmt(thisFriday), includeDetails: false }),
    ])

    const buildWeekTotals = (pp: typeof prepack, at: typeof airtec) => ({
      itemsPacked: pp.totals.totalItemsPacked + at.totals.totalItemsPacked,
      itemsPrepack: pp.totals.totalItemsPacked,
      itemsAirtec: at.totals.totalItemsPacked,
      manHours: pp.totals.totalManHours + at.totals.totalManHours,
      manHoursPrepack: pp.totals.totalManHours,
      manHoursAirtec: at.totals.totalManHours,
    })

    const thisWeekTotals = buildWeekTotals(thisPrepack, thisAirtec)
    const prevWeekTotals = buildWeekTotals(prevPrepack, prevAirtec)

    const buildWeekDaily = (pp: typeof prepack, at: typeof airtec) => {
      const m = new Map<string, { prepackItems: number; airtecItems: number; prepackManHours: number; airtecManHours: number }>()
      for (const r of pp.dailyStats) {
        if (!m.has(r.date)) m.set(r.date, { prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0 })
        const e = m.get(r.date)!
        e.prepackItems += r.itemsPacked
        e.prepackManHours += r.manHours
      }
      for (const r of at.dailyStats) {
        if (!m.has(r.date)) m.set(r.date, { prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0 })
        const e = m.get(r.date)!
        e.airtecItems += r.itemsPacked
        e.airtecManHours += r.manHours
      }
      return Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          label: shortNlDate(date),
          ...v,
          itemsTotal: v.prepackItems + v.airtecItems,
          manHoursTotal: v.prepackManHours + v.airtecManHours,
        }))
    }

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
      thisWeek: {
        dateFrom: fmt(thisMonday),
        dateTo: fmt(thisFriday),
        totals: thisWeekTotals,
        daily: buildWeekDaily(thisPrepack, thisAirtec),
      },
      prevWeek: {
        dateFrom: fmt(prevMonday),
        dateTo: fmt(prevFriday),
        totals: prevWeekTotals,
        daily: buildWeekDaily(prevPrepack, prevAirtec),
      },
    })
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    return response
  } catch (error: unknown) {
    console.error('packing-stats:', error)
    return NextResponse.json({ error: 'Kon inpakstatistieken niet laden' }, { status: 500 })
  }
}
