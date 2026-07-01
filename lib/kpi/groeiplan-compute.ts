import { supabaseAdmin } from '@/lib/supabase/server'
import { toLocalDateKey } from '@/lib/utils/periodPresets'
import {
  GROEIPLAN_KPIS,
  GROEIPLAN_REPORT_START,
  type GroeiplanKpiDefinition,
  type KpiReadiness,
} from './groeiplan-registry'

export type MonthlyDataQuality = 'ok' | 'missing' | 'incomplete' | 'suspicious'

export interface MonthlyPoint {
  month: string
  value: number | null
  dataQuality: MonthlyDataQuality
  note?: string
}

export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown'

export interface KpiAnalysisResult {
  definition: GroeiplanKpiDefinition
  series: MonthlyPoint[]
  trend: TrendDirection
  trendPct: number | null
  peak: { month: string; value: number } | null
  trough: { month: string; value: number } | null
  interpretation: string
  forecast: string
  dataQualityNotes: string[]
  effectiveReadiness: KpiReadiness
}

export interface GroeiplanKpiReport {
  generatedAt: string
  reportStart: string
  reportEnd: string
  months: string[]
  summary: {
    total: number
    operational: number
    partial: number
    needsData: number
    withQualityIssues: number
  }
  kpis: KpiAnalysisResult[]
}

type MonthMap = Map<string, number>

const fetchAllRows = async <T,>(
  buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> => {
  const pageSize = 1000
  let from = 0
  const allRows: T[] = []
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    allRows.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return allRows
}

async function safeFetch<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn()
  } catch (err) {
    console.warn(`groeiplan-kpi: ${label} skipped`, err)
    return []
  }
}

function listMonths(from: string, toDate = new Date()): string[] {
  const months: string[] = []
  const [fy, fm] = from.split('-').map(Number)
  const cursor = new Date(fy, fm - 1, 1)
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    )
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

function toMonthKey(value: unknown): string | null {
  const key = toLocalDateKey(value)
  return key ? key.slice(0, 7) : null
}

function addToMap(map: MonthMap, month: string | null, amount: number) {
  if (!month) return
  map.set(month, (map.get(month) || 0) + amount)
}

function hoursBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e <= s) return 0
  return (e.getTime() - s.getTime()) / 3_600_000
}

function buildSeries(
  months: string[],
  map: MonthMap,
  opts?: { minDaysForComplete?: number; suspiciousMultiplier?: number }
): MonthlyPoint[] {
  const values = months.map((m) => map.get(m) ?? null)
  const nonNull = values.filter((v): v is number => v != null)
  const avg = nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : 0

  return months.map((month) => {
    const raw = map.get(month)
    if (raw == null || raw === undefined) {
      return { month, value: null, dataQuality: 'missing' as const, note: 'Geen data' }
    }
    let dataQuality: MonthlyDataQuality = 'ok'
    let note: string | undefined
    if (raw === 0 && month < months[months.length - 1]) {
      dataQuality = 'incomplete'
      note = 'Waarde nul — mogelijk geen registratie'
    }
    if (avg > 0 && raw > avg * (opts?.suspiciousMultiplier ?? 3)) {
      dataQuality = 'suspicious'
      note = 'Ongebruikelijk hoge waarde t.o.v. gemiddelde'
    }
    return { month, value: Number(raw.toFixed(2)), dataQuality, note }
  })
}

function ratioSeries(
  months: string[],
  numerator: MonthMap,
  denominator: MonthMap
): MonthlyPoint[] {
  const map: MonthMap = new Map()
  for (const month of months) {
    const num = numerator.get(month)
    const den = denominator.get(month)
    if (num == null && den == null) continue
    if (!den || den === 0) {
      map.set(month, 0)
    } else {
      map.set(month, num! / den)
    }
  }
  return buildSeries(months, map)
}

