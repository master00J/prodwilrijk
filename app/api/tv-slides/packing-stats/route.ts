import { NextRequest, NextResponse } from 'next/server'
import { fetchPrepackStats } from '@/lib/prepack/stats'
import { fetchAirtecStats } from '@/lib/airtec/stats'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_POINT_RATE = 50

function shortNlDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

async function getPointRate(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('tv_slides')
      .select('content')
      .eq('type', 'inpakstatistiek')
      .limit(1)
      .single()
    const rate = data?.content?.pointRate
    return typeof rate === 'number' && rate > 0 ? rate : DEFAULT_POINT_RATE
  } catch {
    return DEFAULT_POINT_RATE
  }
}

function marginToPoints(revenue: number, materialCost: number, pointRate: number): number {
  const margin = revenue - materialCost
  return pointRate > 0 ? Number((margin / pointRate).toFixed(1)) : 0
}

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

    const [prepack, airtec, pointRate] = await Promise.all([
      fetchPrepackStats({ dateFrom, dateTo, includeDetails: false }),
      fetchAirtecStats({ dateFrom, dateTo, includeDetails: false }),
      getPointRate(),
    ])

    interface DayBucket {
      date: string
      prepackItems: number
      airtecItems: number
      prepackManHours: number
      airtecManHours: number
      prepackRevenue: number
      airtecRevenue: number
      prepackMaterialCost: number
      airtecMaterialCost: number
    }

    const byDay = new Map<string, DayBucket>()

    const ensure = (d: string): DayBucket => {
      if (!byDay.has(d)) {
        byDay.set(d, {
          date: d,
          prepackItems: 0, airtecItems: 0,
          prepackManHours: 0, airtecManHours: 0,
          prepackRevenue: 0, airtecRevenue: 0,
          prepackMaterialCost: 0, airtecMaterialCost: 0,
        })
      }
      return byDay.get(d)!
    }

    for (const row of prepack.dailyStats) {
      const e = ensure(row.date)
      e.prepackItems += row.itemsPacked
      e.prepackManHours += row.manHours
      e.prepackRevenue += row.revenue
      e.prepackMaterialCost += row.materialCost
    }
    for (const row of airtec.dailyStats) {
      const e = ensure(row.date)
      e.airtecItems += row.itemsPacked
      e.airtecManHours += row.manHours
      e.airtecRevenue += row.revenue
      e.airtecMaterialCost += row.materialCost
    }

    const daily = Array.from(byDay.values())
      .filter((row) => row.prepackItems + row.airtecItems > 0 || row.prepackManHours + row.airtecManHours > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date: row.date,
        label: shortNlDate(row.date),
        prepackItems: row.prepackItems,
        airtecItems: row.airtecItems,
        prepackManHours: row.prepackManHours,
        airtecManHours: row.airtecManHours,
        itemsTotal: row.prepackItems + row.airtecItems,
        manHoursTotal: row.prepackManHours + row.airtecManHours,
        scorePrepack: marginToPoints(row.prepackRevenue, row.prepackMaterialCost, pointRate),
        scoreAirtec: marginToPoints(row.airtecRevenue, row.airtecMaterialCost, pointRate),
        scoreTotal: marginToPoints(
          row.prepackRevenue + row.airtecRevenue,
          row.prepackMaterialCost + row.airtecMaterialCost,
          pointRate,
        ),
      }))

    const totalItemsPrepack = prepack.totals.totalItemsPacked
    const totalItemsAirtec = airtec.totals.totalItemsPacked
    const totalManPrepack = prepack.totals.totalManHours
    const totalManAirtec = airtec.totals.totalManHours

    const now = new Date()
    const dayOfWeek = now.getDay()
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
      scorePrepack: marginToPoints(pp.totals.totalRevenue, pp.totals.totalMaterialCost, pointRate),
      scoreAirtec: marginToPoints(at.totals.totalRevenue, at.totals.totalMaterialCost, pointRate),
      scoreTotal: marginToPoints(
        pp.totals.totalRevenue + at.totals.totalRevenue,
        pp.totals.totalMaterialCost + at.totals.totalMaterialCost,
        pointRate,
      ),
    })

    const thisWeekTotals = buildWeekTotals(thisPrepack, thisAirtec)
    const prevWeekTotals = buildWeekTotals(prevPrepack, prevAirtec)

    const buildWeekDaily = (pp: typeof prepack, at: typeof airtec) => {
      const m = new Map<string, DayBucket>()
      for (const r of pp.dailyStats) {
        if (!m.has(r.date)) m.set(r.date, { date: r.date, prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0, prepackRevenue: 0, airtecRevenue: 0, prepackMaterialCost: 0, airtecMaterialCost: 0 })
        const e = m.get(r.date)!
        e.prepackItems += r.itemsPacked
        e.prepackManHours += r.manHours
        e.prepackRevenue += r.revenue
        e.prepackMaterialCost += r.materialCost
      }
      for (const r of at.dailyStats) {
        if (!m.has(r.date)) m.set(r.date, { date: r.date, prepackItems: 0, airtecItems: 0, prepackManHours: 0, airtecManHours: 0, prepackRevenue: 0, airtecRevenue: 0, prepackMaterialCost: 0, airtecMaterialCost: 0 })
        const e = m.get(r.date)!
        e.airtecItems += r.itemsPacked
        e.airtecManHours += r.manHours
        e.airtecRevenue += r.revenue
        e.airtecMaterialCost += r.materialCost
      }
      return Array.from(m.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          label: shortNlDate(date),
          prepackItems: v.prepackItems,
          airtecItems: v.airtecItems,
          prepackManHours: v.prepackManHours,
          airtecManHours: v.airtecManHours,
          itemsTotal: v.prepackItems + v.airtecItems,
          manHoursTotal: v.prepackManHours + v.airtecManHours,
          scorePrepack: marginToPoints(v.prepackRevenue, v.prepackMaterialCost, pointRate),
          scoreAirtec: marginToPoints(v.airtecRevenue, v.airtecMaterialCost, pointRate),
          scoreTotal: marginToPoints(v.prepackRevenue + v.airtecRevenue, v.prepackMaterialCost + v.airtecMaterialCost, pointRate),
        }))
    }

    const response = NextResponse.json({
      dateFrom,
      dateTo,
      days,
      pointRate,
      daily,
      totals: {
        itemsPacked: totalItemsPrepack + totalItemsAirtec,
        itemsPrepack: totalItemsPrepack,
        itemsAirtec: totalItemsAirtec,
        manHours: totalManPrepack + totalManAirtec,
        manHoursPrepack: totalManPrepack,
        manHoursAirtec: totalManAirtec,
        scorePrepack: marginToPoints(prepack.totals.totalRevenue, prepack.totals.totalMaterialCost, pointRate),
        scoreAirtec: marginToPoints(airtec.totals.totalRevenue, airtec.totals.totalMaterialCost, pointRate),
        scoreTotal: marginToPoints(
          prepack.totals.totalRevenue + airtec.totals.totalRevenue,
          prepack.totals.totalMaterialCost + airtec.totals.totalMaterialCost,
          pointRate,
        ),
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
