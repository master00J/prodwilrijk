'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts'

interface PrepackDailyStat {
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

interface PrepackTotals {
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

interface AirtecDailyStat {
  date: string
  itemsPacked: number
  manHours: number
  employeeCount: number
  itemsPerFte: number
  revenue: number
  incomingItems: number
  fte: number
}

interface AirtecTotals {
  totalItemsPacked: number
  totalManHours: number
  averageItemsPerFte: number
  totalDays: number
  totalRevenue: number
  totalIncoming: number
  incomingVsPackedRatio: number | null
  avgLeadTimeHours: number | null
  totalFte: number
  avgFtePerDay: number
}

interface PrepackDetail {
  id: number
  item_number: string
  po_number: string
  amount: number
  revenue: number
  materialCostTotal: number
  date_packed: string
  date_added: string
}

interface AirtecDetail {
  id: number
  kistnummer: string | null
  item_number: string | null
  quantity: number
  revenue: number
  date_packed: string
  date_received: string | null
}

export default function PrepackAirtecOverviewPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prepackDaily, setPrepackDaily] = useState<PrepackDailyStat[]>([])
  const [prepackTotals, setPrepackTotals] = useState<PrepackTotals | null>(null)
  const [prepackDetails, setPrepackDetails] = useState<PrepackDetail[]>([])
  const [airtecDaily, setAirtecDaily] = useState<AirtecDailyStat[]>([])
  const [airtecTotals, setAirtecTotals] = useState<AirtecTotals | null>(null)
  const [airtecDetails, setAirtecDetails] = useState<AirtecDetail[]>([])

