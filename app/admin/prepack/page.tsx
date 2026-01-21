'use client'

import { useState, useEffect, useMemo, ReactNode } from 'react'
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
  itemsPerHour: number
  revenue: number
  incomingItems: number
  fte: number
}

interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerHour: number
  totalDays: number
  totalRevenue: number
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
  date_packed: string
  date_added: string
}

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
  const [collapsedSections, setCollapsedSections] = useState({
    filters: false,
    chartOutput: false,
    chartRevenue: false,
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
        avgManHoursPerDay: 0,
        activeEmployees: 0,
        peakDay: null as DailyStat | null,
        bestProductivityDay: null as DailyStat | null,
      }
    }
    const totalDays = totals.totalDays || 1
    const avgItemsPerDay = totals.totalItemsPacked / totalDays
    const avgRevenuePerDay = totals.totalRevenue / totalDays
    const avgManHoursPerDay = totals.totalManHours / totalDays
    const activeEmployees = personStats.length

    const peakDay = dailyStats.reduce<DailyStat | null>((best, current) => {
      if (!best || current.itemsPacked > best.itemsPacked) return current
      return best
    }, null)

    const bestProductivityDay = dailyStats.reduce<DailyStat | null>((best, current) => {
      if (!best || current.itemsPerHour > best.itemsPerHour) return current
      return best
    }, null)

    return {
      avgItemsPerDay,
      avgRevenuePerDay,
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

  // Set default date range to last 7 days
  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    
    setDateTo(today.toISOString().split('T')[0])
    setDateFrom(lastWeek.toISOString().split('T')[0])
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      })
      
      const response = await fetch(`/api/admin/prepack-stats?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      
      const data = await response.json()
      setDailyStats(data.dailyStats || [])
      setTotals(data.totals || null)
      setPersonStats(data.personStats || [])
      setDetailedItems(data.detailedItems || [])
      setLastUpdated(new Date().toISOString())
    } catch (error) {
      console.error('Error fetching stats:', error)
      alert('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

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
        'Items per uur': stat.itemsPerHour,
        Omzet: stat.revenue,
      }))

      const detailRows = detailedItems.map((item) => ({
        'Datum verpakt': new Date(item.date_packed).toLocaleString('nl-NL'),
        Itemnummer: item.item_number,
        'PO nummer': item.po_number,
        Aantal: item.amount,
        Prijs: item.price,
        Omzet: item.revenue,
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Tot Datum</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchStats}
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
              <div className="text-sm text-gray-600 mb-1">Items per uur</div>
              <div className="text-3xl font-bold text-indigo-700">
                {totals ? totals.averageItemsPerHour.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <div className="text-sm text-gray-600 mb-1">Totale omzet</div>
              <div className="text-3xl font-bold text-amber-700">
                {totals ? formatCurrency(totals.totalRevenue) : '-'}
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
                  ? `${kpiStats.bestProductivityDay.itemsPerHour.toFixed(2)} items/uur`
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
        <CollapsibleCard id="productivity" title="Productiviteit" subtitle="Items per uur">
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
                  formatter={(value: number) => [`${value.toFixed(2)} items/uur`, 'Productiviteit']}
                />
                <Line
                  type="monotone"
                  dataKey="itemsPerHour"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Items/uur"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CollapsibleCard>
      </div>

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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items/Uur</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Omzet</th>
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
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.itemsPerHour.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      €{stat.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