function pctSeries(months: string[], numMap: MonthMap, denMap: MonthMap): MonthlyPoint[] {
  const map: MonthMap = new Map()
  for (const month of months) {
    const num = numMap.get(month) || 0
    const den = denMap.get(month) || 0
    if (den === 0) continue
    map.set(month, (num / den) * 100)
  }
  return buildSeries(months, map)
}

function analyzeTrend(series: MonthlyPoint[]): {
  trend: TrendDirection
  trendPct: number | null
  peak: { month: string; value: number } | null
  trough: { month: string; value: number } | null
} {
  const points = series.filter(
    (p): p is MonthlyPoint & { value: number } =>
      p.value != null && p.dataQuality !== 'missing'
  )
  if (points.length < 2) {
    return { trend: 'unknown', trendPct: null, peak: null, trough: null }
  }

  let peak = points[0]
  let trough = points[0]
  for (const p of points) {
    if (p.value > peak.value) peak = p
    if (p.value < trough.value) trough = p
  }

  const recent = points.slice(-2)
  const prev = recent[0].value
  const last = recent[1].value
  if (prev === 0) {
    return {
      trend: last > 0 ? 'up' : 'stable',
      trendPct: null,
      peak: { month: peak.month, value: peak.value },
      trough: { month: trough.month, value: trough.value },
    }
  }
  const pct = ((last - prev) / Math.abs(prev)) * 100
  let trend: TrendDirection = 'stable'
  if (pct > 5) trend = 'up'
  else if (pct < -5) trend = 'down'

  return {
    trend,
    trendPct: Number(pct.toFixed(1)),
    peak: { month: peak.month, value: peak.value },
    trough: { month: trough.month, value: trough.value },
  }
}

function buildInterpretation(
  def: GroeiplanKpiDefinition,
  series: MonthlyPoint[],
  trend: TrendDirection,
  trendPct: number | null,
  peak: { month: string; value: number } | null,
  trough: { month: string; value: number } | null
): string {
  if (def.readiness === 'needs_data') {
    return 'Deze KPI is in het groeiplan opgenomen maar kan vandaag niet betrouwbaar worden gemeten. Zie data-gaps voor vereiste acties.'
  }

  const valid = series.filter((p) => p.value != null)
  if (valid.length === 0) {
    return `Geen meetbare data sinds ${GROEIPLAN_REPORT_START}. Controleer of de onderliggende flow actief is en data registreert.`
  }

  const parts: string[] = []
  if (trend === 'up' && trendPct != null) {
    parts.push(`Laatste maand ${trendPct > 0 ? '+' : ''}${trendPct}% t.o.v. vorige maand (stijging).`)
  } else if (trend === 'down' && trendPct != null) {
    parts.push(`Laatste maand ${trendPct}% t.o.v. vorige maand (daling).`)
  } else if (trend === 'stable') {
    parts.push('Recent stabiel t.o.v. vorige maand (±5%).')
  }

  if (peak) parts.push(`Piek in ${peak.month} (${peak.value} ${def.unit}).`)
  if (trough && trough.month !== peak?.month) {
    parts.push(`Laagste punt in ${trough.month} (${trough.value} ${def.unit}).`)
  }

  const missing = series.filter((p) => p.dataQuality === 'missing').length
  if (missing > 0) parts.push(`${missing} maand(en) zonder data.`)

  const suspicious = series.filter((p) => p.dataQuality === 'suspicious').length
  if (suspicious > 0) parts.push(`${suspicious} maand(en) met ongebruikelijke waarden — manuele controle aanbevolen.`)

  return parts.join(' ') || 'Evolutie beschikbaar; interpreteer in combinatie met operationele context.'
}