  useEffect(() => {
    const today = new Date()
    const lastWeek = new Date(today)
    lastWeek.setDate(today.getDate() - 7)
    setDateTo(today.toISOString().split('T')[0])
    setDateFrom(lastWeek.toISOString().split('T')[0])
  }, [])

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatCurrency = (value: number) =>
    `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatLeadTime = (hours: number | null) => {
    if (hours == null) return '-'
    const days = hours / 24
    return `${days.toFixed(1)} dagen`
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      const [prepackRes, airtecRes] = await Promise.all([
        fetch(`/api/admin/prepack-stats?${params}`),
        fetch(`/api/admin/airtec-stats?${params}`),
      ])

      if (!prepackRes.ok) throw new Error('Prepack stats laden mislukt')
      if (!airtecRes.ok) throw new Error('Airtec stats laden mislukt')

      const prepackData = await prepackRes.json()
      const airtecData = await airtecRes.json()

      setPrepackDaily(prepackData.dailyStats || [])
      setPrepackTotals(prepackData.totals || null)
      setPrepackDetails(prepackData.detailedItems || [])

      setAirtecDaily(airtecData.dailyStats || [])
      setAirtecTotals(airtecData.totals || null)
      setAirtecDetails(airtecData.detailedItems || [])
    } catch (err) {
      console.error('Error fetching combined stats:', err)
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const prepackSummary = useMemo(() => {
    if (!prepackTotals) return null
    return [
      { label: 'Items ingepakt', value: prepackTotals.totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(prepackTotals.totalRevenue) },
      { label: 'Materiaalkost', value: formatCurrency(prepackTotals.totalMaterialCost) },
      { label: 'Manuren', value: prepackTotals.totalManHours.toFixed(1) },
      { label: 'Instroom', value: prepackTotals.totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(prepackTotals.avgLeadTimeHours) },
    ]
  }, [prepackTotals])

  const airtecSummary = useMemo(() => {
    if (!airtecTotals) return null
    return [
      { label: 'Items ingepakt', value: airtecTotals.totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(airtecTotals.totalRevenue) },
      { label: 'Manuren', value: airtecTotals.totalManHours.toFixed(1) },
      { label: 'Instroom', value: airtecTotals.totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(airtecTotals.avgLeadTimeHours) },
    ]
  }, [airtecTotals])

  const combinedSummary = useMemo(() => {
    if (!prepackTotals || !airtecTotals) return null
    const totalItemsPacked = prepackTotals.totalItemsPacked + airtecTotals.totalItemsPacked
    const totalRevenue = prepackTotals.totalRevenue + airtecTotals.totalRevenue
    const totalMaterialCost = prepackTotals.totalMaterialCost
    const totalManHours = prepackTotals.totalManHours + airtecTotals.totalManHours
    const totalIncoming = prepackTotals.totalIncoming + airtecTotals.totalIncoming
    const weightedLeadTimeHours =
      (prepackTotals.avgLeadTimeHours || 0) * prepackTotals.totalItemsPacked +
      (airtecTotals.avgLeadTimeHours || 0) * airtecTotals.totalItemsPacked
    const leadTimeHours =
      totalItemsPacked > 0 ? weightedLeadTimeHours / totalItemsPacked : null

    return [
      { label: 'Items ingepakt', value: totalItemsPacked },
      { label: 'Omzet', value: formatCurrency(totalRevenue) },
      { label: 'Materiaalkost', value: formatCurrency(totalMaterialCost) },
      { label: 'Manuren', value: totalManHours.toFixed(1) },
      { label: 'Instroom', value: totalIncoming },
      { label: 'Gem. doorlooptijd', value: formatLeadTime(leadTimeHours) },
    ]
  }, [prepackTotals, airtecTotals])

  const prepackChartData = useMemo(
    () =>
      prepackDaily.map((row) => ({
        date: formatDate(row.date),
        itemsPacked: row.itemsPacked,
        revenue: row.revenue,
        materialCost: row.materialCost,
      })),
    [prepackDaily]
  )

  const airtecChartData = useMemo(
    () =>
      airtecDaily.map((row) => ({
        date: formatDate(row.date),
        itemsPacked: row.itemsPacked,
        revenue: row.revenue,
      })),
    [airtecDaily]
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Prepack + Airtec overzicht</h1>
          <p className="text-gray-600 mt-1">Gecombineerde details voor beide teams.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/prepack"
            className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm"
          >
            Prepack detail
          </Link>
          <Link
            href="/admin/airtec"
            className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm"
          >
            Airtec detail
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Van</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tot</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:bg-gray-300"
          >
            {loading ? 'Laden...' : 'Vernieuwen'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {combinedSummary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Gezamenlijke KPI&apos;s</h2>
            <span className="text-xs text-gray-500">Prepack + Airtec</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
            {combinedSummary.map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Prepack</h2>
            <span className="text-xs text-gray-500">Totaal & details</span>
          </div>
          {prepackSummary ? (
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {prepackSummary.map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-6">Geen data.</p>
          )}

          <h3 className="text-sm font-semibold mb-2">Dagoverzicht</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-left">Omzet</th>
                  <th className="px-3 py-2 text-left">Materiaalkost</th>
                </tr>
              </thead>
              <tbody>
                {prepackDaily.map((row) => (
                  <tr key={row.date} className="border-b">
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2">{row.itemsPacked}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.materialCost)}</td>
                  </tr>
                ))}
                {prepackDaily.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-gray-500 text-center">
                      Geen data voor deze periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold mb-2">KPI grafiek</h3>
          <div className="h-64">
            {prepackChartData.length === 0 ? (
              <p className="text-sm text-gray-500">Geen data voor grafiek.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prepackChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="itemsPacked" name="Items" fill="#2563eb" />
                  <Line dataKey="revenue" name="Omzet" stroke="#16a34a" strokeWidth={2} />
                  <Line dataKey="materialCost" name="Materiaalkost" stroke="#f97316" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Airtec</h2>
            <span className="text-xs text-gray-500">Totaal & details</span>
          </div>
          {airtecSummary ? (
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {airtecSummary.map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-6">Geen data.</p>
          )}

          <h3 className="text-sm font-semibold mb-2">Dagoverzicht</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Datum</th>
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-left">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {airtecDaily.map((row) => (
                  <tr key={row.date} className="border-b">
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2">{row.itemsPacked}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
                {airtecDaily.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-gray-500 text-center">
                      Geen data voor deze periode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold mb-2">KPI grafiek</h3>
          <div className="h-64">
            {airtecChartData.length === 0 ? (
              <p className="text-sm text-gray-500">Geen data voor grafiek.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={airtecChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="itemsPacked" name="Items" fill="#7c3aed" />
                  <Line dataKey="revenue" name="Omzet" stroke="#16a34a" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
