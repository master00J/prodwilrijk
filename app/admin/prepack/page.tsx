'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
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
}

interface Totals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerHour: number
  totalDays: number
  totalRevenue: number
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
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [personStats, setPersonStats] = useState<PersonStats[]>([])
  const [detailedItems, setDetailedItems] = useState<DetailedItem[]>([])
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
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
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
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
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
            <div className="text-sm text-gray-600 mb-1">Actieve medewerkers</div>
            <div className="text-3xl font-bold text-slate-800">
              {totals ? kpiStats.activeEmployees : '-'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-2">Gemiddelde per dag</div>
            <div className="text-lg font-semibold text-gray-900">
              {totals ? `${kpiStats.avgManHoursPerDay.toFixed(2)} uur` : '-'}
            </div>
            <div className="text-xs text-gray-500">Manuren per dag</div>
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
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Output & Manuren</h2>
            <span className="text-xs text-gray-500">Items en manuren per dag</span>
          </div>
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
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Omzet trend</h2>
            <span className="text-xs text-gray-500">Dagelijkse omzet</span>
          </div>
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Productiviteit</h2>
            <span className="text-xs text-gray-500">Items per uur</span>
          </div>
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
        </div>
      </div>

      {/* Werkende Personen */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Werkende Personen</h2>
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
      </div>

      {/* Detailed Items List */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Gedetailleerde Lijst Verpakte Items</h2>
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
      </div>

      {/* Daily Statistics Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Dagelijkse Statistieken</h2>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items Verpakt</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manuren</th>
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
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.itemsPacked}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{stat.manHours.toFixed(2)}</td>
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
      </div>
    </div>
  )
}
