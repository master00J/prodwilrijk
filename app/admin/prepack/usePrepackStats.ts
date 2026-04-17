'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as XLSX from 'xlsx'
import type {
  Aggregation,
  AggregatedStat,
  CompareMode,
  DailyStat,
  DetailedItem,
  DetailSortColumn,
  MissingDataStat,
  PersonStats,
  PrepackTargets,
  TopItemStat,
  Totals,
  WeekdayStat,
} from './types'

const toDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toLocalDate = (value: string) => new Date(`${value}T00:00:00`)

// ISO-week helpers
function getIsoWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (target.getUTCDay() + 6) % 7 // ma=0, zo=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return { year: target.getUTCFullYear(), week }
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // ma=0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfIsoWeek(date: Date): Date {
  const d = startOfIsoWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

function workingDaysBetween(from: Date, to: Date): number {
  let count = 0
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Telt werkdagen in een periode, inclusief zaterdag/zondag wanneer er op die
// weekenddagen effectief activiteit was (items gepakt of manuren geboekt).
// Week loopt zo altijd ma t/m zo, maar lege weekenddagen worden niet meegeteld.
function activeDaysInBucket(
  from: Date,
  to: Date,
  rows: Array<{ date: string; itemsPacked?: number; manHours?: number }>
): number {
  const activeWeekend = new Set<string>()
  for (const r of rows) {
    const d = toLocalDate(r.date)
    const dow = d.getDay()
    const hasActivity = (r.itemsPacked || 0) > 0 || (r.manHours || 0) > 0
    if ((dow === 0 || dow === 6) && hasActivity) activeWeekend.add(r.date)
  }
  let count = 0
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      count++
    } else if (activeWeekend.has(toDateInput(d))) {
      count++
    }
    d.setDate(d.getDate() + 1)
  }
  return count
}

const WEEKDAY_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const LS_KEY_AGGREGATION = 'prepack.aggregation.v1'
const LS_KEY_HOURLY = 'prepack.hourlyRate.v1'
const LS_KEY_TARGETS = 'prepack.targets.v1'

