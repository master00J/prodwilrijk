'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3, Clock, Package, Scissors, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type TabId = 'items' | 'analytics' | 'zaag'

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

type ZaagDay = { date: string; hours: number }

export default function ProductionOrderKpiPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<KpiRow[]>([])
  const [steps, setSteps] = useState<KpiRow[]>([])
  const [employees, setEmployees] = useState<KpiRow[]>([])
  const [items, setItems] = useState<KpiRow[]>([])
  const [itemRuns, setItemRuns] = useState<ItemRun[]>([])
  const [zaagByDate, setZaagByDate] = useState<ZaagDay[]>([])
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showSecondary, setShowSecondary] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('items')
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7' | '30' | '90' | '365'>('30')

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
      setZaagByDate(data.zaagByDate || [])
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

  // Analytics: filter op periode (laatste N dagen)
  const analyticsFiltered = useMemo(() => {
    const days = parseInt(analyticsPeriod, 10)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date(end)
    start.setDate(start.getDate() - days + 1)
    start.setHours(0, 0, 0, 0)
    return itemRuns.filter((r) => {
      const d = new Date(r.date)
      return d >= start && d <= end
    })
  }, [itemRuns, analyticsPeriod])

  const analyticsProductiesPerDag = useMemo(() => {
    const counts = new Map<string, number>()
    analyticsFiltered.forEach((r) => {
      const key = r.date
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: formatDate(date), datum: date, count }))
  }, [analyticsFiltered])

  const analyticsMinPerStukBuckets = useMemo(() => {
    const buckets = { '0-15': 0, '15-30': 0, '30-60': 0, '60+': 0 }
    analyticsFiltered.forEach((r) => {
      const min = r.hoursPerPiece * 60
      if (min <= 15) buckets['0-15']++
      else if (min <= 30) buckets['15-30']++
      else if (min <= 60) buckets['30-60']++
      else buckets['60+']++
    })
    return Object.entries(buckets).map(([range, count]) => ({ range, count }))
  }, [analyticsFiltered])

  const analyticsTopItems = useMemo(() => {
    const byItem = new Map<string, number>()
    analyticsFiltered.forEach((r) => {
      byItem.set(r.item_number, (byItem.get(r.item_number) || 0) + 1)
    })
    return Array.from(byItem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }))
  }, [analyticsFiltered])

  const analyticsSlowest = useMemo(() => {
    return [...analyticsFiltered]
      .sort((a, b) => b.hoursPerPiece - a.hoursPerPiece)
      .slice(0, 5)
  }, [analyticsFiltered])

  const analyticsMetrics = useMemo(() => {
    const total = analyticsFiltered.length
    const totalH = analyticsFiltered.reduce((s, r) => s + r.totalHours, 0)
    const avgMinPerStuk =
      analyticsFiltered.length > 0
        ? analyticsFiltered.reduce((s, r) => s + r.hoursPerPiece * 60, 0) / analyticsFiltered.length
        : 0
    const days = parseInt(analyticsPeriod, 10)
    const throughput = days > 0 ? (total / days) * 7 : 0
    return { total, totalH, avgMinPerStuk, throughput }
  }, [analyticsFiltered, analyticsPeriod])

  const zaagTotal = zaagByDate.reduce((s, d) => s + d.hours, 0)
  const zaagChartData = zaagByDate.map((d) => ({ date: formatDate(d.date), uren: Number(d.hours.toFixed(2)) }))

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Productie Orders – KPI</h1>

        {/* Tabs zoals oude admin */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(
            [
              { id: 'items' as TabId, label: 'Items & vergelijking', icon: Package },
              { id: 'analytics' as TabId, label: 'Order Analytics', icon: BarChart3 },
              { id: 'zaag' as TabId, label: 'Zaag Dashboard', icon: Scissors },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

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

        {/* Items tab */}
        {activeTab === 'items' && (
          <>
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
          </>
        )}

        {/* Analytics tab – zoals oude Order Analytics */}
        {activeTab === 'analytics' && (
          <>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>Inzicht:</strong> Analyseer afgewerkte producties om bottlenecks te ontdekken en je planning te
                verbeteren.
              </p>
            </div>

            <div className="flex gap-2 mb-6">
              <span className="text-sm font-medium text-gray-700 pt-2">Tijdsperiode:</span>
              {(['7', '30', '90', '365'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    analyticsPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Laatste {p} dagen
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Package className="w-4 h-4 text-green-500" />
                  Afgewerkte producties
                </div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{analyticsMetrics.total}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Producties per week
                </div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{analyticsMetrics.throughput.toFixed(1)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Gem. min/stuk
                </div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{analyticsMetrics.avgMinPerStuk.toFixed(0)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">Totale productie uren</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{analyticsMetrics.totalH.toFixed(1)} u</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Producties per dag</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsProductiesPerDag}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#2563eb" name="Producties" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Productietijd per stuk (min)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsMinPerStukBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" name="Aantal" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Top items (meest geproduceerd)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2">#</th>
                        <th className="py-2">Item</th>
                        <th className="py-2">Producties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsTopItems.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-gray-500">
                            Geen gegevens
                          </td>
                        </tr>
                      ) : (
                        analyticsTopItems.map((row, i) => (
                          <tr key={row.item} className="border-b">
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2 font-medium">{row.item}</td>
                            <td className="py-2">{row.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Langste productietijden (min/stuk)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2">Order</th>
                        <th className="py-2">Item</th>
                        <th className="py-2">Min/stuk</th>
                        <th className="py-2">Datum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsSlowest.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-gray-500">
                            Geen gegevens
                          </td>
                        </tr>
                      ) : (
                        analyticsSlowest.map((run) => (
                          <tr key={`${run.order_number}-${run.date}`} className="border-b">
                            <td className="py-2 font-medium">{run.order_number}</td>
                            <td className="py-2">{run.item_number}</td>
                            <td className="py-2">{formatHours(run.hoursPerPiece)}</td>
                            <td className="py-2">{formatDate(run.date)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Belangrijkste inzichten</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                {analyticsFiltered.length === 0 ? (
                  <li>Geen afgewerkte producties binnen de geselecteerde periode.</li>
                ) : (
                  <>
                    <li>
                      Gemiddeld {analyticsMetrics.avgMinPerStuk.toFixed(0)} minuten per stuk in de laatste{' '}
                      {analyticsPeriod} dagen.
                    </li>
                    <li>
                      Totaal {analyticsMetrics.total} producties, {analyticsMetrics.throughput.toFixed(1)} per week.
                    </li>
                    {analyticsSlowest.length > 0 && (
                      <li>
                        Langste run: item {analyticsSlowest[0].item_number} op {formatDate(analyticsSlowest[0].date)} (
                        {formatHours(analyticsSlowest[0].hoursPerPiece)}/stuk).
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </>
        )}

        {/* Zaag tab */}
        {activeTab === 'zaag' && (
          <>
            <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-amber-800">
                <strong>Tip:</strong> Zaaguren komen uit stappen met &quot;zaag&quot; of &quot;zagen&quot; in de naam.
                m³-data is niet beschikbaar in dit systeem.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Scissors className="w-4 h-4 text-amber-600" />
                  Totaal zaaguren
                </div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{zaagTotal.toFixed(1)} u</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">Werkdagen met zaag</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{zaagByDate.length}</div>
              </div>
            </div>

            {zaagByDate.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Geen zaagstatistieken in de geselecteerde periode. Controleer of er tijdregistraties zijn met stappen
                die &quot;zaag&quot; of &quot;zagen&quot; bevatten.
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                  <h3 className="text-lg font-semibold mb-4">Zaaguren per dag</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={zaagChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="uren" stroke="#f59e0b" name="Uren" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Details per werkdag</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-4">Datum</th>
                          <th className="py-2 pr-4">Zaaguren</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zaagByDate.map((d) => (
                          <tr key={d.date} className="border-b">
                            <td className="py-2 pr-4">{formatDate(d.date)}</td>
                            <td className="py-2 pr-4">{d.hours.toFixed(1)} u</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminGuard>
  )
}
