'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { Euro, Package, Clock, TrendingUp } from 'lucide-react'

type RevenueRun = {
  item_number: string
  order_number: string
  date: string
  quantity: number
  hours: number
  hours_per_piece: number
  sales_price: number | null
  revenue: number | null
  material_cost_per_item: number
  material_cost_total: number
  margin: number | null
  description: string | null
}

type RevenueTotals = {
  total_revenue: number
  total_material_cost: number
  total_hours: number
  total_margin: number
}

const formatDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const formatHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(2)} u`
}

const formatEuro = (n: number | null) => (n != null ? `€ ${n.toFixed(2)}` : '–')

export default function ProductionOrderKpiPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [runs, setRuns] = useState<RevenueRun[]>([])
  const [totals, setTotals] = useState<RevenueTotals | null>(null)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      const res = await fetch(`/api/production-order-time/revenue?${params.toString()}`)
      if (!res.ok) throw new Error('Ophalen mislukt')
      const data = await res.json()
      setRuns(data.runs || [])
      setTotals(data.totals || null)
    } catch (e) {
      console.error(e)
      alert('Data laden mislukt')
      setRuns([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRuns = search.trim()
    ? runs.filter(
        (r) =>
          r.item_number.toLowerCase().includes(search.toLowerCase()) ||
          r.order_number.toLowerCase().includes(search.toLowerCase())
      )
    : runs

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-2">Productie – Opbrengsten &amp; kost</h1>
        <p className="text-gray-600 mb-6">
          Overzicht van opbrengsten (verkoop), materiaalkost en gepresteerde uren per productie. Vul datum in en klik op Vernieuwen.
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vanaf</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tot</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <button
                onClick={loadData}
                disabled={loading}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Laden...' : 'Vernieuwen'}
              </button>
            </div>
          </div>
        </div>

        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Euro className="w-4 h-4 text-green-500" />
                Totale opbrengst
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {formatEuro(totals.total_revenue)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Package className="w-4 h-4 text-amber-500" />
                Materiaalkost
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {formatEuro(totals.total_material_cost)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 text-blue-500" />
                Gepresteerde uren
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {totals.total_hours.toFixed(1)} u
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-600">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Marge (opbrengst − materiaal)
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {formatEuro(totals.total_margin)}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold">Detail per productie</h2>
            <input
              type="text"
              placeholder="Zoek op item of order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg w-full sm:w-64"
            />
          </div>

          {loading ? (
            <p className="text-gray-500 py-8 text-center">Laden...</p>
          ) : filteredRuns.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              Geen productiedata in de geselecteerde periode. Stel een datumreeks in en klik op Vernieuwen.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-3 pr-4 font-medium">Datum</th>
                    <th className="py-3 pr-4 font-medium">Order</th>
                    <th className="py-3 pr-4 font-medium">Item</th>
                    <th className="py-3 pr-4 font-medium">Omschrijving</th>
                    <th className="py-3 pr-4 font-medium text-right">Stuks</th>
                    <th className="py-3 pr-4 font-medium text-right">Verkoopprijs</th>
                    <th className="py-3 pr-4 font-medium text-right">Opbrengst</th>
                    <th className="py-3 pr-4 font-medium text-right">Materiaalkost</th>
                    <th className="py-3 pr-4 font-medium text-right">Uren</th>
                    <th className="py-3 pr-4 font-medium text-right">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((r, idx) => (
                    <tr key={`${r.order_number}-${r.item_number}-${r.date}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-4 font-medium">{r.order_number}</td>
                      <td className="py-2 pr-4 font-medium">{r.item_number}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate text-gray-600" title={r.description || ''}>
                        {r.description || '–'}
                      </td>
                      <td className="py-2 pr-4 text-right">{r.quantity}</td>
                      <td className="py-2 pr-4 text-right">{formatEuro(r.sales_price)}</td>
                      <td className="py-2 pr-4 text-right font-medium">{formatEuro(r.revenue)}</td>
                      <td className="py-2 pr-4 text-right">€ {r.material_cost_total.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right">{formatHours(r.hours)}</td>
                      <td className="py-2 pr-4 text-right">
                        <span className={r.margin != null && r.margin < 0 ? 'text-red-600' : 'text-gray-900'}>
                          {formatEuro(r.margin)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
