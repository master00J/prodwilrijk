import { fetchPrepackStats } from '@/lib/prepack/stats'
import { previousPeriodRange, resolveAssistantDateRange } from '@/lib/personal-assistant/date-range'
import { recallAssistantMemory } from '@/lib/personal-assistant/memory'

type DayRow = {
  date: string
  weekday: number
  items_packed: number
  revenue: number
  man_hours: number
  items_per_fte: number
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

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

function buildDayRows(dailyStats: Array<{ date: string; itemsPacked: number; manHours: number; revenue: number; itemsPerFte: number }>): DayRow[] {
  return dailyStats
    .filter(d => d.date && (d.itemsPacked > 0 || d.manHours > 0))
    .map(d => {
      const dateObj = new Date(`${d.date}T12:00:00`)
      return {
        date: d.date,
        weekday: dateObj.getDay(),
        items_packed: Math.round(d.itemsPacked),
        revenue: Math.round(d.revenue * 100) / 100,
        man_hours: Math.round(d.manHours * 10) / 10,
        items_per_fte: Math.round(d.itemsPerFte * 10) / 10,
      }
    })
}

/** Historische benchmarks en vergelijkingen voor Prepack (geen ML; rolling gemiddelden). */
export async function getPrepackPerformanceInsights(input?: {
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
    date_from: toIsoDate(historyFrom),
    date_to: focusRange.date_to,
  }

  const [focusRaw, historyRaw] = await Promise.all([
    fetchPrepackStats({
      dateFrom: focusRange.date_from,
      dateTo: focusRange.date_to,
      includeDetails: false,
    }),
    fetchPrepackStats({
      dateFrom: historyRange.date_from,
      dateTo: historyRange.date_to,
      includeDetails: false,
    }),
  ])

  const allDays = buildDayRows(historyRaw.dailyStats)
  const focusDays = allDays.filter(d => d.date >= focusRange.date_from && d.date <= focusRange.date_to)
  const historyOnly = allDays.filter(d => d.date < focusRange.date_from)

  const focusItems = focusRaw.totals.totalItemsPacked
  const focusRevenue = Math.round(focusRaw.totals.totalRevenue * 100) / 100
  const focusHours = Math.round(focusRaw.totals.totalManHours * 10) / 10

  const last7 = historyOnly.slice(-7)
  const avg7Items = Math.round(average(last7.map(d => d.items_packed)))
  const avg7Revenue = Math.round(average(last7.map(d => d.revenue)) * 100) / 100

  const todayWeekday = new Date(`${focusRange.date_to}T12:00:00`).getDay()
  const sameWeekdayDays = historyOnly.filter(d => d.weekday === todayWeekday)
  const avgWeekdayItems = Math.round(average(sameWeekdayDays.map(d => d.items_packed)))
  const avgWeekdayRevenue = Math.round(average(sameWeekdayDays.map(d => d.revenue)) * 100) / 100

  const prevRange = previousPeriodRange(focusRange)
  const prevRaw = await fetchPrepackStats({
    dateFrom: prevRange.date_from,
    dateTo: prevRange.date_to,
    includeDetails: false,
  })
  const prevItems = prevRaw.totals.totalItemsPacked
  const prevRevenue = Math.round(prevRaw.totals.totalRevenue * 100) / 100

  const baselineItems =
    focusRange.date_from === focusRange.date_to && avgWeekdayItems > 0
      ? avgWeekdayItems
      : avg7Items
  const baselineRevenue =
    focusRange.date_from === focusRange.date_to && avgWeekdayRevenue > 0
      ? avgWeekdayRevenue
      : avg7Revenue

  const learned_note =
    'Benchmarks worden automatisch berekend uit historische Prepack-data (rolling 7 dagen + gemiddelde per weekdag). Geen vaste targets: vergelijk altijd met deze baselines.'

  let stored_learned: Record<string, unknown> | null = null
  try {
    const memories = await recallAssistantMemory({ subject_type: 'general', limit: 15 })
    const prepackMem = memories.memories.find(
      m => m.subject_key === 'prepack_learned' && m.memory_type === 'baseline'
    )
    const summaryMem = memories.memories.find(
      m => m.subject_key === 'assistant_learned_summary' && m.memory_type === 'baseline'
    )
    if (prepackMem || summaryMem) {
      stored_learned = {
        summary_text: summaryMem?.value || null,
        stored_prepack_updated_at: prepackMem?.updated_at || null,
        has_stored_memory: true,
      }
    }
  } catch {
    stored_learned = null
  }

  return {
    source: 'admin/prepack insights',
    learned_note,
    stored_learned,
    focus_period: focusRange,
    focus_totals: {
      items_packed: focusItems,
      revenue: focusRevenue,
      man_hours: focusHours,
      items_per_fte: Math.round(focusRaw.totals.averageItemsPerFte * 10) / 10,
    },
    focus_daily: focusDays,
    benchmarks: {
      rolling_7_day_avg: {
        items_packed: avg7Items,
        revenue: avg7Revenue,
        sample_days: last7.length,
      },
      same_weekday_avg: {
        weekday: todayWeekday,
        items_packed: avgWeekdayItems,
        revenue: avgWeekdayRevenue,
        sample_days: sameWeekdayDays.length,
      },
      previous_period: {
        range: prevRange,
        items_packed: prevItems,
        revenue: prevRevenue,
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
        baseline: baselineRevenue,
        current: focusRevenue,
        pct_change: pctChange(focusRevenue, baselineRevenue),
        rating: rateLabel(focusRevenue, baselineRevenue),
      },
      items_packed_vs_previous_period: {
        previous: prevItems,
        current: focusItems,
        pct_change: pctChange(focusItems, prevItems),
      },
    },
    recent_daily_trend: allDays.slice(-10),
    top_people_focus: [...focusRaw.personStats]
      .sort((a, b) => b.itemsPacked - a.itemsPacked)
      .slice(0, 8)
      .map(p => ({
        name: p.name,
        items_packed: Math.round(p.itemsPacked),
        man_hours: Math.round(p.manHours * 10) / 10,
      })),
  }
}
