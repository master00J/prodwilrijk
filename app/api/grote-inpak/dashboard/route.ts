// Dashboard-API voor grote inpak: live KPI's per locatie, trends uit de
// dagelijkse snapshots, doorlooptijd uit het case-archief en
// forecast-betrouwbaarheid per kisttype uit de forecast-wijzigingshistoriek.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TREND_DAYS = 60
const DOORLOOPTIJD_DAYS = 90

type LocationKpi = {
  location: string
  total_cases: number
  priority_cases: number
  overdue_cases: number
  overdue_1_3: number
  overdue_4_7: number
  overdue_8_plus: number
  forecast_kritiek: number
  avg_ligtijd_dagen: number | null
}

function normalizeLocation(value: unknown): string {
  const s = String(value || '').toLowerCase()
  if (s.includes('genk')) return 'Genk'
  if (s.includes('wilrijk')) return 'Wilrijk'
  return 'Overig'
}

function daysBetween(fromMs: number, toMs: number): number {
  return (toMs - fromMs) / 86400000
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

async function loadAllRows(
  table: string,
  select: string,
  applyFilters?: (query: any) => any
): Promise<any[]> {
  const pageSize = 1000
  const rows: any[] = []
  let from = 0
  while (true) {
    let query = supabaseAdmin.from(table).select(select).range(from, from + pageSize - 1)
    if (applyFilters) query = applyFilters(query)
    const { data, error } = await query
    if (error) throw error
    const chunk = data || []
    if (chunk.length === 0) break
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    from += chunk.length
  }
  return rows
}

function buildLocationKpis(cases: any[], forecastByLabel: Map<string, string>): LocationKpi[] {
  const now = Date.now()
  const groups = new Map<string, any[]>()
  for (const item of cases) {
    const loc = normalizeLocation(item.productielocatie)
    if (!groups.has(loc)) groups.set(loc, [])
    groups.get(loc)!.push(item)
  }
  groups.set('Totaal', cases)

  return [...groups.entries()].map(([location, rows]) => {
    let priorityCases = 0
    let overdue = 0
    let overdue13 = 0
    let overdue47 = 0
    let overdue8plus = 0
    let forecastKritiek = 0
    let ligtijdSom = 0
    let ligtijdCount = 0

    for (const item of rows) {
      if (item.priority === true) priorityCases += 1

      const teLaat = Number(item.dagen_te_laat || 0)
      if (teLaat > 0) {
        overdue += 1
        if (teLaat <= 3) overdue13 += 1
        else if (teLaat <= 7) overdue47 += 1
        else overdue8plus += 1
      }

      const forecastDate = forecastByLabel.get(String(item.case_label || '').trim())
      if (forecastDate && item.arrival_date) {
        const f = new Date(forecastDate).getTime()
        const a = new Date(String(item.arrival_date)).getTime()
        if (!Number.isNaN(f) && !Number.isNaN(a) && a - f < 0) forecastKritiek += 1
      }

      if (item.arrival_date) {
        const arrival = new Date(String(item.arrival_date)).getTime()
        if (!Number.isNaN(arrival)) {
          ligtijdSom += Math.max(0, daysBetween(arrival, now))
          ligtijdCount += 1
        }
      }
    }

    return {
      location,
      total_cases: rows.length,
      priority_cases: priorityCases,
      overdue_cases: overdue,
      overdue_1_3: overdue13,
      overdue_4_7: overdue47,
      overdue_8_plus: overdue8plus,
      forecast_kritiek: forecastKritiek,
      avg_ligtijd_dagen: ligtijdCount > 0 ? round1(ligtijdSom / ligtijdCount) : null,
    }
  })
}

export async function GET(_request: NextRequest) {
  try {
    const todayMs = Date.now()
    const trendFrom = new Date(todayMs - TREND_DAYS * 86400000).toISOString().split('T')[0]
    const archiveFrom = new Date(todayMs - DOORLOOPTIJD_DAYS * 86400000).toISOString()

    const [cases, kpiHistory, legacyBacklog, archive, openRequests, forecastChanges, currentForecast] =
      await Promise.all([
        loadAllRows(
          'grote_inpak_cases',
          'case_label, case_type, productielocatie, priority, arrival_date, dagen_te_laat, forecast_date'
        ),
        loadAllRows('grote_inpak_kpi_history', '*', (q) =>
          q.gte('snapshot_date', trendFrom).order('snapshot_date', { ascending: true })
        ),
        loadAllRows('grote_inpak_backlog_history', 'snapshot_date, backlog_overdue', (q) =>
          q.gte('snapshot_date', trendFrom).order('snapshot_date', { ascending: true })
        ),
        loadAllRows(
          'grote_inpak_case_archive',
          'case_label, case_type, productielocatie, priority, arrival_date, removed_at, doorlooptijd_dagen',
          (q) => q.gte('removed_at', archiveFrom).order('removed_at', { ascending: false })
        ),
        loadAllRows('grote_inpak_customer_requests', 'id, status, case_label, created_at', (q) =>
          q.in('status', ['open', 'waiting_forecast', 'on_pils'])
        ),
        loadAllRows(
          'grote_inpak_forecast_changes',
          'case_label, case_type, old_arrival_date, new_arrival_date, change_type'
        ),
        loadAllRows('grote_inpak_forecast', 'case_label, case_type, arrival_date'),
      ])

    // --- 1. Live KPI's per locatie ---
    const forecastByLabel = new Map<string, string>()
    for (const item of cases) {
      if (item.forecast_date && item.case_label) {
        forecastByLabel.set(String(item.case_label).trim(), String(item.forecast_date))
      }
    }
    const locations = buildLocationKpis(cases, forecastByLabel)

    // --- Week-over-week delta: vergelijk met snapshot van ~7 dagen geleden ---
    const weekAgo = new Date(todayMs - 7 * 86400000).toISOString().split('T')[0]
    const totaalHistory = kpiHistory
      .filter((row: any) => row.location === 'Totaal' && row.snapshot_date <= weekAgo)
      .sort((a: any, b: any) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)))
    const weekAgoSnapshot = totaalHistory[0] || null
    const currentTotal = locations.find((l) => l.location === 'Totaal') || null
    const weekDelta = weekAgoSnapshot && currentTotal
      ? {
          compared_to: weekAgoSnapshot.snapshot_date,
          total_cases: currentTotal.total_cases - weekAgoSnapshot.total_cases,
          priority_cases: currentTotal.priority_cases - weekAgoSnapshot.priority_cases,
          overdue_cases: currentTotal.overdue_cases - weekAgoSnapshot.overdue_cases,
          avg_ligtijd_dagen:
            currentTotal.avg_ligtijd_dagen != null && weekAgoSnapshot.avg_ligtijd_dagen != null
              ? round1(currentTotal.avg_ligtijd_dagen - Number(weekAgoSnapshot.avg_ligtijd_dagen))
              : null,
        }
      : null

    // --- 2. Trend: KPI-history (nieuw) aangevuld met legacy backlog-history ---
    const trendByDate = new Map<string, { date: string; total: number | null; overdue: number | null; priority: number | null }>()
    for (const row of legacyBacklog) {
      trendByDate.set(String(row.snapshot_date), {
        date: String(row.snapshot_date),
        total: null,
        overdue: Number(row.backlog_overdue || 0),
        priority: null,
      })
    }
    for (const row of kpiHistory) {
      if (row.location !== 'Totaal') continue
      trendByDate.set(String(row.snapshot_date), {
        date: String(row.snapshot_date),
        total: Number(row.total_cases || 0),
        overdue: Number(row.overdue_cases || 0),
        priority: Number(row.priority_cases || 0),
      })
    }
    const trend = [...trendByDate.values()].sort((a, b) => a.date.localeCompare(b.date))

    // --- 3. Doorlooptijd uit archief (laatste 90 dagen) ---
    const leadTimes = archive
      .map((row: any) => ({
        ...row,
        doorlooptijd: row.doorlooptijd_dagen != null ? Number(row.doorlooptijd_dagen) : null,
      }))
      .filter((row: any) => row.doorlooptijd != null && row.doorlooptijd >= 0)

    const leadValues = leadTimes.map((row: any) => row.doorlooptijd as number)

    const perTypeMap = new Map<string, number[]>()
    const perLocationMap = new Map<string, number[]>()
    for (const row of leadTimes) {
      const type = String(row.case_type || 'Onbekend').trim() || 'Onbekend'
      if (!perTypeMap.has(type)) perTypeMap.set(type, [])
      perTypeMap.get(type)!.push(row.doorlooptijd)

      const loc = normalizeLocation(row.productielocatie)
      if (!perLocationMap.has(loc)) perLocationMap.set(loc, [])
      perLocationMap.get(loc)!.push(row.doorlooptijd)
    }

    const doorlooptijd = {
      window_days: DOORLOOPTIJD_DAYS,
      count: leadValues.length,
      avg: leadValues.length > 0 ? round1(leadValues.reduce((s, v) => s + v, 0) / leadValues.length) : null,
      median: median(leadValues) != null ? round1(median(leadValues)!) : null,
      per_location: [...perLocationMap.entries()]
        .map(([location, values]) => ({
          location,
          count: values.length,
          avg: round1(values.reduce((s, v) => s + v, 0) / values.length),
        }))
        .sort((a, b) => b.count - a.count),
      per_case_type: [...perTypeMap.entries()]
        .map(([case_type, values]) => ({
          case_type,
          count: values.length,
          avg: round1(values.reduce((s, v) => s + v, 0) / values.length),
          max: Math.max(...values),
        }))
        .filter((row) => row.count >= 2)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 12),
      outliers: leadTimes
        .sort((a: any, b: any) => b.doorlooptijd - a.doorlooptijd)
        .slice(0, 5)
        .map((row: any) => ({
          case_label: row.case_label,
          case_type: row.case_type,
          productielocatie: row.productielocatie,
          doorlooptijd: row.doorlooptijd,
          removed_at: row.removed_at,
        })),
    }

    // --- 4. Forecast-betrouwbaarheid per kisttype ---
    // Per case: aantal datumwijzigingen + totale verschuiving (eerste vs laatste datum).
    type CaseShift = { case_type: string; changes: number; dates: string[] }
    const shiftByCase = new Map<string, CaseShift>()
    for (const row of forecastChanges) {
      const label = String(row.case_label || '').trim()
      if (!label) continue
      if (!shiftByCase.has(label)) {
        shiftByCase.set(label, { case_type: String(row.case_type || '').trim(), changes: 0, dates: [] })
      }
      const entry = shiftByCase.get(label)!
      if (row.change_type === 'added' && row.new_arrival_date) {
        if (!entry.dates.includes(row.new_arrival_date)) entry.dates.push(row.new_arrival_date)
      } else if (row.change_type === 'date_change') {
        if (row.old_arrival_date && !entry.dates.includes(row.old_arrival_date)) entry.dates.push(row.old_arrival_date)
        if (row.new_arrival_date && !entry.dates.includes(row.new_arrival_date)) {
          entry.dates.push(row.new_arrival_date)
          entry.changes += 1
        }
      }
      if (row.case_type && !entry.case_type) entry.case_type = String(row.case_type).trim()
    }
    for (const row of currentForecast) {
      const label = String(row.case_label || '').trim()
      if (!label) continue
      const entry = shiftByCase.get(label)
      if (entry && row.arrival_date && !entry.dates.includes(row.arrival_date)) {
        entry.dates.push(row.arrival_date)
      }
      if (!entry) {
        shiftByCase.set(label, {
          case_type: String(row.case_type || '').trim(),
          changes: 0,
          dates: row.arrival_date ? [String(row.arrival_date)] : [],
        })
      }
    }

    type TypeAgg = { cases: number; shifted: number; totalChanges: number; totalShiftDays: number; shiftSamples: number }
    const perType = new Map<string, TypeAgg>()
    for (const entry of shiftByCase.values()) {
      const type = entry.case_type || 'Onbekend'
      if (!perType.has(type)) {
        perType.set(type, { cases: 0, shifted: 0, totalChanges: 0, totalShiftDays: 0, shiftSamples: 0 })
      }
      const agg = perType.get(type)!
      agg.cases += 1
      agg.totalChanges += entry.changes
      if (entry.changes > 0) agg.shifted += 1

      const dates = [...entry.dates].sort()
      if (dates.length >= 2) {
        const first = new Date(dates[0]).getTime()
        const last = new Date(dates[dates.length - 1]).getTime()
        if (!Number.isNaN(first) && !Number.isNaN(last)) {
          agg.totalShiftDays += daysBetween(first, last)
          agg.shiftSamples += 1
        }
      }
    }

    const forecastReliability = [...perType.entries()]
      .map(([case_type, agg]) => ({
        case_type,
        cases: agg.cases,
        shifted_cases: agg.shifted,
        shifted_pct: agg.cases > 0 ? Math.round((agg.shifted / agg.cases) * 100) : 0,
        avg_changes: agg.cases > 0 ? round1(agg.totalChanges / agg.cases) : 0,
        avg_shift_days: agg.shiftSamples > 0 ? round1(agg.totalShiftDays / agg.shiftSamples) : 0,
      }))
      .filter((row) => row.cases >= 2)
      .sort((a, b) => b.shifted_pct - a.shifted_pct || b.avg_shift_days - a.avg_shift_days)
      .slice(0, 15)

    // --- Open klantvragen ---
    const requestsByStatus: Record<string, number> = {}
    for (const row of openRequests) {
      const status = String(row.status || 'open')
      requestsByStatus[status] = (requestsByStatus[status] || 0) + 1
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      locations,
      week_delta: weekDelta,
      trend,
      doorlooptijd,
      forecast_reliability: forecastReliability,
      customer_requests: {
        open_total: openRequests.length,
        by_status: requestsByStatus,
      },
    })
  } catch (error: any) {
    console.error('Error building grote-inpak dashboard:', error)
    return NextResponse.json(
      { error: error.message || 'Dashboard laden mislukt' },
      { status: 500 }
    )
  }
}
