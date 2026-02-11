'use client'

import React, { useCallback, useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { Euro, Package, Clock, TrendingUp, User, Wrench } from 'lucide-react'

type StepHours = { step: string; hours: number }

type RevenueRun = {
  item_number: string
  order_number: string
  date: string
  quantity: number
  hours: number
  hours_per_piece: number
  steps: StepHours[]
  sales_price: number | null
  revenue: number | null
  material_cost_per_item: number
  material_cost_total: number
  margin: number | null
  description: string | null
}

type ActiveSession = {
  id: number
  employee_name: string
  order_number: string
  item_number: string
  step: string
  elapsed_seconds: number
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
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [expandedRunKey, setExpandedRunKey] = useState<string | null>(null)

  const loadActive = useCallback(async () => {
    try {
      const res = await fetch('/api/production-order-time/active')
      if (!res.ok) return
      const data = await res.json()
      setActiveSessions(Array.isArray(data) ? data : [])
    } catch {
      setActiveSessions([])
    }
  }, [])

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

  useEffect(() => {
    void loadActive()
    const t = setInterval(loadActive, 15000)
    return () => clearInterval(t)
  }, [loadActive])

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}u ${min}min`
  }

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

        {activeSessions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-blue-200">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              Momenteel in productie
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Actieve tijdregistraties (wordt elke 15 sec ververst).
            </p>
            <div className="space-y-3">
              {activeSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 py-3 px-4 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <span className="font-medium">{s.order_number}</span>
                  <span className="text-gray-600">Item: {s.item_number || '–'}</span>
                  <span className="flex items-center gap-1 text-gray-700">
                    <User className="w-4 h-4" />
                    {s.employee_name}
                  </span>
                  <span className="flex items-center gap-1 text-blue-700 font-medium">
                    <Wrench className="w-4 h-4" />
                    {s.step || '–'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Bezig: {formatElapsed(s.elapsed_seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <th className="py-3 pr-4 w-8"></th>
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
                  {filteredRuns.map((r, idx) => {
                    const runKey = `${r.order_number}-${r.item_number}-${r.date}-${idx}`
                    const isExpanded = expandedRunKey === runKey
                    const steps = r.steps ?? []
                    const hasSteps = steps.length > 0
                    return (
                      <React.Fragment key={runKey}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-2">
                            {hasSteps ? (
                              <button
                                type="button"
                                onClick={() => setExpandedRunKey(isExpanded ? null : runKey)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                title={isExpanded ? 'Stappen verbergen' : 'Stappen tonen'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            ) : (
                              <span className="text-gray-300 w-6 inline-block">–</span>
                            )}
                          </td>
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
                        {isExpanded && hasSteps && (
                          <tr key={`${runKey}-steps`} className="bg-gray-50 border-b border-gray-100">
                            <td className="py-2 pr-2"></td>
                            <td colSpan={10} className="py-3 px-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Uren per stap</div>
                              <div className="flex flex-wrap gap-3">
                                {steps.map((s) => (
                                  <span
                                    key={s.step}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
                                  >
                                    <span className="text-gray-700">{s.step}</span>
                                    <span className="font-medium text-gray-900">{formatHours(s.hours)}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