function buildForecast(series: MonthlyPoint[], trend: TrendDirection): string {
  const points = series.filter((p): p is MonthlyPoint & { value: number } => p.value != null)
  if (points.length < 3) {
    return 'Onvoldoende historiek voor betrouwbare trendprojectie (minimaal 3 maanden met data).'
  }
  const last3 = points.slice(-3).map((p) => p.value)
  const avg = last3.reduce((a, b) => a + b, 0) / last3.length
  if (trend === 'up') {
    return `Op basis van de laatste 3 maanden (gem. ${avg.toFixed(1)}) is een licht stijgende lijn plausible, mits capaciteit en instroom stabiel blijven.`
  }
  if (trend === 'down') {
    return `Op basis van de laatste 3 maanden (gem. ${avg.toFixed(1)}) kan de dalende lijn aanhouden — onderzoek oorzaken (capaciteit, instroom, seizoen).`
  }
  return `Op basis van de laatste 3 maanden (gem. ${avg.toFixed(1)}) verwachten we stabilisatie, tenzij proces- of volumewijzigingen ingrijpen.`
}

function collectQualityNotes(series: MonthlyPoint[], def: GroeiplanKpiDefinition): string[] {
  const notes: string[] = [...def.gaps]
  const missing = series.filter((p) => p.dataQuality === 'missing')
  if (missing.length > 0) {
    notes.push(`Ontbrekende maanden: ${missing.map((p) => p.month).join(', ')}`)
  }
  const suspicious = series.filter((p) => p.dataQuality === 'suspicious')
  if (suspicious.length > 0) {
    notes.push(`Verdachte waarden: ${suspicious.map((p) => `${p.month} (${p.note})`).join('; ')}`)
  }
  const incomplete = series.filter((p) => p.dataQuality === 'incomplete')
  if (incomplete.length > 0) {
    notes.push(`${incomplete.length} maand(en) met nul-waarde — mogelijk onvolledige registratie`)
  }
  return [...new Set(notes)]
}

function effectiveReadiness(
  def: GroeiplanKpiDefinition,
  series: MonthlyPoint[],
  notes: string[]
): KpiReadiness {
  if (def.readiness === 'needs_data') return 'needs_data'
  const hasData = series.some((p) => p.value != null)
  if (!hasData) return def.readiness === 'operational' ? 'partial' : 'needs_data'
  const missingRatio = series.filter((p) => p.dataQuality === 'missing').length / series.length
  if (missingRatio > 0.5) return 'partial'
  if (notes.length > def.gaps.length) return 'partial'
  return def.readiness
}