export function usePrepackStats(
  dateFromInputRef: React.RefObject<HTMLInputElement | null>,
  dateToInputRef: React.RefObject<HTMLInputElement | null>,
  compareFromInputRef: React.RefObject<HTMLInputElement | null>,
  compareToInputRef: React.RefObject<HTMLInputElement | null>
) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [silentRefreshing, setSilentRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [personStats, setPersonStats] = useState<PersonStats[]>([])
  const [detailedItems, setDetailedItems] = useState<DetailedItem[]>([])
  const [detailsLimited, setDetailsLimited] = useState(false)
  const [missingCostOnly, setMissingCostOnly] = useState(false)
  const [sortColumn, setSortColumn] = useState<DetailSortColumn | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = useCallback((col: DetailSortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return col
      }
      setSortDir('desc')
      return col
    })
  }, [])
  const [bomLoading, setBomLoading] = useState(false)
  const [bomError, setBomError] = useState<string | null>(null)
  const [bomDetail, setBomDetail] = useState<any | null>(null)
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareMode, setCompareMode] = useState<CompareMode>('selectedDays')
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareEffectiveFrom, setCompareEffectiveFrom] = useState('')
  const [compareEffectiveTo, setCompareEffectiveTo] = useState('')
  const [comparePrimaryTotals, setComparePrimaryTotals] = useState<Totals | null>(null)
  const [compareTotals, setCompareTotals] = useState<Totals | null>(null)
  const [compareDailyStats, setCompareDailyStats] = useState<DailyStat[]>([])
  const [collapsedSections, setCollapsedSections] = useState({
    filters: false,
    chartOutput: false,
    chartRevenue: false,
    chartMaterial: false,
    chartIncoming: false,
    productivity: false,
    people: false,
    details: false,
    daily: false,
    topItems: false,
    weekday: false,
  })
  const [queueStats, setQueueStats] = useState<{
    queueStuks: number
    queueLines: number
    backlogStuks: number
    backlogLines: number
    priorityStuks: number
    oldestWorkingDays: number
    avgLeadTimeDays: number | null
    backlogPct: number
    topCritical?: Array<{
      id: number
      item_number: string | null
      description: string | null
      amount: number
      priority: boolean
      date_added: string
      workingDaysOld: number
    }>
  } | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const initialLoadDone = useRef(false)
  const [aggregation, setAggregation] = useState<Aggregation>('day')
  const [targets, setTargets] = useState<PrepackTargets>({ dailyItems: null, dailyRevenue: null })

  // Hydrate persisted settings
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const a = window.localStorage.getItem(LS_KEY_AGGREGATION)
      if (a === 'day' || a === 'week' || a === 'month') setAggregation(a)
      const t = window.localStorage.getItem(LS_KEY_TARGETS)
      if (t) {
        const parsed = JSON.parse(t)
        setTargets({
          dailyItems:
            typeof parsed?.dailyItems === 'number' && Number.isFinite(parsed.dailyItems)
              ? parsed.dailyItems
              : null,
          dailyRevenue:
            typeof parsed?.dailyRevenue === 'number' && Number.isFinite(parsed.dailyRevenue)
              ? parsed.dailyRevenue
              : null,
        })
      }
    } catch {
      // ignore malformed storage
    }
  }, [])

  const updateAggregation = useCallback((next: Aggregation) => {
    setAggregation(next)
    try {
      window.localStorage.setItem(LS_KEY_AGGREGATION, next)
    } catch {
      // ignore
    }
  }, [])

  const updateTargets = useCallback((patch: Partial<PrepackTargets>) => {
    setTargets((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(LS_KEY_TARGETS, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const fetchStatsData = useCallback(async (range: { from: string; to: string }) => {
    const params = new URLSearchParams({
      date_from: range.from,
      date_to: range.to,
    })
    const response = await fetch(`/api/admin/prepack-stats?${params}`)
    if (!response.ok) throw new Error('Failed to fetch stats')
    return response.json()
  }, [])

  const applyMainStats = useCallback((data: any) => {
    setDailyStats(data.dailyStats || [])
    setTotals(data.totals || null)
    setPersonStats(data.personStats || [])
    setDetailedItems(data.detailedItems || [])
    setDetailsLimited(Boolean(data.detailsLimited))
    setLastUpdated(new Date().toISOString())
  }, [])

  const applyCompareStats = useCallback((data: any) => {
    setCompareDailyStats(data.dailyStats || [])
    setCompareTotals(data.totals || null)
  }, [])

  const getPresetRange = useCallback((preset: string) => {
    const today = new Date()
    if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toDateInput(start), to: toDateInput(today) }
    }
    if (preset === 'prevMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    if (preset === 'thisQuarter') {
      const quarter = Math.floor(today.getMonth() / 3)
      const start = new Date(today.getFullYear(), quarter * 3, 1)
      return { from: toDateInput(start), to: toDateInput(today) }
    }
    if (preset === 'prevQuarter') {
      const quarter = Math.floor(today.getMonth() / 3)
      const startMonth = (quarter - 1) * 3
      const year = startMonth < 0 ? today.getFullYear() - 1 : today.getFullYear()
      const normalizedStart = startMonth < 0 ? 9 : startMonth
      const start = new Date(year, normalizedStart, 1)
      const end = new Date(year, normalizedStart + 3, 0)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    if (preset === 'thisYear') {
      const start = new Date(today.getFullYear(), 0, 1)
      return { from: toDateInput(start), to: toDateInput(today) }
    }
    if (preset === 'prevYear') {
      const start = new Date(today.getFullYear() - 1, 0, 1)
      const end = new Date(today.getFullYear() - 1, 11, 31)
      return { from: toDateInput(start), to: toDateInput(end) }
    }
    return null
  }, [])

  const getCompareRange = useCallback(
    (fromValue: string, toValue: string, mode: CompareMode, customFrom?: string, customTo?: string) => {
      if (!fromValue || !toValue) return null
      if (mode === 'selectedDays') return { from: toValue, to: toValue }
      if (customFrom && customTo) return { from: customFrom, to: customTo }
      const fromDate = toLocalDate(fromValue)
      const toDate = toLocalDate(toValue)
      if (mode === 'previous') {
        const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
        const compareToDate = new Date(fromDate)
        compareToDate.setDate(compareToDate.getDate() - 1)
        const compareFromDate = new Date(compareToDate)
        compareFromDate.setDate(compareFromDate.getDate() - diffDays + 1)
        return { from: toDateInput(compareFromDate), to: toDateInput(compareToDate) }
      }
      if (mode === 'lastYear') {
        const compareFromDate = new Date(fromDate)
        const compareToDate = new Date(toDate)
        compareFromDate.setFullYear(compareFromDate.getFullYear() - 1)
        compareToDate.setFullYear(compareToDate.getFullYear() - 1)
        return { from: toDateInput(compareFromDate), to: toDateInput(compareToDate) }
      }
      return null
    },
    []
  )

  const handleRefresh = useCallback(
    async (initialRange?: { from: string; to: string }) => {
      const fromValue = initialRange?.from ?? dateFromInputRef.current?.value ?? dateFrom
      const toValue = initialRange?.to ?? dateToInputRef.current?.value ?? dateTo
      if (!fromValue || !toValue) return
      setDateFrom(fromValue)
      setDateTo(toValue)
      if (dateFromInputRef.current) dateFromInputRef.current.value = fromValue
      if (dateToInputRef.current) dateToInputRef.current.value = toValue
      setLoading(true)
      try {
        const mainData = await fetchStatsData({ from: fromValue, to: toValue })
        applyMainStats(mainData)
        if (compareEnabled) {
          const customFrom = compareFromInputRef.current?.value ?? compareFrom
          const customTo = compareToInputRef.current?.value ?? compareTo
          if (compareMode === 'selectedDays') {
            // Vergelijk de twee geselecteerde datums (Vergelijk vanaf = dag 1, Vergelijk tot = dag 2)
            if (customFrom && customTo) {
              const [day1Data, day2Data] = await Promise.all([
                fetchStatsData({ from: customFrom, to: customFrom }),
                fetchStatsData({ from: customTo, to: customTo }),
              ])
              setComparePrimaryTotals(day1Data.totals || null)
              setCompareEffectiveFrom(customFrom)
              setCompareEffectiveTo(customTo)
              applyCompareStats(day2Data)
            } else {
              setComparePrimaryTotals(null)
              setCompareTotals(null)
              setCompareDailyStats([])
              setCompareEffectiveFrom('')
              setCompareEffectiveTo('')
            }
          } else {
            const compareRange = getCompareRange(fromValue, toValue, compareMode, customFrom, customTo)
            if (compareRange) {
              if (customFrom && customTo) {
                setCompareFrom(compareRange.from)
                setCompareTo(compareRange.to)
              }
              setCompareEffectiveFrom(compareRange.from)
              setCompareEffectiveTo(compareRange.to)
              const compareData = await fetchStatsData(compareRange)
              applyCompareStats(compareData)
            } else {
              setCompareTotals(null)
              setCompareDailyStats([])
              setCompareEffectiveFrom('')
              setCompareEffectiveTo('')
            }
            setComparePrimaryTotals(null)
          }
        } else {
          setCompareTotals(null)
          setCompareDailyStats([])
          setCompareEffectiveFrom('')
          setCompareEffectiveTo('')
          setComparePrimaryTotals(null)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
        alert('Failed to load statistics')
      } finally {
        setLoading(false)
      }
    },
    [
      compareEnabled,
      compareMode,
      compareFrom,
      compareTo,
      dateFrom,
      dateTo,
      fetchStatsData,
      applyMainStats,
      applyCompareStats,
      getCompareRange,
      dateFromInputRef,
      dateToInputRef,
      compareFromInputRef,
      compareToInputRef,
    ]
  )

  const handleApplyPreset = useCallback(
    (preset: string) => {
      const range = getPresetRange(preset)
      if (!range) return
      setDateFrom(range.from)
      setDateTo(range.to)
      if (dateFromInputRef.current) dateFromInputRef.current.value = range.from
      if (dateToInputRef.current) dateToInputRef.current.value = range.to
      void handleRefresh({ from: range.from, to: range.to })
    },
    [getPresetRange, handleRefresh, dateFromInputRef, dateToInputRef]
  )

  // Compare-presets: primary range + compare range + compareMode (custom)
  const handleApplyComparePreset = useCallback(
    (preset:
      | 'thisWeekVsLastWeek'
      | 'thisMonthVsLastMonth'
      | 'thisMonthVsLastYearSameMonth'
      | 'thisQuarterVsLastQuarter'
      | 'thisYearVsLastYear') => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let primaryFrom: Date
      let primaryTo: Date
      let compFrom: Date
      let compTo: Date
      let aggHint: Aggregation = aggregation

      if (preset === 'thisWeekVsLastWeek') {
        primaryFrom = startOfIsoWeek(today)
        primaryTo = today
        const prevAnchor = new Date(primaryFrom)
        prevAnchor.setDate(prevAnchor.getDate() - 1)
        compFrom = startOfIsoWeek(prevAnchor)
        compTo = endOfIsoWeek(prevAnchor)
        aggHint = 'day'
      } else if (preset === 'thisMonthVsLastMonth') {
        primaryFrom = new Date(today.getFullYear(), today.getMonth(), 1)
        primaryTo = today
        compFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        compTo = new Date(today.getFullYear(), today.getMonth(), 0)
        aggHint = 'week'
      } else if (preset === 'thisMonthVsLastYearSameMonth') {
        primaryFrom = new Date(today.getFullYear(), today.getMonth(), 1)
        primaryTo = today
        compFrom = new Date(today.getFullYear() - 1, today.getMonth(), 1)
        compTo = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0)
        aggHint = 'week'
      } else if (preset === 'thisQuarterVsLastQuarter') {
        const q = Math.floor(today.getMonth() / 3)
        primaryFrom = new Date(today.getFullYear(), q * 3, 1)
        primaryTo = today
        const startMonth = (q - 1) * 3
        const year = startMonth < 0 ? today.getFullYear() - 1 : today.getFullYear()
        const normalized = startMonth < 0 ? 9 : startMonth
        compFrom = new Date(year, normalized, 1)
        compTo = new Date(year, normalized + 3, 0)
        aggHint = 'month'
      } else {
        primaryFrom = new Date(today.getFullYear(), 0, 1)
        primaryTo = today
        compFrom = new Date(today.getFullYear() - 1, 0, 1)
        compTo = new Date(today.getFullYear() - 1, 11, 31)
        aggHint = 'month'
      }

      const pf = toDateInput(primaryFrom)
      const pt = toDateInput(primaryTo)
      const cf = toDateInput(compFrom)
      const ct = toDateInput(compTo)

      setDateFrom(pf)
      setDateTo(pt)
      if (dateFromInputRef.current) dateFromInputRef.current.value = pf
      if (dateToInputRef.current) dateToInputRef.current.value = pt

      setCompareEnabled(true)
      setCompareMode('custom')
      setCompareFrom(cf)
      setCompareTo(ct)
      if (compareFromInputRef.current) compareFromInputRef.current.value = cf
      if (compareToInputRef.current) compareToInputRef.current.value = ct

      updateAggregation(aggHint)
      void handleRefresh({ from: pf, to: pt })
    },
    [
      aggregation,
      handleRefresh,
      updateAggregation,
      dateFromInputRef,
      dateToInputRef,
      compareFromInputRef,
      compareToInputRef,
    ]
  )

  const fetchQueueStats = useCallback(async () => {
    setQueueLoading(true)
    try {
      const res = await fetch('/api/admin/prepack-queue')
      if (res.ok) {
        const data = await res.json()
        setQueueStats(data)
      }
    } catch {
      // non-critical, ignore
    } finally {
      setQueueLoading(false)
    }
  }, [])

  // Stille refresh: alleen data ophalen zonder loading-indicator
  const silentRefresh = useCallback(async () => {
    const fromValue = dateFromInputRef.current?.value ?? dateFrom
    const toValue = dateToInputRef.current?.value ?? dateTo
    if (!fromValue || !toValue) return
    setSilentRefreshing(true)
    try {
      const data = await fetchStatsData({ from: fromValue, to: toValue })
      applyMainStats(data)
    } catch {
      // stil falen — geen melding tonen bij achtergrond-refresh
    } finally {
      setSilentRefreshing(false)
    }
  }, [dateFrom, dateTo, dateFromInputRef, dateToInputRef, fetchStatsData, applyMainStats])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    const toValue = today.toISOString().split('T')[0]
    const fromValue = lastWeek.toISOString().split('T')[0]
    setDateFrom(fromValue)
    setDateTo(toValue)
    if (dateFromInputRef.current) dateFromInputRef.current.value = fromValue
    if (dateToInputRef.current) dateToInputRef.current.value = toValue
    void handleRefresh({ from: fromValue, to: toValue })
    void fetchQueueStats()
  }, [dateFromInputRef, dateToInputRef, handleRefresh, fetchQueueStats])

  // Auto-refresh elke 60s als de geselecteerde periode vandaag bevat
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const rangeIncludesToday = dateTo >= todayStr
    if (!rangeIncludesToday || !dateTo) return

    const interval = setInterval(() => {
      void silentRefresh()
    }, 60_000)

    return () => clearInterval(interval)
  }, [dateTo, silentRefresh])

  const toggleSection = useCallback((key: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const kpiStats = useMemo(() => {
    if (!totals) {
      return {
        avgItemsPerDay: 0,
        avgRevenuePerDay: 0,
        avgMaterialCostPerDay: 0,
        avgManHoursPerDay: 0,
        activeEmployees: 0,
        peakDay: null as DailyStat | null,
        bestProductivityDay: null as DailyStat | null,
      }
    }
    const totalDays = totals.totalDays || 1
    const avgItemsPerDay = totals.totalItemsPacked / totalDays
    const avgRevenuePerDay = totals.totalRevenue / totalDays
    const avgMaterialCostPerDay = totals.totalMaterialCost / totalDays
    const avgManHoursPerDay = totals.totalManHours / totalDays
    const activeEmployees = personStats.length
    const peakDay = dailyStats.reduce<DailyStat | null>(
      (best, current) => (!best || current.itemsPacked > best.itemsPacked ? current : best),
      null
    )
    const bestProductivityDay = dailyStats.reduce<DailyStat | null>(
      (best, current) => (!best || current.itemsPerFte > best.itemsPerFte ? current : best),
      null
    )
    return {
      avgItemsPerDay,
      avgRevenuePerDay,
      avgMaterialCostPerDay,
      avgManHoursPerDay,
      activeEmployees,
      peakDay,
      bestProductivityDay,
    }
  }, [totals, personStats.length, dailyStats])

  const filteredDetailedItems = useMemo(() => {
    let items = detailedItems
    if (missingCostOnly) {
      items = items.filter((item) => {
        const missingPrice = !item.priceFound || item.price <= 0
        const missingUnitCost = !item.materialCostUnit || item.materialCostUnit <= 0
        const missingTotalCost = !item.materialCostTotal || item.materialCostTotal <= 0
        return missingPrice || missingUnitCost || missingTotalCost
      })
    }
    if (!sortColumn) return items
    return [...items].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      let cmp = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal, 'nl-NL')
      } else {
        cmp = (aVal as number) < (bVal as number) ? -1 : (aVal as number) > (bVal as number) ? 1 : 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [detailedItems, missingCostOnly, sortColumn, sortDir])

  const compareSummary = useMemo(() => {
    const baseTotals = compareMode === 'selectedDays' ? comparePrimaryTotals : totals
    if (!baseTotals || !compareTotals) return null
    const diff = (current: number, previous: number) => current - previous
    const pct = (current: number, previous: number) =>
      previous === 0 ? null : ((current - previous) / previous) * 100
    const baseDays = baseTotals.totalDays || 1
    const compDays = compareTotals.totalDays || 1
    const baseMargin = baseTotals.totalRevenue - baseTotals.totalMaterialCost
    const compMargin = compareTotals.totalRevenue - compareTotals.totalMaterialCost
    const baseItemsPerDay = baseTotals.totalItemsPacked / baseDays
    const compItemsPerDay = compareTotals.totalItemsPacked / compDays
    const baseRevPerDay = baseTotals.totalRevenue / baseDays
    const compRevPerDay = compareTotals.totalRevenue / compDays
    return {
      items: {
        diff: diff(baseTotals.totalItemsPacked, compareTotals.totalItemsPacked),
        pct: pct(baseTotals.totalItemsPacked, compareTotals.totalItemsPacked),
      },
      incoming: {
        diff: diff(baseTotals.totalIncoming, compareTotals.totalIncoming),
        pct: pct(baseTotals.totalIncoming, compareTotals.totalIncoming),
      },
      manHours: {
        diff: diff(baseTotals.totalManHours, compareTotals.totalManHours),
        pct: pct(baseTotals.totalManHours, compareTotals.totalManHours),
      },
      revenue: {
        diff: diff(baseTotals.totalRevenue, compareTotals.totalRevenue),
        pct: pct(baseTotals.totalRevenue, compareTotals.totalRevenue),
      },
      material: {
        diff: diff(baseTotals.totalMaterialCost, compareTotals.totalMaterialCost),
        pct: pct(baseTotals.totalMaterialCost, compareTotals.totalMaterialCost),
      },
      margin: {
        diff: diff(baseMargin, compMargin),
        pct: pct(baseMargin, compMargin),
      },
      itemsPerFte: {
        diff: diff(baseTotals.averageItemsPerFte, compareTotals.averageItemsPerFte),
        pct: pct(baseTotals.averageItemsPerFte, compareTotals.averageItemsPerFte),
      },
      itemsPerDay: {
        diff: diff(baseItemsPerDay, compItemsPerDay),
        pct: pct(baseItemsPerDay, compItemsPerDay),
      },
      revenuePerDay: {
        diff: diff(baseRevPerDay, compRevPerDay),
        pct: pct(baseRevPerDay, compRevPerDay),
      },
      leadTime: (() => {
        const a = baseTotals.avgLeadTimeHours
        const b = compareTotals.avgLeadTimeHours
        if (a == null || b == null) return null
        return {
          diff: diff(a, b),
          pct: pct(a, b),
        }
      })(),
    }
  }, [totals, compareTotals, compareMode, comparePrimaryTotals])

  const compareModeLabel = useMemo(() => {
    if (!compareEnabled) return null
    if (compareMode === 'selectedDays') return 'Dag 1 vs Dag 2'
    if (
      (compareFromInputRef.current?.value || compareFrom) &&
      (compareToInputRef.current?.value || compareTo)
    )
      return 'Aangepaste periode'
    if (compareMode === 'previous') return 'Vorige periode'
    if (compareMode === 'lastYear') return 'Zelfde periode vorig jaar'
    return 'Aangepaste periode'
  }, [compareEnabled, compareMode, compareFrom, compareTo, compareFromInputRef, compareToInputRef])

  const formatDate = useCallback(
    (value: string) => new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
    []
  )
  const formatCurrency = useCallback(
    (value: number) =>
      `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    []
  )
  const formatDateTime = useCallback(
    (value: string) => new Date(value).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }),
    []
  )
  const formatLeadTime = useCallback((hours: number | null) => {
    if (hours == null) return '-'
    const days = hours / 24
    return `${days.toFixed(1)} dagen`
  }, [])
  const formatSignedNumber = useCallback((value: number, digits = 0) => {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    const formatted =
      digits === 0 ? Math.abs(value).toLocaleString('nl-NL') : Math.abs(value).toFixed(digits)
    return `${sign}${formatted}`
  }, [])
  const formatSignedCurrency = useCallback(
    (value: number) => {
      const sign = value > 0 ? '+' : value < 0 ? '−' : ''
      return `${sign}${formatCurrency(Math.abs(value))}`
    },
    [formatCurrency]
  )

  // Aggregeert DailyStat[] naar AggregatedStat[] voor week/maand views
  const aggregateStats = useCallback(
    (stats: DailyStat[], agg: Aggregation): AggregatedStat[] => {
      if (agg === 'day') {
        return stats.map<AggregatedStat>((s) => {
          const d = toLocalDate(s.date)
          const dow = d.getDay()
          const hasActivity = (s.itemsPacked || 0) > 0 || (s.manHours || 0) > 0
          // Weekend-dagen tellen als werkdag zodra er effectief gewerkt is
          const workingDaysInBucket = dow === 0 || dow === 6 ? (hasActivity ? 1 : 0) : 1
          return {
            ...s,
            periodStart: s.date,
            periodEnd: s.date,
            periodKey: s.date,
            periodLabel: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
            workingDaysInBucket,
          }
        })
      }

      const buckets = new Map<
        string,
        { key: string; start: Date; end: Date; label: string; rows: DailyStat[] }
      >()

      for (const row of stats) {
        const d = toLocalDate(row.date)
        let key = ''
        let start: Date
        let end: Date
        let label = ''
        if (agg === 'week') {
          const iso = getIsoWeek(d)
          key = `${iso.year}-W${String(iso.week).padStart(2, '0')}`
          start = startOfIsoWeek(d)
          end = endOfIsoWeek(d)
          label = `W${iso.week} • ${start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
        } else {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          start = new Date(d.getFullYear(), d.getMonth(), 1)
          end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          label = start.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
        }
        const existing = buckets.get(key)
        if (existing) existing.rows.push(row)
        else buckets.set(key, { key, start, end, label, rows: [row] })
      }

      const sortedKeys = Array.from(buckets.keys()).sort()
      return sortedKeys.map<AggregatedStat>((key) => {
        const b = buckets.get(key)!
        const sum = b.rows.reduce(
          (acc, r) => {
            acc.itemsPacked += r.itemsPacked || 0
            acc.manHours += r.manHours || 0
            acc.revenue += r.revenue || 0
            acc.materialCost += r.materialCost || 0
            acc.incomingItems += r.incomingItems || 0
            acc.fte += r.fte || 0
            acc.employeeCount = Math.max(acc.employeeCount, r.employeeCount || 0)
            return acc
          },
          {
            itemsPacked: 0,
            manHours: 0,
            revenue: 0,
            materialCost: 0,
            incomingItems: 0,
            fte: 0,
            employeeCount: 0,
          }
        )
        const itemsPerFte = sum.fte > 0 ? sum.itemsPacked / sum.fte : 0
        const workingDaysInBucket = activeDaysInBucket(b.start, b.end, b.rows)
        return {
          date: toDateInput(b.start),
          itemsPacked: sum.itemsPacked,
          manHours: Math.round(sum.manHours * 10) / 10,
          employeeCount: sum.employeeCount,
          itemsPerFte: Math.round(itemsPerFte * 10) / 10,
          revenue: Math.round(sum.revenue * 100) / 100,
          materialCost: Math.round(sum.materialCost * 100) / 100,
          incomingItems: sum.incomingItems,
          fte: Math.round(sum.fte * 100) / 100,
          periodStart: toDateInput(b.start),
          periodEnd: toDateInput(b.end),
          periodKey: b.key,
          periodLabel: b.label,
          workingDaysInBucket,
        }
      })
    },
    []
  )

  const aggregatedStats = useMemo<AggregatedStat[]>(
    () => aggregateStats(dailyStats, aggregation),
    [dailyStats, aggregation, aggregateStats]
  )

  const aggregatedCompareStats = useMemo<AggregatedStat[]>(
    () => aggregateStats(compareDailyStats, aggregation),
    [compareDailyStats, aggregation, aggregateStats]
  )

  // Trend-deltas: pct% verschillen tov de compare-periode, voor badges op KPIs
  const trendDeltas = useMemo(() => {
    const baseTotals = compareMode === 'selectedDays' ? comparePrimaryTotals : totals
    if (!compareEnabled || !baseTotals || !compareTotals) return null
    const pct = (current: number, previous: number) =>
      !previous || !Number.isFinite(previous) ? null : ((current - previous) / previous) * 100
    const baseDays = baseTotals.totalDays || 1
    const compDays = compareTotals.totalDays || 1
    const perDay = (value: number, days: number) => (days > 0 ? value / days : 0)
    const baseMargin = baseTotals.totalRevenue - baseTotals.totalMaterialCost
    const compMargin = compareTotals.totalRevenue - compareTotals.totalMaterialCost
    return {
      items: pct(baseTotals.totalItemsPacked, compareTotals.totalItemsPacked),
      incoming: pct(baseTotals.totalIncoming, compareTotals.totalIncoming),
      manHours: pct(baseTotals.totalManHours, compareTotals.totalManHours),
      revenue: pct(baseTotals.totalRevenue, compareTotals.totalRevenue),
      materialCost: pct(baseTotals.totalMaterialCost, compareTotals.totalMaterialCost),
      margin: pct(baseMargin, compMargin),
      itemsPerFte: pct(baseTotals.averageItemsPerFte, compareTotals.averageItemsPerFte),
      itemsPerDay: pct(
        perDay(baseTotals.totalItemsPacked, baseDays),
        perDay(compareTotals.totalItemsPacked, compDays)
      ),
      revenuePerDay: pct(
        perDay(baseTotals.totalRevenue, baseDays),
        perDay(compareTotals.totalRevenue, compDays)
      ),
    }
  }, [totals, compareTotals, compareMode, comparePrimaryTotals, compareEnabled])

  // Top items op omzet en slechtste marge
  const topItems = useMemo(() => {
    if (!detailedItems.length) return { byRevenue: [] as TopItemStat[], byMargin: [] as TopItemStat[] }
    const map = new Map<string, TopItemStat>()
    for (const it of detailedItems) {
      const key = it.item_number || '—'
      const existing = map.get(key)
      if (existing) {
        existing.totalAmount += it.amount || 0
        existing.totalRevenue += it.revenue || 0
        existing.totalMaterialCost += it.materialCostTotal || 0
        if (!it.priceFound || it.price <= 0) existing.missingPrice = true
      } else {
        map.set(key, {
          item_number: key,
          description: it.description ?? null,
          totalAmount: it.amount || 0,
          totalRevenue: it.revenue || 0,
          totalMaterialCost: it.materialCostTotal || 0,
          grossMargin: 0,
          marginPct: null,
          missingPrice: !it.priceFound || it.price <= 0,
        })
      }
    }
    const arr = Array.from(map.values()).map((row) => {
      const margin = row.totalRevenue - row.totalMaterialCost
      const pct = row.totalRevenue > 0 ? (margin / row.totalRevenue) * 100 : null
      return { ...row, grossMargin: margin, marginPct: pct }
    })
    const byRevenue = [...arr].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10)
    const byMargin = [...arr]
      .filter((r) => r.totalRevenue > 0 && !r.missingPrice && r.marginPct !== null)
      .sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))
      .slice(0, 10)
    return { byRevenue, byMargin }
  }, [detailedItems])

  // Weekdag-patroon uit dailyStats.
  // We tonen alle weekdagen met data (inclusief zaterdag/zondag indien er
  // effectief gewerkt is in het weekend). Dagen zonder data worden niet
  // getoond om ruis te vermijden.
  const weekdayStats = useMemo<WeekdayStat[]>(() => {
    if (!dailyStats.length) return []
    const agg: Record<number, { items: number; hours: number; perFte: number; revenue: number; days: number }> = {}
    for (const s of dailyStats) {
      const d = toLocalDate(s.date)
      const dow = d.getDay()
      const hasActivity =
        (s.itemsPacked || 0) > 0 || (s.manHours || 0) > 0 || (s.revenue || 0) > 0
      // Sla lege weekenddagen over; werkdagen altijd meetellen zodat rustige
      // ma-vr ook zichtbaar blijven als zwak patroon.
      if ((dow === 0 || dow === 6) && !hasActivity) continue
      if (!agg[dow]) agg[dow] = { items: 0, hours: 0, perFte: 0, revenue: 0, days: 0 }
      agg[dow].items += s.itemsPacked || 0
      agg[dow].hours += s.manHours || 0
      agg[dow].perFte += s.itemsPerFte || 0
      agg[dow].revenue += s.revenue || 0
      agg[dow].days += 1
    }
    // Volgorde: ma, di, wo, do, vr, za, zo (alleen buckets die bestaan)
    const order = [1, 2, 3, 4, 5, 6, 0]
    return order
      .filter((dow) => agg[dow])
      .map<WeekdayStat>((dow) => {
        const a = agg[dow]
        const d = a.days || 1
        return {
          weekdayIndex: dow,
          label: WEEKDAY_LABELS[dow],
          avgItemsPacked: Math.round(a.items / d),
          avgManHours: Math.round((a.hours / d) * 10) / 10,
          avgItemsPerFte: Math.round((a.perFte / d) * 10) / 10,
          avgRevenue: Math.round(a.revenue / d),
          daysCounted: a.days,
        }
      })
  }, [dailyStats])

  // Verloren data (ontbrekende prijzen / materiaalkost)
  const missingDataStats = useMemo<MissingDataStat>(() => {
    const totalItemsInPeriod = detailedItems.length
    let itemsWithoutPrice = 0
    let itemsWithoutMaterialCost = 0
    for (const it of detailedItems) {
      if (!it.priceFound || it.price <= 0) itemsWithoutPrice++
      if (!it.materialCostTotal || it.materialCostTotal <= 0) itemsWithoutMaterialCost++
    }
    let estimatedLostRevenueHint: string | null = null
    if (itemsWithoutPrice > 0 && totalItemsInPeriod > itemsWithoutPrice) {
      const withPrice = detailedItems.filter((i) => i.priceFound && i.price > 0)
      if (withPrice.length > 0) {
        const avgPrice =
          withPrice.reduce((s, i) => s + i.price, 0) / withPrice.length
        const missingAmount = detailedItems
          .filter((i) => !i.priceFound || i.price <= 0)
          .reduce((s, i) => s + (i.amount || 0), 0)
        const estimate = avgPrice * missingAmount
        estimatedLostRevenueHint = estimate > 0 ? `±€${Math.round(estimate).toLocaleString('nl-NL')}` : null
      }
    }
    return {
      itemsWithoutPrice,
      itemsWithoutMaterialCost,
      totalItemsInPeriod,
      estimatedLostRevenueHint,
    }
  }, [detailedItems])

  const handleExportExcel = useCallback(() => {
    if (exporting) return
    setExporting(true)
    try {
      const dailyRows = dailyStats.map((stat) => ({
        Datum: formatDate(stat.date),
        'Goederen binnen': stat.incomingItems,
        'Items verpakt': stat.itemsPacked,
        Manuren: stat.manHours,
        FTE: stat.fte,
        Medewerkers: stat.employeeCount,
        'Items per FTE': stat.itemsPerFte,
        Omzet: stat.revenue,
        Materiaalkost: stat.materialCost,
      }))
      const detailRows = detailedItems.map((item) => ({
        'Datum verpakt': new Date(item.date_packed).toLocaleString('nl-NL'),
        Itemnummer: item.item_number,
        'PO nummer': item.po_number,
        Aantal: item.amount,
        Prijs: item.price,
        Omzet: item.revenue,
        'Materiaalkost/stuk': item.materialCostUnit,
        'Materiaalkost totaal': item.materialCostTotal,
        'Datum toegevoegd': item.date_added ? new Date(item.date_added).toLocaleString('nl-NL') : '',
      }))
      const workbook = XLSX.utils.book_new()
      const dailySheet = XLSX.utils.json_to_sheet(dailyRows)
      const detailSheet = XLSX.utils.json_to_sheet(detailRows)
      XLSX.utils.book_append_sheet(workbook, dailySheet, 'Dagelijkse stats')
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Items')
      const filename = `prepack-stats-${dateFrom || 'start'}-tot-${dateTo || 'eind'}.xlsx`
      XLSX.writeFile(workbook, filename)
    } catch (error) {
      console.error('Excel export failed:', error)
      alert('Excel export mislukt')
    } finally {
      setExporting(false)
    }
  }, [exporting, dailyStats, detailedItems, formatDate, dateFrom, dateTo])

  const openBomDetail = useCallback(async (itemNumber: string) => {
    setBomLoading(true)
    setBomError(null)
    try {
      const response = await fetch(
        `/api/production-orders/breakdown?item_number=${encodeURIComponent(itemNumber)}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Fout bij laden BOM detail')
      setBomDetail(data)
    } catch (error: any) {
      setBomError(error.message || 'Fout bij laden BOM detail')
      setBomDetail(null)
    } finally {
      setBomLoading(false)
    }
  }, [])

  const closeBomDetail = useCallback(() => {
    setBomDetail(null)
    setBomError(null)
  }, [])

  return {
    dateFrom,
    dateTo,
    loading,
    silentRefreshing,
    exporting,
    lastUpdated,
    dailyStats,
    totals,
    personStats,
    detailedItems,
    detailsLimited,
    missingCostOnly,
    setMissingCostOnly,
    bomLoading,
    bomError,
    bomDetail,
    compareEnabled,
    setCompareEnabled,
    compareMode,
    setCompareMode,
    compareFrom,
    setCompareFrom,
    compareTo,
    setCompareTo,
    compareEffectiveFrom,
    compareEffectiveTo,
    comparePrimaryTotals,
    compareTotals,
    compareDailyStats,
    collapsedSections,
    toggleSection,
    kpiStats,
    filteredDetailedItems,
    compareSummary,
    compareModeLabel,
    formatDate,
    formatCurrency,
    formatDateTime,
    formatLeadTime,
    formatSignedNumber,
    formatSignedCurrency,
    handleRefresh,
    handleApplyPreset,
    handleApplyComparePreset,
    handleExportExcel,
    openBomDetail,
    closeBomDetail,
    queueStats,
    queueLoading,
    fetchQueueStats,
    sortColumn,
    sortDir,
    handleSort,
    aggregation,
    updateAggregation,
    aggregatedStats,
    aggregatedCompareStats,
    targets,
    updateTargets,
    trendDeltas,
    topItems,
    weekdayStats,
    missingDataStats,
  }
}
