import { fetchAirtecStats } from '@/lib/airtec/stats'
import { previousPeriodRange, resolveAssistantDateRange } from '@/lib/personal-assistant/date-range'

function pctChange(current: number, baseline: number): number | null {
  if (baseline <= 0) return null
  return Math.round(((current - baseline) / baseline) * 1000) / 10
}

function rateLabel(current: number, baseline: number): 'sterk' | 'normaal' | 'zwak' | 'onvoldoende_data' {
  if (baseline <= 0) return 'onvoldoende_data'
  const ratio = current / baseline
  if (ratio >= 1.1) return 'sterk'
  if (ratio <= 0.9) return 'zwak'
  return 'normaal'
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Airtec benchmarks (totaal stuks; per persoon alleen uren). */
export async function getAirtecPerformanceInsights(input?: {
  period?: string
  date_from?: string
  date_to?: string
  history_days?: number
}) {
  const focusRange = resolveAssistantDateRange({ ...input, defaultDays: 1 })
  const historyDays = Math.min(Math.max(input?.history_days ?? 35, 14), 90)

  const historyFrom = new Date(`${focusRange.date_from}T00:00:00`)
  historyFrom.setDate(historyFrom.getDate() - historyDays)
  const historyRange = {
    date_from: historyFrom.toISOString().split('T')[0],
    date_to: focusRange.date_to,
  }

  const [focusRaw, historyRaw] = await Promise.all([
    fetchAirtecStats({
      dateFrom: focusRange.date_from,
      dateTo: focusRange.date_to,
      includeDetails: false,
    }),
    fetchAirtecStats({
      dateFrom: historyRange.date_from,
      dateTo: historyRange.date_to,
      includeDetails: false,
    }),
  ])

  const historyDaysRows = historyRaw.dailyStats
    .filter(d => d.date < focusRange.date_from && (d.itemsPacked > 0 || d.manHours > 0))
    .map(d => ({
      date: d.date,
      items_packed: Math.round(d.itemsPacked),
      revenue: Math.round(d.revenue * 100) / 100,
      man_hours: Math.round(d.manHours * 10) / 10,
    }))

  const last7 = historyDaysRows.slice(-7)
  const avg7Items = Math.round(average(last7.map(d => d.items_packed)))
  const avg7Revenue = Math.round(average(last7.map(d => d.revenue)) * 100) / 100

  const prevRange = previousPeriodRange(focusRange)
  const prevRaw = await fetchAirtecStats({
    dateFrom: prevRange.date_from,
    dateTo: prevRange.date_to,
    includeDetails: false,
  })

  const focusItems = Math.round(focusRaw.totals.totalItemsPacked)
  const focusRevenue = Math.round(focusRaw.totals.totalRevenue * 100) / 100
  const baselineItems = avg7Items

  return {
    source: 'admin/airtec insights',
    focus_period: focusRange,
    focus_totals: {
      items_packed: focusItems,
      revenue: focusRevenue,
      man_hours: Math.round(focusRaw.totals.totalManHours * 10) / 10,
    },
    benchmarks: {
      rolling_7_day_avg: { items_packed: avg7Items, revenue: avg7Revenue, sample_days: last7.length },
      previous_period: {
        range: prevRange,
        items_packed: Math.round(prevRaw.totals.totalItemsPacked),
        revenue: Math.round(prevRaw.totals.totalRevenue * 100) / 100,
      },
    },
    evaluation: {
      items_packed_vs_baseline: {
        baseline: baselineItems,
        current: focusItems,
        pct_change: pctChange(focusItems, baselineItems),
        rating: rateLabel(focusItems, baselineItems),
      },
      revenue_vs_baseline: {
        baseline: avg7Revenue,
        current: focusRevenue,
        pct_change: pctChange(focusRevenue, avg7Revenue),
        rating: rateLabel(focusRevenue, avg7Revenue),
      },
    },
    recent_daily_trend: historyDaysRows.slice(-10),
    top_people_by_hours: [...focusRaw.personStats]
      .sort((a, b) => b.manHours - a.manHours)
      .slice(0, 8)
      .map(p => ({ name: p.name, man_hours: Math.round(p.manHours * 10) / 10 })),
  }
}
