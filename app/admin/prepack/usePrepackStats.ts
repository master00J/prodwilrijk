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
  CompareMode,
  DailyStat,
  DetailedItem,
  DetailSortColumn,
  PersonStats,
  Totals,
} from './types'

const toDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toLocalDate = (value: string) => new Date(`${value}T00:00:00`)

export function usePrepackStats(
  dateFromInputRef: React.RefObject<HTMLInputElement | null>,
  dateToInputRef: React.RefObject<HTMLInputElement | null>,
  compareFromInputRef: React.RefObject<HTMLInputElement | null>,
  compareToInputRef: React.RefObject<HTMLInputElement | null>
) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
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
  } | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const initialLoadDone = useRef(false)

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
    handleExportExcel,
    openBomDetail,
    closeBomDetail,
    queueStats,
    queueLoading,
    fetchQueueStats,
    sortColumn,
    sortDir,
    handleSort,
  }
}