async function loadRawData(since: string) {
  const sinceTs = `${since}-01 00:00:00`

  const [
    packedItems,
    packedAirtec,
    itemsToPack,
    timeLogsPrepack,
    timeLogsAirtec,
    timeLogsProduction,
    kpiHistory,
    caseArchive,
    consumption,
    productControles,
    scanLog,
    woodConsumption,
    woodCorrections,
    forecastChanges,
    employeeStatus,
    packedIncoming,
  ] = await Promise.all([
    safeFetch('packed_items', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('packed_items')
          .select('amount, date_packed')
          .gte('date_packed', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('packed_items_airtec', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('packed_items_airtec')
          .select('quantity, date_packed')
          .gte('date_packed', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('items_to_pack', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('items_to_pack')
          .select('amount, date_added')
          .gte('date_added', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('time_logs prepack', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('time_logs')
          .select('start_time, end_time')
          .eq('type', 'items_to_pack')
          .gte('start_time', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('time_logs airtec', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('time_logs')
          .select('start_time, end_time')
          .eq('type', 'items_to_pack_airtec')
          .gte('start_time', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('time_logs production', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('time_logs')
          .select('start_time, end_time, production_quantity')
          .eq('type', 'production_order')
          .gte('start_time', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('kpi_history', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('grote_inpak_kpi_history')
          .select('snapshot_date, overdue_cases')
          .gte('snapshot_date', `${since}-01`)
          .range(from, to)
      )
    ),
    safeFetch('case_archive', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('grote_inpak_case_archive')
          .select('removed_at, doorlooptijd_dagen')
          .gte('removed_at', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('consumption', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('grote_inpak_packed_consumption')
          .select('scan_date, quantity')
          .gte('scan_date', `${since}-01`)
          .range(from, to)
      )
    ),
    safeFetch('product_controles', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('product_controles')
          .select('controle_datum, status')
          .gte('controle_datum', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('airtec_scan_log', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('airtec_scan_log')
          .select('scanned_at, result')
          .gte('scanned_at', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('wood_consumption', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('wood_consumption')
          .select('datum_verbruik, aantal')
          .gte('datum_verbruik', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('wood_stock_corrections', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('wood_stock_corrections')
          .select('created_at')
          .gte('created_at', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('forecast_changes', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('grote_inpak_forecast_changes')
          .select('changed_at')
          .gte('changed_at', sinceTs)
          .range(from, to)
      )
    ),
    safeFetch('employee_daily_status', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('employee_daily_status')
          .select('date, status')
          .gte('date', `${since}-01`)
          .range(from, to)
      )
    ),
    safeFetch('packed_items incoming', () =>
      fetchAllRows<any>(async (from, to) =>
        supabaseAdmin
          .from('packed_items')
          .select('amount, date_added')
          .gte('date_added', sinceTs)
          .range(from, to)
      )
    ),
  ])

  return {
    packedItems,
    packedAirtec,
    itemsToPack,
    packedIncoming,
    timeLogsPrepack,
    timeLogsAirtec,
    timeLogsProduction,
    kpiHistory,
    caseArchive,
    consumption,
    productControles,
    scanLog,
    woodConsumption,
    woodCorrections,
    forecastChanges,
    employeeStatus,
  }
}

function aggregateRawData(raw: Awaited<ReturnType<typeof loadRawData>>, months: string[]) {
  const prepackItems: MonthMap = new Map()
  const airtecItems: MonthMap = new Map()
  const prepackHours: MonthMap = new Map()
  const airtecHours: MonthMap = new Map()
  const prepackIncoming: MonthMap = new Map()
  const productionHours: MonthMap = new Map()
  const productionPieces: MonthMap = new Map()
  const giConsumption: MonthMap = new Map()
  const giOverdueSum: MonthMap = new Map()
  const giOverdueCount: MonthMap = new Map()
  const giLeadSum: MonthMap = new Map()
  const giLeadCount: MonthMap = new Map()
  const qualityReject: MonthMap = new Map()
  const qualityTotal: MonthMap = new Map()
  const scanMatch: MonthMap = new Map()
  const scanTotal: MonthMap = new Map()
  const woodUse: MonthMap = new Map()
  const woodCorr: MonthMap = new Map()
  const forecastCh: MonthMap = new Map()
  const empPresent: MonthMap = new Map()
  const empTotal: MonthMap = new Map()

  for (const row of raw.packedItems) {
    addToMap(prepackItems, toMonthKey(row.date_packed), Number(row.amount) || 0)
  }
  for (const row of raw.packedAirtec) {
    addToMap(airtecItems, toMonthKey(row.date_packed), Number(row.quantity) || 0)
  }
  for (const row of raw.itemsToPack) {
    addToMap(prepackIncoming, toMonthKey(row.date_added), Number(row.amount) || 0)
  }
  for (const row of raw.packedIncoming) {
    addToMap(prepackIncoming, toMonthKey(row.date_added), Number(row.amount) || 0)
  }
  for (const row of raw.timeLogsPrepack) {
    if (!row.end_time) continue
    addToMap(prepackHours, toMonthKey(row.start_time), hoursBetween(row.start_time, row.end_time))
  }
  for (const row of raw.timeLogsAirtec) {
    if (!row.end_time) continue
    addToMap(airtecHours, toMonthKey(row.start_time), hoursBetween(row.start_time, row.end_time))
  }
  for (const row of raw.timeLogsProduction) {
    if (!row.end_time) continue
    const month = toMonthKey(row.start_time)
    addToMap(productionHours, month, hoursBetween(row.start_time, row.end_time))
    const qty = Number(row.production_quantity) || 0
    if (qty > 0) addToMap(productionPieces, month, qty)
  }
  for (const row of raw.consumption) {
    addToMap(giConsumption, toMonthKey(row.scan_date), Number(row.quantity) || 0)
  }
  for (const row of raw.kpiHistory) {
    const month = toMonthKey(row.snapshot_date)
    if (!month) continue
    addToMap(giOverdueSum, month, Number(row.overdue_cases) || 0)
    addToMap(giOverdueCount, month, 1)
  }
  for (const row of raw.caseArchive) {
    const month = toMonthKey(row.removed_at)
    const lt = Number(row.doorlooptijd_dagen)
    if (!month || !Number.isFinite(lt)) continue
    addToMap(giLeadSum, month, lt)
    addToMap(giLeadCount, month, 1)
  }
  for (const row of raw.productControles) {
    const month = toMonthKey(row.controle_datum)
    if (!month) continue
    addToMap(qualityTotal, month, 1)
    if (row.status === 'afgekeurd') addToMap(qualityReject, month, 1)
  }
  for (const row of raw.scanLog) {
    const month = toMonthKey(row.scanned_at)
    if (!month) continue
    addToMap(scanTotal, month, 1)
    if (row.result === 'match') addToMap(scanMatch, month, 1)
  }
  for (const row of raw.woodConsumption) {
    addToMap(woodUse, toMonthKey(row.datum_verbruik), Number(row.aantal) || 0)
  }
  for (const row of raw.woodCorrections) {
    addToMap(woodCorr, toMonthKey(row.created_at), 1)
  }
  for (const row of raw.forecastChanges) {
    addToMap(forecastCh, toMonthKey(row.changed_at), 1)
  }
  for (const row of raw.employeeStatus) {
    const month = toMonthKey(row.date)
    if (!month) continue
    addToMap(empTotal, month, 1)
    if (row.status === 'aanwezig') addToMap(empPresent, month, 1)
  }

  const giOverdueAvg: MonthMap = new Map()
  for (const month of months) {
    const sum = giOverdueSum.get(month)
    const cnt = giOverdueCount.get(month)
    if (sum != null && cnt) giOverdueAvg.set(month, sum / cnt)
  }

  const giLeadAvg: MonthMap = new Map()
  for (const month of months) {
    const sum = giLeadSum.get(month)
    const cnt = giLeadCount.get(month)
    if (sum != null && cnt) giLeadAvg.set(month, sum / cnt)
  }

  const prepackItemsPerHour: MonthMap = new Map()
  const airtecItemsPerHour: MonthMap = new Map()
  const prodHoursPerPiece: MonthMap = new Map()
  const inflowRatio: MonthMap = new Map()

  for (const month of months) {
    const ph = prepackHours.get(month) || 0
    const pi = prepackItems.get(month) || 0
    if (ph > 0) prepackItemsPerHour.set(month, pi / ph)

    const ah = airtecHours.get(month) || 0
    const ai = airtecItems.get(month) || 0
    if (ah > 0) airtecItemsPerHour.set(month, ai / ah)

    const prh = productionHours.get(month) || 0
    const prp = productionPieces.get(month) || 0
    if (prp > 0) prodHoursPerPiece.set(month, prh / prp)

    const inc = prepackIncoming.get(month) || 0
    if (pi > 0) inflowRatio.set(month, inc / pi)
  }

  return {
    prepackItems,
    airtecItems,
    prepackHours,
    airtecHours,
    prepackIncoming,
    prepackItemsPerHour,
    airtecItemsPerHour,
    productionPieces,
    prodHoursPerPiece,
    giConsumption,
    giOverdueAvg,
    giLeadAvg,
    qualityReject,
    qualityTotal,
    scanMatch,
    scanTotal,
    woodUse,
    woodCorr,
    forecastCh,
    empPresent,
    empTotal,
    inflowRatio,
  }
}

function buildKpiResult(
  def: GroeiplanKpiDefinition,
  months: string[],
  series: MonthlyPoint[]
): KpiAnalysisResult {
  const { trend, trendPct, peak, trough } = analyzeTrend(series)
  const dataQualityNotes = collectQualityNotes(series, def)
  return {
    definition: def,
    series,
    trend,
    trendPct,
    peak,
    trough,
    interpretation: buildInterpretation(def, series, trend, trendPct, peak, trough),
    forecast: def.readiness === 'needs_data' ? 'Geen projectie mogelijk zonder databron.' : buildForecast(series, trend),
    dataQualityNotes,
    effectiveReadiness: effectiveReadiness(def, series, dataQualityNotes),
  }
}

function emptySeries(months: string[]): MonthlyPoint[] {
  return months.map((month) => ({
    month,
    value: null,
    dataQuality: 'missing' as const,
    note: 'Geen databron geconfigureerd',
  }))
}

export async function computeGroeiplanKpiReport(): Promise<GroeiplanKpiReport> {
  const months = listMonths(GROEIPLAN_REPORT_START)
  const reportEnd = months[months.length - 1] || GROEIPLAN_REPORT_START

  let agg: ReturnType<typeof aggregateRawData>
  const raw = await loadRawData(GROEIPLAN_REPORT_START)
  agg = aggregateRawData(raw, months)

  const kpis: KpiAnalysisResult[] = GROEIPLAN_KPIS.map((def) => {
    if (def.readiness === 'needs_data') {
      return buildKpiResult(def, months, emptySeries(months))
    }

    let series: MonthlyPoint[]
    switch (def.id) {
      case 'prepack_items':
        series = buildSeries(months, agg.prepackItems)
        break
      case 'airtec_items':
        series = buildSeries(months, agg.airtecItems)
        break
      case 'grote_inpak_consumption':
        series = buildSeries(months, agg.giConsumption)
        break
      case 'production_pieces':
        series = buildSeries(months, agg.productionPieces)
        break
      case 'prepack_items_per_hour':
        series = buildSeries(months, agg.prepackItemsPerHour)
        break
      case 'airtec_items_per_hour':
        series = buildSeries(months, agg.airtecItemsPerHour)
        break
      case 'production_hours_per_piece':
        series = buildSeries(months, agg.prodHoursPerPiece)
        break
      case 'prepack_manhours':
        series = buildSeries(months, agg.prepackHours)
        break
      case 'airtec_manhours':
        series = buildSeries(months, agg.airtecHours)
        break
      case 'employee_attendance':
        series = pctSeries(months, agg.empPresent, agg.empTotal)
        break
      case 'prepack_incoming':
        series = buildSeries(months, agg.prepackIncoming)
        break
      case 'prepack_inflow_vs_packed':
        series = buildSeries(months, agg.inflowRatio)
        break
      case 'grote_inpak_overdue':
        series = buildSeries(months, agg.giOverdueAvg)
        break
      case 'grote_inpak_leadtime':
        series = buildSeries(months, agg.giLeadAvg)
        break
      case 'wood_consumption':
        series = buildSeries(months, agg.woodUse)
        break
      case 'wood_stock_corrections':
        series = buildSeries(months, agg.woodCorr)
        break
      case 'quality_reject_rate':
        series = pctSeries(months, agg.qualityReject, agg.qualityTotal)
        break
      case 'airtec_scan_match':
        series = pctSeries(months, agg.scanMatch, agg.scanTotal)
        break
      case 'forecast_shift_rate':
        series = buildSeries(months, agg.forecastCh)
        break
      default:
        series = emptySeries(months)
    }
    return buildKpiResult(def, months, series)
  })

  const summary = {
    total: kpis.length,
    operational: kpis.filter((k) => k.effectiveReadiness === 'operational').length,
    partial: kpis.filter((k) => k.effectiveReadiness === 'partial').length,
    needsData: kpis.filter((k) => k.effectiveReadiness === 'needs_data').length,
    withQualityIssues: kpis.filter((k) => k.dataQualityNotes.length > k.definition.gaps.length).length,
  }

  return {
    generatedAt: new Date().toISOString(),
    reportStart: GROEIPLAN_REPORT_START,
    reportEnd,
    months,
    summary,
    kpis,
  }
}
