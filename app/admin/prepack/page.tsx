'use client'

import { useState, useEffect, useMemo, useRef, ReactNode } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerFte: number
  revenue: number
  materialCost: number
  incomingItems: number
  fte: number
}

interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalMaterialCost: number
  totalIncoming: number
  incomingVsPackedRatio: number | null
  avgLeadTimeHours: number | null
  totalFte: number
  avgFtePerDay: number
}

interface PersonStats {
  name: string
  manHours: number
}

interface DetailedItem {
  id: number
  item_number: string
  po_number: string
  amount: number
  price: number
  revenue: number
  materialCostUnit: number
  materialCostTotal: number
  date_packed: string
  date_added: string
}

type CompareMode = 'previous' | 'lastYear' | 'custom'

export default function PrepackMonitorPage() {
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
  const [bomLoading, setBomLoading] = useState(false)
  const [bomError, setBomError] = useState<string | null>(null)
  const [bomDetail, setBomDetail] = useState<any | null>(null)
  const dateFromInputRef = useRef<HTMLInputElement>(null)
  const dateToInputRef = useRef<HTMLInputElement>(null)
  const compareFromInputRef = useRef<HTMLInputElement>(null)
  const compareToInputRef = useRef<HTMLInputElement>(null)
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareMode, setCompareMode] = useState<CompareMode>('previous')
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareEffectiveFrom, setCompareEffectiveFrom] = useState('')
  const [compareEffectiveTo, setCompareEffectiveTo] = useState('')
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
  type SectionKey = keyof typeof collapsedSections

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const CollapsibleCard = ({
    id,
    title,
    subtitle,
    children,
  }: {
    id: SectionKey
    title: string
    subtitle?: string
    children: ReactNode
  }) => {
    const isCollapsed = collapsedSections[id]
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {isCollapsed ? 'Uitklappen' : 'Inklappen'}
          </span>
        </button>
        {!isCollapsed && <div className="mt-4">{children}</div>}
      </div>
    )
  }
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

    const peakDay = dailyStats.reduce<DailyStat | null>((best, current) => {
      if (!best || current.itemsPacked > best.itemsPacked) return current
      return best
    }, null)

    const bestProductivityDay = dailyStats.reduce<DailyStat | null>((best, current) => {
      if (!best || current.itemsPerFte > best.itemsPerFte) return current
      return best
    }, null)

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

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatCurrency = (value: number) =>
    `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })

  const formatLeadTime = (hours: number | null) => {
    if (hours == null) return '-'
    const days = hours / 24
    return `${days.toFixed(1)} dagen`
  }

  const formatSignedNumber = (value: number, digits = 0) => {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    const formatted =
      digits === 0 ? Math.abs(value).toLocaleString('nl-NL') : Math.abs(value).toFixed(digits)
    return `${sign}${formatted}`
  }

  const formatSignedCurrency = (value: number) => {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return `${sign}${formatCurrency(Math.abs(value))}`
  }

  const toDateInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toLocalDate = (value: string) => new Date(`${value}T00:00:00`)

  const getPresetRange = (preset: string) => {
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
  }

  const getCompareRange = (
    fromValue: string,
    toValue: string,
    mode: CompareMode,
    customFrom?: string,
    customTo?: string
  ) => {
    if (!fromValue || !toValue) return null

    if (customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }

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
  }

  // Set default date range to last 7 days
  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)

    const toValue = today.toISOString().split('T')[0]
    const fromValue = lastWeek.toISOString().split('T')[0]

    setDateTo(toValue)
    setDateFrom(fromValue)
    if (dateFromInputRef.current) dateFromInputRef.current.value = fromValue
    if (dateToInputRef.current) dateToInputRef.current.value = toValue
    void handleRefresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchStatsData = async (range: { from: string; to: string }) => {
    const params = new URLSearchParams({
      date_from: range.from,
      date_to: range.to,
    })

    const response = await fetch(`/api/admin/prepack-stats?${params}`)
    if (!response.ok) throw new Error('Failed to fetch stats')

    return response.json()
  }

  const applyMainStats = (data: any) => {
    setDailyStats(data.dailyStats || [])
    setTotals(data.totals || null)
    setPersonStats(data.personStats || [])
    setDetailedItems(data.detailedItems || [])
    setDetailsLimited(Boolean(data.detailsLimited))
    setLastUpdated(new Date().toISOString())
  }

  const applyCompareStats = (data: any) => {
    setCompareDailyStats(data.dailyStats || [])
    setCompareTotals(data.totals || null)
  }

  const handleRefresh = async () => {
    const fromValue = dateFromInputRef.current?.value || dateFrom
    const toValue = dateToInputRef.current?.value || dateTo
    if (!fromValue || !toValue) return
    setDateFrom(fromValue)
    setDateTo(toValue)
    setLoading(true)
    try {
      const mainData = await fetchStatsData({ from: fromValue, to: toValue })
      applyMainStats(mainData)

      if (compareEnabled) {
        const customFrom = compareFromInputRef.current?.value || compareFrom
        const customTo = compareToInputRef.current?.value || compareTo
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
      } else {
        setCompareTotals(null)
        setCompareDailyStats([])
        setCompareEffectiveFrom('')
        setCompareEffectiveTo('')
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      alert('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyPreset = (preset: string) => {
    const range = getPresetRange(preset)
    if (!range) return
    setDateFrom(range.from)
    setDateTo(range.to)
    if (dateFromInputRef.current) dateFromInputRef.current.value = range.from
    if (dateToInputRef.current) dateToInputRef.current.value = range.to
    void handleRefresh()
  }

  const compareSummary = useMemo(() => {
    if (!totals || !compareTotals) return null
    const diff = (current: number, previous: number) => current - previous
    const pct = (current: number, previous: number) =>
      previous === 0 ? null : ((current - previous) / previous) * 100

    return {
      items: {
        diff: diff(totals.totalItemsPacked, compareTotals.totalItemsPacked),
        pct: pct(totals.totalItemsPacked, compareTotals.totalItemsPacked),
      },
      incoming: {
        diff: diff(totals.totalIncoming, compareTotals.totalIncoming),
        pct: pct(totals.totalIncoming, compareTotals.totalIncoming),
      },
      manHours: {
        diff: diff(totals.totalManHours, compareTotals.totalManHours),
        pct: pct(totals.totalManHours, compareTotals.totalManHours),
      },
      revenue: {
        diff: diff(totals.totalRevenue, compareTotals.totalRevenue),
        pct: pct(totals.totalRevenue, compareTotals.totalRevenue),
      },
    }
  }, [totals, compareTotals])

  const compareModeLabel = useMemo(() => {
    if (!compareEnabled) return null
    if ((compareFromInputRef.current?.value || compareFrom) && (compareToInputRef.current?.value || compareTo)) {
      return 'Aangepaste periode'
    }
    if (compareMode === 'previous') return 'Vorige periode'
    if (compareMode === 'lastYear') return 'Zelfde periode vorig jaar'
    return 'Aangepaste periode'
  }, [compareEnabled, compareMode])

  const handleExportExcel = () => {
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
  }

  const openBomDetail = async (itemNumber: string) => {
    setBomLoading(true)
    setBomError(null)
    try {
      const response = await fetch(`/api/production-orders/breakdown?item_number=${encodeURIComponent(itemNumber)}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Fout bij laden BOM detail')
      }
      setBomDetail(data)
    } catch (error: any) {
      setBomError(error.message || 'Fout bij laden BOM detail')
      setBomDetail(null)
    } finally {
      setBomLoading(false)
    }
  }

  const closeBomDetail = () => {
    setBomDetail(null)
    setBomError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link 
          href="/admin" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Terug naar Admin
        </Link>
        <h1 className="text-3xl font-bold">Prepack Flow Monitoring</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
            Periode: {dateFrom || '—'} → {dateTo || '—'}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1">
            Laatste update: {lastUpdated ? formatDateTime(lastUpdated) : '—'}
          </span>
        </div>
      </div>

      {/* Date Filters */}
      <div className="mb-6">
        <CollapsibleCard id="filters" title="Filters & KPI's">
          <div className="mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block mb-2 font-medium">Vanaf Datum</label>
              <input
                type="date"
                ref={dateFromInputRef}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Tot Datum</label>
              <input
                type="date"
                ref={dateToInputRef}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('thisMonth')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Deze maand
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevMonth')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorige maand
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('thisQuarter')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Dit kwartaal
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevQuarter')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorig kwartaal
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('thisYear')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Dit jaar
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('prevYear')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Vorig jaar
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading || !dateFrom || !dateTo}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Laden...' : 'Vernieuwen'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting || dailyStats.length === 0}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {exporting ? 'Exporteren...' : 'Export naar Excel'}
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={compareEnabled}
                  onChange={(e) => setCompareEnabled(e.target.checked)}
                />
                Vergelijking inschakelen
              </label>
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as CompareMode)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!compareEnabled}
              >
                <option value="previous">Vorige periode (zelfde lengte)</option>
                <option value="lastYear">Zelfde periode vorig jaar</option>
                <option value="custom">Aangepaste periode</option>
              </select>
              {compareEnabled && (
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-sm text-gray-600">Vergelijk vanaf</label>
                    <input
                      type="date"
                      ref={compareFromInputRef}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onChange={(e) => setCompareFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Vergelijk tot</label>
                    <input
                      type="date"
                      ref={compareToInputRef}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onChange={(e) => setCompareTo(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Vergelijk toepassen
                  </button>
                </div>
              )}
            </div>

            {compareEnabled && compareTotals && (
              <div className="mt-4 space-y-4">
                <div className="text-sm text-gray-600">
                  Vergelijking: <span className="font-medium text-gray-900">{compareModeLabel}</span>
                  <span className="ml-2 text-gray-500">
                    ({compareEffectiveFrom || '—'} → {compareEffectiveTo || '—'})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Metric</th>
                        <th className="px-4 py-2 text-left font-medium">Huidige periode</th>
                        <th className="px-4 py-2 text-left font-medium">Vergelijking</th>
                        <th className="px-4 py-2 text-left font-medium">Verschil</th>
                        <th className="px-4 py-2 text-left font-medium">% wijziging</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Items verpakt</td>
                        <td className="px-4 py-2 text-gray-900">
                          {totals?.totalItemsPacked.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals?.totalItemsPacked.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.items.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.items.pct == null ? '-' : `${compareSummary.items.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Goederen binnen</td>
                        <td className="px-4 py-2 text-gray-900">
                          {totals?.totalIncoming.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals?.totalIncoming.toLocaleString('nl-NL') ?? '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.incoming.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.incoming.pct == null ? '-' : `${compareSummary.incoming.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Manuren</td>
                        <td className="px-4 py-2 text-gray-900">
                          {totals ? totals.totalManHours.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals ? compareTotals.totalManHours.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedNumber(compareSummary.manHours.diff, 2) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.manHours.pct == null ? '-' : `${compareSummary.manHours.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-900">Omzet</td>
                        <td className="px-4 py-2 text-gray-900">
                          {totals ? formatCurrency(totals.totalRevenue) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareTotals ? formatCurrency(compareTotals.totalRevenue) : '-'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {compareSummary ? formatSignedCurrency(compareSummary.revenue.diff) : '-'}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {compareSummary?.revenue.pct == null ? '-' : `${compareSummary.revenue.pct.toFixed(1)}%`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500">
                  Periode-dagen: huidig {totals?.totalDays ?? 0} · vergelijking {compareTotals?.totalDays ?? 0}
                </div>
              </div>
            )}

            {compareEnabled && compareTotals && (
              <div className="mt-2 text-xs text-gray-500">
                Dagrecords vergelijking: {compareDailyStats.length}
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Goederen binnen</div>
              <div className="text-3xl font-bold text-slate-800">
                {totals ? totals.totalIncoming.toLocaleString('nl-NL') : '-'}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-sm text-gray-600 mb-1">Items verpakt</div>
              <div className="text-3xl font-bold text-blue-700">
                {totals ? totals.totalItemsPacked.toLocaleString('nl-NL') : '-'}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <div className="text-sm text-gray-600 mb-1">Totale manuren</div>
              <div className="text-3xl font-bold text-emerald-700">
                {totals ? totals.totalManHours.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Gem. FTE/dag</div>
              <div className="text-3xl font-bold text-slate-800">
                {totals ? totals.avgFtePerDay.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <div className="text-sm text-gray-600 mb-1">Items/FTE</div>
              <div className="text-3xl font-bold text-indigo-700">
                {totals ? totals.averageItemsPerFte.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <div className="text-sm text-gray-600 mb-1">Totale omzet</div>
              <div className="text-3xl font-bold text-amber-700">
                {totals ? formatCurrency(totals.totalRevenue) : '-'}
              </div>
            </div>
            <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
              <div className="text-sm text-gray-600 mb-1">Totale materiaalkost</div>
              <div className="text-3xl font-bold text-rose-700">
                {totals ? formatCurrency(totals.totalMaterialCost) : '-'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Gem. items per dag</div>
              <div className="text-3xl font-bold text-slate-800">
                {totals ? kpiStats.avgItemsPerDay.toFixed(0) : '-'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="text-sm text-gray-600 mb-1">Binnen vs verpakt</div>
              <div className="text-3xl font-bold text-slate-800">
                {totals && totals.incomingVsPackedRatio != null
                  ? `${totals.incomingVsPackedRatio.toFixed(2)}x`
                  : '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gemiddelde per dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? `${kpiStats.avgManHoursPerDay.toFixed(2)} uur` : '-'}
              </div>
              <div className="text-xs text-gray-500">Manuren per dag</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. FTE per dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? totals.avgFtePerDay.toFixed(2) : '-'}
              </div>
              <div className="text-xs text-gray-500">Ma–Do 8u, Vr 7u</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. materiaalkost/dag</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? formatCurrency(kpiStats.avgMaterialCostPerDay) : '-'}
              </div>
              <div className="text-xs text-gray-500">Op basis van BOM</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Gem. doorlooptijd (werkdagen)</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? formatLeadTime(totals.avgLeadTimeHours) : '-'}
              </div>
              <div className="text-xs text-gray-500">Date added → date packed</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Beste productiviteit</div>
              <div className="text-lg font-semibold text-gray-900">
                {kpiStats.bestProductivityDay
                  ? `${kpiStats.bestProductivityDay.itemsPerFte.toFixed(2)} items/FTE`
                  : '-'}
              </div>
              <div className="text-xs text-gray-500">
                {kpiStats.bestProductivityDay ? formatDate(kpiStats.bestProductivityDay.date) : '-'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Piekvolume</div>
              <div className="text-lg font-semibold text-gray-900">
                {kpiStats.peakDay ? `${kpiStats.peakDay.itemsPacked} items` : '-'}
              </div>
              <div className="text-xs text-gray-500">
                {kpiStats.peakDay ? formatDate(kpiStats.peakDay.date) : '-'}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Actieve medewerkers</div>
              <div className="text-lg font-semibold text-gray-900">
                {totals ? kpiStats.activeEmployees : '-'}
              </div>
              <div className="text-xs text-gray-500">Unieke medewerkers</div>
            </div>
          </div>
        </CollapsibleCard>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <CollapsibleCard
          id="chartOutput"
          title="Output & Manuren"
          subtitle="Items en manuren per dag"
        >
          {loading ? (
            <div className="text-center py-8 text-gray-500">Grafiek laden...</div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'Manuren') {
                      return [`${value.toFixed(2)} uur`, 'Manuren']
                    }
                    if (name === 'FTE') {
                      return [value.toFixed(2), 'FTE']
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="itemsPacked"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Items"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="manHours"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Manuren"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fte"
                  stroke="#0f172a"
                  strokeWidth={2}
                  name="FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>

        <CollapsibleCard id="chartRevenue" title="Omzet trend" subtitle="Dagelijkse omzet">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Grafiek laden...</div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [formatCurrency(value), 'Omzet']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  name="Omzet"
                  dot={{ fill: '#f59e0b', r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard id="chartMaterial" title="Materiaalkost trend" subtitle="Dagelijkse materiaalkost">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Grafiek laden...</div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [formatCurrency(value), 'Materiaalkost']}
                />
                <Line
                  type="monotone"
                  dataKey="materialCost"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  name="Materiaalkost"
                  dot={{ fill: '#f43f5e', r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard id="productivity" title="Productiviteit" subtitle="Items per FTE">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Grafiek laden...</div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number) => [`${value.toFixed(2)} items/FTE`, 'Productiviteit']}
                />
                <Line
                  type="monotone"
                  dataKey="itemsPerFte"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Items/FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <CollapsibleCard
          id="chartIncoming"
          title="Binnengekomen vs verpakt"
          subtitle="Goederen per dag"
        >
          {loading ? (
            <div className="text-center py-8 text-gray-500">Grafiek laden...</div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Geen data gevonden</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                  }
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatDate(value as string)}
                  formatter={(value: number, name: string) => {
                    if (name === 'FTE') {
                      return [value.toFixed(2), 'FTE']
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="incomingItems"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Goederen binnen"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="itemsPacked"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Items verpakt"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fte"
                  stroke="#0f172a"
                  strokeWidth={2}
                  name="FTE"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CollapsibleCard>
      </div>

      {/* Werkende Personen */}
      <div className="mb-6">
        <CollapsibleCard id="people" title="Werkende Personen">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : personStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Persoon</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {personStats.map((stat) => (
                  <tr key={stat.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CollapsibleCard>
      </div>

      {/* Detailed Items List */}
      <div className="mb-6">
        <CollapsibleCard id="details" title="Gedetailleerde Lijst Verpakte Items">
        {detailsLimited && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            Detailtabel is ingeklapt voor deze grote periode. Beperk de periode om details te tonen.
          </div>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Items laden...</div>
          </div>
        ) : detailedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen items gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Itemnummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">PO Nummer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aantal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Prijs</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost/stuk</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">BOM</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.date_packed).toLocaleDateString('nl-NL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.po_number || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.amount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.price > 0 ? `€${item.price.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.revenue > 0 ? `€${item.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.materialCostUnit > 0
                        ? `€${item.materialCostUnit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.materialCostTotal > 0
                        ? `€${item.materialCostTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <button
                        type="button"
                        onClick={() => openBomDetail(item.item_number)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Bekijk
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CollapsibleCard>
      </div>

      {bomDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">BOM detail</div>
                <div className="text-sm text-gray-500">
                  Itemnummer: {bomDetail.item_number}
                </div>
              </div>
              <button
                type="button"
                onClick={closeBomDetail}
                className="text-gray-500 hover:text-gray-700"
              >
                Sluiten
              </button>
            </div>
            <div className="p-4 space-y-6">
              {bomError && <div className="text-sm text-red-600">{bomError}</div>}
              {bomLoading ? (
                <div className="text-sm text-gray-500">Laden...</div>
              ) : (
                bomDetail.lines?.map((line: any) => (
                  <div key={line.line_no || line.description} className="border rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {line.description || '-'} {line.order_number ? `(${line.order_number})` : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          Aantal: {line.quantity} · Kost/stuk: €{Number(line.cost_per_item || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-1 pr-3">Component</th>
                            <th className="py-1 pr-3">Eenheid</th>
                            <th className="py-1 pr-3">Prijs</th>
                            <th className="py-1 pr-3">Aantal</th>
                            <th className="py-1 pr-3">Afmetingen (mm)</th>
                            <th className="py-1 pr-3">Kost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.components?.map((component: any, idx: number) => (
                            <tr key={`${component.component_item_no}-${idx}`} className="border-t">
                              <td className="py-1 pr-3">
                                {component.component_item_no || '-'} {component.description || ''}
                              </td>
                              <td className="py-1 pr-3">{component.unit_of_measure || 'stuks'}</td>
                              <td className="py-1 pr-3">
                                {component.price !== undefined && component.price !== null
                                  ? `€${Number(component.price).toFixed(5)}`
                                  : '-'}
                              </td>
                              <td className="py-1 pr-3">{component.unit_count}</td>
                              <td className="py-1 pr-3">
                                {component.length}×{component.width}×{component.thickness}
                              </td>
                              <td className="py-1 pr-3">€{Number(component.cost || 0).toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Statistics Table */}
      <CollapsibleCard id="daily" title="Dagelijkse Statistieken">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Statistieken laden...</div>
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Geen data gevonden voor de geselecteerde periode
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Goederen binnen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">FTE</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medewerkers</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/FTE</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Materiaalkost</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyStats.map((stat) => (
                  <tr key={stat.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(stat.date).toLocaleDateString('nl-NL', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {stat.incomingItems.toLocaleString('nl-NL')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.itemsPacked}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.fte.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.employeeCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPerFte.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.materialCost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleCard>
    </div>
  )
}
