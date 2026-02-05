'use client'

import { BarChart3, Clock, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type KpiRow = { key: string; hours: number }

type ItemRun = {
  item_number: string
  order_number: string
  date: string
  totalHours: number
  quantity: number
  hoursPerPiece: number
  steps: { step: string; hours: number }[]
}

type OrderDetail = {
  order: { order_number: string; sales_order_number: string | null; uploaded_at: string }
  lines: Array<{
    item_number: string | null
    description: string | null
    quantity: number
    sales_price: number | null
    cost_per_item: number
    total_cost: number
  }>
  materials: Array<{
    item_number: string
    description: string | null
    usage_count: number
    price: number | null
    unit_of_measure: string
  }>
  totals: {
    line_count: number
    component_count: number
    total_material_cost: number
    missing_price_count: number
  }
}

const formatDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const formatHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(2)} u`
}

export default function ProductionOrderKpiPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<KpiRow[]>([])
  const [steps, setSteps] = useState<KpiRow[]>([])
  const [employees, setEmployees] = useState<KpiRow[]>([])
  const [items, setItems] = useState<KpiRow[]>([])
  const [itemRuns, setItemRuns] = useState<ItemRun[]>([])
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showSecondary, setShowSecondary] = useState(false)

  const loadKpi = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      const response = await fetch(`/api/production-order-time/kpi?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch KPI')
      const data = await response.json()
      setOrders(data.orders || [])
      setSteps(data.steps || [])
      setEmployees(data.employees || [])
      setItems(data.items || [])
      setItemRuns(data.itemRuns || [])
    } catch (error) {
      console.error(error)
      alert('KPI laden mislukt')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  const loadOrderDetails = useCallback(async () => {
    setDetailsLoading(true)
    try {
      const response = await fetch('/api/production-order-time/order-details')
      if (!response.ok) throw new Error('Failed to fetch order details')
      const data = await response.json()
      setOrderDetails(data.orders || [])
    } catch (error) {
      console.error(error)
      alert('Orderdetails laden mislukt')
    } finally {
      setDetailsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKpi()
  }, [loadKpi])

  useEffect(() => {
    void loadOrderDetails()
  }, [loadOrderDetails])

  const runsByItem = itemRuns.reduce<Record<string, ItemRun[]>>((acc, run) => {
    const key = run.item_number
    if (!acc[key]) acc[key] = []
    acc[key].push(run)
    return acc
  }, {})

  const totalHours = itemRuns.reduce((s, r) => s + r.totalHours, 0)

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Productie Orders – KPI</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                onClick={loadKpi}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Laden...' : 'Vernieuwen'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI-kaarten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4 text-blue-500" />
              Totaal uren
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{totalHours.toFixed(2)} u</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="w-4 h-4 text-amber-500" />
              Producties
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{itemRuns.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="w-4 h-4 text-green-500" />
              Unieke items
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{Object.keys(runsByItem).length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">Stuks geproduceerd</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">
              {itemRuns.reduce((s, r) => s + r.quantity, 0)}
            </div>
          </div>
        </div>

        {/* Items per productie – vergelijking */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Items per productie – vergelijking</h2>
            <button
              type="button"
              onClick={() => setShowSecondary(!showSecondary)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {showSecondary ? 'Verberg' : 'Toon'} uren per stap/medewerker
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Per item zie je elke productierun (order + datum). Bij meerdere runs kun je de productietijd per stuk
            vergelijken.
          </p>

          {itemRuns.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              Geen productiedata in de geselecteerde periode. Pas de datums aan of voer eerst tijdregistraties uit.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(runsByItem)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([itemNumber, runs]) => {
                  const sortedRuns = [...runs].sort((a, b) => a.date.localeCompare(b.date))
                  return (
                    <div key={itemNumber} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedItem(expandedItem === itemNumber ? null : itemNumber)
                        }
                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
                      >
                        <span className="font-medium">{itemNumber}</span>
                        <span className="text-sm text-gray-500">
                          {runs.length} productie{runs.length !== 1 ? 's' : ''} ·{' '}
                          {formatHours(runs.reduce((s, r) => s + r.totalHours, 0))} totaal
                        </span>
                        <span className="text-gray-400">{expandedItem === itemNumber ? '▼' : '▶'}</span>
                      </button>

                      {expandedItem === itemNumber && (
                        <div className="p-4 border-t border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-500 border-b">
                                  <th className="py-2 pr-4">Order</th>
                                  <th className="py-2 pr-4">Datum</th>
                                  <th className="py-2 pr-4">Uren</th>
                                  <th className="py-2 pr-4">Stuks</th>
                                  <th className="py-2 pr-4 font-medium">Min/stuk</th>
                                  <th className="py-2 pr-4">Vergelijking</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedRuns.map((run, idx) => {
                                  const prev = idx > 0 ? sortedRuns[idx - 1] : null
                                  const diff =
                                    prev != null
                                      ? run.hoursPerPiece - prev.hoursPerPiece
                                      : null
                                  const diffPercent =
                                    prev != null && prev.hoursPerPiece > 0
                                      ? ((run.hoursPerPiece - prev.hoursPerPiece) / prev.hoursPerPiece) * 100
                                      : null
                                  return (
                                    <tr key={`${run.order_number}-${run.date}`} className="border-b last:border-0">
                                      <td className="py-2 pr-4 font-medium">{run.order_number}</td>
                                      <td className="py-2 pr-4">{formatDate(run.date)}</td>
                                      <td className="py-2 pr-4">{run.totalHours.toFixed(2)} u</td>
                                      <td className="py-2 pr-4">{run.quantity}</td>
                                      <td className="py-2 pr-4 font-medium">
                                        {formatHours(run.hoursPerPiece)}
                                      </td>
                                      <td className="py-2 pr-4">
                                        {diff != null && diffPercent != null ? (
                                          <span
                                            className={
                                              diff < 0
                                                ? 'text-green-600 flex items-center gap-1'
                                                : diff > 0
                                                  ? 'text-amber-600 flex items-center gap-1'
                                                  : 'text-gray-500'
                                            }
                                          >
                                            {diff < 0 ? (
                                              <TrendingDown className="w-4 h-4" />
                                            ) : diff > 0 ? (
                                              <TrendingUp className="w-4 h-4" />
                                            ) : null}
                                            {diff < 0 ? '-' : '+'}
                                            {formatHours(Math.abs(diff))} vs {formatDate(prev!.date)} (
                                            {diffPercent >= 0 ? '+' : ''}
                                            {diffPercent.toFixed(0)}%)
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          {runs.some((r) => r.steps.length > 0) && (
                            <details className="mt-4">
                              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                                Uren per stap (eerste run)
                              </summary>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {runs[0]?.steps.map((s) => (
                                  <span
                                    key={s.step}
                                    className="px-2 py-1 bg-gray-100 rounded text-xs"
                                  >
                                    {s.step}: {formatHours(s.hours)}
                                  </span>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {showSecondary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Uren per stap</h2>
              {steps.length === 0 ? (
                <div className="text-sm text-gray-500">Geen data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stap</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Uren</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {steps.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{row.key}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.hours.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Uren per medewerker</h2>
              {employees.length === 0 ? (
                <div className="text-sm text-gray-500">Geen data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Medewerker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Uren</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employees.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{row.key}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.hours.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders met materiaalkosten */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Orders met materiaalkosten</h2>
            <button
              onClick={loadOrderDetails}
              disabled={detailsLoading}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-60"
            >
              {detailsLoading ? 'Laden...' : 'Vernieuwen'}
            </button>
          </div>

          {orderDetails.length === 0 ? (
            <div className="text-sm text-gray-500">
              Geen orders gevonden. Upload productieorders via Admin → Productieorder upload (tijd).
            </div>
          ) : (
            <div className="space-y-4">
              {orderDetails.map((od) => (
                <div key={od.order.order_number} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOrder(expandedOrder === od.order.order_number ? null : od.order.order_number)
                    }
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-medium">{od.order.order_number}</span>
                      {od.order.sales_order_number && (
                        <span className="text-sm text-gray-500">Verkoop: {od.order.sales_order_number}</span>
                      )}
                      <span className="text-sm text-gray-500">
                        {od.totals.line_count} lijnen · € {od.totals.total_material_cost.toFixed(2)} materiaalkost
                      </span>
                      {od.totals.missing_price_count > 0 && (
                        <span className="text-sm text-amber-600">
                          {od.totals.missing_price_count} ontbrekende prijs(en)
                        </span>
                      )}
                    </div>
                    <span className="text-gray-400">{expandedOrder === od.order.order_number ? '▼' : '▶'}</span>
                  </button>

                  {expandedOrder === od.order.order_number && (
                    <div className="p-4 border-t border-gray-200 space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Materiaalkost per lijn</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-2 pr-4">Item</th>
                                <th className="py-2 pr-4">Omschrijving</th>
                                <th className="py-2 pr-4">Aantal</th>
                                <th className="py-2 pr-4">Verkoopprijs</th>
                                <th className="py-2 pr-4">Kost/stuk</th>
                                <th className="py-2 pr-4">Totaal kost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {od.lines.map((line, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="py-2 pr-4 font-medium">{line.item_number || '-'}</td>
                                  <td className="py-2 pr-4">{line.description || '-'}</td>
                                  <td className="py-2 pr-4">{line.quantity}</td>
                                  <td className="py-2 pr-4">
                                    {line.sales_price != null ? `€ ${Number(line.sales_price).toFixed(2)}` : '-'}
                                  </td>
                                  <td className="py-2 pr-4">€ {Number(line.cost_per_item).toFixed(2)}</td>
                                  <td className="py-2 pr-4">€ {Number(line.total_cost).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-2">Grondstoffen</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-2 pr-4">Itemnummer</th>
                                <th className="py-2 pr-4">Omschrijving</th>
                                <th className="py-2 pr-4">Prijs</th>
                                <th className="py-2 pr-4">Eenheid</th>
                                <th className="py-2 pr-4">Gebruik</th>
                              </tr>
                            </thead>
                            <tbody>
                              {od.materials.map((m) => (
                                <tr key={m.item_number} className="border-t">
                                  <td className="py-2 pr-4 font-medium">{m.item_number}</td>
                                  <td className="py-2 pr-4">{m.description || '-'}</td>
                                  <td className="py-2 pr-4">
                                    {m.price !== null ? `€ ${Number(m.price).toFixed(4)}` : '-'}
                                  </td>
                                  <td className="py-2 pr-4">{m.unit_of_measure}</td>
                                  <td className="py-2 pr-4">{m.usage_count}x</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}
